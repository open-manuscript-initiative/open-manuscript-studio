import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

test('section headers and individual page masters reflow, persist and feed PDF output', async ({ page }) => {
  test.setTimeout(120_000);
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const current = useStudioStore.getState().manuscript;
    const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } = await import('/src/services/publicationStyleExport.ts');
    const baseStyle = clonePublicationStyleTemplate();
    baseStyle.paragraphStyles.items.find((item) => item.id === baseStyle.paragraphStyles.defaultStyleId)!.properties = { leftIndent: 6, rightIndent: 3 };
    localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(baseStyle));
    const rich = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    useStudioStore.getState().loadManuscript({ ...current, title: 'Journal issue', sections: ['First article', 'Second article'].map((title, index) => ({
      id: `article-${index}`, title,
      blocks: Array.from({ length: 12 }, (_, i) => ({ id: `block-${index}-${i}`, type: 'paragraph', content: rich(`Paragraph ${i + 1}. ` + 'Text for testing journal page layouts and headers. '.repeat(8)) })),
    })) });
  });
  const originalParagraphs = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.sections.flatMap((section) => section.blocks)
      .filter((block) => block.type === 'paragraph')
      .map((block) => ({ id: block.id, text: JSON.parse(block.content).content[0].content.map((node: { text?: string }) => node.text ?? '').join('') }));
  });
  expect(originalParagraphs).toHaveLength(24);
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const editor = menu.locator('.publication-style-editor');
  await editor.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('50');
  expect(await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { getAppliedPublicationTemplate } = await import('/src/model/publicationTemplates.ts');
    return Boolean(getAppliedPublicationTemplate(useStudioStore.getState().manuscript));
  })).toBe(false);
  const toggle = editor.getByRole('button', { name: 'Page styles and section headers', exact: true });
  await toggle.click();
  const panel = editor.locator('.publication-page-styles-panel');
  await panel.getByRole('button', { name: 'Save current page settings as a style', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Page style name', exact: true }).fill('Article opening');
  await panel.getByRole('spinbutton', { name: 'Top margin (mm)', exact: true }).fill('35');
  await panel.getByRole('combobox', { name: 'Section', exact: true }).selectOption('article-0');
  const styleId = await panel.getByRole('combobox', { name: 'Page style', exact: true }).inputValue();
  await panel.getByRole('combobox', { name: 'Section page style', exact: true }).selectOption(styleId);
  await panel.getByRole('checkbox', { name: 'Use a section-specific running header', exact: true }).check();
  await panel.getByRole('checkbox', { name: 'Show header on the first page of this section', exact: true }).check();
  await panel.getByRole('textbox', { name: 'Odd page — left', exact: true }).fill('Author A — {{sectionTitle}}');
  await panel.getByRole('textbox', { name: 'Even page — left', exact: true }).fill('Author A — {{pageNumber}}');
  await panel.getByRole('combobox', { name: 'Section', exact: true }).selectOption('article-1');
  await panel.getByRole('checkbox', { name: 'Use a section-specific running header', exact: true }).check();
  await panel.getByRole('checkbox', { name: 'Show header on the first page of this section', exact: true }).check();
  await panel.getByRole('textbox', { name: 'Odd page — left', exact: true }).fill('Author B — {{sectionTitle}}');
  await panel.getByRole('textbox', { name: 'Even page — left', exact: true }).fill('Author B — {{sectionTitle}}');
  await toggle.click();
  const guides = editor.locator('.publication-document-page-guide');
  await editor.getByRole('button', { name: 'Page thumbnails', exact: true }).click();
  const navigator = editor.locator('#publication-style-ribbon-panel-thumbnails .publication-page-navigator');
  await expect.poll(() => guides.filter({ has: page.locator('.publication-document-running-header', { hasText: 'Author A' }) }).count()).toBeGreaterThan(0);
  // Page guides are virtualized. Navigate to each study before checking its header.
  await navigator.getByRole('button', { name: /Second article/ }).first().click();
  await expect.poll(() => guides.filter({ has: page.locator('.publication-document-running-header', { hasText: 'Author B' }) }).count()).toBeGreaterThan(0);
  await expect.poll(() => guides.filter({ has: page.locator('.publication-document-running-header', { hasText: 'Author B' }) }).first().getAttribute('data-page-style')).toBe('default');
  await navigator.locator('[data-thumbnail-page="0"]').click();
  await expect(guides.filter({ has: page.locator('.publication-document-running-header', { hasText: 'Author A' }) }).first()).toBeAttached();
  const body = editor.locator('.omi-continuous-tiptap-editor > [data-block-id="block-0-0"]');
  const horizontal = await body.evaluate((el) => {
    const computed = getComputedStyle(el);
    const guide = document.querySelector<HTMLElement>('.publication-document-page-guide[data-section-id="article-0"]')!;
    return { occupied: el.getBoundingClientRect().width + parseFloat(computed.marginLeft) + parseFloat(computed.marginRight),
      available: guide.getBoundingClientRect().width - parseFloat(guide.style.getPropertyValue('--omi-publication-page-left-margin')) - parseFloat(guide.style.getPropertyValue('--omi-publication-page-right-margin')) };
  });
  expect(horizontal.occupied).toBeLessThanOrEqual(horizontal.available + 1);
  const firstGuide = editor.locator('.publication-document-page-guide[data-page-number="1"]');
  const before = await firstGuide.evaluate((el) => ({ top: getComputedStyle(el).getPropertyValue('--omi-publication-page-top-margin'), height: el.getBoundingClientRect().height }));
  await toggle.click();
  await panel.getByRole('spinbutton', { name: 'From page number', exact: true }).fill('1');
  await panel.getByRole('spinbutton', { name: 'To page number', exact: true }).fill('1');
  await panel.getByRole('button', { name: 'Apply to pages', exact: true }).click();
  await toggle.click();
  await expect(firstGuide).toHaveAttribute('data-page-style', styleId);
  const after = await firstGuide.evaluate((el) => ({ top: getComputedStyle(el).getPropertyValue('--omi-publication-page-top-margin'), height: el.getBoundingClientRect().height }));
  expect(parseFloat(after.top)).toBeGreaterThan(parseFloat(before.top)); expect(after.height).toBeCloseTo(before.height, 1);
  const result = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { serializeOmiJson } = await import('/src/services/exportOmi.ts');
    const { parseOmiJson } = await import('/src/services/omiPortableFormat.ts');
    const { loadPublicationStyle, withPrintRunningHeader, clonePublicationPublisherTemplate } = await import('/src/services/publicationStyleExport.ts');
    useStudioStore.getState().checkpoint('manual');
    const restored = parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    const style = loadPublicationStyle(restored);
    const html = withPrintRunningHeader('<html><head></head><body></body></html>', restored, style, clonePublicationPublisherTemplate());
    useStudioStore.getState().loadManuscript(restored);
    return { collection: style.pageStyles!, html, paragraphs: restored.sections.flatMap((s) => s.blocks).filter((block) => block.type === 'paragraph').map((block) => ({ id: block.id, text: JSON.parse(block.content).content[0].content.map((node: { text?: string }) => node.text ?? '').join('') })) };
  });
  expect(result.collection.styles[0]!.name).toBe('Article opening');
  expect(result.collection.sections).toHaveLength(2); expect(result.collection.pages).toHaveLength(1);
  expect(result.paragraphs).toEqual(originalParagraphs);
  expect(result.html).toContain('Author A'); expect(result.html).toContain('Author B'); expect(result.html).toContain(':nth(n+1):nth(-n+1)');
  await expect(firstGuide).toHaveAttribute('data-page-style', styleId);
});
