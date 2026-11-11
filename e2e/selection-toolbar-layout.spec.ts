import { expect, test, type Locator, type Page } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

async function selectText(editor: Locator) {
  await editor.focus();
  await editor.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const start = node.data.indexOf('Select these words');
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + 'Select these words'.length);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    throw new Error('Fixture text is missing');
  });
}

async function openToolbar(page: Page) {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  const editor = page.locator('.omi-continuous-tiptap-editor[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.insertText('Select these words to format them.');
  await selectText(editor);
  const toolbar = page.locator('.omi-rich-text-toolbar');
  await expect(toolbar).toBeVisible();
  return { editor, toolbar };
}

async function expectNoScrollbars(toolbar: Locator) {
  const panels = toolbar.locator(
    ':scope, .omi-rich-text-toolbar-row, .omi-selection-action-toolbar, .omi-rich-text-popover',
  );
  for (const panel of await panels.all()) {
    expect(await panel.evaluate((element) => ({
      horizontal: element.scrollWidth > element.clientWidth + 1,
      vertical: element.scrollHeight > element.clientHeight + 1,
    }))).toEqual({ horizontal: false, vertical: false });
  }
  const box = (await toolbar.boundingBox())!;
  for (const control of await toolbar.locator('button, input, select').all()) {
    const controlBox = (await control.boundingBox())!;
    expect(controlBox.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(controlBox.y).toBeGreaterThanOrEqual(box.y - 1);
    expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
    expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(box.y + box.height + 1);
  }
}

test('desktop selection tools wrap without scrolling, including expanded tools', async ({ page }) => {
  const { toolbar } = await openToolbar(page);
  for (const width of [1916, 1440, 900, 761]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoScrollbars(toolbar);
    await toolbar.getByRole('button', { name: 'More text tools', exact: true }).click();
    await expect(toolbar.locator('.omi-rich-text-more-menu')).toBeVisible();
    await expectNoScrollbars(toolbar);
    const box = (await toolbar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    await toolbar.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});

test('dragging and resizing remember the panel without losing the text selection', async ({ page }) => {
  const { editor, toolbar } = await openToolbar(page);
  const selectionLength = await toolbar.getAttribute('data-selection-length');
  const moveHandle = toolbar.getByRole('button', { name: /^Move toolbar/ });
  const before = (await toolbar.boundingBox())!;
  const handle = (await moveHandle.boundingBox())!;
  const dx = 24 - before.x;
  const dy = 520 - before.y;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + dx, handle.y + handle.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
  await expect(toolbar).toHaveAttribute('data-pinned', 'true');
  await expect(toolbar).toHaveAttribute('data-selection-length', selectionLength!);
  const moved = (await toolbar.boundingBox())!;
  expect(moved.x).toBeCloseTo(24, 0);
  expect(moved.y).toBeCloseTo(520, 0);

  const resize = (await toolbar.getByRole('button', { name: /^Resize toolbar/ }).boundingBox())!;
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x + resize.width / 2 - 160, resize.y + resize.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const resized = (await toolbar.boundingBox())!;
  expect(resized.width).toBeCloseTo(moved.width - 160, 0);
  expect(resized.height).toBeGreaterThanOrEqual(moved.height + 59);
  await expectNoScrollbars(toolbar);
  await expect(toolbar).toHaveAttribute('data-selection-length', selectionLength!);
  await toolbar.getByRole('button', { name: 'Bold / strong', exact: true }).click();
  await expect(editor.locator('strong')).toContainText('Select these words');

  await editor.press('Escape');
  await expect(toolbar).toHaveCount(0);
  await selectText(editor);
  await expect(toolbar).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await expect.poll(() => toolbar.boundingBox()).toEqual(resized);

  await page.reload();
  await expect(editor).toBeVisible();
  await selectText(editor);
  await expect(toolbar).toHaveAttribute('data-pinned', 'true');
  await expect.poll(() => toolbar.boundingBox()).toEqual(resized);

  // A smaller window clamps the remembered panel into view.
  await page.setViewportSize({ width: 800, height: 600 });
  await expect.poll(async () => {
    const box = (await toolbar.boundingBox())!;
    return box.x >= 0 && box.y >= 0 && box.x + box.width <= 800 && box.y + box.height <= 600;
  }).toBe(true);

  // Desktop placement does not displace the mobile bottom toolbar.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(moveHandle).toHaveCount(0);
  await expect(toolbar).toBeVisible();
  const mobile = (await toolbar.boundingBox())!;
  expect(mobile.x).toBeGreaterThanOrEqual(0);
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toolbar).toHaveAttribute('data-pinned', 'true');
  await expect.poll(() => toolbar.boundingBox()).toEqual(resized);
  await toolbar.getByRole('button', { name: 'Reset toolbar size and position', exact: true }).click();
  await expect(toolbar).toHaveAttribute('data-pinned', 'false');
  expect((await toolbar.boundingBox())!.width).toBe(704);
});

test('panel placement also works with the keyboard and can return to selection following', async ({ page }) => {
  const { toolbar } = await openToolbar(page);
  const pin = toolbar.getByRole('button', { name: 'Pin toolbar position', exact: true });
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  const before = (await toolbar.boundingBox())!;
  await toolbar.getByRole('button', { name: /^Move toolbar/ }).press('Shift+ArrowRight');
  expect((await toolbar.boundingBox())!.x).toBeCloseTo(before.x + 40, 0);
  await toolbar.getByRole('button', { name: /^Resize toolbar/ }).press('ArrowRight');
  expect((await toolbar.boundingBox())!.width).toBeCloseTo(before.width + 10, 0);
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await expect(toolbar).toHaveAttribute('data-pinned', 'false');
});
