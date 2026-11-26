import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('semantic text roles offer editable point presets, languages and inherited note citation settings', async ({ page }) => {
  test.setTimeout(90_000);
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createNoteAnnotation } = await import('/src/model/notes.ts');
    const current = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...current, title: 'Semantic typography fixture', locale: 'hu-HU', motto: 'A short motto', abstract: 'An abstract', keywords: ['History', 'Archives'],
      bibliographicRecords: [{ id: 'bib', type: 'journal-article', title: 'Structured Notes', contributors: [{ id: 'a', role: 'author', familyName: 'Scholar', givenName: 'Ada' }], issued: '2026', identifiers: [], status: 'verified' }],
      sections: [{ id: 's', title: 'Section heading', blocks: [{ id: 'p', type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Original body text.' }, { type: 'omiNote', attrs: { noteId: 'n', anchorId: 'a', label: '1', noteType: 'footnote' } },
      ] }] }) }] }],
      annotations: [{ ...createNoteAnnotation({ id: 'n', anchorId: 'a', targetBlockId: 'p', body: 'See also' }), noteCitations: [{ id: 'nc', target: 'bib' }] }],
    });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  await expect(canvas.locator('.publication-document-keywords')).toHaveText('History · Archives');
  await menu.getByRole('button', { name: 'Paragraph styles', exact: true }).click();
  const panel = menu.locator('.publication-style-ribbon-panel--paragraph-styles');
  const list = panel.locator('.publication-paragraph-style-list');
  for (const name of ['Title', 'Motto', 'Abstract', 'Keywords', 'Quotation', 'Note', 'Citation', 'Citation in notes']) await expect(list.getByRole('option', { name, exact: true })).toBeVisible();
  await list.getByRole('option', { name: 'Title', exact: true }).click();
  await panel.getByRole('button', { name: 'Basic character formats', exact: true }).click();
  const size = panel.getByRole('spinbutton', { name: 'Size', exact: true });
  const sizeOptions = panel.getByRole('combobox', { name: 'Size', exact: true });
  await expect(sizeOptions.locator('option[value="12"]')).toHaveText('12 pt');
  await sizeOptions.selectOption('14');
  await expect(size).toHaveValue('14');
  await size.fill('27.3');
  await panel.getByRole('spinbutton', { name: 'Leading', exact: true }).fill('32.7');
  await panel.getByRole('button', { name: 'Advanced character formats', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Language', exact: true }).fill('de-DE');
  await expect.poll(() => canvas.locator('.publication-document-title').evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-locale'))).toContain('de-DE');
  await expect.poll(() => canvas.locator('.publication-document-title').evaluate((element) => {
    const css = getComputedStyle(element); return Math.round(parseFloat(css.lineHeight) / parseFloat(css.fontSize) * 1000);
  })).toBe(Math.round(32.7 / 27.3 * 1000));
  await list.getByRole('option', { name: 'Heading 1', exact: true }).click();
  await panel.getByRole('button', { name: 'Basic character formats', exact: true }).click();
  await panel.getByRole('spinbutton', { name: 'Size', exact: true }).fill('19.4');
  await panel.getByRole('spinbutton', { name: 'Leading', exact: true }).fill('24.6');
  await expect.poll(() => canvas.locator('.omi-continuous-tiptap-editor > h1[data-section-id="s"]').evaluate((element) => {
    const css = getComputedStyle(element); return Math.round(parseFloat(css.lineHeight) / parseFloat(css.fontSize) * 1000);
  })).toBe(Math.round(24.6 / 19.4 * 1000));
  await list.getByRole('option', { name: 'Citation in notes', exact: true }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    useStudioStore.getState().checkpoint('manual');
  });
  await expect(list.getByRole('option', { name: 'Citation in notes', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('combobox', { name: 'First citation style', exact: true })).toBeVisible();
  await panel.getByRole('combobox', { name: 'First citation style', exact: true }).selectOption('apa-7');
  await panel.getByRole('combobox', { name: 'Subsequent citation style', exact: true }).selectOption('mla-9');
  await list.getByRole('option', { name: 'Title', exact: true }).click();
  await panel.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await panel.getByRole('button', { name: 'General', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Style name', exact: true }).fill('Source title');
  const result = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { loadPublicationStyle, renderStyleBasedHtml, clonePublicationPublisherTemplate, resolvePublicationParagraphStyle } = await import('/src/services/publicationStyleExport.ts');
    const { getPublicationProfile } = await import('/src/model/publicationProfile.ts');
    const manuscript = useStudioStore.getState().manuscript;
    const style = loadPublicationStyle(manuscript);
    const title = style.paragraphStyles.items.find((item) => item.role === 'title')!;
    const before = JSON.stringify(manuscript);
    const html = await renderStyleBasedHtml(manuscript, getPublicationProfile('omi-generic-scholarly')!, 'html', { style, identity: clonePublicationPublisherTemplate(), embedAssets: false });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { title: resolvePublicationParagraphStyle(style, title.id, manuscript.locale), custom: style.paragraphStyles.items.some((item) => item.name === 'Source title' && !item.role),
      first: style.noteCitationStyles?.first, subsequent: style.noteCitationStyles?.subsequent, lang: doc.querySelector('.article-front h1')?.getAttribute('lang'),
      citation: doc.querySelector('.omi-note-citation')?.textContent, unchanged: JSON.stringify(manuscript) === before, locale: manuscript.locale };
  });
  expect(result.title.fontSize).toBe(27.3); expect(result.title.lineHeight).toBe(32.7); expect(result.title.language).toBe('de-DE');
  expect(result.custom).toBe(true); expect(result.first).toBe('apa-7'); expect(result.subsequent).toBe('mla-9'); expect(result.lang).toBe('de-DE');
  expect(result.citation).toContain('Scholar'); expect(result.unchanged).toBe(true); expect(result.locale).toBe('hu-HU');
});

test('HTML keeps three alignments and print keeps justification and language patterns', async ({ page }) => {
  test.setTimeout(90_000);
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } = await import('/src/services/publicationStyleExport.ts');
    const style = clonePublicationStyleTemplate();
    style.styles.body.alignment = 'justify';
    style.paragraphStyles.items[0]!.properties.alignment = 'justify';
    localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
    const current = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...current, title: 'Print typography fixture', locale: 'hu-HU', sections: [{ id: 's', title: '', blocks: [
      { id: 'p', type: 'paragraph', content: 'megszentségteleníthetetlenségeskedéseitekért '.repeat(3) },
    ] }] });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  const paragraph = canvas.locator('p[data-block-id="p"]');
  await expect.poll(() => paragraph.evaluate((el) => getComputedStyle(el).textAlign)).toBe('justify');
  await canvas.getByRole('button', { name: 'HTML5 visual editor', exact: true }).click();
  await expect.poll(() => paragraph.evaluate((el) => getComputedStyle(el).textAlign)).toBe('left');
  await expect.poll(() => paragraph.evaluate((el) => getComputedStyle(el).hyphens)).toBe('none');
  await menu.getByRole('button', { name: 'Typography', exact: true }).click();
  const controls = menu.locator('.publication-style-alignment');
  await expect(controls.getByRole('button')).toHaveCount(3);
  await expect(controls.getByRole('button', { name: 'Justified', exact: true })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Typography', exact: true }).click();
  await canvas.getByRole('button', { name: 'Print layout', exact: true }).click();
  await expect.poll(() => paragraph.evaluate((el) => getComputedStyle(el).textAlign)).toBe('justify');
  await menu.getByRole('button', { name: 'Typography', exact: true }).click();
  await expect(controls.getByRole('button')).toHaveCount(4);
  const result = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { clonePublicationStyleTemplate, clonePublicationPublisherTemplate, renderStyleBasedHtml } = await import('/src/services/publicationStyleExport.ts');
    const { getPublicationProfile } = await import('/src/model/publicationProfile.ts');
    const manuscript = useStudioStore.getState().manuscript;
    const style = clonePublicationStyleTemplate();
    const context = { style, identity: clonePublicationPublisherTemplate(), embedAssets: false };
    const profile = getPublicationProfile('omi-generic-scholarly')!;
    const before = JSON.stringify(manuscript);
    const printed = await renderStyleBasedHtml(manuscript, profile, 'print', context);
    const html = await renderStyleBasedHtml(manuscript, profile, 'html', context);
    return { printBreaks: printed.includes('\u00ad'), htmlBreaks: html.includes('\u00ad'), unchanged: JSON.stringify(manuscript) === before };
  });
  expect(result).toEqual({ printBreaks: true, htmlBreaks: false, unchanged: true });
});

