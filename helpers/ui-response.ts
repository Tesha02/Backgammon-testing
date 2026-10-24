import type { Page, Response } from '@playwright/test';

export function waitForApiResponse(
  page: Page,
  method: 'GET' | 'POST',
  path: string,
): Promise<Response> {
  const origin = new URL(process.env.API_BASE_URL || 'http://localhost:8080').origin;
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === method &&
      url.origin === origin && url.pathname === path;
  });
}
