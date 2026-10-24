import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';
import { AuthApi } from '..\\api\\AuthApi';
import { GamesApi } from '..\\api\\GamesApi';
import { LeaderboardApi } from '..\\api\\LeaderboardApi';
import { RoomsApi } from '..\\api\\RoomsApi';
import { newUserData } from '..\\helpers\\test-data';
import type {
  AuthResponse,
  GameResponse,
  RegisterRequest,
  RoomResponse,
  UserResponse,
} from '..\\types\\api';

function apiObjects(request: APIRequestContext) {
  return {
    auth: new AuthApi(request),
    rooms: new RoomsApi(request),
    games: new GamesApi(request),
    leaderboard: new LeaderboardApi(request),
  };
}

export type ApiObjects = ReturnType<typeof apiObjects>;

interface RegisteredUser {
  data: RegisterRequest;
  profile: UserResponse;
}

export interface TestUser extends RegisteredUser {
  api: ApiObjects;
}

export interface AuthenticatedTestUser extends TestUser {
  token: string;
}

interface TrackedRoom {
  id: number;
  owner: TestUser;
}

interface ApiScenario {
  api: ApiObjects;
  registerUser(): Promise<RegisteredUser>;
  createUser(): Promise<AuthenticatedTestUser>;
  apiForToken(token: string): Promise<ApiObjects>;
  trackRoom(host: TestUser, id: number): void;
  createRoom(host: TestUser, name: string): Promise<APIResponse>;
}

async function cleanRoom({ id, owner }: TrackedRoom): Promise<void> {
  const detailsResponse = await owner.api.rooms.details(id);
  if (detailsResponse.status() === 404) {
    const currentResponse = await owner.api.rooms.current();
    expect(currentResponse.status(), `Cleanup: host of deleted room ${id} has no active room`)
      .toBe(204);
    return;
  }
  expect(detailsResponse.status(), `Cleanup: GET /api/rooms/${id}`).toBe(200);
  const room: RoomResponse = await detailsResponse.json();
  expect(room.id, 'Cleanup must target the tracked room').toBe(id);

  if (room.status === 'WAITING') {
    const leaveResponse = await owner.api.rooms.leave(id);
    expect(leaveResponse.status(), `Cleanup: POST /api/rooms/${id}/leave`).toBe(204);
    const deletedResponse = await owner.api.rooms.details(id);
    expect(deletedResponse.status(), `Cleanup: room ${id} must be deleted`).toBe(404);
  } else {
    expect(['PLAYING', 'CLOSED'], `Cleanup: room ${id} has a supported status`)
      .toContain(room.status);
    expect(
      Number.isSafeInteger(room.gameId) && room.gameId !== null && room.gameId > 0,
      `Cleanup: room ${id} must identify its game`,
    ).toBe(true);
    if (room.gameId === null) {
      throw new Error(`Cleanup: room ${id} has no game ID`);
    }

    const gameResponse = await owner.api.games.get(room.gameId);
    expect(gameResponse.status(), `Cleanup: GET /api/games/${room.gameId}`).toBe(200);
    const game: GameResponse = await gameResponse.json();
    expect(game.roomId, 'Cleanup must not finish another room game').toBe(id);

    if (game.status === 'IN_PROGRESS') {
      const finishResponse = await owner.api.games.finish(game.id);
      if (finishResponse.status() === 409) {
        const updatedResponse = await owner.api.games.get(game.id);
        expect(updatedResponse.status(), `Cleanup: re-read game ${game.id}`).toBe(200);
        const updated: GameResponse = await updatedResponse.json();
        expect(updated.roomId, 'Cleanup conflict must refer to the same room').toBe(id);
        expect(updated.status, 'A finish conflict is valid only for an already finished game')
          .toBe('FINISHED');
      } else {
        expect(finishResponse.status(), `Cleanup: POST /api/games/${game.id}/finish`)
          .toBe(200);
        const finished: GameResponse = await finishResponse.json();
        expect(finished.status, `Cleanup: game ${game.id} must be finished`).toBe('FINISHED');
        expect(finished.roomId, 'Cleanup must finish only the tracked room game').toBe(id);
      }
    } else {
      expect(['FINISHED', 'ABANDONED'], `Cleanup: game ${game.id} must be terminal`)
        .toContain(game.status);
    }
  }

  const currentResponse = await owner.api.rooms.current();
  expect(currentResponse.status(), `Cleanup: host of room ${id} has no active room`).toBe(204);
}

export const test = base.extend<{ scenario: ApiScenario }>({
  scenario: async ({ playwright }, use) => {
    const contexts: APIRequestContext[] = [];
    const rooms: TrackedRoom[] = [];

    async function newApi(token?: string): Promise<ApiObjects> {
      const context = await playwright.request.newContext({
        baseURL: process.env.API_BASE_URL || 'http://localhost:8080',
        timeout: 10_000,
        failOnStatusCode: false,
        extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      });
      contexts.push(context);
      return apiObjects(context);
    }

    try {
      const api = await newApi();

      async function registerUser(): Promise<RegisteredUser> {
        const data = newUserData();
        const response = await api.auth.register(data);
        expect(response.status(), 'Setup: POST /auth/register must create a test user').toBe(201);
        const profile: UserResponse = await response.json();
        expect(Number.isSafeInteger(profile.id) && profile.id > 0, 'Setup: valid user ID')
          .toBe(true);
        expect(profile.username, 'Setup: registered username').toBe(data.username);
        expect(profile.email, 'Setup: registered email').toBe(data.email);
        expect(profile.active, 'Setup: test user must be active').toBe(true);
        return { data, profile };
      }

      const scenario: ApiScenario = {
        api,
        registerUser,
        apiForToken: newApi,
        trackRoom(host, id) {
          expect(Number.isSafeInteger(id) && id > 0, 'Track created room ID').toBe(true);
          if (!rooms.some(room => room.id === id)) {
            rooms.push({ id, owner: host });
          }
        },
        async createUser() {
          const user = await registerUser();
          const response = await api.auth.login({
            email: user.data.email,
            password: user.data.password,
          });
          expect(response.status(), 'Setup: POST /auth/login must authenticate the test user')
            .toBe(200);
          const body: AuthResponse = await response.json();
          expect(typeof body.token, 'Setup: login token must be a string').toBe('string');
          expect(body.token.trim().length > 0, 'Setup: login token must not be empty').toBe(true);
          expect(body.username, 'Setup: login must use the intended user').toBe(user.profile.username);
          return { ...user, token: body.token, api: await newApi(body.token) };
        },
        async createRoom(host, name) {
          const response = await host.api.rooms.create({ name });
          // Track successful creation before the scenario can fail its business assertions.
          if (response.ok()) {
            const room: RoomResponse = await response.json();
            scenario.trackRoom(host, room.id);
          }
          return response;
        },
      };

      await use(scenario);
    } finally {
      const cleanupResults = await Promise.allSettled(
        rooms.map(room => base.step(`Clean up room ${room.id}`, () => cleanRoom(room))),
      );
      const disposalResults = await Promise.allSettled(contexts.map(context => context.dispose()));
      const errors: unknown[] = [];
      for (const result of [...cleanupResults, ...disposalResults]) {
        if (result.status === 'rejected') {
          errors.push(result.reason);
        }
      }
      if (errors.length > 0) {
        const details = errors.map(error => error instanceof Error ? error.message : String(error));
        throw new AggregateError(errors, `API fixture teardown failed:\n${details.join('\n')}`);
      }
    }
  },
});

export { expect } from '@playwright/test';
