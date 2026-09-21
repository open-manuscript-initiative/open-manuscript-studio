import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('the full-screen menu opens the live publication editor', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();

  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await expect(menu).toBeVisible();

  const viewport = page.viewportSize();
  const menuBox = await menu.boundingBox();
  expect(viewport).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(menuBox?.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 1);
  expect(menuBox?.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);

  await expect(menu.getByRole('navigation', { name: 'Manuscript menu' })).toBeVisible();
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();

  await expect(menu.getByRole('heading', { name: 'Live publication editor' })).toBeVisible();
  await expect(menu.getByRole('toolbar', { name: 'Live publication editor' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Paragraph styles', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Typesetting proofing', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'HTML5 visual editor', exact: true })).toBeVisible();
  await expect(menu.locator('.publication-document-canvas')).toBeVisible();
  expect(api.unhandledRequests).toEqual([]);
});

test('HTML5 visual editing is responsive and preserves changes when returning to print', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();

  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  const printView = canvas.getByRole('button', { name: 'Print layout', exact: true });
  const htmlView = canvas.getByRole('button', { name: 'HTML5 visual editor', exact: true });

  await expect(printView).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas.locator('.publication-document-page-guide')).not.toHaveCount(0);
  await expect(canvas.getByRole('combobox', { name: 'Zoom', exact: true })).toBeVisible();

  await htmlView.click();
  await expect(htmlView).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas.locator('[data-publication-view="html"]')).toBeVisible();
  await expect(canvas.locator('.publication-document-page-guide')).toHaveCount(0);
  await expect(canvas.locator('.publication-document-ruler')).toHaveCount(0);
  await expect(canvas.getByRole('combobox', { name: 'Zoom', exact: true })).toHaveCount(0);
  await expect(canvas.getByText('Responsive width', { exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Print page', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Typesetting proofing', exact: true })).toHaveCount(0);

  const title = canvas.getByRole('textbox', { name: 'Document title', exact: true });
  await title.fill('Edited in the HTML5 visual editor');
  expect(await canvas.locator('.publication-document-canvas-stage--html').evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )).toBe(true);

  await printView.click();
  await expect(printView).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas.locator('.publication-document-page-guide')).not.toHaveCount(0);
  await expect(title).toHaveValue('Edited in the HTML5 visual editor');
  expect(api.unhandledRequests).toEqual([]);
});

test('live pages place each footnote below its anchor and reflow after zoom and editing', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createNoteAnnotation } = await import('/src/model/notes.ts');
    const manuscript = useStudioStore.getState().manuscript;
    const blocks = Array.from({ length: 18 }, (_, index) => ({
      id: `footnote-block-${index}`, type: 'paragraph',
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: `Paragraph ${index}. ` + 'Text flows across publication pages. '.repeat(16) },
        { type: 'omiNote', attrs: { noteId: `note-${index}`, anchorId: `anchor-${index}`, label: String(index + 1), noteType: 'footnote' } },
        { type: 'text', text: ' Following text.' },
      ] }] }),
    }));
    useStudioStore.getState().loadManuscript({
      ...manuscript, title: 'Page footnotes',
      sections: [{ id: 'footnote-section', title: '', blocks }],
      annotations: blocks.map((block, index) => createNoteAnnotation({
        id: `note-${index}`, anchorId: `anchor-${index}`, targetBlockId: block.id,
        body: `Footnote ${index + 1}. ` + 'A note belonging to the referenced page. '.repeat(index === 17 ? 120 : 3),
      })),
    });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  const audit = () => canvas.evaluate((root) => {
    const pages = Array.from(root.querySelectorAll('.publication-document-page-guide'));
    const notes = Array.from(root.querySelectorAll<HTMLElement>('[data-footnote-page]'));
    if (!notes.length) return ['no footnotes'];
    const failures: string[] = [];
    for (const anchor of root.querySelectorAll<HTMLElement>('[data-omi-note]')) {
      const rect = anchor.getBoundingClientRect();
      const pageIndex = pages.findIndex((sheet) => {
        const box = sheet.getBoundingClientRect();
        return rect.top >= box.top && rect.bottom <= box.bottom;
      });
      const area = notes.find((note) => Number(note.dataset.footnotePage) === pageIndex);
      const note = area?.querySelector(`[data-publication-note-id="${anchor.dataset.noteId}"]`);
      if (!note || rect.bottom > area!.getBoundingClientRect().top + 1) failures.push(anchor.dataset.noteId!);
    }
    // Every text line, including lines without a note marker, must clear the note area.
    const walker = document.createTreeWalker(root.querySelector('.omi-continuous-tiptap-editor')!, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement?.closest('[contenteditable="false"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) {
        for (const area of notes) {
          const box = area.getBoundingClientRect();
          if (rect.top < box.bottom && rect.bottom > box.top + 1) failures.push(`text overlaps footnotes: ${walker.currentNode.textContent?.slice(0, 35)} at ${rect.top}..${rect.bottom}, notes ${area.dataset.footnotePage}: ${box.top}..${box.bottom}`);
        }
      }
    }
    return failures;
  });
  await expect.poll(audit).toEqual([]);
  await canvas.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('50');
  await expect.poll(audit).toEqual([]);
  await canvas.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('100');
  await expect.poll(audit).toEqual([]);
  const editor = canvas.locator('.omi-continuous-tiptap-editor');
  await editor.locator('p').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText('Additional content changes the page breaks. '.repeat(30));
  await expect.poll(audit).toEqual([]);
  await expect(canvas.locator('[data-note-continuation]')).not.toHaveCount(0);
});
