import type { Page } from '@playwright/test';

export class LeaderboardPage {
  constructor(private readonly page: Page) {}

  get personalRank() { return this.page.locator('.my-rank-value'); }
  get table() { return this.page.getByRole('table'); }
  get headers() { return this.table.getByRole('columnheader'); }
  get rows() { return this.table.locator('tbody tr'); }

  async readRows() {
    return this.rows.evaluateAll(rows => rows.map(row => {
      const [rank, username, rating] = Array.from(row.querySelectorAll('td'),
        cell => cell.textContent?.trim());
      if (!rank || !username || !rating ||
          !Number.isSafeInteger(Number(rank)) || !Number.isSafeInteger(Number(rating))) {
        throw new Error('Expected a leaderboard row with rank, player and integer rating');
      }
      return { rank: Number(rank), username, rating: Number(rating) };
    }));
  }

  async backToLobby(): Promise<void> {
    await this.page.getByRole('button', { name: 'Back to lobby', exact: true }).click();
  }
}
