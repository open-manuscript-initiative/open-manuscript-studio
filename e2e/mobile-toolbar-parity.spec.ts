import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

async function openMobileManuscript(page: Page) {
  await page.setViewportSize({ width: 393, height: 851 });
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
}

test('browser mobile exposes the manuscript tab strip and real editorial tools', async ({ page }) => {
  await openMobileManuscript(page);
  const toolbar = page.locator('.focus-header-secondary-row');
  await expect(toolbar.getByRole('button', { name: 'Show document outline' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Proofing and tracked changes' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.locator('.desktop-document-tabs')).toBeVisible();
  await expect(page.locator('.desktop-document-tabs').getByRole('tab')).toHaveCount(1);
  await toolbar.getByRole('button', { name: 'Show document outline' }).click();
  await expect(page.locator('.desktop-document-outline')).toBeVisible();
  await page.getByRole('button', { name: 'Hide document outline' }).last().click();
  await expect(page.locator('.desktop-document-outline')).toHaveCount(0);
});

test('Android mobile exposes the same outline, proofing, notes, search and save state', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36',
      configurable: true,
    });
  });
  await openMobileManuscript(page);
  const toolbar = page.locator('.mobile-action-bar');
  const outline = toolbar.getByRole('button', { name: 'Show document outline' });
  const proofing = toolbar.getByRole('button', { name: 'Proofing and tracked changes' });
  const search = toolbar.getByRole('button', { name: 'Search' });
  await expect(outline).toBeVisible();
  await expect(proofing).toBeVisible();
  await expect(search).toBeVisible();
  await expect(toolbar.locator('.mobile-notes-count')).toBeAttached();
  await expect(toolbar.locator('.mobile-save-state')).toBeVisible();
  await expect(page.locator('.mobile-document-tab-strip').getByRole('tab')).toHaveCount(1);

  await outline.click();
  await expect(page.locator('.mobile-workspace .desktop-document-outline')).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Hide document outline' })).toHaveAttribute('aria-pressed', 'true');
  await toolbar.getByRole('button', { name: 'Hide document outline' }).click();
  await expect(page.locator('.mobile-workspace .desktop-document-outline')).toHaveCount(0);

  await proofing.click();
  await expect(page.locator('.mobile-workspace .proofing-panel')).toBeVisible();
  await expect(proofing).toHaveAttribute('aria-pressed', 'true');
  await proofing.click();
  await expect(page.locator('.mobile-workspace .proofing-panel')).toHaveCount(0);

  await search.click();
  await expect(page.getByRole('search', { name: 'Find' })).toBeVisible();
  await toolbar.getByRole('button', { name: 'Close search' }).click();
  await expect(page.getByRole('search', { name: 'Find' })).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
