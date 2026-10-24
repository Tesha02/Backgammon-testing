import type { APIRequestContext, APIResponse } from '@playwright/test';

export class LeaderboardApi {
  constructor(private readonly request: APIRequestContext) {}

  me(): Promise<APIResponse> {
    return this.request.get('/api/leaderboard/me');
  }

  list(page: number, size: number): Promise<APIResponse> {
    return this.request.get('/api/leaderboard', { params: { page, size } });
  }
}
