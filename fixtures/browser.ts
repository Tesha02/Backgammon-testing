import type { BrowserContext, Page } from '@playwright/test';
import { test as base, type AuthenticatedTestUser } from '.\\test';
import { newUserData } from '..\\helpers\\test-data';
import { RegisterPage } from '..\\pages\\RegisterPage';
import { LoginPage } from '..\\pages\\LoginPage';
import { LobbyPage } from '..\\pages\\LobbyPage';
import { WaitingRoomPage } from '..\\pages\\WaitingRoomPage';
import { BoardPage } from '..\\pages\\BoardPage';
import { LeaderboardPage } from '..\\pages\\LeaderboardPage';
import type { RegisterRequest } from '..\\types\\api';

export const test = base.extend<{
  actors: {
    guest(label: string): Promise<Player>;
    authenticated(label: string, user: AuthenticatedTestUser): Promise<Player>;
  };
  players: { a: Player; b: Player };
}>({
  actors: async ({ browser, baseURL, viewport, scenario }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    const players: Player[] = [];
    const errors: unknown[] = [];

    async function createPlayer(label: string, user?: AuthenticatedTestUser): Promise<Player> {
      if (!baseURL) throw new Error('Browser fixture requires a frontend baseURL');
      const context = await browser.newContext({
        baseURL,
        viewport,
        storageState: {
          cookies: [],
          origins: user ? [{
            origin: new URL(baseURL).origin,
            localStorage: [
              { name: 'bg_token', value: user.token },
              { name: 'bg_username', value: user.profile.username },
            ],
          }] : [],
        },
      });
      contexts.push(context);
      const page = await context.newPage();
      const player = {
        label,
        page,
        data: user ? user.data : newUserData(),
        register: new RegisterPage(page),
        login: new LoginPage(page),
        lobby: new LobbyPage(page),
        waiting: new WaitingRoomPage(page),
        board: new BoardPage(page),
        leaderboard: new LeaderboardPage(page),
      };
      players.push(player);
      return player;
    }

    try {
      // Make scenario a dependency so browser evidence is saved before API cleanup.
      void scenario;
      await use({
        guest: label => createPlayer(label),
        authenticated: (label, user) => createPlayer(label, user),
      });
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        const captures = await Promise.allSettled(players.map(async player => {
          const path = testInfo.outputPath(`player-${player.label}.png`);
          await player.page.screenshot({ path, fullPage: true, timeout: 10_000 });
          await testInfo.attach(`Player ${player.label}`, { path, contentType: 'image/png' });
        }));
        for (const result of captures) {
          if (result.status === 'rejected') errors.push(result.reason);
        }
      }
      const closures = await Promise.allSettled(contexts.map(context => context.close()));
      for (const result of closures) {
        if (result.status === 'rejected') errors.push(result.reason);
      }
      if (errors.length > 0) {
        throw new AggregateError(errors, 'Browser evidence or context teardown failed');
      }
    }
  },
  players: async ({ actors }, use) => {
    await use({ a: await actors.guest('A'), b: await actors.guest('B') });
  },
});

interface Player {
  label: string;
  page: Page;
  data: RegisterRequest;
  register: RegisterPage;
  login: LoginPage;
  lobby: LobbyPage;
  waiting: WaitingRoomPage;
  board: BoardPage;
  leaderboard: LeaderboardPage;
}

export { expect } from '@playwright/test';
