import type { Page, Response } from '@playwright/test';
import { waitForApiResponse } from '..\\helpers\\ui-response';
import type { RegisterRequest } from '..\\types\\api';

export class RegisterPage {
  constructor(private readonly page: Page) {}

  get form() { return this.page.locator('form.auth-card'); }
  get error() { return this.form.locator('.error'); }
  get submitButton() { return this.form.getByRole('button', { name: 'Register', exact: true }); }

  async open(): Promise<void> {
    await this.page.goto('/register');
  }

  async fill(data: RegisterRequest, confirmPassword = data.password): Promise<void> {
    await this.page.getByPlaceholder('Username', { exact: true }).fill(data.username);
    await this.page.getByPlaceholder('Email', { exact: true }).fill(data.email);
    await this.page.getByPlaceholder('Password', { exact: true }).fill(data.password);
    await this.page.getByPlaceholder('Confirm Password', { exact: true }).fill(confirmPassword);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async register(data: RegisterRequest): Promise<Response> {
    await this.fill(data);
    const response = waitForApiResponse(this.page, 'POST', '/auth/register');
    await this.submit();
    return response;
  }
}
