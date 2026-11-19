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
    await panel.getByRole('tab', { name: 'Cover – inside', exact: true }).click();
    await expect(include).not.toBeChecked();
    await include.check();
    await content.fill('Independent back cover');
    await panel.getByRole('tab', { name: 'Cover – outside', exact: true }).click();
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
    expect(output.indexOf('Independent back cover')).toBeLessThan(output.indexOf('<article class="omi-scholarly-article"'));
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
      state.loadManuscript({ ...state.manuscript, title: 'Publication frame fixture', documentStructure: createDocumentStructureProfile('volume') });
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
    await numeric('Width (mm)', '60'); await numeric('Height (mm)', '40');
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
    const layerOrderBeforeResize = await panel.locator('[data-matter-frame-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-matter-frame-id')));
    const resize = panel.getByRole('button', { name: 'Resize frame', exact: true });
    await resize.scrollIntoViewIfNeeded();
    const resizeBox = (await resize.boundingBox())!;
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 10, resizeBox.y + resizeBox.height / 2 + 4, { steps: 3 });
    await page.mouse.up();
    await expect.poll(async () => Number(await settings.getByRole('spinbutton', { name: 'Width (mm)', exact: true }).inputValue())).toBeGreaterThan(60);
    expect(await panel.locator('[data-matter-frame-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-matter-frame-id')))).toEqual(layerOrderBeforeResize);

    await settings.getByRole('button', { name: 'Send backward', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Send backward', exact: true })).toBeDisabled();
    await settings.getByRole('button', { name: 'Bring forward', exact: true }).click();
    await expect(settings.getByLabel('Layer (1 = bottom)', { exact: true })).toHaveValue('1');
    expect(await settings.getByLabel('Layer (1 = bottom)', { exact: true }).selectOption({ value: '2' })).toEqual(['2']);
    await expect(settings.getByLabel('Layer (1 = bottom)', { exact: true })).toHaveValue('2');
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
    await panel.getByRole('tab', { name: 'Cover – outside', exact: true }).click();
    await panel.getByRole('checkbox', { name: 'Include in publication' }).check();
    const spineWidth = panel.getByRole('spinbutton', { name: 'Spine width (mm)', exact: true });
    await spineWidth.fill('18'); await spineWidth.press('Tab');
    await panel.getByLabel('New frame placement', { exact: true }).selectOption('spine');
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
      state.loadManuscript({ ...state.manuscript, title: 'Publication measurement fixture', documentStructure: createDocumentStructureProfile('volume') });
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
    // Tab leaves the adjacent Height field focused. Unit changes must never
    // commit its old display text as if it had been typed in the new unit.
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
    await panel.getByRole('tab', { name: 'Cover – outside', exact: true }).click();
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
  await expect(page.locator('.publication-style-editor')).toHaveAttribute('data-publication-page-count', /^[1-9]\d*$/);
  await menu.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
}

for (const width of [1440, 393]) {
  test(`one cover sheet spans both folds and calculates its spine from paper and pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { createDocumentStructureProfile } = await import('/src/model/documentProfile.ts');
      const state = useStudioStore.getState();
      state.loadManuscript({ ...state.manuscript, title: 'One physical cover sheet', documentStructure: createDocumentStructureProfile('volume') });
    });
    await openPublicationMatter(page);
    const panel = page.locator('.omi-publication-matter-editor');
    const include = panel.getByRole('checkbox', { name: 'Include in publication', exact: true });
    await include.check();
    await expect(panel.getByRole('tab', { name: 'Spine', exact: true })).toHaveCount(0);
    await panel.getByLabel('New frame placement', { exact: true }).selectOption('cover-outside');
    const livePages = panel.getByRole('checkbox', { name: 'Use publication editor page count', exact: true });
    const automatic = panel.getByRole('checkbox', { name: 'Calculate spine from page count and paper', exact: true });
    // The print layout is measured before hiding the mounted manuscript canvas.
    await expect(livePages).toBeEnabled();
    await livePages.uncheck();
    const pages = panel.getByRole('spinbutton', { name: 'Inside page count', exact: true });
    await pages.fill('300'); await pages.press('Tab');
    await panel.getByLabel('Inside paper', { exact: true }).selectOption('amber-80');
    await automatic.check();
    const spine = panel.getByRole('spinbutton', { name: 'Spine width (mm)', exact: true });
    await expect(spine).toHaveValue('14.85');
    const allowance = panel.getByRole('spinbutton', { name: 'Binding allowance (mm)', exact: true });
    await allowance.fill('0.5'); await allowance.press('Tab');
    await expect(spine).toHaveValue('15.35');
    await panel.getByLabel('Inside paper', { exact: true }).selectOption('munken-80-1.5');
    await expect(spine).toHaveValue('18.5');
    const sheetDimensions = await panel.locator('[data-cover-sheet="cover-outside"]').evaluate((element) => {
      const [width, height] = (element as HTMLElement).style.aspectRatio.split('/').map(Number);
      return { width: width!, height: height! };
    });
    await panel.getByRole('button', { name: 'Add text frame', exact: true }).click();
    const settings = panel.locator('.omi-matter-frame-settings');
    for (const [name, value] of [['X (mm)', '10'], ['Width (mm)', String(sheetDimensions.width - 20)]] as const) {
      const input = settings.getByRole('spinbutton', { name, exact: true });
      await input.fill(value); await input.press('Tab');
    }
    await panel.getByRole('textbox', { name: 'Text frame content', exact: true }).fill('One frame across both folds');
    const bounds = await panel.locator('.omi-matter-frame.is-selected').boundingBox();
    const paperInnerWidth = await panel.locator('[data-cover-sheet="cover-outside"]').evaluate((element) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    });
    expect(bounds!.width / paperInnerWidth).toBeCloseTo((sheetDimensions.width - 20) / sheetDimensions.width, 2);
    await expect(panel.locator('.omi-cover-fold')).toHaveCount(2);
    await panel.getByRole('tab', { name: 'Cover – inside', exact: true }).click();
    await include.check();
    await expect(panel.locator('[data-matter-frame-id]')).toHaveCount(0);
    await expect(spine).toHaveValue('18.5');
    await spine.fill('20'); await spine.press('Tab');
    await expect(automatic).not.toBeChecked();
    await panel.getByRole('tab', { name: 'Cover – outside', exact: true }).click();
    await expect(panel.locator('.omi-matter-rich-preview')).toContainText(['One frame across both folds']);
    await expect(spine).toHaveValue('20');
    const persisted = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { serializeOmiJson } = await import('/src/services/exportOmi.ts');
      const { parseOmiJson } = await import('/src/services/omiPortableFormat.ts');
      const { getPublicationMatter } = await import('/src/model/publicationMatter.ts');
      const { loadPublicationStyle } = await import('/src/services/publicationStyleExport.ts');
      const { renderHtmlArticle } = await import('/src/services/exportHtml.ts');
      const { resolvePublicationProfile } = await import('/src/model/publicationProfile.ts');
      const manuscript = parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
      return { model: getPublicationMatter(manuscript), html: renderHtmlArticle(manuscript, { ...resolvePublicationProfile(manuscript), publicationStyle: loadPublicationStyle() }).html };
    });
    expect(persisted.model!.spineCalculation).toMatchObject({ pageCount: 300, paperId: 'munken-80-1.5', mode: 'manual', allowanceMm: .5 });
    expect(persisted.html).toContain(`width:${sheetDimensions.width - 18.5 + 20}mm;height:${sheetDimensions.height}mm`);
    expect(persisted.html.match(/data-cover-sheet=/g)).toHaveLength(2);
    expect(persisted.html).not.toContain('omi-cover-fold');
    // Enabling a title page changes the live inside count while covers stay excluded.
    await livePages.check(); await automatic.check();
    const previousCount = Number(await pages.inputValue());
    await panel.getByRole('tab', { name: 'Title page', exact: true }).click();
    await include.check();
    await panel.getByRole('tab', { name: 'Cover – outside', exact: true }).click();
    await expect(pages).toHaveValue(String(previousCount + 1));
  });
}