test('frame justification and Hungarian hyphenation agree in preview and export', async ({ page }) => {
  test.setTimeout(90_000);
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createFrameLayout, FRAME_LAYOUT_EXTENSION, RECTANGLE_POINTS } = await import('/src/model/publicationFrames.ts');
    const layout = createFrameLayout();
    layout.styles[0]!.properties = { ...layout.styles[0]!.properties, alignment: 'justify', paddingMm: 0, language: 'hu-HU' };
    layout.stories = [{ id: 's', name: 'S', text: 'Magyar megszentségteleníthetetlenségeskedéseitekért szöveg. '.repeat(3) }];
    layout.frames = [{ id: 'f', name: 'F', kind: 'text', page: 0, xMm: 15, yMm: 20, widthMm: 43, heightMm: 180,
      rotation: 0, shape: 'rectangle', points: structuredClone(RECTANGLE_POINTS), styleId: layout.styles[0]!.id, storyId: 's' }];
    const current = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...current, locale: 'hu-HU', extensions: { ...current.extensions, [FRAME_LAYOUT_EXTENSION]: layout } });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  await menu.getByRole('button', { name: 'Frames and page styles', exact: true }).click();
  const editor = menu.locator('.omi-frame-editor');
  await expect(editor.locator('[data-hyphenated]')).not.toHaveCount(0);
  await expect.poll(() => editor.locator('[data-frame-line]').evaluateAll((lines) => lines.some((line) => parseFloat(getComputedStyle(line).wordSpacing) > 0))).toBe(true);
  await editor.getByText('Edit shared style', { exact: true }).click();
  await expect(editor.getByRole('combobox', { name: 'Alignment', exact: true }).locator('option')).toHaveCount(4);
  await editor.getByRole('checkbox', { name: 'Language-based hyphenation', exact: true }).uncheck();
  await expect(editor.locator('[data-hyphenated]')).toHaveCount(0);
  await editor.getByRole('checkbox', { name: 'Language-based hyphenation', exact: true }).check();
  await expect(editor.locator('[data-hyphenated]')).not.toHaveCount(0);
  const result = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { getFrameLayout } = await import('/src/model/publicationFrames.ts');
    const { buildFrameExport } = await import('/src/services/publicationFrameRendering.ts');
    const manuscript = useStudioStore.getState().manuscript;
    const layout = getFrameLayout(manuscript)!;
    const before = layout.stories[0]!.text;
    const html = await buildFrameExport(manuscript, layout);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { unchanged: layout.stories[0]!.text === before, hyphens: doc.querySelectorAll('[data-hyphenated]').length,
      previewHyphens: document.querySelectorAll('.omi-frame-editor [data-hyphenated]').length,
      spacing: html.includes('word-spacing:'), sourceBreaks: before.includes('\u00ad') };
  });
  expect(result.unchanged).toBe(true); expect(result.sourceBreaks).toBe(false);
  expect(result.hyphens).toBeGreaterThan(0); expect(result.hyphens).toBe(result.previewHyphens);
  expect(result.spacing).toBe(true);
});

