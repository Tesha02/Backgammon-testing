import { test, expect } from '..\\..\\fixtures\\browser';
import { newRoomName } from '..\\..\\helpers\\test-data';
import type { RoomResponse } from '..\\..\\types\\api';

test('UI-06 | Room creation rejects a name containing only spaces',
  async ({ actors, scenario }) => {
    const user = await test.step('Prepare a user without an active room', async () => {
      const user = await scenario.createUser();
      expect((await user.api.rooms.current()).status(), 'Setup: no active room').toBe(204);
      return user;
    });
    const player = await actors.authenticated('Player', user);

    await test.step('Submit a spaces-only room name in the create modal', async () => {
      await player.lobby.open();
      await expect(player.lobby.username).toHaveText(user.data.username);
      await player.lobby.openCreateRoom();
      await player.lobby.fillRoomName('   ');
      await player.lobby.submitCreateRoom();
    });

    await test.step('Show the trim-validation error without creating a room', async () => {
      await expect(player.lobby.error).toHaveText('Room name is required.');
      await expect(player.page).toHaveURL(/\/lobby$/);
      await expect(player.lobby.createModal).toBeVisible();
      await expect(player.lobby.activeRoom).toHaveCount(0);
      expect((await user.api.rooms.current()).status(), 'GET /api/rooms/current after rejection')
        .toBe(204);
    });
  });

test('UI-07 | Creating a room opens the host waiting room', async ({ actors, scenario }) => {
  const host = await test.step('Prepare an authenticated host without a room', async () => {
    const host = await scenario.createUser();
    expect((await host.api.rooms.current()).status(), 'Setup: no active room').toBe(204);
    return host;
  });
  const player = await actors.authenticated('Host', host);
  const name = newRoomName();

  const room = await test.step('Create a uniquely named room through the lobby modal', async () => {
    await player.lobby.open();
    const response = await player.lobby.createRoom(name);
    expect(response.status(), 'UI POST /api/rooms').toBe(201);
    const room: RoomResponse = await response.json();
    scenario.trackRoom(host, room.id);
    expect(room).toMatchObject({ name, status: 'WAITING', playerCount: 1, gameId: null });
    return room;
  });

  await test.step('Display the room name, occupancy, host identity and waiting message',
    async () => {
      await expect(player.page).toHaveURL(new RegExp(`/room/${room.id}$`));
      await expect(player.waiting.card).toContainText(`${name} (1/2 players)`);
      await expect(player.waiting.player(host.data.username)).toContainText(host.data.username);
      await expect(player.waiting.player(host.data.username)).toContainText('(host)');
      await expect(player.waiting.waitingForPlayer).toBeVisible();
      await expect(player.waiting.startButton).toHaveCount(0);
    });
});
