import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
for (const width of [1440, 393]) {
  test(`core model review reports and source freshness (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page); await signInToStudio(page);
    await page.evaluate(async () => {
      const { createBlankManuscript } = await import('/src/document/createBlankManuscript.ts');
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.getState().loadManuscript(createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Private review title' }));
    });
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.getByRole('button', { name: 'Validation', exact: true }).click();
    const panel = page.locator('.omi-core-model-review');
    await panel.getByRole('button', { name: 'Review core models', exact: true }).click();
    await expect(panel.getByText('Valid within the core review scope', { exact: true })).toBeVisible();
    const downloading = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Save core review JSON', exact: true }).click();
    const text = await readFile((await (await downloading).path())!, 'utf8'), report = JSON.parse(text);
    expect(report.result.specifications['OMI-SPEC-120']).toBe('0.3.0');
    expect(report.conformance).toBe('not-assessed');
    expect(report.subject.stateDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(text).not.toContain('Private review title');
    await page.evaluate(async () => (await import('/src/app/useStudioStore.ts')).useStudioStore.getState().setTitle('Changed'));
    await expect(panel.getByText('The manuscript changed. Run the review again.', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Save core review JSON', exact: true })).toBeDisabled();
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.setState({ manuscript: { ...useStudioStore.getState().manuscript, locale: 'bad_language' } });
    });
    await panel.getByRole('button', { name: 'Review core models', exact: true }).click();
    await expect(panel.getByText('Core review issues found', { exact: true })).toBeVisible();
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
