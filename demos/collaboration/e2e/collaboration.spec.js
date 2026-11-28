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
    // Fixed synthetic identities exercise actual caret colors without a random
    // collision in the finite hue palette. Production UUID generation is unchanged.
    await first.addInitScript(() => { crypto.randomUUID = () => '10000000-0000-4000-8000-000000000001'; });
    await second.addInitScript(() => { crypto.randomUUID = () => '10000000-0000-4000-8000-000000000002'; });
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
    const firstRemoteCaret = firstEditor.locator('.collaboration-carets__label');
    const secondRemoteCaret = secondEditor.locator('.collaboration-carets__label');
    await expect(firstRemoteCaret).toContainText('Grace');
    await expect(secondRemoteCaret).toContainText('Ada');
    const [firstColor, secondColor] = await Promise.all([
      firstRemoteCaret.evaluate((element) => getComputedStyle(element).backgroundColor),
      secondRemoteCaret.evaluate((element) => getComputedStyle(element).backgroundColor),
    ]);
    expect(firstColor).not.toBe(secondColor);
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
