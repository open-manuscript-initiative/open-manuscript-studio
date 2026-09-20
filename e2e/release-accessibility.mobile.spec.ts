import { expect, test } from '@playwright/test';

import { expectBasicAccessibilityContract } from './support/accessibilityAssertions';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('mobile login and editor retain the same accessibility contract', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await page.goto('/');
  await expectBasicAccessibilityContract(page);

  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  await expectBasicAccessibilityContract(page);

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  await expect(dialog).toBeVisible();
  await expectBasicAccessibilityContract(page);

  await dialog.getByRole('button', { name: 'References', exact: true }).click();
  const targetSelect = dialog.locator('[data-named-anchor-target]');
  await expect(targetSelect).toBeVisible();
  await targetSelect.scrollIntoViewIfNeeded();

  const targetBox = await targetSelect.boundingBox();
  const viewport = page.viewportSize();
  expect(targetBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(targetBox!.x).toBeGreaterThanOrEqual(0);
  expect(targetBox!.x + targetBox!.width).toBeLessThanOrEqual(viewport!.width + 1);

  expect(api.unhandledRequests).toEqual([]);
});
