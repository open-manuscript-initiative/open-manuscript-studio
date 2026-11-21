import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

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
    useStudioStore.getState().loadManuscript({ ...current, locale: 'hu-HU', sections: [{ id: 's', title: '', blocks: [
      { id: 'p', type: 'paragraph', content: 'megszentségteleníthetetlenségeskedéseitekért '.repeat(3) },
    ] }] });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const canvas = menu.locator('.publication-document-canvas');
  const paragraph = canvas.locator('[data-block-id="p"]');
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
