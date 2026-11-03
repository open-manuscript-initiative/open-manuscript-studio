import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('live publication editor presents one canonical manuscript view with optional frame tools', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();

  const liveEditor = menu.locator('.publication-style-editor');
  const canvas = liveEditor.locator('.publication-document-canvas');
  const inspector = liveEditor.locator('.publication-frame-inspector-panel');
  const toggle = liveEditor.getByRole('button', { name: 'Frames and page styles', exact: true });
  await expect(canvas).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(inspector).toHaveCount(0);
  await expect(liveEditor.locator('.omi-publication-layout-switch')).toHaveCount(0);
  await expect(liveEditor.getByRole('button', { name: 'Continuous layout', exact: true })).toHaveCount(0);
  await expect(liveEditor.getByRole('button', { name: 'Frame layout', exact: true })).toHaveCount(0);

  const before = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return JSON.stringify(useStudioStore.getState().manuscript);
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('.omi-frame-editor')).toBeVisible();
  await expect(inspector.locator('.publication-frame-inspector-advisory')).toContainText('footnotes');
  // The authoritative structured canvas never unmounts or converts to a plain-text story.
  await expect(canvas).toBeAttached();
  await inspector.getByRole('button', { name: 'Close frame tools', exact: true }).click();
  await expect(inspector).toHaveCount(0);
  await expect(canvas).toBeVisible();
  const after = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return JSON.stringify(useStudioStore.getState().manuscript);
  });
  expect(after).toBe(before);
});

test('mobile preview shows one publication editor with expandable frame tools, not layout modes', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();
  const liveEditor = menu.locator('.publication-style-editor');
  await expect(liveEditor.locator('.publication-document-canvas')).toBeVisible();
  const toggle = liveEditor.getByRole('button', { name: 'Frames and page styles', exact: true });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(liveEditor.locator('.publication-frame-inspector-panel')).toBeVisible();
  await expect(liveEditor.locator('.omi-frame-editor')).toBeVisible();
  await liveEditor.getByRole('button', { name: 'Close frame tools', exact: true }).click();
  await expect(liveEditor.locator('.publication-frame-inspector-panel')).toHaveCount(0);
});
