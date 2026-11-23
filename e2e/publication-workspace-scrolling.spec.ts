import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

async function openPublication(page: Page) {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  return {
    content: menu.locator('.studio-menu-content--publication-editor'),
    editor: menu.locator('.publication-style-editor'),
  };
}

// Desktop Chrome tests also cover the responsive web UI used by Android WebView.
for (const viewport of [
  { width: 393, height: 851, label: 'mobile portrait' },
  { width: 851, height: 393, label: 'mobile landscape' },
  { width: 820, height: 900, label: 'tablet' },
  { width: 1024, height: 768, label: 'compact desktop' },
]) {
  test(`publication controls and the page canvas remain reachable on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const { content, editor } = await openPublication(page);
    const stage = editor.locator('.publication-document-canvas-stage');

    await expect(content).toHaveCSS('overflow-y', 'auto');
    await expect(editor.locator('.publication-document-canvas')).toBeVisible();
    await expect(stage).toHaveCSS('overflow-y', 'auto');
    await expect(stage).toBeVisible();

    if (viewport.width <= 720) {
      await expect(editor).toHaveClass(/publication-style-editor--preview/);
      const pageStyle = editor.getByRole('combobox', { name: 'New page style in thumbnails' });
      await expect(pageStyle).toBeAttached();
      await pageStyle.scrollIntoViewIfNeeded();
      await expect(pageStyle).toBeInViewport();
      // Scrolling the parent must reveal the preview *below* the page toolbar.
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toBeInViewport({ ratio: 0.1 });
      const dimensions = await content.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight + 10);
      await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      // The canvas mode and the inspector still work after scrolling.
      await editor.getByRole('button', { name: 'HTML5 visual editor', exact: true }).click();
      await expect(editor.locator('.publication-document-canvas-stage--html')).toBeVisible();
      const frames = editor.getByRole('button', { name: 'Frames and page styles', exact: true });
      await frames.scrollIntoViewIfNeeded();
      await frames.click();
      await expect(editor.locator('.publication-frame-inspector-panel')).toBeVisible();
      await editor.getByRole('button', { name: 'Close frame tools', exact: true }).click();
    } else {
      await expect(editor).not.toHaveClass(/publication-style-editor--preview/);
      await expect(editor.locator('.publication-style-ribbon')).toBeVisible();
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toBeInViewport({ ratio: 0.1 });
    }
  });
}

test('wide desktop keeps its fixed publishing shell and independent document scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { content, editor } = await openPublication(page);
  // Desktop's general menu rule permits auto overflow; what matters is that
  // the document stage keeps its own scrolling and the docked rail stays visible.
  await expect(content).toHaveCSS('overflow-y', 'auto');
  await expect(editor.locator('.publication-style-ribbon')).toHaveCSS('display', 'grid');
  const canvas = editor.locator('.publication-document-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas.locator('.publication-document-canvas-stage')).toHaveCSS('overflow-y', 'auto');
  await editor.getByRole('button', { name: 'Page thumbnails', exact: true }).click();
  await expect(editor.locator('#publication-style-ribbon-panel-thumbnails .publication-page-navigator')).toBeVisible();
});

test('native-style preview remains scrollable even with a desktop-width viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const { content, editor } = await openPublication(page);
  // Native Android preview mode can remain active at large landscape widths.
  await editor.evaluate((element) => element.classList.add('publication-style-editor--preview'));
  await expect(content).toHaveCSS('overflow-y', 'auto');
  await expect(editor).toHaveCSS('overflow', 'visible');
  await expect(editor.locator('.publication-document-canvas-stage')).toHaveCSS('overflow-y', 'auto');
});

test('volume cover controls are reachable in the mobile publication workspace', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 740 });
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
  const editor = menu.locator('.publication-style-editor');
  const content = menu.locator('.studio-menu-content--publication-editor');
  await editor.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
  await expect(content).toHaveCSS('overflow-y', 'auto');
  const matter = editor.locator('.omi-publication-matter-editor');
  await expect(matter).toBeVisible();
  await matter.getByRole('checkbox', { name: 'Include in publication' }).check();
  const addTextFrame = matter.getByRole('button', { name: 'Add text frame', exact: true });
  await addTextFrame.scrollIntoViewIfNeeded();
  await expect(addTextFrame).toBeInViewport();
  await editor.getByRole('tab', { name: 'Publication content', exact: true }).click();
  await expect(editor.locator('.publication-document-canvas')).toBeVisible();
});