test('title-only publication accepts typing and reaches an idle pagination state', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const current = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...current, title: 'Title', subtitle: '', motto: '', abstract: '', keywords: [],
      sections: [{ id: 'empty-section', title: '', blocks: [{ id: 'empty-paragraph', type: 'paragraph', content: '' }] }],
    });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  const title = canvas.locator('textarea.publication-document-title');
  await expect(title).toHaveValue('Title');
  await title.press('End');
  await title.pressSequentially(' only manuscript');
  await expect(title).toHaveValue('Title only manuscript');
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.title;
  })).toBe('Title only manuscript');
  // Observe a quiet interval after typing; pagination must not keep triggering
  // itself through the autosizing textarea's inline height writes.
  await expect.poll(() => canvas.locator('.publication-document-content').evaluate(async (element) => {
    let passes = 0;
    const observer = new MutationObserver((records) => { passes += records.length; });
    observer.observe(element, { attributes: true, attributeFilter: ['data-publication-measuring'] });
    await new Promise<void>((resolve) => { setTimeout(resolve, 400); });
    observer.disconnect();
    return passes;
  }), { timeout: 10_000 }).toBe(0);
});

test('initial publication layout exposes readiness without locking the manuscript', async ({ page }) => {
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  await expect(canvas.locator('textarea.publication-document-title')).toBeEditable();
  await expect(canvas).toHaveAttribute('data-publication-layout-ready', 'true');
  await expect(canvas.locator('.publication-layout-preparing')).toHaveCount(0);
  await canvas.getByRole('button', { name: 'HTML5 visual editor', exact: true }).click();
  await expect(canvas).not.toHaveAttribute('data-publication-layout-ready', /.+/);
  await canvas.getByRole('button', { name: 'Print layout', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-publication-layout-ready', 'true');
  await expect(canvas.locator('textarea.publication-document-title')).toBeEditable();
});
