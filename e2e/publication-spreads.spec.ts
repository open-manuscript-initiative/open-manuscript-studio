import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';


declare global {
  interface Window {
    __omiSpreadPersistence?: {
      hasEdit: () => boolean;
      roundTrip: () => { facingPages?: boolean; pageNumberStart?: number };
    };
  }
}

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

test('facing pages keep continued paragraphs, table rows and footnotes editable on their sheets', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 2800 });
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  // Load a real browser module, not a CDP-awaited dynamic-import Promise.
  // The module exposes synchronous checks only in this isolated test page.
  // Wait for readiness explicitly; a module failure must fail the test.
  await page.addScriptTag({ type: 'module', content: [
    "    import { useStudioStore } from '/src/app/useStudioStore.ts';",
    "    import { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY, loadPublicationStyle } from '/src/services/publicationStyleExport.ts';",
    "    import { serializeOmiJson } from '/src/services/exportOmi.ts';",
    "    import { parseOmiJson } from '/src/services/omiPortableFormat.ts';",
    "    import { createNoteAnnotation } from '/src/model/notes.ts';",
    "    import { createTableBlock } from '/src/model/visualBlocks.ts';",
    "    const style = clonePublicationStyleTemplate();",
    "    style.page.pageNumberStart = 2;",
    "    localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));",
    "    const current = useStudioStore.getState().manuscript;",
    "    const rich = (index: number) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [",
    "      { type: 'text', text: `Paragraph ${index}. ` + 'Continuous text crossing the spine and flowing onto the next sheet. '.repeat(65) },",
    "      { type: 'omiNote', attrs: { noteId: `n-${index}`, anchorId: `a-${index}`, label: `${index + 1}`, noteType: 'footnote' } },",
    "      { type: 'text', text: ' After the note.' },",
    "    ] }] });",
    "    useStudioStore.getState().loadManuscript({ ...current, title: 'Facing pages trial', sections: [{ id: 's', title: '', blocks: [",
    "      ...Array.from({ length: 3 }, (_, i) => ({ id: `p-${i}`, type: 'paragraph', content: rich(i) })),",
    "      createTableBlock(Array.from({ length: 50 }, (_, i) => [`Row ${i}`, 'Table text. '.repeat(4)]), {}, 'spread-table'),",
    "    ] }], annotations: Array.from({ length: 3 }, (_, i) => createNoteAnnotation({",
    "      id: `n-${i}`, anchorId: `a-${i}`, targetBlockId: `p-${i}`, body: `Note ${i}. ` + 'A footnote on its reference page. '.repeat(5),",
    "    })) });",
    "    window.__omiSpreadPersistence = {",
    "      hasEdit: () => useStudioStore.getState().manuscript.sections.some(section => section.blocks.some(block => block.content.includes('EDITED'))),",
    "      roundTrip: () => {",
    "        useStudioStore.getState().checkpoint('manual');",
    "        return loadPublicationStyle(parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript))).page;",
    "      },",
    "    };",
    "",
  ].join('\n') });
  await page.waitForFunction(() => typeof window.__omiSpreadPersistence?.roundTrip === 'function');
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const editor = menu.locator('.publication-style-editor');
  const pageSettings = editor.getByRole('button', { name: 'Print page', exact: true });
  await pageSettings.click();
  await editor.getByRole('checkbox', { name: 'Facing pages', exact: true }).check();
  await expect(editor.getByRole('spinbutton', { name: 'First page number', exact: true })).toHaveValue('3');
  await pageSettings.click();
  const canvas = editor.locator('.publication-document-canvas');
  await canvas.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('50');
  const paper = canvas.locator('.publication-document-paper--spreads');
  await expect(paper).toBeVisible();
  const guides = canvas.locator('.publication-document-page-guide');
  await expect.poll(() => guides.count()).toBeGreaterThan(4);
  const positions = await guides.evaluateAll((items) => items.slice(0, 5).map((item) => ({
    number: item.getAttribute('data-page-number'), x: parseFloat((item as HTMLElement).style.left),
    top: parseFloat((item as HTMLElement).style.top), side: item.getAttribute('data-page-side'),
  })));
  expect(positions.map((p) => p.number)).toEqual(['3', '4', '5', '6', '7']);
  expect(positions[0]!.x).toBeGreaterThan(positions[1]!.x);
  expect(positions[1]!.top).toBe(positions[2]!.top);
  expect(positions[3]!.top).toBe(positions[4]!.top);
  expect(positions.map((p) => p.side)).toEqual(['right', 'left', 'right', 'left', 'right']);

  // Audit physical line rectangles, including long paragraph continuations and
  // table cells, against the actual sheets rather than vertical page strides.
  const audit = () => canvas.evaluate((root) => {
    const sheets = Array.from(root.querySelectorAll<HTMLElement>('.publication-document-page-guide')).map((el) => ({ el, rect: el.getBoundingClientRect() }));
    const failures: string[] = [];
    const flow = root.querySelector('.omi-continuous-tiptap-editor')!;
    const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (parent?.closest('.omi-table-actions, .omi-table-editor-wrap, [contenteditable="false"]')) continue;
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) {
        if (rect.width < .1 || rect.height < .1) continue;
        const sheet = sheets.find(({ rect: box }) => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
        if (!sheet) failures.push(`line outside sheets: ${walker.currentNode.textContent?.slice(0, 20)} (${Math.round(rect.x)}, ${Math.round(rect.y)})`);
      }
    }
    for (const anchor of root.querySelectorAll<HTMLElement>('[data-omi-note]')) {
      const rect = anchor.getBoundingClientRect();
      const note = root.querySelector<HTMLElement>(`[data-footnote-page] [data-publication-note-id="${anchor.dataset.noteId}"]`);
      const area = note?.closest<HTMLElement>('[data-footnote-page]');
      if (!area) { failures.push(`missing note ${anchor.dataset.noteId}`); continue; }
      const box = area.getBoundingClientRect();
      if (rect.left < box.left - 2 || rect.right > box.right + 2 || rect.bottom > box.top + 1) failures.push(`misplaced note ${anchor.dataset.noteId}`);
    }
    return failures;
  });
  await expect.poll(audit).toEqual([]);
  const continuation = canvas.locator('.omi-publication-spread-continuation').first();
  await expect(continuation).toBeVisible();
  await continuation.click(); await page.keyboard.type('EDITED ');
  await expect.poll(() => page.evaluate(() => window.__omiSpreadPersistence!.hasEdit())).toBe(true);
  await expect.poll(audit).toEqual([]);
  const saved = await page.evaluate(() => window.__omiSpreadPersistence!.roundTrip());
  await page.evaluate(() => { delete window.__omiSpreadPersistence; });
  expect(saved.facingPages).toBe(true); expect(saved.pageNumberStart).toBe(3);
  await pageSettings.click(); await editor.getByRole('checkbox', { name: 'Facing pages', exact: true }).uncheck(); await pageSettings.click();
  await expect(paper).toHaveCount(0);
  await expect(canvas.locator('.omi-publication-spread-continuation')).toHaveCount(0);
});

