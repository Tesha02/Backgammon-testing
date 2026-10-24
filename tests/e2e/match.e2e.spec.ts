import type { APIResponse, Response } from '@playwright/test';
import { test, expect } from '..\\..\\fixtures\\browser';
import type { TestUser } from '..\\..\\fixtures\\test';
import { newRoomName } from '..\\..\\helpers\\test-data';
import type { BoardPage } from '..\\..\\pages\\BoardPage';
import type {
  AuthResponse,
  GamePlayerResponse,
  GameResponse,
  GameState,
  LeaderboardEntryResponse,
  LegalMoveResponse,
  MoveResponse,
  RoomDetailsResponse,
  RoomResponse,
  UserResponse,
} from '..\\..\\types\\api';

async function read<T>(response: APIResponse | Response, status: number): Promise<T> {
  expect(response.status(), new URL(response.url()).pathname)
    .toBe(status);
  return response.json();
}

async function expectBoard(board: BoardPage, state: GameState, player: string): Promise<void> {
  expect([state.whiteBar, state.blackBar, state.whiteOff, state.blackOff],
    'The first move from the standard position must keep every checker on the points')
    .toEqual([0, 0, 0, 0]);
  await expect.poll(async () => {
    const rendered = await board.readBoard();
    return {
      points: rendered.points.slice(1),
      white: rendered.checkers.filter(checker => checker.color === 'WHITE').length,
      black: rendered.checkers.filter(checker => checker.color === 'BLACK').length,
      flying: rendered.checkers.filter(checker => checker.flying).length,
    };
  }, { message: `Player ${player}: visible board must match the committed game state` }).toEqual({
    points: state.points.slice(1), white: 15, black: 15, flying: 0,
  });
}

