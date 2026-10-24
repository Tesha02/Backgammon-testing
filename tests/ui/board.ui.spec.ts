import { test, expect } from '..\\..\\fixtures\\browser';
import { newRoomName } from '..\\..\\helpers\\test-data';
import type { GameResponse, RoomResponse, UserResponse } from '..\\..\\types\\api';

test('UI-11 | Cancelling forfeiture leaves the match and both statistics unchanged',
  async ({ actors, scenario }) => {
    const host = await test.step('Prepare the host account', () => scenario.createUser());
    const guest = await test.step('Prepare the guest account', () => scenario.createUser());
    const { room, game } = await test.step('Prepare a two-player game through the API', async () => {
      const roomResponse = await scenario.createRoom(host, newRoomName());
      expect(roomResponse.status(), 'Setup: create room').toBe(201);
      const room: RoomResponse = await roomResponse.json();
      expect((await guest.api.rooms.join(room.id)).status(), 'Setup: guest joins').toBe(201);
      const response = await host.api.games.start(room.id);
      expect(response.status(), `Setup: start game in room ${room.id}`).toBe(201);
      const game: GameResponse = await response.json();
      expect(game).toMatchObject({ roomId: room.id, status: 'IN_PROGRESS', finishedAt: null });
      return { room, game };
    });
    const before = await test.step('Snapshot both players statistics before the UI action',
      () => Promise.all([host, guest].map(async user => {
        const response = await user.api.auth.me();
        expect(response.status(), `Setup: statistics for user ${user.profile.id}`).toBe(200);
        const profile: UserResponse = await response.json();
        expect(profile.id).toBe(user.profile.id);
        return { user, profile };
      })));
    const hostUi = await actors.authenticated('Host', host);
    const guestUi = await actors.authenticated('Guest', guest);

    await test.step('Show the same active game in two independent browsers', async () => {
      expect(hostUi.page.context()).not.toBe(guestUi.page.context());
      for (const player of [hostUi, guestUi]) {
        await player.board.open(game.id);
        await player.board.waitUntilReady();
        await expect(player.board.playerNames).toHaveCount(2);
        for (const username of [host.data.username, guest.data.username]) {
          await expect(player.board.playerNames.filter({ hasText: username })).toBeVisible();
        }
        await expect(player.board.result).toHaveCount(0);
      }
    });

    await test.step('Read the real forfeiture warning and cancel instead of confirming', async () => {
      await hostUi.board.openForfeit();
      await expect(hostUi.board.forfeitDialog).toContainText('Your opponent will win');
      await expect(hostUi.board.forfeitDialog).toContainText('your rating will decrease');
      await expect(hostUi.board.forfeitDialog).toContainText('a loss will be added to your record.');
      await hostUi.board.cancelForfeit();
      await expect(hostUi.board.forfeitDialog).toBeHidden();
    });

    await test.step('Keep both boards open without a result dialog', async () => {
      for (const player of [hostUi, guestUi]) {
        await expect(player.page).toHaveURL(url =>
          url.pathname === '/board' && url.searchParams.get('gameId') === String(game.id));
        await player.board.waitUntilReady();
        await expect(player.board.result).toHaveCount(0);
      }
    });

    await test.step('Keep the game active, both memberships and exact pre-cancel statistics',
      async () => {
        const response = await host.api.games.get(game.id);
        expect(response.status(), `GET /api/games/${game.id} after Cancel`).toBe(200);
        const after: GameResponse = await response.json();
        expect(after).toMatchObject({
          id: game.id, roomId: room.id, status: 'IN_PROGRESS', finishedAt: null,
        });
        for (const { user, profile } of before) {
          const currentResponse = await user.api.rooms.current();
          expect(currentResponse.status(), `Active room for user ${user.profile.id}`).toBe(200);
          const current: RoomResponse = await currentResponse.json();
          expect(current).toMatchObject({
            id: room.id, status: 'PLAYING', playerCount: 2, gameId: game.id,
          });
          const profileResponse = await user.api.auth.me();
          expect(profileResponse.status(), `Unchanged statistics for user ${user.profile.id}`)
            .toBe(200);
          const updated: UserResponse = await profileResponse.json();
          expect(updated).toMatchObject({
            id: profile.id, rating: profile.rating, wins: profile.wins, losses: profile.losses,
          });
        }
      });
  });
