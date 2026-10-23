import type { APIRequestContext, APIResponse } from '@playwright/test';

export class LeaderboardApi {
  constructor(private readonly request: APIRequestContext) {}

  list(page: number, size: number): Promise<APIResponse> {
    return this.request.get('/api/leaderboard', { params: { page, size } });
  }
}
