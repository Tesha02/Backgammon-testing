import { test, expect } from '..\\..\\fixtures\\test';
import { newRoomName } from '..\\..\\helpers\\test-data';
import type { ErrorResponse, RoomDetailsResponse, RoomResponse } from '..\\..\\types\\api';

test('API-09 | A guest cannot start the game', async ({ scenario }) => {
  const host = await test.step('Create the host', () => scenario.createUser());
  const guest = await test.step('Create the guest', () => scenario.createUser());
  const room = await test.step('Prepare a waiting room with two players', async () => {
    const createResponse = await scenario.createRoom(host, newRoomName());
    expect(createResponse.status(), 'Setup: create room').toBe(201);
    const room: RoomResponse = await createResponse.json();
    const joinResponse = await guest.api.rooms.join(room.id);
    expect(joinResponse.status(), 'Setup: guest joins').toBe(201);
    const response = await host.api.rooms.details(room.id);
    expect(response.status(), 'Setup: read room details').toBe(200);
    const details: RoomDetailsResponse = await response.json();
    expect(details.status).toBe('WAITING');
    expect(details.playerCount).toBe(2);
    expect(details.gameId).toBeNull();
    expect(details.players).toHaveLength(2);
    expect(details.players.find(player => player.userId === host.profile.id)?.host).toBe(true);
    expect(details.players.find(player => player.userId === guest.profile.id)?.host).toBe(false);
    return room;
  });

  await test.step('Reject the guest start request with the host-only error', async () => {
    const response = await guest.api.games.start(room.id);
    expect(response.status(), `POST /api/games/rooms/${room.id}/start as guest`).toBe(403);
    const body: ErrorResponse = await response.json();
    expect(body.message).toBe('Only the host can start the game');
  });

  await test.step('Verify the room remains waiting without a game', async () => {
    const response = await host.api.rooms.details(room.id);
    expect(response.status(), 'Read room after the rejected start').toBe(200);
    const details: RoomDetailsResponse = await response.json();
    expect(details.id).toBe(room.id);
    expect(details.status).toBe('WAITING');
    expect(details.playerCount).toBe(2);
    expect(details.gameId).toBeNull();
  });
});
