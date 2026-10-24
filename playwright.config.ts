import { defineConfig, devices } from '@playwright/test';

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
    {
      name: 'ui-chromium',
      testMatch: /[\\/]ui[\\/].+\.ui\.spec\.ts$/,
      timeout: 60_000,
      expect: { timeout: 15_000 },
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL || 'http://localhost:4200',
        viewport: { width: 1440, height: 1000 },
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'e2e-chromium',
      testMatch: /[\\/]e2e[\\/].+\.e2e\.spec\.ts$/,
      timeout: 180_000,
      expect: { timeout: 15_000 },
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL || 'http://localhost:4200',
        viewport: { width: 1440, height: 1000 },
        screenshot: 'only-on-failure',
      },
    },
  ],
});
