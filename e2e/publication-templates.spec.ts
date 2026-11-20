import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

for (const width of [1440, 393]) {
  test(`publication templates can be created, reused and reopened (${width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New volume or issue/ }).click();
    const form = page.locator('.omi-new-publication-form');
    await form.getByRole('combobox', { name: 'Publication template', exact: true }).selectOption('omi-series-a5');
    await expect(form.getByRole('combobox', { name: 'Publication template', exact: true }).locator('option')).toHaveCount(2);
    await form.getByLabel('Volume or journal issue title').fill('Source volume');
    await form.getByLabel('Series title', { exact: true }).fill('History series');
    await form.getByLabel('ISBN (print)', { exact: true }).fill('978-0-306-40615-7');
    await form.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('tab', { name: 'Title data', exact: true }).click();
    await expect(page.getByLabel('Series title', { exact: true })).toHaveValue('History series');
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
    await menu.getByRole('group', { name: 'Publishing', exact: true }).getByRole('button', { name: 'Publication editor', exact: true }).click();
    const editor = menu.locator('.publication-style-editor');
    if (width > 720) {
      await editor.getByRole('button', { name: 'Print page', exact: true }).click();
      await editor.getByLabel('Trim width (mm)', { exact: true }).fill('160');
      await editor.getByRole('button', { name: 'Print page', exact: true }).click();
    }
    const panel = editor.locator('.publication-template-panel');
    await panel.locator('summary').click();
    await panel.getByLabel('Template name', { exact: true }).fill('University book series');
    await panel.getByLabel('Series or journal name', { exact: true }).fill('History series');
    await panel.getByRole('button', { name: 'Save as new template', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('Template saved.');
    const templateId = await panel.getByRole('combobox', { name: 'Publication template', exact: true }).inputValue();
    expect(templateId).not.toBe('');
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    // Apply the saved format to a separate, already existing publication.
    await page.evaluate(async () => {
      const { createAndOpenBlankOmiDocument } = await import('/src/app/newDocumentActions.ts');
      createAndOpenBlankOmiDocument({ kind: 'volume', publicationKind: 'volume', title: 'Target volume', locale: 'en', titleMatter: { isbn: '978-3-16-148410-0' } });
    });
    await editor.locator('.publication-template-panel summary').click();
    await panel.getByRole('combobox', { name: 'Publication template', exact: true }).selectOption(templateId);
    await panel.getByRole('button', { name: 'Apply template', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('Template applied.');
    const result = await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { getAppliedPublicationTemplate } = await import('/src/model/publicationTemplates.ts');
      const manuscript = useStudioStore.getState().manuscript;
      return { title: manuscript.title, isbn: manuscript.titleMatter?.isbn, seriesTitle: manuscript.titleMatter?.seriesTitle, width: getAppliedPublicationTemplate(manuscript)?.style.page.width };
    });
    expect(result).toEqual({ title: 'Target volume', isbn: '978-3-16-148410-0', seriesTitle: 'History series', width: width > 720 ? 160 : 148 });
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.getState().checkpoint('manual');
      const { resumeLastSessionPersistence } = await import('/src/app/lastSessionPersistence.ts');
      await resumeLastSessionPersistence();
    });
    await page.reload();
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    await menu.getByRole('group', { name: 'Publishing', exact: true }).getByRole('button', { name: 'Publication editor', exact: true }).click();
    await editor.locator('.publication-template-panel summary').click();
    await expect(panel.getByRole('combobox', { name: 'Publication template', exact: true }).locator('option', { hasText: 'University book series' })).toHaveCount(1);
    if (width > 720) {
      await editor.getByRole('button', { name: 'Print page', exact: true }).click();
      await expect(editor.getByLabel('Trim width (mm)', { exact: true })).toHaveValue('160');
      await editor.getByRole('button', { name: 'Print page', exact: true }).click();
    }
    const overflow = await panel.locator('input:not([type="file"]), select, button').evaluateAll((controls) => controls.filter((control) => {
      const box = control.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1;
    }).map((control) => control.tagName));
    expect(overflow).toEqual([]);
  });
}

test('journal creation filters templates and preserves issue identifiers', async ({ page }) => {
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New volume or issue/ }).click();
  const form = page.locator('.omi-new-publication-form');
  await form.getByRole('combobox', { name: 'Publication template', exact: true }).selectOption('omi-series-a5');
  await form.getByRole('combobox', { name: 'Publication type', exact: true }).selectOption('journal-issue');
  await expect(form.getByRole('combobox', { name: 'Publication template', exact: true })).toHaveValue('');
  await expect(form.getByRole('combobox', { name: 'Publication template', exact: true }).locator('option')).toHaveCount(2);
  await form.getByRole('combobox', { name: 'Publication template', exact: true }).selectOption('omi-journal-150-240');
  await form.getByLabel('Volume or journal issue title').fill('Special issue');
  await form.getByLabel('ISSN (print)', { exact: true }).fill('1234-5679');
  await form.getByLabel('ISBN (print)', { exact: true }).fill('978-3-16-148410-0');
  await form.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('tab', { name: 'Title data', exact: true }).click();
  await expect(page.getByLabel('ISBN (print)', { exact: true })).toHaveValue('978-3-16-148410-0');
  await expect(page.getByLabel('ISSN (print)', { exact: true })).toHaveValue('1234-5679');
});

test('saved journal templates prefill both ISSNs and retain entered text for the next issue', async ({ page }) => {
  await installMockStudioApi(page); await signInToStudio(page);
  const templateId = await page.evaluate(async () => {
    const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
    const { capturePublicationTemplate, savePublicationTemplate } = await import('/src/services/publicationTemplates.ts');
    const { clonePublicationStyleTemplate } = await import('/src/services/publicationStyleExport.ts');
    const source = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'Source issue', titleMatter: { issn: '1234-5679', eissn: '2049-3630', publisherName: 'Review press', colophon: 'Editorial board\nPermanent imprint' } });
    source.subtitle = 'Recurring subtitle';
    const template = await capturePublicationTemplate(source, clonePublicationStyleTemplate(), 'Saved journal', 'Review');
    await savePublicationTemplate(template);
    return template.id;
  });
  await page.getByRole('button', { name: /^New volume or issue/ }).click();
  const form = page.locator('.omi-new-publication-form');
  await form.getByRole('combobox', { name: 'Publication type', exact: true }).selectOption('journal-issue');
  await form.getByRole('combobox', { name: 'Publication template', exact: true }).selectOption(templateId);
  await expect(form.getByLabel('ISSN (print)', { exact: true })).toHaveValue('1234-5679');
  await expect(form.getByLabel('ISSN (electronic, eISSN)', { exact: true })).toHaveValue('2049-3630');
  await form.getByLabel('Volume or journal issue title').fill('Current issue');
  await form.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('tab', { name: 'Title data', exact: true }).click();
  await expect(page.getByLabel('ISSN (print)', { exact: true })).toHaveValue('1234-5679');
  await expect(page.getByLabel('ISSN (electronic, eISSN)', { exact: true })).toHaveValue('2049-3630');
  await expect(page.getByRole('textbox', { name: 'Colophon or imprint', exact: true })).toHaveValue('Editorial board\nPermanent imprint');
});
