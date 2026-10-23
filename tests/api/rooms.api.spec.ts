import { test, expect } from '..\\..\\fixtures\\test';
import { newRoomName } from '..\\..\\helpers\\test-data';
import type {
  ErrorResponse,
  RoomDetailsResponse,
  RoomPlayerResponse,
  RoomResponse,
} from '..\\..\\types\\api';

test('API-06 | Creating a room automatically adds its host', async ({ scenario }) => {
  const host = await test.step('Create an authenticated user with no active room', async () => {
    const host = await scenario.createUser();
    const current = await host.api.rooms.current();
    expect(current.status(), 'A new host must not have an active room').toBe(204);
    return host;
  });
  const name = newRoomName();
  const room = await test.step('Create a uniquely named waiting room', async () => {
    const response = await scenario.createRoom(host, name);
    expect(response.status(), 'POST /api/rooms').toBe(201);
    const room: RoomResponse = await response.json();
    expect(Number.isSafeInteger(room.id) && room.id > 0).toBe(true);
    expect(room.name).toBe(name);
    expect(room.status).toBe('WAITING');
    expect(room.playerCount).toBe(1);
    expect(room.gameId).toBeNull();
    return room;
  });

  await test.step('Verify host membership and the current room', async () => {
    const detailsResponse = await host.api.rooms.details(room.id);
    expect(detailsResponse.status(), `GET /api/rooms/${room.id}`).toBe(200);
    const details: RoomDetailsResponse = await detailsResponse.json();
    expect(details.id).toBe(room.id);
    expect(details.name).toBe(name);
    expect(details.status).toBe('WAITING');
    expect(details.playerCount).toBe(1);
    expect(details.gameId).toBeNull();
    expect(details.players).toHaveLength(1);
    const player = details.players[0];
    expect(player?.roomId).toBe(room.id);
    expect(player?.userId).toBe(host.profile.id);
    expect(player?.username).toBe(host.profile.username);
    expect(player?.host).toBe(true);

    const currentResponse = await host.api.rooms.current();
    expect(currentResponse.status(), 'GET /api/rooms/current for the host').toBe(200);
    const current: RoomResponse = await currentResponse.json();
    expect(current.id).toBe(room.id);
  });
});

test('API-07 | A second player joins as guest without starting the game', async ({ scenario }) => {
  const host = await test.step('Create the host', () => scenario.createUser());
  const guest = await test.step('Create an independent guest', () => scenario.createUser());
  const room = await test.step('Prepare the host waiting room', async () => {
    const response = await scenario.createRoom(host, newRoomName());
    expect(response.status(), 'Setup: create waiting room').toBe(201);
    const room: RoomResponse = await response.json();
    expect(room.status).toBe('WAITING');
    return room;
  });

  await test.step('Join using the guest identity without a request body', async () => {
    const response = await guest.api.rooms.join(room.id);
    expect(response.status(), `POST /api/rooms/${room.id}/join`).toBe(201);
    const membership: RoomPlayerResponse = await response.json();
    expect(Number.isSafeInteger(membership.id) && membership.id > 0).toBe(true);
    expect(membership.roomId).toBe(room.id);
    expect(membership.userId).toBe(guest.profile.id);
    expect(membership.username).toBe(guest.profile.username);
    expect(membership.host).toBe(false);
  });

  await test.step('Verify both memberships and the absence of an automatic start', async () => {
    const response = await host.api.rooms.details(room.id);
    expect(response.status(), `GET /api/rooms/${room.id}`).toBe(200);
    const details: RoomDetailsResponse = await response.json();
    expect(details.id).toBe(room.id);
    expect(details.status).toBe('WAITING');
    expect(details.playerCount).toBe(2);
    expect(details.gameId).toBeNull();
    expect(details.players).toHaveLength(2);
    expect(details.players.map(player => player.userId).sort((a, b) => a - b))
      .toEqual([host.profile.id, guest.profile.id].sort((a, b) => a - b));
    expect(details.players.filter(player => player.host)).toHaveLength(1);
    expect(details.players.find(player => player.userId === host.profile.id)?.host).toBe(true);
    expect(details.players.find(player => player.userId === guest.profile.id)?.host).toBe(false);
    expect(new Set(details.players.map(player => player.id)).size).toBe(2);

    const currentResponse = await guest.api.rooms.current();
    expect(currentResponse.status(), 'GET /api/rooms/current for the guest').toBe(200);
    const current: RoomResponse = await currentResponse.json();
    expect(current.id).toBe(room.id);
  });
});

test('API-08 | A third player cannot join a full waiting room', async ({ scenario }) => {
  const host = await test.step('Create the host', () => scenario.createUser());
  const guest = await test.step('Create the second player', () => scenario.createUser());
  const third = await test.step('Create a third player without an active room', async () => {
    const third = await scenario.createUser();
    const response = await third.api.rooms.current();
    expect(response.status(), 'The third player must not already belong to an active room').toBe(204);
    return third;
  });
  const before = await test.step('Prepare a full room that is still waiting', async () => {
    const createResponse = await scenario.createRoom(host, newRoomName());
    expect(createResponse.status(), 'Setup: create room').toBe(201);
    const room: RoomResponse = await createResponse.json();
    const joinResponse = await guest.api.rooms.join(room.id);
    expect(joinResponse.status(), 'Setup: second player joins').toBe(201);
    const response = await host.api.rooms.details(room.id);
    expect(response.status(), 'Setup: read full room').toBe(200);
    const details: RoomDetailsResponse = await response.json();
    expect(details.status).toBe('WAITING');
    expect(details.playerCount).toBe(2);
    expect(details.gameId).toBeNull();
    expect(details.players).toHaveLength(2);
    expect(details.players.map(player => player.userId).sort((a, b) => a - b))
      .toEqual([host.profile.id, guest.profile.id].sort((a, b) => a - b));
    return details;
  });

  await test.step('Reject the third player because the room is full', async () => {
    const response = await third.api.rooms.join(before.id);
    expect(response.status(), `POST /api/rooms/${before.id}/join for the third player`).toBe(409);
    const body: ErrorResponse = await response.json();
    expect(body.message).toBe('Room is full');
  });

  await test.step('Verify the original memberships and the rejected player current room', async () => {
    const response = await host.api.rooms.details(before.id);
    expect(response.status(), 'Read room after the rejected join').toBe(200);
    const after: RoomDetailsResponse = await response.json();
    expect(after.id).toBe(before.id);
    expect(after.status).toBe('WAITING');
    expect(after.playerCount).toBe(2);
    expect(after.gameId).toBeNull();
    expect(after.players).toHaveLength(2);
    expect([...after.players].sort((a, b) => a.userId - b.userId))
      .toEqual([...before.players].sort((a, b) => a.userId - b.userId));

    const currentResponse = await third.api.rooms.current();
    expect(currentResponse.status(), 'Rejected third player must have no current room').toBe(204);
    expect((await currentResponse.body()).length, 'HTTP 204 must have an empty body').toBe(0);
  });
});
