import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createBlankManuscript } from '../src/document/createBlankManuscript';
import { buildDocxExport } from '../src/services/exportDocx';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const width of [1440, 393]) {
  test(`capability disclosure and scoped self-assessment (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.evaluate(async () => {
      const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.getState().loadManuscript(createBlankManuscript({ kind: 'study', locale: 'en', title: 'Private manuscript' }));
    });
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.getByRole('button', { name: 'Validation', exact: true }).click();
    const panel = page.locator('.omi-model-support');
    await expect(panel.getByText('OMI-SPEC-190', { exact: true })).toBeVisible();
    await expect(panel.getByText('OMI-SPEC-340', { exact: true }).first()).toBeVisible();
    await panel.getByRole('button', { name: 'Run local self-assessment', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('Indeterminate — mandatory requirements remain untested.');
    const downloaded = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Save self-assessment', exact: true }).click();
    const file = await downloaded;
    const text = await readFile((await file.path())!, 'utf8');
    const report = JSON.parse(text);
    expect(report.evidence.coverage).toHaveLength(72);
    expect(report.evidence.verification).toBe('not-independent');
    expect(report.evidence.results.every((result: { status: string }) => result.status === 'pass')).toBe(true);
    expect(text).not.toContain('Private manuscript');
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test('DOCX candidate report retains original and blocks a stale workspace replacement', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.evaluate(async () => {
    const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    useStudioStore.getState().loadManuscript(createBlankManuscript({ kind: 'study', locale: 'en', title: 'Before import' }));
  });
  const fixture = buildDocxExport(createBlankManuscript({ kind: 'study', locale: 'en', title: 'Import candidate' }));
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await page.getByRole('button', { name: 'Document', exact: true }).click();
  await page.locator('input[type="file"][accept^=".docx"]').setInputFiles({ name: 'candidate.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(fixture.bytes) });
  const report = page.locator('.omi-exchange-report');
  await expect(report.getByText('Candidate prepared', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await report.getByRole('button', { name: 'Save original file', exact: true }).click();
  const file = await download;
  expect(createHash('sha256').update(await readFile((await file.path())!)).digest('hex')).toBe(createHash('sha256').update(fixture.bytes).digest('hex'));
  await page.getByRole('checkbox', { name: 'This is my own work created earlier in another editor; do not add a source line.', exact: true }).check();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    useStudioStore.getState().setTitle('Changed during preparation');
  });
  await page.getByRole('button', { name: 'Create manuscript', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The workspace changed during preparation. Select the file again.');
  expect(await page.evaluate(async () => (await import('/src/app/useStudioStore.ts')).useStudioStore.getState().manuscript.title)).toBe('Changed during preparation');
});
