import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
async function openPublication(page: Page) {
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  return menu.locator('.publication-style-editor');
}
async function setup(page: Page) {
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } = await import('/src/services/publicationStyleExport.ts');
    const { capturePublicationPageStyle } = await import('/src/model/publicationPageStyles.ts');
    const style = clonePublicationStyleTemplate();
    style.page.width = 120; style.page.height = 170; style.page.margins = { top: 20, bottom: 20, inner: 20, outer: 20 };
    const plate = capturePublicationPageStyle(style, 'plate', 'Plate'); plate.page.width = 150; plate.page.height = 180;
    style.pageStyles = { version: 1, styles: [plate], sections: [{ sectionId: 'b', startNewPage: true }], pages: [] };
    localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
    const current = useStudioStore.getState().manuscript;
    const rich = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    useStudioStore.getState().loadManuscript({ ...current, title: 'Thumbnail trial', abstract: '', keywords: [],
      sections: [
        { id: 'a', title: 'Study A', blocks: [{ id: 'a-body', type: 'paragraph', content: rich('Long content carries its identity through page navigation. '.repeat(65)) }] },
        { id: 'child', parentSectionId: 'a', title: 'Child', blocks: [{ id: 'child-body', type: 'paragraph', content: rich('CHILD_TEXT') }] },
        { id: 'b', title: 'Study B', blocks: [{ id: 'b-body', type: 'paragraph', content: rich('LAST_BODY_PARAGRAPH') }] },
      ],
    });
  });
  return openPublication(page);
}

test('body thumbnails navigate, move complete studies, insert after the last page, move/delete blanks and persist', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  let editor = await setup(page);
  await editor.getByRole('button', { name: 'Page thumbnails', exact: true }).click();
  let navigator = editor.locator('#publication-style-ribbon-panel-thumbnails .publication-page-navigator');
  const thumbnails = () => navigator.locator('[data-thumbnail-page]');
  await expect.poll(() => thumbnails().count()).toBeGreaterThan(2);
  await thumbnails().last().click();
  const lastNumber = await thumbnails().last().locator('.publication-page-thumbnail-caption>span').innerText();
  await expect(editor.locator(`.publication-document-page-guide[data-page-number="${lastNumber}"]`)).toBeInViewport();
  await navigator.getByRole('combobox', { name: 'New page style in thumbnails' }).selectOption('plate');
  const originalCount = await thumbnails().count();
  await navigator.getByRole('button', { name: 'Add page after', exact: true }).click();
  await expect(thumbnails()).toHaveCount(originalCount + 1);
  const blank = navigator.locator('[data-thumbnail-id^="inserted:"]');
  await expect(blank).toHaveAttribute('data-thumbnail-style', 'plate');
  await expect(blank.locator('[data-style-letter]')).toHaveText('B');
  await expect(editor.locator('[data-inserted-page]')).toHaveCount(1);
  // Capture the actual browser drag/drop sequence if the native drag fails
  // while Chromium auto-scrolls the vertically docked thumbnails.
  await page.evaluate(() => {
    (window as typeof window & { __omiPageDragEvents?: string[] }).__omiPageDragEvents = [];
    for (const type of ['dragstart', 'dragover', 'drop', 'dragend']) document.addEventListener(type, (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-thumbnail-id]') : null;
      if (target && type !== 'dragover') (window as typeof window & { __omiPageDragEvents?: string[] }).__omiPageDragEvents?.push(`${type}:${target.getAttribute('data-thumbnail-id')}`);
    }, { capture: true, once: false });
  });
  // Both ends must be visible before the HTML5 drag starts. Otherwise
  // Chromium scrolls the list underneath the starting pointer and may drag
  // a neighbouring page rather than the requested inserted sheet.
  await thumbnails().first().scrollIntoViewIfNeeded();
  await blank.scrollIntoViewIfNeeded();
  await expect(thumbnails().first()).toBeInViewport();
  await expect(blank).toBeInViewport();
  const draggedId = await blank.getAttribute('data-thumbnail-id');
  await blank.dragTo(thumbnails().first(), { sourcePosition: { x: 20, y: 20 }, targetPosition: { x: 20, y: 20 } });
  const events = await page.evaluate(
    () => (window as typeof window & { __omiPageDragEvents?: string[] }).__omiPageDragEvents ?? []);
  expect(events.find((event) => event.startsWith('dragstart:'))).toBe(`dragstart:${draggedId}`);
  await expect(thumbnails().first()).toHaveAttribute('data-thumbnail-id', /^inserted:/);
  await navigator.getByRole('button', { name: 'Move page later', exact: true }).click();
  await expect(thumbnails().first()).not.toHaveAttribute('data-thumbnail-id', /^inserted:/);
  await navigator.getByRole('button', { name: 'Delete page', exact: true }).click();
  await expect(thumbnails()).toHaveCount(originalCount);
  await expect(editor.locator('[data-inserted-page]')).toHaveCount(0);
  // Move the last study to the front by dragging one of its page thumbnails.
  await thumbnails().last().dragTo(thumbnails().first());
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.sections.map((section) => section.id);
  })).toEqual(['b', 'a', 'child']);
  await expect(editor.locator('[data-block-id="child-body"]').first()).toContainText('CHILD_TEXT');
  await thumbnails().first().click();
  await navigator.getByRole('button', { name: 'Add page before', exact: true }).click();
  await expect(navigator.locator('[data-thumbnail-id^="inserted:"]')).toHaveCount(1);
  // A leading blank is also a usable drop target for a complete study.
  await thumbnails().last().dragTo(thumbnails().first());
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.sections.map((section) => section.id);
  })).toEqual(['a', 'child', 'b']);
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { resumeLastSessionPersistence } = await import('/src/app/lastSessionPersistence.ts');
    useStudioStore.getState().checkpoint('manual'); await resumeLastSessionPersistence();
  });
  await page.reload(); editor = await openPublication(page);
  await editor.getByRole('button', { name: 'Page thumbnails', exact: true }).click();
  navigator = editor.locator('#publication-style-ribbon-panel-thumbnails .publication-page-navigator');
  await expect(navigator.locator('[data-thumbnail-id^="inserted:"]')).toHaveAttribute('data-thumbnail-style', 'plate');
  await page.setViewportSize({ width: 480, height: 900 });
  // At mobile widths the Studio switches to its preview layout: the
  // thumbnail navigator moves back inside the canvas, above the page.
  navigator = editor.locator('.publication-document-canvas > .publication-page-navigator');
  await expect(navigator).toBeVisible();
  await expect(navigator.getByRole('button', { name: 'Add page before', exact: true })).toBeVisible();
  expect(await navigator.evaluate((element) => element.scrollWidth <= element.clientWidth + 2)).toBe(true);
  expect(await editor.locator('.publication-document-canvas-stage').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(50);
  await page.screenshot({ path: testInfo.outputPath('page-thumbnails-mobile.png') });
});

