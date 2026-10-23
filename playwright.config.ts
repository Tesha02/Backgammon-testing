import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.\\tests',
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:8080',
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /[\\/]api[\\/].+\.api\.spec\.ts$/,
    },
  ],
});
