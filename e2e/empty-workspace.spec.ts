import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const viewport of [{ width: 1440, height: 900 }, { width: 393, height: 851 }]) {
  test(`sign out directly from the empty workspace (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const api = await installMockStudioApi(page);
    await signInToStudio(page);
    await expect(page.locator('section.editor')).toHaveCount(0);
    const logoutRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && new URL(request.url()).pathname === '/api/auth/logout',
    );
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await logoutRequest;
    await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No document is open' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
    expect(api.unhandledRequests).toEqual([]);
  });

  test(`login without a document opens the empty workspace (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installMockStudioApi(page);
    await signInToStudio(page);
    await expect(page.locator('section.editor')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'No document is open' })).toBeVisible();
    await expect(page.locator('section.editor')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => ({
      heightFits: document.documentElement.scrollHeight <= window.innerHeight,
      widthFits: document.documentElement.scrollWidth <= window.innerWidth,
    }))).toEqual({ heightFits: true, widthFits: true });

    const logoutButton = page.getByRole('button', { name: 'Sign out', exact: true });
    await expect.poll(() => logoutButton.evaluate((button) => (
      button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight
    ))).toBe(true);

    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await expect(page.locator('section.editor')).toBeVisible();
    // Explicit creation persists; even a deliberately blank document is open.
    await page.evaluate(async () => {
      const { resumeLastSessionPersistence } = await import('/src/app/lastSessionPersistence.ts');
      await resumeLastSessionPersistence();
    });
    await page.reload();
    await expect(page.locator('section.editor')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No document is open' })).toHaveCount(0);
    await page.evaluate(async () => {
      const { closeCurrentDocument } = await import('/src/app/documentLifecycle.ts');
      await closeCurrentDocument();
    });
    await expect(page.getByRole('heading', { name: 'No document is open' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'No document is open' })).toBeVisible();
  });
}

test('an explicitly closed workspace still requires sign-in', async ({ page }) => {
  await installMockStudioApi(page);
  await page.addInitScript(() => localStorage.setItem('omi:document-closed', '1'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No document is open' })).toHaveCount(0);
});

for (const width of [1440, 393]) {
  test(`the final document closes without a session recheck or logout (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await installMockStudioApi(page);
    await signInToStudio(page);
    let sessionRechecks = 0;
    let logoutRequests = 0;
    await page.route('**/api/auth/me', async (route) => {
      sessionRechecks++;
      await route.fulfill({ status: 401, json: { error: { code: 'SYNTHETIC_REAUTH_UNAVAILABLE' } } });
    });
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/auth/logout') logoutRequests++;
    });
    await page.evaluate(() => { (window as unknown as Record<string, unknown>).__closeDocumentSentinel = 'same-page'; });
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: /^New OMI study/ }).click();
      await expect(page.locator('section.editor')).toBeVisible();
      await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
      await menu.getByRole('button', { name: 'Document', exact: true }).click();
      page.once('dialog', (dialog) => { void dialog.accept(); });
      await menu.locator('[data-document-close="true"]').click();
      await expect(page.getByRole('heading', { name: 'No document is open' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__closeDocumentSentinel)).toBe('same-page');
      expect(sessionRechecks).toBe(0);
      expect(logoutRequests).toBe(0);
    }
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
    expect(logoutRequests).toBe(1);
    expect(api.unhandledRequests).toEqual([]);
  });
}
