import { expect, test, type Page } from '@playwright/test';
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
    await openPublicationMatter(page);
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


for (const width of [1440, 393]) {
  test(`title-page text and image frames retain independent geometry and artwork at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { createDocumentStructureProfile } = await import('/src/model/documentProfile.ts');
      const state = useStudioStore.getState();
      state.loadManuscript({ ...state.manuscript, documentStructure: createDocumentStructureProfile('volume') });
    });
    await openPublicationMatter(page);
    const panel = page.locator('.omi-publication-matter-editor');
    await panel.getByRole('tab', { name: 'Title page', exact: true }).click();
    await panel.getByRole('checkbox', { name: 'Include in publication' }).check();
    await panel.getByRole('button', { name: 'Add text frame', exact: true }).click();
    const settings = panel.locator('.omi-matter-frame-settings');
    await settings.getByRole('textbox', { name: 'Frame name', exact: true }).fill('Title');
    const text = panel.getByRole('textbox', { name: 'Text frame content', exact: true });
    await text.fill('Framed title');
    await text.press('ControlOrMeta+a');
    await panel.getByRole('button', { name: 'Bold / strong', exact: true }).click();
    await expect(text.locator('strong')).toHaveText('Framed title');
    await settings.getByLabel('Frame shape', { exact: true }).selectOption('polygon');
    await expect(panel.locator('.omi-matter-frame-point')).toHaveCount(4);
    await settings.getByRole('button', { name: 'Add point', exact: true }).click();
    await expect(panel.locator('.omi-matter-frame-point')).toHaveCount(5);
    await settings.getByRole('button', { name: 'Remove point', exact: true }).click();
    await panel.getByRole('button', { name: 'Add graphic frame', exact: true }).click();
    await settings.getByRole('textbox', { name: 'Frame name', exact: true }).fill('Artwork');
    await settings.getByLabel('Insert image in frame', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8C8AAAAASUVORK5CYII=', 'base64') });
    await expect(panel.locator('.omi-matter-frame-image > img')).toBeVisible();
    const numeric = async (name: string, value: string) => {
      const input = settings.getByRole('spinbutton', { name, exact: true });
      await input.fill(value); await input.press('Tab');
    };
    await numeric('Width (mm)', '100'); await numeric('Height (mm)', '90');
    await numeric('Rotation (°)', '15');
    await numeric('Graphic X (mm)', '-10'); await numeric('Graphic rotation (°)', '-20');
    await settings.getByRole('checkbox', { name: 'Keep graphic proportions', exact: true }).uncheck();
    await numeric('Graphic width (mm)', '110'); await numeric('Graphic height (mm)', '70');
    await expect(settings.getByRole('spinbutton', { name: 'Width (mm)', exact: true })).toHaveValue('100');
    await expect(settings.getByRole('spinbutton', { name: 'Height (mm)', exact: true })).toHaveValue('90');
    const artworkId = (await panel.locator('[data-frame-kind="graphic"]').getAttribute('data-matter-frame-id'))!;
    await panel.getByRole('button', { name: 'Add text frame', exact: true }).click();
    await settings.getByRole('textbox', { name: 'Frame name', exact: true }).fill('Overlay');
    await panel.getByRole('textbox', { name: 'Text frame content', exact: true }).fill('Overlay text');
    const overlayId = (await panel.locator('.omi-matter-frame.is-selected').getAttribute('data-matter-frame-id'))!;
    const topFrameAtOverlayCenter = async () => {
      const overlay = panel.locator('.omi-matter-frame').filter({ has: page.getByRole('textbox', { name: 'Text frame content', exact: true }) });
      await overlay.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      return overlay.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('[data-matter-frame-id]')?.getAttribute('data-matter-frame-id');
      });
    };
    await expect.poll(topFrameAtOverlayCenter).toBe(overlayId);
    await settings.getByRole('button', { name: 'Send backward', exact: true }).click();
    await expect(panel.locator('[data-matter-frame-id]').nth(1)).toHaveAttribute('data-matter-frame-id', overlayId);
    await expect.poll(topFrameAtOverlayCenter).toBe(artworkId);
    await settings.getByRole('button', { name: 'Send backward', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Send backward', exact: true })).toBeDisabled();
    await settings.getByRole('button', { name: 'Bring forward', exact: true }).click();
    await expect(settings.getByLabel('Layer (1 = bottom)', { exact: true })).toHaveValue('1');
    await settings.getByLabel('Layer (1 = bottom)', { exact: true }).selectOption('2');
    await expect(settings.getByRole('button', { name: 'Bring to front', exact: true })).toBeDisabled();
    await expect.poll(topFrameAtOverlayCenter).toBe(overlayId);
    await settings.getByRole('button', { name: 'Delete frame', exact: true }).click();
    await panel.getByLabel('Select frame', { exact: true }).selectOption(artworkId);
    await settings.getByRole('button', { name: 'Send to back', exact: true }).click();
    await expect(panel.locator('[data-frame-kind]').first()).toHaveAttribute('data-frame-kind', 'graphic');
    await settings.getByRole('button', { name: 'Bring to front', exact: true }).click();
    await expect(panel.locator('[data-frame-kind]').last()).toHaveAttribute('data-frame-kind', 'graphic');
    if (width === 1440) {
      const handle = panel.getByRole('button', { name: 'Move frame', exact: true });
      await handle.scrollIntoViewIfNeeded();
      const bounds = (await handle.boundingBox())!;
      const previousX = await settings.getByRole('spinbutton', { name: 'X (mm)', exact: true }).inputValue();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 15, bounds.y + bounds.height / 2 + 10, { steps: 4 }); await page.mouse.up();
      await expect(settings.getByRole('spinbutton', { name: 'X (mm)', exact: true })).not.toHaveValue(previousX);
      await expect(settings.getByRole('spinbutton', { name: 'Graphic X (mm)', exact: true })).toHaveValue('-10');
    }
    // Both page isolation and persisted state are exercised through the actual UI/store.
    await panel.getByRole('tab', { name: 'Half-title', exact: true }).click();
    await expect(panel.locator('[data-frame-kind]')).toHaveCount(0);
    await panel.getByRole('tab', { name: 'Title page', exact: true }).click();
    await expect(panel.locator('[data-frame-kind]')).toHaveCount(2);
    const restored = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { serializeOmiJson } = await import('/src/services/exportOmi.ts');
      const { parseOmiJson } = await import('/src/services/omiPortableFormat.ts');
      const { getPublicationMatter } = await import('/src/model/publicationMatter.ts');
      const manuscript = useStudioStore.getState().manuscript;
      const restored = parseOmiJson(serializeOmiJson(manuscript));
      return getPublicationMatter(restored)!.pages.find((item) => item.kind === 'title-page')!.frames!;
    });
    expect(restored[0].content).toContain('Framed title');
    expect(restored[1]).toMatchObject({ widthMm: 100, heightMm: 90, rotation: 15, graphicTransform: { widthMm: 110, heightMm: 70, offsetXMm: -10, rotation: -20 } });
    await panel.getByLabel('Select frame', { exact: true }).selectOption(restored[1].id);
    await settings.getByRole('button', { name: 'Delete frame', exact: true }).click();
    await expect(panel.locator('[data-frame-kind]')).toHaveCount(1);
    await expect(panel.locator('.omi-matter-rich-preview strong')).toHaveText('Framed title');
    await panel.getByRole('tab', { name: 'Spine', exact: true }).click();
    await panel.getByRole('checkbox', { name: 'Include in publication' }).check();
    const spineWidth = panel.getByRole('spinbutton', { name: 'Spine width (mm)', exact: true });
    await spineWidth.fill('18'); await spineWidth.press('Tab');
    await panel.getByRole('button', { name: 'Add text frame', exact: true }).click();
    await expect(settings.getByRole('spinbutton', { name: 'Rotation (°)', exact: true })).toHaveValue('90');
    await panel.getByRole('textbox', { name: 'Text frame content', exact: true }).fill('The book spine');
    await numeric('Rotation (°)', '-90');
    const spineOutput = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { renderHtmlArticle } = await import('/src/services/exportHtml.ts');
      return renderHtmlArticle(useStudioStore.getState().manuscript).html;
    });
    expect(spineOutput).toContain('data-spine-width-mm="18"');
    expect(spineOutput).toContain('The book spine');
    expect(spineOutput).toContain('transform:rotate(-90deg)');

  });
}


for (const width of [1440, 393]) {
  test(`cover measurement units convert input and preserve dimensions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { createDocumentStructureProfile } = await import('/src/model/documentProfile.ts');
      const state = useStudioStore.getState();
      state.loadManuscript({ ...state.manuscript, documentStructure: createDocumentStructureProfile('volume') });
    });
    await openPublicationMatter(page);
    const panel = page.locator('.omi-publication-matter-editor');
    await panel.getByRole('tab', { name: 'Title page', exact: true }).click();
    await panel.getByRole('checkbox', { name: 'Include in publication' }).check();
    await panel.getByRole('button', { name: 'Add graphic frame', exact: true }).click();
    const settings = panel.locator('.omi-matter-frame-settings');
    await settings.getByLabel('Insert image in frame', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8C8AAAAASUVORK5CYII=', 'base64') });
    await expect(panel.locator('.omi-matter-frame-image > img')).toBeVisible();
    const snapshot = () => page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { getPublicationMatter } = await import('/src/model/publicationMatter.ts');
      return JSON.stringify(getPublicationMatter(useStudioStore.getState().manuscript));
    });
    const before = await snapshot();
    const units = panel.getByLabel('Measurement units', { exact: true });
    for (const unit of ['pc', 'pt', 'mm', 'pc', 'pt', 'mm']) {
      await units.selectOption(unit);
      const input = settings.getByRole('spinbutton', { name: `Width (${unit})`, exact: true });
      await input.focus(); await input.press('Tab');
    }
    expect(await snapshot()).toBe(before);
    await units.selectOption('pc');
    const frameWidth = settings.getByRole('spinbutton', { name: 'Width (pc)', exact: true });
    await frameWidth.fill('6'); await frameWidth.press('Tab');
    await units.selectOption('pt');
    await expect(settings.getByRole('spinbutton', { name: 'Width (pt)', exact: true })).toHaveValue('72');
    const imageX = settings.getByRole('spinbutton', { name: 'Graphic X (pt)', exact: true });
    await imageX.fill('-12'); await imageX.press('Tab');
    await units.selectOption('mm');
    await expect(settings.getByRole('spinbutton', { name: 'Width (mm)', exact: true })).toHaveValue('25.4');
    const edited = JSON.parse(await snapshot()).pages.find((item: { kind: string }) => item.kind === 'title-page').frames[0];
    expect(edited.widthMm).toBe(25.4);
    expect(edited.graphicTransform.offsetXMm).toBeCloseTo(-25.4 / 6, 10);
    await units.selectOption('pc');
    await panel.getByRole('tab', { name: 'Spine', exact: true }).click();
    await expect(units).toHaveValue('pc');
    const spine = panel.getByRole('spinbutton', { name: 'Spine width (pc)', exact: true });
    await spine.fill('3'); await spine.press('Tab');
    await units.selectOption('mm');
    await expect(panel.getByRole('spinbutton', { name: 'Spine width (mm)', exact: true })).toHaveValue('12.7');
    expect(JSON.parse(await snapshot()).spineWidthMm).toBe(12.7);
    expect(await page.evaluate(() => localStorage.getItem('omi-publication-matter-measurement-unit-v1'))).toBe('mm');
  });
}


async function openPublicationMatter(page: Page) {
  await expect(page.locator('.omi-volume-workspace-tabs').getByRole('tab', { name: 'Covers and title pages', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('group', { name: 'Publishing', exact: true }).getByRole('button', { name: 'Publication editor', exact: true }).click();
  await menu.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
}
