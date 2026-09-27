import { expect, test } from '@playwright/test';

async function join(page, name) {
  await page.goto('/');
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Private access code').fill('playwright-demo-access-code');
  await page.getByRole('button', { name: 'Join shared room' }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  return page.locator('[contenteditable="true"]');
}

test('two participants edit the same synthetic room in real time', async ({ browser }) => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  try {
    const firstEditor = await join(first, 'Ada');
    const secondEditor = await join(second, 'Grace');
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
