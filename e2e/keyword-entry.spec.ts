import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('keyword entry preserves typing order and multilingual text direction', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  await dialog.getByRole('button', { name: 'Manuscript data', exact: true }).click();

  const keywordInput = dialog.getByRole('textbox', { name: 'Keywords en', exact: true });
  await expect(keywordInput).toBeVisible();
  await expect(keywordInput).toHaveAttribute('dir', 'auto');

  await keywordInput.click();
  await keywordInput.pressSequentially('church history');
  await expect(keywordInput).toHaveValue('church history');

  const caret = await keywordInput.evaluate((node) => {
    const input = node as HTMLInputElement;
    return {
      start: input.selectionStart,
      end: input.selectionEnd,
      length: input.value.length,
    };
  });
  expect(caret.start).toBe(caret.length);
  expect(caret.end).toBe(caret.length);

  await keywordInput.press('Enter');
  await expect(dialog.locator('.omi-keyword-chip').filter({ hasText: 'church history' })).toBeVisible();

  // Content entry must remain independent from an RTL interface direction.
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });

  await keywordInput.pressSequentially('manuscripts');
  await expect(keywordInput).toHaveValue('manuscripts');
  await keywordInput.press('Enter');
  await expect(dialog.locator('.omi-keyword-chip').filter({ hasText: 'manuscripts' })).toBeVisible();

  await keywordInput.pressSequentially('Հայագիտություն');
  await expect(keywordInput).toHaveValue('Հայագիտություն');
});
