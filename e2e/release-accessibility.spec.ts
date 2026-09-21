import { expect, test } from '@playwright/test';

import { expectBasicAccessibilityContract } from './support/accessibilityAssertions';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('login and editor satisfy the 1.0 keyboard and accessible-name contract', async ({ page }) => {
  const api = await installMockStudioApi(page);

  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to OMI Studio!' })).toBeVisible();
  await expectBasicAccessibilityContract(page);

  const email = page.getByLabel('Email address');
  const password = page.getByLabel('Password');
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Forgot your password?' })).toBeFocused();

  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  await expectBasicAccessibilityContract(page);

  const brandHome = page.getByRole('button', { name: 'Home', exact: true });
  await expect(brandHome).toBeVisible();
  await brandHome.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();

  const menuTrigger = page.getByRole('button', { name: 'Manuscript menu', exact: true });
  await menuTrigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('navigation', { name: 'Manuscript menu' })).toBeVisible();
  await expectBasicAccessibilityContract(page);

  await expect(dialog.locator('.studio-menu-content')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  expect(api.unhandledRequests).toEqual([]);
});
