import { expect, test } from '@playwright/test';

async function join(page, name) {
  await page.goto('/');
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Private access code').fill('playwright-demo-access-code');
  await page.getByRole('button', { name: 'Join shared room' }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  const editor = page.locator('[contenteditable="true"]');
  await expect(editor).toContainText('A shared manuscript, written together');
  return editor;
}

test('two participants edit the same synthetic room in real time', async ({ browser }) => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  try {
    const [firstEditor, secondEditor] = await Promise.all([
      join(first, 'Ada'),
      join(second, 'Grace'),
    ]);
    await expect(firstEditor.locator('h1')).toHaveCount(1);
    await expect(secondEditor.locator('h1')).toHaveCount(1);
    await expect(firstEditor.locator('p')).toHaveText('This synthetic sample is shared in real time. Edit this text from two browser windows to see Yjs collaboration in action.');
    await expect(secondEditor.locator('p')).toHaveText('This synthetic sample is shared in real time. Edit this text from two browser windows to see Yjs collaboration in action.');
    await firstEditor.fill('A shared synthetic manuscript.');
    await expect(secondEditor).toContainText('A shared synthetic manuscript.');
    await secondEditor.fill('Updated by two participants.');
    await expect(firstEditor).toContainText('Updated by two participants.');
  } finally {
    await first.close();
    await second.close();
  }
});

test('wrong access code is rejected', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Display name').fill('Ada');
  await page.getByLabel('Private access code').fill('incorrect-code');
  await page.getByRole('button', { name: 'Join shared room' }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
});
