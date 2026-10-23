import type { APIRequestContext, APIResponse } from '@playwright/test';

export class GamesApi {
  constructor(private readonly request: APIRequestContext) {}

  start(roomId: number): Promise<APIResponse> {
    return this.request.post(`/api/games/rooms/${roomId}/start`);
  }

  get(gameId: number): Promise<APIResponse> {
    return this.request.get(`/api/games/${gameId}`);
  }

  finish(gameId: number): Promise<APIResponse> {
    return this.request.post(`/api/games/${gameId}/finish`);
  }
}
