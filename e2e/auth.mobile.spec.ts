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
  expect(api.unhandledRequests).toEqual([]);
});
