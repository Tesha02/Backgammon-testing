import type { Page, Response } from '@playwright/test';
import { waitForApiResponse } from '..\\helpers\\ui-response';

export class LobbyPage {
  constructor(private readonly page: Page) {}

  get username() { return this.page.locator('.user-info .username'); }
  get createButton() { return this.page.getByRole('button', { name: 'Create Room', exact: true }); }
  get joinButton() { return this.page.getByRole('button', { name: 'Join Room', exact: true }); }
  get activeRoom() { return this.page.locator('.active-room'); }
  get heading() { return this.page.getByRole('heading', { name: 'LOBBY', exact: true }); }
  get error() { return this.page.locator('.lobby-card .error'); }
  get createModal() {
    return this.page.locator('.modal-content').filter({
      has: this.page.getByRole('heading', { name: 'Create Room', exact: true }),
    });
  }

  async open(): Promise<void> {
    await this.page.goto('/lobby');
  }

  async logout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Logout', exact: true }).click();
  }

  async openLeaderboard(): Promise<void> {
    await this.page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  }

  async openCreateRoom(): Promise<void> {
    await this.createButton.click();
  }

  async fillRoomName(name: string): Promise<void> {
    await this.createModal.getByPlaceholder('Room name', { exact: true }).fill(name);
  }

  async submitCreateRoom(): Promise<void> {
    await this.createModal.getByRole('button', { name: 'Create', exact: true }).click();
  }

  async createRoom(name: string): Promise<Response> {
    await this.openCreateRoom();
    await this.fillRoomName(name);
    const response = waitForApiResponse(this.page, 'POST', '/api/rooms');
    await this.submitCreateRoom();
    return response;
  }

  async joinRoom(name: string, roomId: number): Promise<Response> {
    await this.joinButton.click();
    const modal = this.page.locator('.modal-content').filter({
      has: this.page.getByRole('heading', { name: 'Available Rooms', exact: true }),
    });
    const room = modal.locator('.room-item').filter({ hasText: name });
    const response = waitForApiResponse(this.page, 'POST', `/api/rooms/${roomId}/join`);
    await room.getByRole('button', { name: 'Join', exact: true }).click();
    return response;
  }
}
