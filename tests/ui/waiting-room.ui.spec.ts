import { test, expect } from '..\\..\\fixtures\\browser';
import { newRoomName } from '..\\..\\helpers\\test-data';
import type { RoomDetailsResponse, RoomResponse } from '..\\..\\types\\api';

test('UI-08 | Only the host can start after a second player joins',
  async ({ actors, scenario }) => {
    const host = await test.step('Prepare the host account', () => scenario.createUser());
    const guest = await test.step('Prepare an independent guest account', () => scenario.createUser());
    const room = await test.step('Prepare a waiting room with only its host', async () => {
      const response = await scenario.createRoom(host, newRoomName());
      expect(response.status(), 'Setup: create host room').toBe(201);
      const room: RoomResponse = await response.json();
      expect(room).toMatchObject({ status: 'WAITING', playerCount: 1, gameId: null });
      return room;
    });
    const hostUi = await actors.authenticated('Host', host);
    const guestUi = await actors.authenticated('Guest', guest);
    expect(hostUi.page.context()).not.toBe(guestUi.page.context());

    await test.step('With one player the host has no Start game button', async () => {
      await hostUi.waiting.open(room.id);
      await expect(hostUi.waiting.card).toContainText(`${room.name} (1/2 players)`);
      await expect(hostUi.waiting.player(host.data.username)).toContainText('(host)');
      await expect(hostUi.waiting.waitingForPlayer).toBeVisible();
      await expect(hostUi.waiting.startButton).toHaveCount(0);
    });

    await test.step('Join the guest through API preparation and open the same waiting room',
      async () => {
        const response = await guest.api.rooms.join(room.id);
        expect(response.status(), `Setup: POST /api/rooms/${room.id}/join`).toBe(201);
        await guestUi.waiting.open(room.id);
      });

    await test.step('Refresh both visible rosters and enable Start game only for the host',
      async () => {
        for (const player of [hostUi, guestUi]) {
          await expect(player.page).toHaveURL(new RegExp(`/room/${room.id}$`));
          await expect(player.waiting.card).toContainText(`${room.name} (2/2 players)`);
          await expect(player.waiting.player(host.data.username)).toContainText('(host)');
          await expect(player.waiting.player(guest.data.username)).toBeVisible();
        }
        await expect(hostUi.waiting.startButton).toBeVisible();
        await expect(hostUi.waiting.startButton).toBeEnabled();
        await expect(guestUi.waiting.waitingForHost).toBeVisible();
        await expect(guestUi.waiting.startButton).toHaveCount(0);
        const response = await host.api.rooms.details(room.id);
        expect(response.status(), `GET /api/rooms/${room.id}`).toBe(200);
        const details: RoomDetailsResponse = await response.json();
        expect(details).toMatchObject({ id: room.id, status: 'WAITING', playerCount: 2, gameId: null });
      });
  });

