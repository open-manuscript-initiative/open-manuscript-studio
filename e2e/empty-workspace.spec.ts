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
