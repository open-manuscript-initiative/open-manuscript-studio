import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('a user can sign in to and sign out of Studio', async ({ page }) => {
  const api = await installMockStudioApi(page);

  await signInToStudio(page);

  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  expect(api.loginRequests).toEqual([{
    email: 'editor@example.test',
    password: 'correct-horse-battery-staple',
  }]);
  expect(api.unhandledRequests).toEqual([]);

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
});
