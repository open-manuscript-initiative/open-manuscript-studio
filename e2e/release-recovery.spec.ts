import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

const RECOVERY_SENTINEL = 'Crash-recovery browser sentinel 1.0';

test('an unclosed edited manuscript is restored after a browser reload', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  const editor = page.locator('.omi-tiptap-editor[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(RECOVERY_SENTINEL);
  await expect(editor).toContainText(RECOVERY_SENTINEL);

  // The persisted-session layer debounces IndexedDB writes by 250 ms.
  await page.waitForTimeout(750);
  await page.reload({ waitUntil: 'domcontentloaded' });

  const restoredEditor = page.locator('.omi-tiptap-editor[contenteditable="true"]').first();
  await expect(restoredEditor).toBeVisible();
  await expect(restoredEditor).toContainText(RECOVERY_SENTINEL);
  expect(api.unhandledRequests).toEqual([]);
});
