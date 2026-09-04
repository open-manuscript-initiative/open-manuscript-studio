import { defineConfig, devices } from '@playwright/test';

const platform = process.env.PKP_PLATFORM ?? 'ojs';

export default defineConfig({
  testDir: './tests/pkp-integration/e2e',
  outputDir: `test-results/pkp-${platform}`,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `playwright-report/pkp-${platform}` }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: `${platform}-integration-environment`,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
