import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const width of [1440, 393]) {
  test(`validation reports, JSON download and stale state (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.evaluate(async () => {
      const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.getState().loadManuscript(createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Private source title' }));
    });
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.getByRole('button', { name: 'Validation', exact: true }).click();
    const panel = page.locator('.omi-validation-panel');
    await panel.getByRole('button', { name: 'Run checks', exact: true }).click();
    await expect(panel.getByText('Valid within selected scope', { exact: true })).toBeVisible();
    const downloading = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download JSON report', exact: true }).click();
    const file = await downloading;
    expect(file.suggestedFilename()).toBe('validation-authoring.json');
    const text = await readFile((await file.path())!, 'utf8');
    const report = JSON.parse(text);
    expect(report.format).toBe('omi-studio-validation-report');
    expect(report.summary.outcome).toBe('valid');
    expect(report.subject.stateDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(text).not.toContain('Private source title');
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.getState().setTitle('Changed source title');
    });
    await expect(panel.getByText('The manuscript or selected profile changed. Run the checks again.', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Download JSON report', exact: true })).toBeDisabled();
    await panel.getByRole('combobox', { name: 'Check profile', exact: true }).selectOption('publication-preflight');
    await panel.getByRole('button', { name: 'Run checks', exact: true }).click();
    await expect(panel.getByText('Issues found', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Download JSON report', exact: true })).toBeEnabled();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test('unsupported checks are visible as incomplete and never shown as valid', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.evaluate(async () => {
    const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const source = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Future profile' });
    source.extensions = { 'urn:omi:studio:translation:1': { profile: 'future-profile' } };
    useStudioStore.getState().loadManuscript(source);
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await page.getByRole('button', { name: 'Validation', exact: true }).click();
  const panel = page.locator('.omi-validation-panel');
  await panel.getByRole('button', { name: 'Run checks', exact: true }).click();
  await expect(panel.getByText('Result incomplete', { exact: true })).toBeVisible();
  await expect(panel.getByText('This translation profile is not supported; its contents were not checked.', { exact: true })).toBeVisible();
  await expect(panel.getByText('Valid within selected scope', { exact: true })).toHaveCount(0);
});
