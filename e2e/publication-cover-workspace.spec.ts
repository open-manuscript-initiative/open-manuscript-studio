import { expect, test } from '@playwright/test';
import type { Editor } from '@tiptap/core';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

const viewports: { width: number; height: number; nativePreview?: boolean }[] = [
  { width: 1917, height: 906 },
  { width: 1280, height: 600 },
  { width: 1024, height: 768 },
  { width: 393, height: 740 },
  { width: 851, height: 393 },
  { width: 1280, height: 600, nativePreview: true },
];

for (const viewport of viewports) {
  test(`cover canvas and settings stay reachable at ${viewport.width}×${viewport.height}${viewport.nativePreview ? ' in native preview' : ''}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { createDocumentStructureProfile } = await import('/src/model/documentProfile.ts');
      const state = useStudioStore.getState();
      state.loadManuscript({ ...state.manuscript, documentStructure: createDocumentStructureProfile('volume') });
    });
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
    await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
    if (viewport.nativePreview) await menu.locator('.publication-style-editor').evaluate(element => element.classList.add('publication-style-editor--preview'));
    await menu.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
    const matter = menu.locator('.omi-publication-matter-editor');
    const paper = matter.locator('.omi-publication-matter-paper');
    const stage = matter.locator('.omi-matter-canvas-stage');
    if (viewport.height < 500) await stage.scrollIntoViewIfNeeded();
    // Opening the workspace must show the cover without scrolling past settings.
    await expect(paper).toBeInViewport({ ratio: 0.95 });
    await page.screenshot({ path: testInfo.outputPath('cover-workspace.png') });
    await expect(stage).toHaveCSS('overflow-y', 'auto');
    const inspector = matter.locator('.omi-matter-inspector');
    if (viewport.width > 1150 && !viewport.nativePreview) {
      await expect(inspector).toHaveCSS('overflow-y', 'auto');
      await inspector.locator('.omi-matter-spine-panel > summary').click();
      const before = await stage.boundingBox();
      const position = await inspector.boundingBox();
      await page.mouse.move(position!.x + position!.width / 2, position!.y + position!.height / 2);
      await page.mouse.wheel(0, 1200);
      await expect.poll(() => inspector.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await stage.boundingBox()).toEqual(before);
      await expect(paper).toBeInViewport({ ratio: 0.95 });
    }
    // A selected frame adds a substantial inspector; it must not displace the page.
    await matter.getByRole('button', { name: 'Add text frame', exact: true }).click();
    const text = matter.getByRole('textbox', { name: 'Text frame content', exact: true });
    await text.fill('Visible publication cover');
    await expect(paper).toBeInViewport({ ratio: 0.95 });
    const settings = matter.locator('.omi-matter-frame-settings');
    await settings.getByRole('textbox', { name: 'Frame name', exact: true }).fill('Cover title');
    await settings.getByRole('button', { name: 'Delete frame', exact: true }).scrollIntoViewIfNeeded();
    await settings.getByRole('button', { name: 'Delete frame', exact: true }).click();
    await matter.getByRole('tab', { name: 'Title page', exact: true }).click();
    const savedMatter = () => page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { getPublicationMatter } = await import('/src/model/publicationMatter.ts');
      return JSON.stringify(getPublicationMatter(useStudioStore.getState().manuscript));
    });
    const original = await savedMatter();
    // The tall title page has its own scroll area in a short window.
    await matter.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('100');
    const tallPaper = matter.locator('.omi-publication-matter-paper');
    await stage.scrollIntoViewIfNeeded();
    await expect(tallPaper).toBeInViewport();
    const stageBounds = await stage.boundingBox();
    await page.mouse.move(stageBounds!.x + stageBounds!.width / 2, stageBounds!.y + stageBounds!.height / 2);
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => stage.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    if (viewport.width < 720) {
      await page.mouse.wheel(1200, 0);
      await expect.poll(() => stage.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    }
    await matter.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('fit');
    await stage.scrollIntoViewIfNeeded();
    await expect(paper).toBeInViewport({ ratio: 0.95 });
    expect(await savedMatter()).toBe(original);
    const width = await matter.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
    await menu.getByRole('tab', { name: 'Publication content', exact: true }).click();
    await expect(menu.locator('.publication-document-canvas')).toBeVisible();
  });
}

test('large volume cover transitions suspend the body editor and preserve its instance and edits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Maximum update depth|Cannot update a component/.test(message.text())) errors.push(message.text());
  });
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createDocumentStructureProfile } = await import('/src/model/documentProfile.ts');
    const state = useStudioStore.getState();
    state.loadManuscript({ ...state.manuscript, documentStructure: createDocumentStructureProfile('volume'),
      sections: [{ id: 'cover-body', title: 'Body',
        blocks: Array.from({ length: 320 }, (_, index) => ({ id: 'cover-body-' + index, type: 'paragraph' as const,
          content: 'Body paragraph ' + index + ' — ' + 'Scholarly text. '.repeat(12) })) }] });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const body = menu.locator('.publication-document-canvas .omi-continuous-tiptap-editor');
  await expect(body).toBeVisible();
  const handle = await body.evaluateHandle(element => ({ element, editor: (element as HTMLElement & { editor: Editor }).editor }));
  const target = body.locator('[data-block-id="cover-body-0"]');
  await target.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' EDITED');
  await expect(target).toContainText('EDITED');
  for (let cycle = 0; cycle < 2; cycle++) {
    await menu.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
    const matter = menu.locator('.omi-publication-matter-editor');
    await expect(matter.locator('.omi-publication-matter-paper')).toBeInViewport({ ratio: .95 });
    expect(await handle.evaluate(({ editor }) => editor.isEditable)).toBe(false);
    await matter.getByRole('tab', { name: 'Title page', exact: true }).click();
    await expect(matter.locator('.omi-publication-matter-paper')).toBeInViewport({ ratio: .95 });
    await menu.getByRole('tab', { name: 'Publication content', exact: true }).click();
    await expect(body).toBeVisible();
    await expect(target).toContainText('EDITED');
    expect(await handle.evaluate(({ editor, element }) => editor.isEditable && editor.view.dom === element && element.isConnected)).toBe(true);
  }
  expect(errors).toEqual([]);
  await handle.dispose();
});
