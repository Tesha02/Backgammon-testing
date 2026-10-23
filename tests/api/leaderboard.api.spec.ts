import { test, expect } from '..\\..\\fixtures\\test';
import type { LeaderboardResponse } from '..\\..\\types\\api';

function verifyPage(body: LeaderboardResponse, page: number, size: number): void {
  expect(body.page, 'Requested page index').toBe(page);
  expect(body.size, 'Requested page size').toBe(size);
  expect(Number.isSafeInteger(body.totalElements), 'Total elements must be an integer').toBe(true);
  expect(body.totalElements, 'At least three active users were prepared').toBeGreaterThanOrEqual(3);
  expect(body.totalPages, 'Total pages must match the total elements and page size')
    .toBe(Math.ceil(body.totalElements / size));
  expect(Array.isArray(body.entries), 'Leaderboard entries must be an array').toBe(true);
  expect(body.entries, 'Page length must match the available data')
    .toHaveLength(Math.min(size, Math.max(0, body.totalElements - page * size)));
}

test('API-10 | Leaderboard returns sorted and paginated entries', async ({ scenario }) => {
  const user = await test.step('Prepare at least three independent active users', async () => {
    const user = await scenario.createUser();
    await scenario.registerUser();
    await scenario.registerUser();
    return user;
  });
  const size = 2;

  const first = await test.step('Read and verify page zero with size two', async () => {
    const response = await user.api.leaderboard.list(0, size);
    expect(response.status(), 'GET /api/leaderboard?page=0&size=2').toBe(200);
    const body: LeaderboardResponse = await response.json();
    verifyPage(body, 0, size);
    return body;
  });
  const second = await test.step('Read and verify page one with the same page size', async () => {
    const response = await user.api.leaderboard.list(1, size);
    expect(response.status(), 'GET /api/leaderboard?page=1&size=2').toBe(200);
    const body: LeaderboardResponse = await response.json();
    verifyPage(body, 1, size);
    expect(body.totalElements, 'Total users must be consistent between the two requests')
      .toBe(first.totalElements);
    expect(body.totalPages).toBe(first.totalPages);
    return body;
  });

  await test.step('Verify order, consecutive ranks and the boundary between pages', async () => {
    const entries = [...first.entries, ...second.entries];
    expect(new Set(entries.map(entry => entry.userId)).size, 'Pages must not repeat users')
      .toBe(entries.length);

    for (const [index, entry] of entries.entries()) {
      expect(entry.rank, 'Ranks must start at one and continue across pages').toBe(index + 1);
      expect(Number.isSafeInteger(entry.userId) && entry.userId > 0, 'Valid ranked user ID')
        .toBe(true);
      expect(typeof entry.username, 'Ranked username must be a string').toBe('string');
      expect(entry.username.trim().length, 'Ranked username must not be empty').toBeGreaterThan(0);
      expect(Number.isSafeInteger(entry.rating), 'Rating must be an integer').toBe(true);

      const previous = entries[index - 1];
      if (previous) {
        expect(entry.rating, 'Rating must be sorted in descending order')
          .toBeLessThanOrEqual(previous.rating);
        if (entry.rating === previous.rating) {
          expect(entry.userId, 'Equal ratings must be sorted by ascending user ID')
            .toBeGreaterThan(previous.userId);
        }
      }
    }
  });
});
