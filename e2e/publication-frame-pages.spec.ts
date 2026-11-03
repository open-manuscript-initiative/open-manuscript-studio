import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

async function openEditor(page: Page, image = false) {
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async (image) => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createImageBlock } = await import('/src/model/visualBlocks.ts');
    const manuscript = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...manuscript, title: 'Styled publication', sections: [{ id: 'source', title: '', blocks: image ? [
      createImageBlock({ src: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#dd7744"/><rect x="0" width="100" height="100" fill="#4477aa"/><circle cx="100" cy="50" r="35" fill="#e8ca67"/></svg>'), mediaType: 'image/svg+xml', alt: 'Wide colored graphic' }, 'image-source'),
    ] : [] }] });
  }, image);
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();
  await menu.getByRole('button', { name: 'Frame layout', exact: true }).click();
  // This suite verifies backwards compatibility for documents created before
  // automatic A4 frames. New-document behaviour is covered separately below.
  await page.evaluate(async () => {
    const { createFrameLayout } = await import('/src/model/publicationFrames.ts');
    const { stageFrameLayout } = await import('/src/app/publicationFrameActions.ts');
    stageFrameLayout(createFrameLayout());
  });
  return menu.locator('.omi-frame-editor');
}
async function model(page: Page) {
  return page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { getFrameLayout } = await import('/src/model/publicationFrames.ts');
    return getFrameLayout(useStudioStore.getState().manuscript)!;
  });
}
async function expand(root: Locator, label: string) {
  const summary = root.getByText(label, { exact: true });
  if (!await summary.evaluate((element) => (element.parentElement as HTMLDetailsElement).open)) await summary.click();
}
async function downloadHtml(page: Page, editor: Locator) {
  const pending = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Download frame HTML', exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}

test('custom page styles, insertion/deletion and running headers persist into mixed-size PDF pages', async ({ page, context }, testInfo) => {
  const editor = await openEditor(page);
  await editor.getByRole('button', { name: 'New page style', exact: true }).click();
  await expand(editor, 'Edit page style');
  await editor.getByRole('textbox', { name: 'Page style name', exact: true }).fill('Portrait custom');
  await expand(editor, 'Running headers');
  await editor.getByRole('checkbox', { name: 'Show running headers', exact: true }).check();
  await editor.getByRole('textbox', { name: 'Header left', exact: true }).fill('{title}');
  await editor.getByRole('textbox', { name: 'Header center', exact: true }).fill('{style}');
  await editor.getByRole('textbox', { name: 'Header right', exact: true }).fill('{page}/{pages}');
  await editor.getByRole('checkbox', { name: 'Different even-page headers', exact: true }).check();
  await editor.getByRole('textbox', { name: 'Even header left', exact: true }).fill('Even {page}');
  await editor.getByRole('textbox', { name: 'Even header center', exact: true }).fill('{title}');
  await editor.getByRole('textbox', { name: 'Even header right', exact: true }).fill('{page}/{pages}');
  await editor.getByRole('button', { name: 'Add text frame', exact: true }).click();
  const story = 'Text retained when deleting its page.';
  await editor.getByRole('textbox', { name: 'Story text', exact: true }).fill(story);
  const portraitId = (await model(page)).pages![0]!.styleId;
  await editor.getByRole('button', { name: 'Add page', exact: true }).click();
  await editor.getByRole('button', { name: 'New page style', exact: true }).click();
  await expand(editor, 'Edit page style');
  await editor.getByRole('textbox', { name: 'Page style name', exact: true }).fill('Wide custom');
  await editor.getByRole('spinbutton', { name: 'Page width (mm)', exact: true }).fill('240');
  await editor.getByRole('spinbutton', { name: 'Page height (mm)', exact: true }).fill('150');
  await expect(editor.locator('[data-frame-page="0"] .omi-frame-running-header')).toContainText('1/2');
  await expect(editor.locator('[data-frame-page="1"] .omi-frame-running-header')).toContainText('Even 2');
  const html = await downloadHtml(page, editor);
  expect(html).toContain('size:240mm 150mm'); expect(html).toContain('Even 2');
  const proof = await context.newPage(); await proof.setContent(html);
  await proof.pdf({ path: testInfo.outputPath('mixed-page-styles.pdf'), preferCSSPageSize: true, printBackground: true }); await proof.close();
  await editor.getByRole('combobox', { name: 'Selected page', exact: true }).selectOption('0');
  await editor.getByRole('button', { name: 'Delete selected page', exact: true }).click();
  await expect.poll(async () => (await model(page)).page.count).toBe(1);
  await expect(editor.getByRole('status')).toContainText('Text does not fit');
  await expect.poll(async () => (await model(page)).stories[0]!.text).toBe(story);
  const storyId = (await model(page)).stories[0]!.id;
  await editor.getByRole('combobox', { name: 'Retained story', exact: true }).selectOption(storyId);
  await editor.getByRole('button', { name: 'Add text frame', exact: true }).click();
  await expect(editor.getByRole('status')).toHaveCount(0);
  await editor.getByRole('combobox', { name: 'Style for new page', exact: true }).selectOption(portraitId);
  await editor.getByRole('button', { name: 'Add page', exact: true }).click();
  const saved = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { serializeOmiJson } = await import('/src/services/exportOmi.ts');
    const { parseOmiJson } = await import('/src/services/omiPortableFormat.ts');
    const { getFrameLayout } = await import('/src/model/publicationFrames.ts');
    return getFrameLayout(parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript)))!;
  });
  expect(saved.pages![1]!.styleId).toBe(portraitId);
  expect(saved.stories[0]!.text).toBe(story);
  await page.setViewportSize({ width: 480, height: 900 });
  await expect(editor.locator('.omi-frame-inspector')).toHaveCount(0);
  await expect(editor.locator('.omi-frame-running-header')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('page-style-mobile.png') });
});

