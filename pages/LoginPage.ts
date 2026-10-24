import type { Page, Response } from '@playwright/test';
import { waitForApiResponse } from '..\\helpers\\ui-response';
import type { LoginRequest } from '..\\types\\api';

export class LoginPage {
  constructor(private readonly page: Page) {}

  get form() { return this.page.locator('form.auth-card'); }
  get error() { return this.form.locator('.error'); }
  get submitButton() { return this.form.getByRole('button', { name: 'Login', exact: true }); }

  get registrationNotice() {
    return this.page.getByText('Account created. You can log in now.', { exact: true });
  }

  async open(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(data: LoginRequest): Promise<Response> {
    await this.page.getByPlaceholder('Email', { exact: true }).fill(data.email);
    await this.page.getByPlaceholder('Password', { exact: true }).fill(data.password);
    const response = waitForApiResponse(this.page, 'POST', '/auth/login');
    await this.submitButton.click();
    return response;
  }
}
