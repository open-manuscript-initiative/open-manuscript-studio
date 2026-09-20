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
  await expect(page.getByRole('dialog', { name: 'Manuscript menu' })).toBeVisible();
  await expectBasicAccessibilityContract(page);
  expect(api.unhandledRequests).toEqual([]);
});