test('new paragraphs on the first right-hand page retain a valid projection during editing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } = await import('/src/services/publicationStyleExport.ts');
    const style = clonePublicationStyleTemplate();
    style.page.facingPages = true; style.page.pageNumberStart = 1;
    localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
    const current = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...current, title: 'Live layout', sections: [{ id: 's', title: '', blocks: Array.from({ length: 45 }, (_, i) => ({ id: 'live-' + i, type: 'paragraph', content: 'Short paragraph ' + i })) }] });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  await expect(canvas.locator('.publication-document-paper--spreads')).toBeVisible();
  const first = canvas.locator('.omi-continuous-tiptap-editor > [data-block-id="live-0"]');
  await expect(first).toBeVisible();
  const onFirstSheet = () => canvas.evaluate(root => {
    const sheet = root.querySelector('.publication-document-page-guide[data-page-number="1"]')?.getBoundingClientRect();
    const first = root.querySelector('.omi-continuous-tiptap-editor > [data-block-id="live-0"]');
    if (!sheet || !first) return false;
    return [first, first.nextElementSibling].every(el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.left >= sheet.left - 1 && rect.right <= sheet.right + 1;
    });
  });
  await expect.poll(onFirstSheet).toBe(true);
  await first.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('New live paragraph');
  await expect(canvas.locator('.omi-continuous-tiptap-editor > p').filter({ hasText: 'New live paragraph' })).toBeVisible();
  await expect.poll(onFirstSheet).toBe(true);
  await expect(canvas.locator('.omi-continuous-tiptap-editor > p').filter({ hasText: 'New live paragraph' })).toHaveAttribute('data-block-id', /.+/);
});
