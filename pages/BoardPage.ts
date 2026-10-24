import { expect, type Page, type Response } from '@playwright/test';
import { waitForApiResponse } from '..\\helpers\\ui-response';
import type { LegalMoveResponse } from '..\\types\\api';

export class BoardPage {
  constructor(private readonly page: Page) {}

  get svg() { return this.page.locator('svg.board'); }
  get forfeitButton() {
    return this.page.locator('.toolbar').getByRole('button', { name: 'Forfeit Game', exact: true });
  }
  get forfeitDialog() {
    return this.page.getByRole('dialog', { name: 'Forfeit game?', exact: true });
  }
  get result() { return this.page.locator('.game-result-modal'); }
  get playerNames() { return this.page.locator('.player-name'); }

  async open(gameId: number): Promise<void> {
    await this.page.goto(`/board?gameId=${gameId}`);
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.svg).toBeVisible();
    await expect(this.forfeitButton).toBeEnabled();
  }

  async roll(gameId: number): Promise<Response> {
    const response = waitForApiResponse(this.page, 'POST', `/api/games/${gameId}/roll`);
    await this.page.getByRole('button', { name: 'Roll dice', exact: true }).click();
    const result = await response;
    await this.waitUntilReady();
    return result;
  }

  async readBoard() {
    return this.svg.evaluate(element => {
      if (!(element instanceof SVGSVGElement)) {
        throw new Error('Expected the rendered SVG board');
      }
      const bounds = element.getBoundingClientRect();
      const middleY = bounds.y + bounds.height / 2;
      const labels = Array.from(element.querySelectorAll<SVGTextElement>('text.num'), label => {
        const box = label.getBoundingClientRect();
        return { point: Number(label.textContent), x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
      if (labels.length !== 24 || new Set(labels.map(label => label.point)).size !== 24) {
        throw new Error('Expected 24 uniquely numbered SVG points');
      }
      function pointAt(x: number, y: number): number {
        const candidates = labels.filter(label => (label.y < middleY) === (y < middleY));
        candidates.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
        const label = candidates[0];
        if (!label) throw new Error('Cannot associate SVG geometry with a numbered point');
        return label.point;
      }
      const checkers = Array.from(element.querySelectorAll<SVGGElement>('g.checker'), checker => {
        const matrix = checker.getScreenCTM();
        if (!matrix) throw new Error('Checker has no screen transform');
        const position = new DOMPoint(0, 0).matrixTransform(matrix);
        const href = checker.querySelector('use')?.getAttribute('href');
        if (href !== '#disc-white' && href !== '#disc-black') {
          throw new Error('Opening move expects ordinary white/black checkers, not off-board slabs');
        }
        return {
          point: pointAt(position.x, position.y),
          color: href === '#disc-white' ? 'WHITE' : 'BLACK',
          x: position.x,
          y: position.y,
          highlighted: checker.classList.contains('highlighted'),
          selected: checker.querySelector('.sel-ring') !== null,
          flying: checker.classList.contains('flying'),
        };
      });
      const targets = Array.from(element.querySelectorAll<SVGCircleElement>('circle.ghost'), target => {
        const matrix = target.getScreenCTM();
        if (!matrix) throw new Error('Move target has no screen transform');
        const position = new DOMPoint(target.cx.baseVal.value, target.cy.baseVal.value)
          .matrixTransform(matrix);
        return { point: pointAt(position.x, position.y), x: position.x, y: position.y };
      });
      const points = Array<number>(25).fill(0);
      for (const checker of checkers) {
        points[checker.point] = (points[checker.point] ?? 0) + (checker.color === 'WHITE' ? 1 : -1);
      }
      return { points, checkers, targets };
    });
  }

  async move(gameId: number, move: LegalMoveResponse, color: 'WHITE' | 'BLACK'): Promise<Response> {
    await this.waitUntilReady();
    await expect.poll(async () => {
      const board = await this.readBoard();
      return board.checkers.filter(checker =>
        checker.point === move.fromPosition && checker.color === color &&
        checker.highlighted && !checker.flying,
      ).length;
    }, { message: `A legal top checker must be available at point ${move.fromPosition}` }).toBe(1);
    const source = (await this.readBoard()).checkers.find(checker =>
      checker.point === move.fromPosition && checker.color === color && checker.highlighted,
    );
    if (!source) throw new Error(`No highlighted ${color} checker at point ${move.fromPosition}`);
    await this.page.mouse.click(source.x, source.y);
    await expect(this.svg.locator('.sel-ring')).toBeVisible();
    await expect.poll(async () =>
      (await this.readBoard()).targets.filter(target => target.point === move.toPosition).length,
    { message: `Selected checker must offer point ${move.toPosition}` }).toBe(1);
    const target = (await this.readBoard()).targets.find(item => item.point === move.toPosition);
    if (!target) throw new Error(`No rendered target at point ${move.toPosition}`);
    const response = waitForApiResponse(this.page, 'POST', `/api/games/${gameId}/moves`);
    await this.page.mouse.click(target.x, target.y);
    return response;
  }

  async openForfeit(): Promise<void> {
    await this.forfeitButton.click();
    await expect(this.forfeitDialog).toBeVisible();
  }

  async cancelForfeit(): Promise<void> {
    await this.forfeitDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }

  async forfeit(gameId: number): Promise<Response> {
    await this.openForfeit();
    const response = waitForApiResponse(this.page, 'POST', `/api/games/${gameId}/finish`);
    await this.forfeitDialog.getByRole('button', { name: 'Forfeit Game', exact: true }).click();
    return response;
  }

  async viewLeaderboard(): Promise<void> {
    await this.result.getByRole('button', { name: /View Leaderboard/ }).click();
  }
}