test('frame thumbnails carry their style and objects through moves, navigation, insertion and deletion', async ({ page }) => {
  test.setTimeout(90_000);
  const editor = await setup(page);
  await editor.getByRole('button', { name: 'Frames and page styles', exact: true }).click();
  await page.evaluate(async () => {
    const { createDefaultFlowFrameLayout } = await import('/src/model/publicationAutoFlow.ts');
    const { defaultFramePageStyle, insertFramePage } = await import('/src/model/publicationFramePages.ts');
    const { stageFrameLayout } = await import('/src/app/publicationFrameActions.ts');
    let layout = createDefaultFlowFrameLayout(); layout.stories[0]!.text = 'ORIGINAL_FRAME_TEXT';
    layout.stories[0]!.autoContinue = false;
    layout.pageStyles!.push({ ...defaultFramePageStyle(240, 150), id: 'wide', name: 'Landscape' });
    layout = insertFramePage(layout, 0, 'wide', 'wide-page');
    stageFrameLayout(layout);
  });
  const frames = editor.locator('.omi-frame-editor');
  const navigator = frames.locator('.publication-page-navigator');
  const pages = navigator.locator('[data-thumbnail-page]');
  await expect(pages).toHaveCount(2);
  await expect(pages.last().locator('[data-style-letter]')).toHaveText('B');
  await pages.last().dragTo(pages.first());
  await expect(pages.first()).toHaveAttribute('data-thumbnail-id', 'wide-page');
  await pages.last().click();
  await expect(frames.getByRole('combobox', { name: 'Selected page', exact: true })).toHaveValue('1');
  await expect(frames.locator('[data-frame-page="1"]')).toBeInViewport();
  await expect(frames.getByRole('textbox', { name: 'Story text', exact: true })).toHaveValue('ORIGINAL_FRAME_TEXT');
  await navigator.getByRole('combobox', { name: 'New page style in thumbnails' }).selectOption('wide');
  await navigator.getByRole('button', { name: 'Add page after', exact: true }).click();
  await expect(pages).toHaveCount(3);
  await expect(pages.last()).toHaveAttribute('data-thumbnail-style', 'wide');
  await navigator.getByRole('button', { name: 'Move page earlier', exact: true }).click();
  await expect(pages.nth(1)).toHaveAttribute('aria-current', 'page');
  await navigator.getByRole('button', { name: 'Delete page', exact: true }).click();
  await expect(pages).toHaveCount(2);
  await expect(frames.getByRole('textbox', { name: 'Story text', exact: true })).toHaveValue('ORIGINAL_FRAME_TEXT');
  await page.setViewportSize({ width: 480, height: 900 });
  await expect(navigator).toBeVisible();
  await navigator.getByRole('button', { name: 'Add page after', exact: true }).click();
  await expect(pages).toHaveCount(3);
  await navigator.getByRole('button', { name: 'Delete page', exact: true }).click();
  await expect(pages).toHaveCount(2);
});