test('UI-09 | The guest can leave while the host keeps the waiting room',
  async ({ actors, scenario }) => {
    const host = await test.step('Prepare the host account', () => scenario.createUser());
    const guest = await test.step('Prepare the guest account', () => scenario.createUser());
    const room = await test.step('Prepare a waiting room with both players', async () => {
      const response = await scenario.createRoom(host, newRoomName());
      expect(response.status(), 'Setup: create room').toBe(201);
      const room: RoomResponse = await response.json();
      expect((await guest.api.rooms.join(room.id)).status(), 'Setup: guest joins').toBe(201);
      return room;
    });
    const hostUi = await actors.authenticated('Host', host);
    const guestUi = await actors.authenticated('Guest', guest);

    await test.step('Show both players in their separate waiting-room browsers', async () => {
      expect(hostUi.page.context()).not.toBe(guestUi.page.context());
      for (const player of [hostUi, guestUi]) {
        await player.waiting.open(room.id);
        await expect(player.waiting.card).toContainText(`${room.name} (2/2 players)`);
        await expect(player.waiting.player(host.data.username)).toBeVisible();
        await expect(player.waiting.player(guest.data.username)).toBeVisible();
      }
      await expect(hostUi.waiting.startButton).toBeEnabled();
    });

    await test.step('Leave through the guest UI and update the host without reloading', async () => {
      expect((await guestUi.waiting.leave(room.id)).status(), 'UI guest leave').toBe(204);
      await expect(guestUi.page).toHaveURL(/\/lobby$/);
      await expect(guestUi.lobby.username).toHaveText(guest.data.username);
      await expect(guestUi.lobby.createButton).toBeEnabled();
      await expect(hostUi.page).toHaveURL(new RegExp(`/room/${room.id}$`));
      await expect(hostUi.waiting.card).toContainText(`${room.name} (1/2 players)`);
      await expect(hostUi.waiting.player(host.data.username)).toContainText('(host)');
      await expect(hostUi.waiting.player(guest.data.username)).toHaveCount(0);
      await expect(hostUi.waiting.startButton).toHaveCount(0);
      await expect(hostUi.waiting.waitingForPlayer).toBeVisible();
    });

    await test.step('Keep only the host membership and do not create a game', async () => {
      const response = await host.api.rooms.details(room.id);
      expect(response.status(), `GET /api/rooms/${room.id} after guest leave`).toBe(200);
      const details: RoomDetailsResponse = await response.json();
      expect(details).toMatchObject({ id: room.id, status: 'WAITING', playerCount: 1, gameId: null });
      expect(details.players).toHaveLength(1);
      expect(details.players[0]).toMatchObject({ userId: host.profile.id, host: true });
      expect((await guest.api.rooms.current()).status(), 'Guest has no active room').toBe(204);
      const currentResponse = await host.api.rooms.current();
      expect(currentResponse.status(), 'Host still has an active room').toBe(200);
      const current: RoomResponse = await currentResponse.json();
      expect(current.id).toBe(room.id);
    });
  });

test('UI-10 | The host cancels the waiting room for both players',
  async ({ actors, scenario }) => {
    const host = await test.step('Prepare the host account', () => scenario.createUser());
    const guest = await test.step('Prepare the guest account', () => scenario.createUser());
    const room = await test.step('Prepare a waiting room with host and guest', async () => {
      const response = await scenario.createRoom(host, newRoomName());
      expect(response.status(), 'Setup: create room').toBe(201);
      const room: RoomResponse = await response.json();
      expect((await guest.api.rooms.join(room.id)).status(), 'Setup: guest joins').toBe(201);
      return room;
    });
    const hostUi = await actors.authenticated('Host', host);
    const guestUi = await actors.authenticated('Guest', guest);

    await test.step('Open the populated waiting room in separate browser contexts', async () => {
      expect(hostUi.page.context()).not.toBe(guestUi.page.context());
      for (const player of [hostUi, guestUi]) {
        await player.waiting.open(room.id);
        await expect(player.waiting.card).toContainText(`${room.name} (2/2 players)`);
        await expect(player.waiting.player(host.data.username)).toBeVisible();
        await expect(player.waiting.player(guest.data.username)).toBeVisible();
      }
    });

    await test.step('Leave as host and return both browsers to the lobby without guest reload',
      async () => {
        expect((await hostUi.waiting.leave(room.id)).status(), 'UI host leave').toBe(204);
        for (const player of [hostUi, guestUi]) {
          await expect(player.page).toHaveURL(/\/lobby$/);
          await expect(player.lobby.username).toHaveText(player.data.username);
          await expect(player.lobby.createButton).toBeEnabled();
          await expect(player.lobby.activeRoom).toHaveCount(0);
        }
      });

    await test.step('Remove the room and both active memberships', async () => {
      expect((await host.api.rooms.current()).status(), 'Host has no active room').toBe(204);
      expect((await guest.api.rooms.current()).status(), 'Guest has no active room').toBe(204);
      expect((await host.api.rooms.details(room.id)).status(), 'Cancelled room details').toBe(404);
      const response = await host.api.rooms.list();
      expect(response.status(), 'GET /api/rooms after host leave').toBe(200);
      const waitingRooms: RoomResponse[] = await response.json();
      expect(waitingRooms.map(waiting => waiting.id)).not.toContain(room.id);
    });
  });
