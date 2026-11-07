import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
import { buildOmiContainer } from '../src/services/omiContainer';
import { serializeOmiJson } from '../src/services/exportOmi';
import { createVersionedTestManuscript } from '../tests/testManuscriptFixture';

for (const format of ['omi', 'omi.json'] as const) {
  test(`visible mobile web opener loads downloaded ${format} classified as binary`, async ({ page }) => {
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Manuscript menu' }).getByRole('button', { name: 'Document', exact: true }).click();
    const card = page.locator('[data-document-lifecycle="true"]');
    const input = card.locator('input[type="file"]');
    await expect(input).toHaveAttribute('accept', '*/*');
    const manuscript = createVersionedTestManuscript();
    const bytes = format === 'omi'
      ? (await buildOmiContainer(manuscript)).bytes
      : new TextEncoder().encode(serializeOmiJson(manuscript));
    await input.setInputFiles({ name: `download.${format}`, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await expect(page.getByRole('dialog', { name: 'Manuscript menu' })).toHaveCount(0);
    await expect(page.locator('section.editor')).toContainText('Test paragraph.');
    await expect(page.getByRole('tab', { name: 'Test manuscript', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Manuscript menu' }).getByRole('button', { name: 'Document', exact: true }).click();
    await input.setInputFiles({ name: 'empty.omi', mimeType: 'application/octet-stream', buffer: Buffer.alloc(0) });
    await expect(card.getByRole('status')).toContainText('0 bytes');
    await expect(page.getByRole('tab', { name: 'Test manuscript', exact: true })).toBeAttached();
  });
}
