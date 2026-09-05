import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('the responsive login and editor fit a phone viewport', async ({ page }) => {
  const api = await installMockStudioApi(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await signInToStudio(page);
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const menuTrigger = page.getByRole('button', { name: 'Manuscript menu', exact: true });
  const triggerPosition = await menuTrigger.boundingBox();
  expect(triggerPosition).not.toBeNull();
  await menuTrigger.click();

  const menuClose = page.getByRole('button', { name: 'Close manuscript menu', exact: true });
  await expect(menuClose).toBeVisible();
  const closePosition = await menuClose.boundingBox();
  expect(closePosition).not.toBeNull();
  expect(Math.abs((closePosition?.x ?? 0) - (triggerPosition?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((closePosition?.y ?? 0) - (triggerPosition?.y ?? 0))).toBeLessThanOrEqual(1);

  await menuClose.click();
  await expect(menuClose).toBeHidden();

  const searchTrigger = page.getByRole('button', { name: 'Search', exact: true });
  const searchTriggerPosition = await searchTrigger.boundingBox();
  expect(searchTriggerPosition).not.toBeNull();
  await searchTrigger.click();

  const searchClose = page.getByRole('button', { name: 'Close search', exact: true });
  await expect(searchClose).toBeVisible();
  const searchClosePosition = await searchClose.boundingBox();
  expect(searchClosePosition).not.toBeNull();
  expect(Math.abs((searchClosePosition?.x ?? 0) - (searchTriggerPosition?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((searchClosePosition?.y ?? 0) - (searchTriggerPosition?.y ?? 0))).toBeLessThanOrEqual(1);
  await searchClose.click();
  await expect(page.getByRole('search', { name: 'Find' })).toBeHidden();

  expect(api.unhandledRequests).toEqual([]);
});
