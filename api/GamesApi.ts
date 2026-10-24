import type { APIRequestContext, APIResponse } from '@playwright/test';

export class GamesApi {
  constructor(private readonly request: APIRequestContext) {}

  start(roomId: number): Promise<APIResponse> {
    return this.request.post(`/api/games/rooms/${roomId}/start`);
  }

  get(gameId: number): Promise<APIResponse> {
    return this.request.get(`/api/games/${gameId}`);
  }

  players(gameId: number): Promise<APIResponse> {
    return this.request.get(`/api/games/${gameId}/players`);
  }

  legalMoves(gameId: number): Promise<APIResponse> {
    return this.request.get(`/api/games/${gameId}/legal-moves`);
  }

  moves(gameId: number): Promise<APIResponse> {
    return this.request.get(`/api/games/${gameId}/moves`);
  }

  finish(gameId: number): Promise<APIResponse> {
    return this.request.post(`/api/games/${gameId}/finish`);
  }
}
