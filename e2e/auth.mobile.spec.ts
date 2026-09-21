import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('mobile Account keeps the persistent header visible and has no duplicate logout', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);

  const header = page.locator('.focus-header');
  const topRow = header.locator('.focus-header-top-row');
  await topRow.getByRole('button', { name: 'Account', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Account', exact: true });
  await expect(dialog).toBeVisible();
  await expect(header).toBeVisible();
  await expect(topRow.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(dialog.locator('.account-logout')).toHaveCount(0);

  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  const headerOwnsTopLayer = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element?.closest('.focus-header'));
  }, {
    x: (headerBox?.x ?? 0) + Math.min((headerBox?.width ?? 0) / 2, 120),
    y: (headerBox?.y ?? 0) + Math.min((headerBox?.height ?? 0) / 2, 40),
  });
  expect(headerOwnsTopLayer).toBe(true);

  const accountHeading = dialog.getByRole('heading', { name: 'Account', exact: true });
  const accountHeadingBox = await accountHeading.boundingBox();
  expect(accountHeadingBox).not.toBeNull();
  expect(accountHeadingBox!.y).toBeGreaterThanOrEqual(
    (headerBox?.y ?? 0) + (headerBox?.height ?? 0) - 1,
  );

  await topRow.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('the responsive login and editor fit a phone viewport', async ({ page }) => {
  const api = await installMockStudioApi(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const primaryHeader = page.locator('.focus-header-top-row');
  await expect(primaryHeader.getByRole('button', { name: 'Manuscript menu', exact: true })).toBeVisible();
  await expect(primaryHeader.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
  await expect(primaryHeader.getByRole('button', { name: 'Account', exact: true })).toBeVisible();
  await expect(primaryHeader.getByRole('combobox', { name: 'Interface language', exact: true })).toBeVisible();
  await expect(primaryHeader.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page.locator('.focus-header-secondary-row').getByRole('button', { name: 'Search', exact: true })).toBeVisible();

  const menuTrigger = page.getByRole('button', { name: 'Manuscript menu', exact: true });
  const triggerPosition = await menuTrigger.boundingBox();
  expect(triggerPosition).not.toBeNull();
  await menuTrigger.click();

  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  const menuToggle = dialog.getByRole('button', { name: 'Manuscript menu', exact: true });
  const menuNavigation = dialog.getByRole('navigation', { name: 'Manuscript menu' });
  await expect(menuToggle).toBeVisible();
  await expect(menuNavigation).toBeVisible();
  const togglePosition = await menuToggle.boundingBox();
  expect(togglePosition).not.toBeNull();
  expect(Math.abs((togglePosition?.x ?? 0) - (triggerPosition?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((togglePosition?.y ?? 0) - (triggerPosition?.y ?? 0))).toBeLessThanOrEqual(1);

  await expect(dialog.locator('.studio-menu-content')).toBeHidden();
  await expect(dialog.getByRole('button', { name: 'Document', exact: true })).not.toHaveAttribute('aria-current', 'page');

  await menuToggle.click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();

  await menuTrigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'References', exact: true }).click();
  await expect(dialog.locator('.studio-menu-content')).toBeVisible();
  await expect(menuNavigation).toBeHidden();

  await menuToggle.click();
  await expect(menuNavigation).toBeVisible();
  await dialog.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();

  const searchTrigger = page.locator('.focus-header-secondary-row').getByRole('button', { name: 'Search', exact: true });
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
