import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('desktop publication controls occupy a vertical side rail and expand beside the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();

  const editor = menu.locator('.publication-style-editor');
  const workspace = editor.locator('.publication-style-editor-shell');
  const rail = editor.locator('.publication-style-ribbon');
  const canvas = editor.locator('.publication-document-canvas');
  const stylesButton = rail.locator('.publication-style-ribbon-menu-button').first();

  await expect(workspace).toHaveClass(/publication-style-editor-shell--with-ribbon/);
  await expect(rail).toHaveCSS('display', 'grid');
  await expect(canvas).toBeVisible();
  const collapsed = await rail.boundingBox();
  const canvasBefore = await canvas.boundingBox();
  expect(collapsed).not.toBeNull();
  expect(canvasBefore).not.toBeNull();
  expect(collapsed!.x + collapsed!.width).toBeLessThanOrEqual(canvasBefore!.x + 2);

  await stylesButton.click();
  await expect(stylesButton).toHaveAttribute('aria-expanded', 'true');
  await expect(rail.locator('#publication-style-ribbon-panel-styles')).toBeVisible();
  const expanded = await rail.boundingBox();
  expect(expanded!.width).toBeGreaterThan(collapsed!.width + 150);
  await expect(canvas).toBeVisible();

  await stylesButton.click();
  await expect(stylesButton).toHaveAttribute('aria-expanded', 'false');
  await expect(rail.locator('#publication-style-ribbon-panel-styles')).toHaveCount(0);
  const collapsedAgain = await rail.boundingBox();
  expect(Math.abs(collapsedAgain!.width - collapsed!.width)).toBeLessThan(3);

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(rail).not.toHaveCSS('display', 'grid');
  await expect(canvas).toBeVisible();
});