test('graphic content scales with or without ratio lock, pans and rotates inside a fixed clipping frame', async ({ page, context }, testInfo) => {
  const editor = await openEditor(page, true);
  await editor.getByRole('button', { name: 'Add graphic frame', exact: true }).click();
  await expect(editor.locator('.omi-frame-graphic-content img')).toBeVisible();
  const original = (await model(page)).frames[0]!;
  await editor.getByRole('spinbutton', { name: 'Graphic width (mm)', exact: true }).fill('130');
  await expect.poll(async () => (await model(page)).frames[0]!.graphicTransform!.heightMm).toBeCloseTo(65);
  await editor.getByRole('checkbox', { name: 'Keep graphic proportions', exact: true }).uncheck();
  await editor.getByRole('spinbutton', { name: 'Graphic height (mm)', exact: true }).fill('35');
  await editor.getByRole('spinbutton', { name: 'Graphic X (mm)', exact: true }).fill('-18');
  await editor.getByRole('spinbutton', { name: 'Graphic Y (mm)', exact: true }).fill('12');
  await editor.getByRole('spinbutton', { name: 'Graphic rotation (°)', exact: true }).fill('27.5');
  let frame = (await model(page)).frames[0]!;
  expect([frame.xMm, frame.yMm, frame.widthMm, frame.heightMm, frame.rotation]).toEqual([original.xMm, original.yMm, original.widthMm, original.heightMm, original.rotation]);
  expect(frame.graphicTransform!.widthMm).toBe(130); expect(frame.graphicTransform!.heightMm).toBe(35);
  const pan = editor.getByRole('button', { name: 'Move graphic inside frame', exact: true });
  const box = await pan.boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 6, box!.y + 6); await page.mouse.down();
  await page.mouse.move(box!.x + 20, box!.y + 12, { steps: 3 }); await page.mouse.up();
  await expect.poll(async () => (await model(page)).frames[0]!.graphicTransform!.offsetXMm).toBeGreaterThan(-18);
  await editor.getByRole('checkbox', { name: 'Keep graphic proportions', exact: true }).check();
  const ratio = frame.graphicTransform!.widthMm / frame.graphicTransform!.heightMm;
  await editor.getByRole('spinbutton', { name: 'Graphic width (mm)', exact: true }).fill('145');
  frame = (await model(page)).frames[0]!;
  expect(frame.graphicTransform!.widthMm / frame.graphicTransform!.heightMm).toBeCloseTo(ratio);
  await editor.getByRole('combobox', { name: 'Frame shape', exact: true }).selectOption('ellipse');
  await editor.getByRole('spinbutton', { name: 'Rotation (°)', exact: true }).fill('15.25');
  await editor.getByRole('spinbutton', { name: 'Graphic rotation (°)', exact: true }).fill('-33.5');
  const html = await downloadHtml(page, editor);
  expect(html).toContain('rotate(15.25deg)'); expect(html).toContain('rotate(-33.5deg)'); expect(html).toContain('scale(');
  const proof = await context.newPage(); await proof.setContent(html);
  await expect(proof.locator('.omi-frame-graphic')).toHaveCSS('overflow', 'hidden');
  await expect(proof.locator('.omi-frame-graphic')).toHaveCSS('clip-path', /ellipse/);
  await proof.pdf({ path: testInfo.outputPath('clipped-graphic.pdf'), preferCSSPageSize: true, printBackground: true });
  await proof.screenshot({ path: testInfo.outputPath('clipped-graphic.png'), fullPage: true }); await proof.close();
  await page.setViewportSize({ width: 480, height: 900 });
  await expect(editor.locator('.omi-frame-graphic-position')).toHaveAttribute('style', /rotate\(-33.5deg\)/);
  await expect(editor.locator('.omi-frame-inspector')).toHaveCount(0);
});
