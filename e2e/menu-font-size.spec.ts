import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('menu font size can be personalized from Settings', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  const firstMenuItem = dialog.locator('.studio-menu-nav-button').first();

  const defaultSize = await firstMenuItem.evaluate(
    (node) => Number.parseFloat(getComputedStyle(node).fontSize),
  );

  await dialog.getByRole('button', { name: 'Settings', exact: true }).click();
  const slider = dialog.getByRole('slider', { name: 'Menu font size' });
  await expect(slider).toHaveValue('100');

  await slider.fill('130');

  await expect.poll(async () =>
    firstMenuItem.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThan(defaultSize);

  await expect.poll(async () =>
    page.evaluate(() => localStorage.getItem('omi-studio-menu-font-scale')),
  ).toBe('130');

  const enlargedSize = await firstMenuItem.evaluate(
    (node) => Number.parseFloat(getComputedStyle(node).fontSize),
  );

  await slider.fill('80');

  await expect.poll(async () =>
    firstMenuItem.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeLessThan(enlargedSize);
});
