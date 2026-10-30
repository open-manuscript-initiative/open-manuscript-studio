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
  await page.locator('[data-integrations-navigation="true"]').click();
  const card = page.locator('.omi-integration-workspace-card').filter({ has: page.getByRole('heading', { name: 'DeepL translation workspace', exact: true }) });
  await card.getByRole('combobox', { name: 'Scope', exact: true }).selectOption('manuscript');
  await card.getByRole('button', { name: 'Translate', exact: true }).click();
  await expect(card.getByText('Translated Captured source', { exact: true })).toBeVisible();
  await card.getByRole('combobox', { name: 'Target language', exact: true }).selectOption('DE');
  await card.getByRole('combobox', { name: 'Scope', exact: true }).selectOption('section');
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    useStudioStore.getState().setTitle('Later source');
  });
  await card.getByRole('button', { name: 'Save as language variant', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('Translation saved.');
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
