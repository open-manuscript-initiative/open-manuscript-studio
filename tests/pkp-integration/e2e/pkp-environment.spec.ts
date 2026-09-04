import { expect, test } from '@playwright/test';

const pkpBaseUrl = process.env.PKP_BASE_URL ?? 'http://127.0.0.1:8080';
const studioApiBaseUrl = process.env.STUDIO_API_BASE_URL ?? 'http://127.0.0.1:3001';
const platform = process.env.PKP_PLATFORM ?? 'ojs';

test('Studio API is healthy on its isolated PostgreSQL databases', async ({ request }) => {
  const response = await request.get(`${studioApiBaseUrl}/api/health`);

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: 'ok',
    service: 'open-manuscript-studio-server',
    database: 'connected',
  });
});

test(`${platform.toUpperCase()} is installed and renders outside the installer`, async ({ page }) => {
  const response = await page.goto(pkpBaseUrl, { waitUntil: 'domcontentloaded' });

  expect(response).not.toBeNull();
  expect(response?.status()).toBeLessThan(500);
  expect(page.url()).not.toContain('/install');
  await expect(page.locator('html')).toBeVisible();

  const markup = await page.content();
  expect(markup).toContain('</html>');
  expect(markup).not.toContain('name="adminPassword2"');
});
