import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('frame stories link, split and reflow with shared/local styles, shapes, graphics and mobile preview', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createImageBlock } = await import('/src/model/visualBlocks.ts');
    const manuscript = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...manuscript, title: 'Frame publication',
      sections: [{ id: 'frame-source', title: 'Source', blocks: [
        { id: 'original-paragraph', type: 'paragraph', content: 'Original structured manuscript text.' },
        createImageBlock({ src: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#ddbb88"/><circle cx="100" cy="75" r="45" fill="#739883"/></svg>'), mediaType: 'image/svg+xml', alt: 'Geometric test graphic' }, 'frame-graphic'),
      ] }],
    });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();
  await menu.getByRole('button', { name: 'Frame layout', exact: true }).click();
  const editor = menu.locator('.omi-frame-editor');
  const model = () => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { getFrameLayout } = await import('/src/model/publicationFrames.ts');
    return getFrameLayout(useStudioStore.getState().manuscript)!;
  });
  await editor.getByRole('button', { name: 'Add text frame' }).click();
  const first = (await model()).frames[0]!.id;
  await editor.getByRole('spinbutton', { name: 'Height (mm)', exact: true }).fill('30');
  const text = 'Flow words through connected frames. '.repeat(20);
  await editor.getByRole('textbox', { name: 'Story text', exact: true }).fill(text);
  await expect(editor.getByRole('status')).toContainText('Text does not fit');
  await editor.getByRole('button', { name: 'Add text frame' }).click();
  const second = (await model()).frames[1]!.id;
  await editor.getByRole('spinbutton', { name: 'X (mm)', exact: true }).fill('80');
  await editor.getByRole('spinbutton', { name: 'Height (mm)', exact: true }).fill('150');
  await editor.getByRole('combobox', { name: 'Select frame', exact: true }).selectOption(first);
  await editor.getByRole('combobox', { name: 'Link to text frame', exact: true }).selectOption(second);
  await editor.getByRole('button', { name: 'Link frames', exact: true }).click();
  await expect.poll(async () => (await model()).stories.length).toBe(1);
  await expect(editor.getByRole('status')).toHaveCount(0);
  await expect(editor.locator(`[data-frame-id="${second}"] [data-frame-line]`)).not.toHaveCount(0);
  await expect.poll(async () => (await editor.locator('[data-frame-line]').allTextContents()).join('')).toBe(text);
  await editor.getByRole('button', { name: 'Unlink continuation' }).click();
  await expect.poll(async () => (await model()).stories.map((story) => story.text).join('')).toBe(text);
  await expect.poll(async () => (await model()).stories.length).toBe(2);
  await editor.getByRole('combobox', { name: 'Link to text frame', exact: true }).selectOption(second);
  await editor.getByRole('button', { name: 'Link frames', exact: true }).click();
  await editor.getByText('Edit shared style', { exact: true }).click();
  await editor.getByRole('spinbutton', { name: 'Font size (pt)' }).fill('12');
  await expect.poll(async () => (await model()).styles[0]!.properties.fontSizePt).toBe(12);
  await editor.getByRole('combobox', { name: 'Select frame', exact: true }).selectOption(second);
  await editor.getByRole('checkbox', { name: 'Local style overrides' }).check();
  await editor.getByRole('spinbutton', { name: 'Font size (pt)' }).last().fill('9');
  await expect.poll(async () => (await model()).frames[1]!.overrides?.fontSizePt).toBe(9);
  await editor.getByRole('combobox', { name: 'Select frame', exact: true }).selectOption(first);
  const move = editor.locator(`[data-frame-id="${first}"] .omi-frame-move`);
  const beforeX = (await model()).frames[0]!.xMm;
  const box = await move.boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 10, box!.y + 5); await page.mouse.down();
  await page.mouse.move(box!.x + 30, box!.y + 10, { steps: 3 }); await page.mouse.up();
  await expect.poll(async () => (await model()).frames[0]!.xMm).toBeGreaterThan(beforeX);
  const resize = editor.locator(`[data-frame-id="${first}"] .omi-frame-resize`);
  const beforeWidth = (await model()).frames[0]!.widthMm;
  const resizeBox = await resize.boundingBox(); expect(resizeBox).not.toBeNull();
  await page.mouse.move(resizeBox!.x + 4, resizeBox!.y + 4); await page.mouse.down();
  await page.mouse.move(resizeBox!.x + 14, resizeBox!.y + 10, { steps: 3 }); await page.mouse.up();
  await expect.poll(async () => (await model()).frames[0]!.widthMm).toBeGreaterThan(beforeWidth);
  await editor.getByRole('spinbutton', { name: 'Rotation (°)' }).fill('37.5');
  await editor.getByRole('combobox', { name: 'Frame shape' }).selectOption('polygon');
  await editor.getByRole('spinbutton', { name: 'X 2 (%)', exact: true }).fill('75');
  await editor.getByRole('spinbutton', { name: 'Y 2 (%)', exact: true }).fill('20');
  await expect(editor.locator(`[data-frame-id="${first}"]`)).toHaveCSS('transform', /matrix/);
  await expect.poll(async () => (await model()).frames[0]!.points[1]!.x).toBe(75);
  const outlinePoint = editor.locator(`[data-frame-id="${first}"] .omi-frame-point`).nth(1);
  const pointBox = await outlinePoint.boundingBox(); expect(pointBox).not.toBeNull();
  await page.mouse.move(pointBox!.x + 5, pointBox!.y + 5); await page.mouse.down();
  await page.mouse.move(pointBox!.x + 10, pointBox!.y + 10, { steps: 3 }); await page.mouse.up();
  await expect.poll(async () => (await model()).frames[0]!.points[1]!.x).not.toBe(75);

  await editor.getByRole('button', { name: 'Add graphic frame' }).click();
  await editor.getByRole('combobox', { name: 'Frame shape' }).selectOption('ellipse');
  await editor.getByRole('spinbutton', { name: 'Y (mm)', exact: true }).fill('150');
  await editor.getByRole('spinbutton', { name: 'Height (mm)', exact: true }).fill('55');
  await expect(editor.locator('.omi-frame-graphic-content img')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Download frame HTML' })).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Download frame HTML' }).click();
  const download = await downloadPromise; const html = await readFile((await download.path())!, 'utf8');
  expect(html).toContain('rotate(37.5deg)'); expect(html).toContain('data:image/svg+xml;base64,');
  expect((html.match(/class="omi-publication-frame"/g) ?? []).length).toBe(3);
  await download.saveAs(testInfo.outputPath('frames-publication.html'));
  const printProof = await page.context().newPage();
  await printProof.setContent(html);
  await printProof.pdf({ path: testInfo.outputPath('frames-publication.pdf'), preferCSSPageSize: true });
  await printProof.close();
  await page.setViewportSize({ width: 480, height: 900 });
  await expect(editor.locator('.omi-frame-inspector')).toHaveCount(0);
  await expect(editor.locator('.omi-frame-tools')).toHaveCount(0);
  await expect(editor.locator('.omi-frame-object')).toHaveCount(3);
  await expect(menu.locator('.publication-mobile-preview-note')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-frames.png') });
  const serialized = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { serializeOmiJson } = await import('/src/services/exportOmi.ts');
    const { parseOmiJson } = await import('/src/services/omiPortableFormat.ts');
    return JSON.stringify(parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript)).sections);
  });
  expect(serialized).toContain('Original structured manuscript text.');
});

test('graphic frame exports retain the rendered vector chart and printable page size', async ({ page, context }, testInfo) => {
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createChartBlock } = await import('/src/model/visualBlocks.ts');
    const manuscript = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({ ...manuscript, title: 'Chart publication', sections: [{ id: 'charts', title: '', blocks: [createChartBlock([['Year', 'Count'], ['2026', '14'], ['2027', '17']], {}, 'chart-source')] }] });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();
  await menu.getByRole('button', { name: 'Frame layout', exact: true }).click();
  const editor = menu.locator('.omi-frame-editor');
  await editor.getByRole('button', { name: 'Add graphic frame' }).click();
  await expect(editor.locator('.omi-chart-svg')).toBeVisible();
  const pending = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Download frame HTML' }).click();
  const download = await pending;
  const html = await readFile((await download.path())!, 'utf8');
  expect(html).toContain('omi-chart-svg'); expect(html).toContain('<rect');
  expect(html).not.toContain('<table');
  const proof = await context.newPage();
  await proof.setContent(html);
  await proof.pdf({ path: testInfo.outputPath('frame-chart.pdf'), preferCSSPageSize: true });
  await proof.close();
});
