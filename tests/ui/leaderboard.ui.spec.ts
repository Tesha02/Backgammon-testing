import { test, expect } from '..\\..\\fixtures\\browser';
import { waitForApiResponse } from '..\\..\\helpers\\ui-response';
import type {
  LeaderboardEntryResponse,
  LeaderboardResponse,
  UserResponse,
} from '..\\..\\types\\api';

test('UI-12 | The leaderboard shows actual rows and the signed-in player rank',
  async ({ actors, scenario }) => {
    const user = await test.step('Prepare an authenticated user without an active room', async () => {
      const user = await scenario.createUser();
      expect((await user.api.rooms.current()).status(), 'Setup: no active room').toBe(204);
      return user;
    });
    const player = await actors.authenticated('Player', user);

    const { leaderboard, me } = await test.step('Open Leaderboard and capture its real GET responses',
      async () => {
        await player.lobby.open();
        await expect(player.lobby.username).toHaveText(user.data.username);
        const pageResponse = waitForApiResponse(player.page, 'GET', '/api/leaderboard');
        const meResponse = waitForApiResponse(player.page, 'GET', '/api/leaderboard/me');
        await player.lobby.openLeaderboard();
        const [pageResult, meResult] = await Promise.all([pageResponse, meResponse]);
        expect(pageResult.status(), 'UI GET /api/leaderboard?page=0&size=20').toBe(200);
        expect(meResult.status(), 'UI GET /api/leaderboard/me').toBe(200);
        const url = new URL(pageResult.url());
        expect(url.searchParams.get('page')).toBe('0');
        expect(url.searchParams.get('size')).toBe('20');
        const leaderboard: LeaderboardResponse = await pageResult.json();
        const me: LeaderboardEntryResponse = await meResult.json();
        expect(leaderboard).toMatchObject({ page: 0, size: 20 });
        expect(me).toMatchObject({ userId: user.profile.id, username: user.data.username });
        return { leaderboard, me };
      });

    await test.step('Compare every rendered row and column with the returned first page', async () => {
      await expect(player.page).toHaveURL(/\/leaderboard$/);
      await expect(player.leaderboard.table).toBeVisible();
      await expect(player.leaderboard.headers).toHaveText(['#', 'Player', 'Rating']);
      await expect(player.leaderboard.rows).toHaveCount(leaderboard.entries.length);
      await expect.poll(() => player.leaderboard.readRows(), {
        message: 'Visible leaderboard rows must match the actual page 0 response',
      }).toEqual(leaderboard.entries.map(({ rank, username, rating }) => ({ rank, username, rating })));
    });

    await test.step('Match the personal rank and rating without assuming a first-page position',
      async () => {
        await expect(player.leaderboard.personalRank)
          .toHaveText(`#${me.rank} \u00b7 ${me.rating}`);
        const response = await user.api.auth.me();
        expect(response.status(), 'GET /auth/me for the displayed personal rating').toBe(200);
        const profile: UserResponse = await response.json();
        expect(profile.id).toBe(user.profile.id);
        expect(me.rating).toBe(profile.rating);
        const ownEntry = leaderboard.entries.find(entry => entry.userId === user.profile.id);
        if (ownEntry) {
          expect(ownEntry).toEqual(me);
          expect(ownEntry.username).toBe(user.data.username);
          expect(ownEntry.rating).toBe(profile.rating);
        } else {
          expect(me.rank, 'A player absent from page 0 must rank below its 20 entries')
            .toBeGreaterThan(20);
        }
      });

    await test.step('Return to the authenticated lobby', async () => {
      await player.leaderboard.backToLobby();
      await expect(player.page).toHaveURL(/\/lobby$/);
      await expect(player.lobby.username).toHaveText(user.data.username);
      await expect(player.lobby.createButton).toBeEnabled();
    });
  });
