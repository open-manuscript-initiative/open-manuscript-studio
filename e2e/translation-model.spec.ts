import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const width of [1440, 393]) {
  test(`translation review, source edit, and portable reopen (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.evaluate(async () => {
      const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.getState().loadManuscript(createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Original title' }));
    });
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.getByRole('button', { name: 'Translations', exact: true }).click();
    const panel = page.locator('.omi-translation-panel');
    await panel.getByRole('button', { name: 'Create translation', exact: true }).click();
    const row = panel.locator('.omi-translation-alignment').first();
    await row.getByLabel('Target text', { exact: true }).fill('Translated title');
    await row.getByLabel('Translator notes', { exact: true }).fill('Reviewed terminology');
    await row.getByRole('combobox', { name: 'Relationship', exact: true }).selectOption('equivalent');
    await row.getByRole('button', { name: 'Save changes', exact: true }).click();
    await row.getByRole('button', { name: 'Mark as reviewed', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Parallel text HTML', exact: true })).toBeEnabled();
    const downloaded = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Parallel text HTML', exact: true }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe('translation-en-parallel.html');
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { parseOmiJson, toPortableOmiManuscript } = await import('/src/services/omiPortableFormat.ts');
      const reopened = parseOmiJson(JSON.stringify(toPortableOmiManuscript(useStudioStore.getState().manuscript)));
      useStudioStore.getState().loadManuscript(reopened);
      useStudioStore.getState().setTitle('Changed source title');
    });
    await expect(panel.getByRole('button', { name: 'Parallel text HTML', exact: true })).toBeDisabled();
    await expect(row.getByText('Source changed', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Update source alignment', exact: true }).click();
    await expect(row.getByLabel('Target text', { exact: true })).toHaveValue('Translated title');
    await expect(row.getByLabel('Translator notes', { exact: true })).toHaveValue('Reviewed terminology');
    await expect(row.getByText('Changed source title', { exact: true })).toBeVisible();
    await expect(row.getByText('Draft', { exact: true })).toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test('DeepL saves the preview basis rather than later form values or source edits', async ({ page }) => {
  await installMockStudioApi(page);
  await page.route('**/integrations/deepl/translate', async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({ json: { providerId: 'deepl', targetLanguage: request.targetLanguage, scope: request.scope,
      segments: request.segments.map((segment: { id: string; text: string }) => ({ ...segment, text: `Translated ${segment.text}` })) } });
  });
  await signInToStudio(page);
  await page.evaluate(async () => {
    const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    useStudioStore.getState().loadManuscript(createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Captured source' }));
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await page.getByRole('button', { name: 'Translations', exact: true }).click();
  const panel = page.locator('.omi-translation-panel');
  const card = panel.locator('.omi-machine-translation-workspace');
  await card.getByRole('button', { name: 'Request machine translation suggestions', exact: true }).click();
  await expect(card.getByRole('textbox', { name: 'Machine suggestion 1', exact: true })).toHaveValue('Translated Captured source');
  await panel.getByLabel('Target language', { exact: true }).fill('de');
  await panel.getByRole('combobox', { name: 'Scope', exact: true }).selectOption('section');
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    useStudioStore.getState().setTitle('Later source');
  });
  await card.getByRole('button', { name: 'Accept selected suggestions as new translation', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Translation saved.');
  const saved = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { getTranslationModel, translationProgress } = await import('/src/model/translation.ts');
    const source = useStudioStore.getState().manuscript;
    const variant = getTranslationModel(source).variants[0]!;
    return { target: variant.targetLanguage, scope: variant.scope.kind, original: variant.alignments[0]!.sourceText,
      provider: variant.alignments[0]!.origin.provider, stale: translationProgress(source, variant).stale };
  });
  expect(saved).toEqual({ target: 'en', scope: 'manuscript', original: 'Captured source', provider: 'DeepL', stale: 1 });
});

for (const width of [1440, 393]) {
  test(`DeepL suggestions can be edited, excluded or discarded before acceptance (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await page.route('**/integrations/deepl/translate', async (route) => {
      const request = route.request().postDataJSON();
      await route.fulfill({ json: { providerId: 'deepl', targetLanguage: request.targetLanguage, scope: request.scope,
        segments: request.segments.map((segment: { id: string; text: string }) => ({ ...segment, text: `Translated ${segment.text}` })) } });
    });
    await signInToStudio(page);
    await page.evaluate(async () => {
      const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const m = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Original title' });
      m.sections[0]!.title = 'Section heading';
      m.sections[0]!.blocks = [{ id: 'source-body', type: 'paragraph', content: 'Original paragraph' }];
      useStudioStore.getState().loadManuscript(m);
    });
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.getByRole('button', { name: 'Translations', exact: true }).click();
    const panel = page.locator('.omi-translation-panel');
    const workspace = panel.locator('.omi-machine-translation-workspace');
    const countVariants = () => page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { getTranslationModel } = await import('/src/model/translation.ts');
      return getTranslationModel(useStudioStore.getState().manuscript).variants.length;
    });
    await workspace.getByRole('button', { name: 'Request machine translation suggestions', exact: true }).click();
    await expect(workspace.locator('.omi-machine-translation-suggestion')).toHaveCount(3);
    expect(await countVariants()).toBe(0);
    await workspace.getByRole('button', { name: 'Discard suggestions', exact: true }).click();
    await expect(workspace.locator('.omi-machine-translation-suggestion')).toHaveCount(0);
    expect(await countVariants()).toBe(0);
    await workspace.getByRole('button', { name: 'Request machine translation suggestions', exact: true }).click();
    await workspace.getByRole('textbox', { name: 'Machine suggestion 1', exact: true }).fill('Corrected translation');
    await workspace.getByRole('checkbox', { name: 'Use suggestion 2', exact: true }).uncheck();
    await workspace.getByRole('button', { name: 'Accept selected suggestions as new translation', exact: true }).click();
    await expect.poll(countVariants).toBe(1);
    const saved = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { getTranslationModel } = await import('/src/model/translation.ts');
      const m = useStudioStore.getState().manuscript;
      return { source: m.title, sourceBody: m.sections[0]!.blocks[0]!.content,
        alignments: getTranslationModel(m).variants[0]!.alignments.map((item) => ({ text: item.targetText, status: item.status, equivalence: item.equivalence })) };
    });
    expect(saved.source).toBe('Original title');
    expect(saved.sourceBody).toBe('Original paragraph');
    expect(saved.alignments.map((item) => item.text)).toEqual(['Corrected translation', '', 'Translated Original paragraph']);
    expect(saved.alignments.every((item) => item.status === 'draft' && item.equivalence === 'unassessed')).toBe(true);
    await expect(panel.getByRole('button', { name: 'Parallel text HTML', exact: true })).toBeDisabled();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).last().click();
    await page.locator('[data-integrations-navigation="true"]').click();
    await expect(page.getByRole('heading', { name: 'DeepL translation workspace', exact: true })).toHaveCount(0);
  });
}
