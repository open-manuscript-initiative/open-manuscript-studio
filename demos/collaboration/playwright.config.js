import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', headless: true },
  webServer: [
    {
      command: 'npm start',
      url: 'http://127.0.0.1:3020/healthz',
      reuseExistingServer: !process.env.CI,
      env: {
        DEMO_ACCESS_CODE: 'playwright-demo-access-code',
        DEMO_TOKEN_SECRET: 'playwright-signing-secret-with-32-bytes',
        DEMO_HTTP_PORT: '3020',
        DEMO_WS_PORT: '3021',
        DEMO_ALLOWED_ORIGIN: 'http://127.0.0.1:5173',
        DEMO_STORAGE_DIR: '/tmp/omi-collaboration-playwright',
      },
    },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  ],
});
