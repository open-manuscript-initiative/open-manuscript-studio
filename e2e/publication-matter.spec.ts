import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const width of [1440, 393]) {
  test(`volume covers and title pages are independently editable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { createDocumentStructureProfile } = await import('/src/model/documentProfile.ts');
      const state = useStudioStore.getState();
      state.loadManuscript({ ...state.manuscript, title: 'Publication matter fixture', documentStructure: createDocumentStructureProfile('volume') });
    });
    const initialSections = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      return JSON.stringify(useStudioStore.getState().manuscript.sections);
    });
    await page.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
    const panel = page.locator('.omi-publication-matter-editor');
    const include = panel.getByRole('checkbox', { name: 'Include in publication' });
    const content = panel.getByRole('textbox', { name: 'Page text', exact: true });
    await expect(include).not.toBeChecked();
    await include.check();
    await content.fill('Independent front cover');
    await content.press('ControlOrMeta+a');
    await panel.getByRole('button', { name: 'Bold / strong', exact: true }).click();
    await expect(content.locator('strong')).toHaveText('Independent front cover');
    await panel.getByRole('spinbutton', { name: 'Font size (pt)' }).fill('24');
    await panel.getByRole('spinbutton', { name: 'Font size (pt)' }).press('Tab');
    await panel.getByRole('tab', { name: 'IV. Back cover – outside', exact: true }).click();
    await expect(include).not.toBeChecked();
    await include.check();
    await content.fill('Independent back cover');
    await panel.getByRole('tab', { name: 'I. Front cover – outside', exact: true }).click();
    await expect(content.locator('strong')).toHaveText('Independent front cover');
    await panel.getByLabel('Upload cover image').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8C8AAAAASUVORK5CYII=', 'base64') });
    await expect(panel.locator('.omi-publication-matter-paper > img')).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      return JSON.stringify(useStudioStore.getState().manuscript.sections);
    })).toBe(initialSections);
    const output = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { renderHtmlArticle } = await import('/src/services/exportHtml.ts');
      return renderHtmlArticle(useStudioStore.getState().manuscript).html;
    });
    expect(output.indexOf('Independent front cover')).toBeLessThan(output.indexOf('<article class="omi-scholarly-article"'));
    expect(output.indexOf('Independent back cover')).toBeGreaterThan(output.indexOf('</article>'));
  });
}
