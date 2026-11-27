import { expect, test, type Page } from '@playwright/test';
import type { Editor } from '@tiptap/core';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

async function prepare(page: Page) {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const source = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...source, title: 'Publication editing fixture', sections: [{ id: 'source-section', title: '',
      blocks: Array.from({ length: 100 }, (_, i) => ({ id: `source-${i}`, type: 'paragraph', content: `Paragraph ${i}` })),
    }] });
  });
  return page.locator('.focus-workspace .omi-continuous-tiptap-editor');
}
async function openPublication(page: Page) {
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publication editor', exact: true }).click();
  return page.locator('.publication-document-canvas');
}
async function returnToAuthor(page: Page) {
  const menu = page.getByRole('dialog');
  await menu.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await menu.locator('[data-home-navigation]').click();
  await expect(menu).toHaveCount(0);
}

test('inactive author view coalesces publication edits, preserves selection/history and saves canonical content', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Maximum update depth|Cannot update a component/.test(message.text()))
      runtimeErrors.push(message.text());
  });
  const author = await prepare(page);
  await expect(author).toBeVisible();
  const saved = await author.evaluateHandle(element => {
    const editor = (element as HTMLElement & { editor: Editor }).editor;
    let start = 0;
    editor.state.doc.forEach((node, offset) => { if (node.attrs.omiBlockId === 'source-90') start = offset + 1; });
    editor.commands.setTextSelection({ from: start, to: start + 9 });
    const state = { editor, element, changed: 0, replacements: 0 };
    editor.on('transaction', ({ transaction }) => {
      if (!transaction.docChanged) return;
      state.changed++;
      if (transaction.steps.some(step => 'from' in step && step.from === 0 && 'to' in step && typeof step.to === 'number' && step.to > 1000)) state.replacements++;
    });
    return state;
  });
  const canvas = await openPublication(page);
  await expect(page.locator('[data-authoring-suspended="true"]')).toHaveCount(1);
  expect(await saved.evaluate(value => value.editor.isEditable)).toBe(false);
  const target = canvas.locator('.omi-continuous-tiptap-editor > p[data-block-id="source-0"]');
  await target.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' EDITED' + 'x'.repeat(30), { delay: 20 });
  await expect(target).toContainText('EDITED');
  expect(await saved.evaluate(value => ({ changed: value.changed, replacements: value.replacements }))).toEqual({ changed: 0, replacements: 0 });
  await page.keyboard.press('Control+z');
  await expect(target).not.toContainText('EDITED');
  await page.keyboard.press('Control+Shift+z');
  await expect(target).toContainText('EDITED');
  const persisted = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { serializeOmiJson } = await import('/src/services/exportOmi.ts');
    const { parseOmiJson } = await import('/src/services/omiPortableFormat.ts');
    useStudioStore.getState().checkpoint('manual');
    return parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript)).sections[0].blocks[0].content;
  });
  expect(persisted).toContain('EDITED');
  await returnToAuthor(page);
  await expect(page.locator('[data-authoring-suspended="false"]')).toHaveCount(1);
  await expect(author.locator('[data-block-id="source-0"]')).toContainText('EDITED');
  const restored = await saved.evaluate(value => ({
    sameInstance: value.element.isConnected && value.editor.view.dom === value.element,
    editable: value.editor.isEditable, changed: value.changed, replacements: value.replacements,
    block: value.editor.state.selection.$anchor.node(1).attrs.omiBlockId,
    selected: value.editor.state.doc.textBetween(value.editor.state.selection.from, value.editor.state.selection.to),
  }));
  expect(restored).toEqual({ sameInstance: true, editable: true, changed: 1, replacements: 1, block: 'source-90', selected: 'Paragraph' });
  await saved.evaluate(value => { value.editor.commands.insertContent('AUTHOR'); });
  await expect(author.locator('[data-block-id="source-90"]')).toContainText('AUTHOR');
  await saved.evaluate(value => { value.editor.commands.undo(); });
  await expect(author.locator('[data-block-id="source-90"]')).toContainText('Paragraph 90');
  await expect(author.locator('[data-block-id="source-0"]')).toContainText('EDITED');
  expect(runtimeErrors).toEqual([]);
  await saved.dispose();
});

test('document switches while author view is suspended cannot restore stale manuscript content', async ({ page }) => {
  const author = await prepare(page);
  await expect(author).toBeVisible();
  await openPublication(page);
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const source = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...source, id: 'other-manuscript', title: 'Other manuscript',
      sections: [{ id: 'other-section', title: '', blocks: [{ id: 'other-block', type: 'paragraph', content: 'Other document text' }] }],
    });
  });
  await expect(page.locator('.publication-document-canvas .omi-continuous-tiptap-editor > p[data-block-id="other-block"]')).toContainText('Other document text');
  await returnToAuthor(page);
  await expect(author.locator('[data-block-id="other-block"]')).toContainText('Other document text');
  await expect(author.locator('[data-block-id="source-0"]')).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.id;
  })).toBe('other-manuscript');
});

test('publication activity releases the author view on close and when resizing into preview mode', async ({ page }) => {
  const author = await prepare(page);
  await expect(author).toBeVisible();
  for (let cycle = 0; cycle < 2; cycle++) {
    await openPublication(page);
    await expect(page.locator('[data-authoring-suspended="true"]')).toHaveCount(1);
    if (cycle === 0) {
      await page.setViewportSize({ width: 393, height: 851 });
      await expect(page.locator('[data-authoring-suspended="false"]')).toHaveCount(1);
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.locator('[data-authoring-suspended="true"]')).toHaveCount(1);
    }
    await returnToAuthor(page);
    await expect(page.locator('[data-authoring-suspended="false"]')).toHaveCount(1);
    expect(await author.evaluate(element => (element as HTMLElement & { editor: Editor }).editor.isEditable)).toBe(true);
  }
});