test('E2E-01: two players register, play a move and finish by forfeiture with updated ratings',
  async ({ players: { a, b }, scenario }) => {
    async function registerAndLogin(player: typeof a): Promise<TestUser> {
      await player.register.open();
      const registered = await read<UserResponse>(await player.register.register(player.data), 201);
      await expect(player.page).toHaveURL(/\/login(?:\?|$)/);
      await expect(player.login.registrationNotice).toBeVisible();
      const login = await read<AuthResponse>(await player.login.login(player.data), 200);
      expect(typeof login.token === 'string' && login.token.trim().length > 0,
        `Player ${player.label}: UI login must provide a nonempty token`).toBe(true);
      expect(login.username).toBe(player.data.username);
      expect(login.email).toBe(player.data.email);
      const api = await scenario.apiForToken(login.token);
      const profile = await read<UserResponse>(await api.auth.me(), 200);
      expect(profile).toMatchObject({
        id: registered.id,
        username: player.data.username,
        email: player.data.email,
        role: 'USER',
        active: true,
        rating: 1000,
        wins: 0,
        losses: 0,
      });
      expect(Number.isSafeInteger(profile.id) && profile.id > 0).toBe(true);
      await expect(player.page).toHaveURL(/\/lobby$/);
      await expect(player.lobby.username).toHaveText(player.data.username);
      return { data: player.data, profile, api };
    }

    const host = await test.step('Player A registers and logs in through the UI',
      () => registerAndLogin(a));
    const guest = await test.step('Player B registers and logs in in a separate browser context',
      () => registerAndLogin(b));

    expect(a.page.context()).not.toBe(b.page.context());
    expect(host.profile.id).not.toBe(guest.profile.id);
    for (const player of [a, b]) {
      expect(await player.page.evaluate(() => localStorage.getItem('bg_username')))
        .toBe(player.data.username);
    }

    const room = await test.step('Player A creates a uniquely named waiting room through the UI',
      async () => {
        const name = newRoomName();
        const response = await a.lobby.createRoom(name);
        const created = await read<RoomResponse>(response, 201);
        scenario.trackRoom(host, created.id);
        expect(created).toMatchObject({ name, status: 'WAITING', playerCount: 1, gameId: null });
        await expect(a.page).toHaveURL(new RegExp(`/room/${created.id}$`));
        await expect(a.waiting.card).toContainText(`${name} (1/2 players)`);
        await expect(a.waiting.startButton).toHaveCount(0);
        return created;
      });

    await test.step('Player B joins that exact room; both players wait for the host to start',
      async () => {
        expect((await b.lobby.joinRoom(room.name, room.id)).status()).toBe(201);
        for (const player of [a, b]) {
          await expect(player.page).toHaveURL(new RegExp(`/room/${room.id}$`));
          await expect(player.waiting.card).toContainText(`${room.name} (2/2 players)`);
          await expect(player.waiting.card).toContainText(host.data.username);
          await expect(player.waiting.card).toContainText(guest.data.username);
        }
        await expect(a.waiting.startButton).toBeEnabled();
        await expect(b.waiting.startButton).toHaveCount(0);
        const details = await read<RoomDetailsResponse>(await host.api.rooms.details(room.id), 200);
        expect(details).toMatchObject({ id: room.id, status: 'WAITING', gameId: null, playerCount: 2 });
        expect(details.players).toHaveLength(2);
        expect(details.players).toEqual(expect.arrayContaining([
          expect.objectContaining({ userId: host.profile.id, host: true }),
          expect.objectContaining({ userId: guest.profile.id, host: false }),
        ]));
      });

    const started = await test.step('Player A starts the match; both browsers show the same game',
      async () => {
        const game = await read<GameResponse>(await a.waiting.startGame(room.id), 201);
        expect(game).toMatchObject({ roomId: room.id, status: 'IN_PROGRESS', currentTurnUserId: null });
        expect(Number.isSafeInteger(game.id) && game.id > 0).toBe(true);
        for (const player of [a, b]) {
          await expect(player.page).toHaveURL(url =>
            url.pathname === '/board' && url.searchParams.get('gameId') === String(game.id));
          await player.board.waitUntilReady();
          await expect(player.board.playerNames).toHaveCount(2);
          await expect(player.page.locator('.toolbar')).toContainText(host.data.username);
          await expect(player.page.locator('.toolbar')).toContainText(guest.data.username);
        }
        return game;
      });

    const gamePlayers = await read<GamePlayerResponse[]>(
      await host.api.games.players(started.id), 200);
    expect(gamePlayers).toHaveLength(2);
    expect(gamePlayers.map(player => player.userId).sort((x, y) => x - y))
      .toEqual([host.profile.id, guest.profile.id].sort((x, y) => x - y));
    expect(gamePlayers.map(player => player.color).sort()).toEqual(['BLACK', 'WHITE']);
    expect(gamePlayers.every(player => player.gameId === started.id && !player.winner)).toBe(true);
    const white = gamePlayers.find(player => player.color === 'WHITE');
    const black = gamePlayers.find(player => player.color === 'BLACK');
    if (!white || !black) throw new Error(`Game ${started.id}: both player colors are required`);
    for (const player of [a, b]) {
      await expect(player.board.playerNames).toContainText([white.username, black.username]);
    }

    const opening = await test.step('Both players roll through the UI until the opening is resolved',
      async () => {
        let game = started;
        for (let round = 1; round <= 10; round++) {
          for (const player of [a, b]) {
            if (game.currentTurnUserId !== null) return game;
            const userId = player.label === 'A' ? host.profile.id : guest.profile.id;
            const identity = gamePlayers.find(item => item.userId === userId);
            if (!identity) throw new Error(`Player ${player.label} is missing from game ${game.id}`);
            const die = identity.color === 'WHITE' ? game.openingWhiteDie : game.openingBlackDie;
            if (die === null) {
              game = await test.step(`Opening round ${round}: player ${player.label} rolls`,
                async () => read<GameResponse>(await player.board.roll(game.id), 200));
              expect(game.id).toBe(started.id);
            }
          }
          if (game.currentTurnUserId !== null) return game;
          expect([game.openingWhiteDie, game.openingBlackDie],
            'A tied opening must reset both dice before the next round').toEqual([null, null]);
        }
        throw new Error(`Game ${game.id}: opening unresolved after 10 rounds; ` +
          JSON.stringify({
            currentTurnUserId: game.currentTurnUserId,
            whiteDie: game.openingWhiteDie,
            blackDie: game.openingBlackDie,
          }));
      });

    expect([host.profile.id, guest.profile.id]).toContain(opening.currentTurnUserId);
    const active = opening.currentTurnUserId === host.profile.id ? a : b;
    const activeUser = active.label === 'A' ? host : guest;
    const activeGamePlayer = gamePlayers.find(player => player.userId === activeUser.profile.id);
    if (!activeGamePlayer) throw new Error(`Game ${started.id}: starting player is missing`);

    await test.step(`Player ${active.label} plays a legal UI move; both visible boards synchronize`,
      async () => {
        let game = opening;
        if (game.currentState.dice.length === 0) {
          game = await test.step('Current UI requires another roll after the opening',
            async () => read<GameResponse>(await active.board.roll(game.id), 200));
        }
        expect(game.currentTurnUserId).toBe(activeUser.profile.id);
        expect(game.currentState.dice.length).toBeGreaterThan(0);
        const legal = await read<LegalMoveResponse[]>(
          await activeUser.api.games.legalMoves(game.id), 200);
        expect(legal.length, 'The standard opening board must offer a real move').toBeGreaterThan(0);
        const move = legal[0];
        if (!move) throw new Error(`Game ${game.id}: no legal move from the initial board`);
        expect(move.fromPosition).toBeGreaterThanOrEqual(1);
        expect(move.fromPosition).toBeLessThanOrEqual(24);
        expect(move.toPosition).toBeGreaterThanOrEqual(1);
        expect(move.toPosition).toBeLessThanOrEqual(24);
        expect(move.toPosition).not.toBe(move.fromPosition);
        for (const player of [a, b]) {
          await expectBoard(player.board, game.currentState, player.label);
        }
        const before = game.currentState;
        const response = await active.board.move(game.id, move, activeGamePlayer.color);
        const updated = await read<GameResponse>(response, 200);
        const sent: LegalMoveResponse = response.request().postDataJSON();
        expect(sent).toEqual(move);
        expect(updated.id).toBe(game.id);
        const sign = activeGamePlayer.color === 'WHITE' ? 1 : -1;
        const sourceCount = before.points[move.fromPosition];
        const destinationCount = before.points[move.toPosition];
        if (sourceCount === undefined || destinationCount === undefined) {
          throw new Error(`Game ${game.id}: move references a missing point`);
        }
        expect(updated.currentState.points[move.fromPosition]).toBe(sourceCount - sign);
        expect(updated.currentState.points[move.toPosition]).toBe(destinationCount + sign);
        const committed = await read<GameResponse>(await activeUser.api.games.get(game.id), 200);
        expect(committed.currentState).toEqual(updated.currentState);
        const history = await read<MoveResponse[]>(await activeUser.api.games.moves(game.id), 200);
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({
          ...move, gameId: game.id, gamePlayerId: activeGamePlayer.id,
        });
        for (const player of [a, b]) {
          await expectBoard(player.board, updated.currentState, player.label);
        }
      });

    await test.step('Player B forfeits through the UI; committed statistics and results are correct',
      async () => {
        const finished = await read<GameResponse>(await b.board.forfeit(started.id), 200);
        const [winner, loser] = await Promise.all([
          host.api.auth.me().then(response => read<UserResponse>(response, 200)),
          guest.api.auth.me().then(response => read<UserResponse>(response, 200)),
        ]);
        expect(winner).toMatchObject({ id: host.profile.id, wins: 1, losses: 0, rating: 1020 });
        expect(loser).toMatchObject({ id: guest.profile.id, wins: 0, losses: 1, rating: 980 });
        expect(finished).toMatchObject({ id: started.id, roomId: room.id, status: 'FINISHED' });
        expect(typeof finished.finishedAt === 'string' &&
          Number.isFinite(Date.parse(finished.finishedAt))).toBe(true);
        const committed = await read<GameResponse>(await host.api.games.get(started.id), 200);
        expect(committed).toMatchObject({
          id: started.id, status: 'FINISHED',
        });
        if (finished.finishedAt === null || committed.finishedAt === null) {
          throw new Error(`Game ${started.id}: a finished match must have a persisted finish date`);
        }
        // Persisted timestamps may have less fractional precision than the finish response.
        expect(Date.parse(committed.finishedAt)).toBe(Date.parse(finished.finishedAt));
        const closedRoom = await read<RoomResponse>(await host.api.rooms.details(room.id), 200);
        expect(closedRoom).toMatchObject({ id: room.id, status: 'CLOSED', gameId: started.id });
        const results = await read<GamePlayerResponse[]>(
          await host.api.games.players(started.id), 200);
        expect(results).toHaveLength(2);
        expect(results.filter(player => player.winner)).toHaveLength(1);
        expect(results).toEqual(expect.arrayContaining([
          expect.objectContaining({ userId: host.profile.id, winner: true }),
          expect.objectContaining({ userId: guest.profile.id, winner: false }),
        ]));
        await expect(a.board.result).toHaveRole('dialog');
        await expect(a.board.result.getByRole('heading')).toContainText('YOU WON!');
        await expect(b.board.result.getByRole('heading')).toContainText('YOU LOST!');
        await expect(b.board.result.locator('.loss-statistics div').filter({ hasText: 'Rating' })
          .locator('dd')).toHaveText('980');
        await expect(b.board.result.locator('.loss-statistics div').filter({ hasText: 'Losses' })
          .locator('dd')).toHaveText('1');
      });

    await test.step('Both players see their exact new rating and personal rank on the leaderboard',
      async () => {
        for (const [player, user, rating] of [[a, host, 1020], [b, guest, 980]] as const) {
          await player.board.viewLeaderboard();
          await expect(player.page).toHaveURL(/\/leaderboard$/);
          const personal = await read<LeaderboardEntryResponse>(await user.api.leaderboard.me(), 200);
          expect(personal).toMatchObject({
            userId: user.profile.id, username: user.data.username, rating,
          });
          expect(Number.isSafeInteger(personal.rank) && personal.rank > 0).toBe(true);
          await expect(player.leaderboard.personalRank)
            .toHaveText(`#${personal.rank} \u00b7 ${rating}`);
          await expect(player.leaderboard.table).toBeVisible();
          if (personal.rank <= 20) {
            const row = player.leaderboard.table.getByRole('row').filter({
              has: player.page.getByRole('cell', { name: user.data.username, exact: true }),
            });
            await expect(row.getByRole('cell')).toHaveText([
              String(personal.rank), user.data.username, String(rating),
            ]);
          }
        }
      });

    await test.step('Both players return to the lobby without an active room', async () => {
      for (const [player, user] of [[a, host], [b, guest]] as const) {
        await player.leaderboard.backToLobby();
        await expect(player.page).toHaveURL(/\/lobby$/);
        await expect(player.lobby.username).toHaveText(user.data.username);
        await expect(player.lobby.activeRoom).toHaveCount(0);
        await expect(player.lobby.createButton).toBeEnabled();
        await expect(player.lobby.joinButton).toBeEnabled();
        expect((await user.api.rooms.current()).status()).toBe(204);
      }
    });
  });
