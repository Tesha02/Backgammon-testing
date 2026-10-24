import type { Page, Response } from '@playwright/test';
import { waitForApiResponse } from '..\\helpers\\ui-response';

export class WaitingRoomPage {
  constructor(private readonly page: Page) {}

  get card() { return this.page.locator('.lobby-card'); }
  get startButton() { return this.page.getByRole('button', { name: 'Start game', exact: true }); }
  get waitingForPlayer() {
    return this.card.getByText('Waiting for a second player...', { exact: true });
  }
  get waitingForHost() {
    return this.card.getByText('Waiting for the host to start the game...', { exact: true });
  }

  player(username: string) {
    return this.card.locator('div').filter({ hasText: username });
  }

  async open(roomId: number): Promise<void> {
    await this.page.goto(`/room/${roomId}`);
  }

  async leave(roomId: number): Promise<Response> {
    const response = waitForApiResponse(this.page, 'POST', `/api/rooms/${roomId}/leave`);
    await this.page.getByRole('button', { name: 'Leave room', exact: true }).click();
    return response;
  }

  async startGame(roomId: number): Promise<Response> {
    const response = waitForApiResponse(this.page, 'POST', `/api/games/rooms/${roomId}/start`);
    await this.startButton.click();
    return response;
  }
}
