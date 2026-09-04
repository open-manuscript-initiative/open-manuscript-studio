import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('the full-screen menu opens the live publication editor', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await signInToStudio(page);

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();

  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await expect(menu).toBeVisible();

  const viewport = page.viewportSize();
  const menuBox = await menu.boundingBox();
  expect(viewport).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 1);
  expect(menuBox?.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);

  await menu.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();

  await expect(menu.getByRole('heading', { name: 'Live publication editor' })).toBeVisible();
  await expect(menu.getByRole('toolbar', { name: 'Live publication editor' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Paragraph styles', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Typesetting proofing', exact: true })).toBeVisible();
  await expect(menu.locator('.publication-document-canvas')).toBeVisible();
  expect(api.unhandledRequests).toEqual([]);
});
