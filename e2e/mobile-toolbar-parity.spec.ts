import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
import { installMockAndroidRuntime } from './support/mockAndroidRuntime';

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
  await expect(toolbar.locator('.focus-formatting-button')).toBeVisible();
  await expect(page.locator('.desktop-document-tabs')).toBeVisible();
  await expect(page.locator('.desktop-document-tabs').getByRole('tab')).toHaveCount(1);
  await toolbar.getByRole('button', { name: 'Show document outline' }).click();
  await expect(page.locator('.desktop-document-outline')).toBeVisible();
  await page.getByRole('button', { name: 'Hide document outline' }).last().click();
  await expect(page.locator('.desktop-document-outline')).toHaveCount(0);
});

test('Android mobile exposes the same outline, proofing, notes, search and save state', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await installMockAndroidRuntime(page);
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
  await expect(toolbar.locator('.focus-formatting-button')).toBeVisible();
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
  const editor = page.locator('.omi-continuous-tiptap-editor[contenteditable="true"]').first();
  await editor.fill('Native formatting');
  await editor.press('ControlOrMeta+a');
  await toolbar.locator('.focus-formatting-button').click();
  const formatting = page.locator('#omi-header-formatting');
  await formatting.getByRole('button', { name: 'Bold / strong', exact: true }).click();
  await expect(editor.locator('strong')).toHaveText('Native formatting');
  await expect(page.locator('.mobile-editor-tools .focus-header-formatting')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


for (const runtime of ['desktop', 'mobile-web', 'android'] as const) {
  test(runtime + ' permanent note icon inserts without a selection', async ({ page }) => {
    if (runtime === 'android') await installMockAndroidRuntime(page);
    if (runtime === 'desktop') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await installMockStudioApi(page);
      await signInToStudio(page);
      await page.getByRole('button', { name: /^New OMI study/ }).click();
    } else await openMobileManuscript(page);
    const toolbar = page.locator(runtime === 'android' ? '.mobile-action-bar' : '.focus-header-secondary-row');
    const insert = toolbar.locator('.focus-insert-note-button');
    await expect(insert).toBeVisible();
    const editor = page.locator('.omi-continuous-tiptap-editor[contenteditable="true"]').first();
    await editor.fill('A note here.');
    await editor.press('End');
    await expect(page.locator('.omi-selection-action-toolbar')).toHaveCount(0);
    await expect(insert).toBeEnabled();
    await insert.click();
    await expect(editor.locator('[data-omi-note]')).toHaveCount(1);
    await expect(editor).toContainText('A note here.');
    await expect(page.locator('.omi-note-editor-card')).toBeVisible();
  });
}
