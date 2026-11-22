import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('publication editor presents one canonical manuscript view with optional frame tools', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();

  const liveEditor = menu.locator('.publication-style-editor');
  const canvas = liveEditor.locator('.publication-document-canvas');
  const inspector = liveEditor.locator('.publication-frame-inspector-panel');
  const toggle = liveEditor.getByRole('button', { name: 'Frames and page styles', exact: true });
  await expect(canvas).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(inspector).toHaveCount(0);
  await expect(liveEditor.locator('.omi-publication-layout-switch')).toHaveCount(0);
  await expect(liveEditor.getByRole('button', { name: 'Continuous layout', exact: true })).toHaveCount(0);
  await expect(liveEditor.getByRole('button', { name: 'Frame layout', exact: true })).toHaveCount(0);

  const before = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return JSON.stringify(useStudioStore.getState().manuscript);
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('.omi-frame-editor')).toBeVisible();
  await expect(inspector.locator('.publication-frame-inspector-advisory')).toContainText('footnotes');
  // The authoritative structured canvas never unmounts or converts to a plain-text story.
  await expect(canvas).toBeAttached();
  await inspector.getByRole('button', { name: 'Close frame tools', exact: true }).click();
  await expect(inspector).toHaveCount(0);
  await expect(canvas).toBeVisible();
  const after = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return JSON.stringify(useStudioStore.getState().manuscript);
  });
  expect(after).toBe(before);
});

test('mobile preview shows one publication editor with expandable frame tools, not layout modes', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const liveEditor = menu.locator('.publication-style-editor');
  await expect(liveEditor.locator('.publication-document-canvas')).toBeVisible();
  const toggle = liveEditor.getByRole('button', { name: 'Frames and page styles', exact: true });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(liveEditor.locator('.publication-frame-inspector-panel')).toBeVisible();
  await expect(liveEditor.locator('.omi-frame-editor')).toBeVisible();
  await liveEditor.getByRole('button', { name: 'Close frame tools', exact: true }).click();
  await expect(liveEditor.locator('.publication-frame-inspector-panel')).toHaveCount(0);
});


for (const width of [1440, 393]) {
  test(`publication pages live in Publishing and retain the manuscript workspace at ${width}px`, async ({ page }) => {
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
    await expect(page.locator('.omi-volume-front-matter-workspace').getByRole('tab', { name: 'Covers and title pages', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
    await menu.getByRole('group', { name: 'Publishing', exact: true }).getByRole('button', { name: 'Publication editor', exact: true }).click();
    const editor = menu.locator('.publication-style-editor');
    const canvas = editor.locator('.publication-document-canvas');
    await canvas.evaluate((element) => element.setAttribute('data-workspace-identity', 'retained'));
    const sectionsBefore = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      return JSON.stringify(useStudioStore.getState().manuscript.sections);
    });
    await editor.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
    await expect(canvas).toBeAttached(); await expect(canvas).toBeHidden();
    const matter = editor.locator('.omi-publication-matter-editor');
    await matter.getByRole('checkbox', { name: 'Include in publication' }).check();
    await matter.getByRole('button', { name: 'Add text frame', exact: true }).click();
    const text = matter.getByRole('textbox', { name: 'Text frame content', exact: true });
    await text.fill('Integrated publication cover');
    await text.press('ControlOrMeta+a');
    await matter.getByRole('button', { name: 'Bold / strong', exact: true }).click();
    await matter.getByLabel('Measurement units', { exact: true }).selectOption('pc');
    await editor.getByRole('tab', { name: 'Publication content', exact: true }).click();
    await expect(canvas).toBeVisible(); await expect(canvas).toHaveAttribute('data-workspace-identity', 'retained');
    if (width === 1440) {
      // Desktop measurements live in the expandable icon rail, not the top bar.
      const measurementToggle = editor.getByRole('button', { name: 'Measurement units', exact: true });
      await measurementToggle.click();
      await expect(editor.locator('#publication-style-ribbon-panel-units')
        .getByRole('combobox', { name: 'Measurement units', exact: true })).toHaveValue('pc');
      await measurementToggle.click();
    } else {
      // Mobile preview keeps the measurement control directly reachable.
      await expect(editor.getByRole('combobox', { name: 'Measurement units', exact: true })).toHaveValue('pc');
    }
    if (width === 1440) {
      await editor.getByRole('button', { name: 'Frames and page styles', exact: true }).click();
      const frames = editor.locator('.omi-frame-editor');
      await frames.getByRole('button', { name: 'Add text frame', exact: true }).click();
      const size = frames.getByRole('spinbutton', { name: 'Width (pc)', exact: true });
      await size.fill('6'); await size.press('Tab');
      await frames.getByRole('button', { name: 'Send to back', exact: true }).click();
      await expect(frames.getByLabel('Layer (1 = bottom)', { exact: true })).toHaveValue('0');
      await frames.getByRole('button', { name: 'Bring forward', exact: true }).click();
      await expect(frames.getByLabel('Layer (1 = bottom)', { exact: true })).toHaveValue('1');
      await editor.getByRole('button', { name: 'Close frame tools', exact: true }).click();
    }
    await editor.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
    await expect(matter.locator('.omi-matter-rich-preview strong')).toHaveText('Integrated publication cover');
    await expect(matter.getByLabel('Measurement units', { exact: true })).toHaveValue('pc');
    expect(await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      return JSON.stringify(useStudioStore.getState().manuscript.sections);
    })).toBe(sectionsBefore);
  });
}
