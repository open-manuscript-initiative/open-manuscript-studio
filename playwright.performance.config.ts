import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseUrl || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  testMatch: /editor-performance\.benchmark\.spec\.ts$/,
  outputDir: 'test-results/editor-performance-playwright',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 240_000,
  expect: {
    timeout: 120_000,
  },
  reporter: [
    ['list'],
    ['html', {
      open: 'never',
      outputFolder: 'playwright-report/editor-performance',
    }],
  ],
  use: {
    baseURL,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{
    name: 'editor-performance-chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
      launchOptions: {
        args: ['--enable-precise-memory-info'],
      },
    },
  }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
