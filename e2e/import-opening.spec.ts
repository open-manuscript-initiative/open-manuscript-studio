import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
import { createVersionedTestManuscript } from '../tests/testManuscriptFixture';
import { buildDocxExport } from '../src/services/exportDocx';
import { buildOdtExport } from '../src/services/exportOdt';
import { buildOmiContainer } from '../src/services/omiContainer';

async function openDocumentMenu(page: Page) {
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Manuscript menu' })
    .getByRole('button', { name: 'Document', exact: true }).click();
}

for (const width of [1440, 393]) {
  for (const format of ['docx', 'odt', 'pdf'] as const) {
    test(`${format} import explains confirmation then reveals the editor (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 851 });
      await installMockStudioApi(page);
      if (format === 'pdf') {
        // The conversion service is outside this UI regression; exercise its
        // real queued/poll/result client with a deterministic response.
        await page.route('**/api/import/pdf**', async (route) => {
          const payload = route.request().url().endsWith('/result')
            ? { result: {
              source: { fileName: 'candidate.pdf', pageCount: 1, kind: 'text' },
              title: 'Test manuscript',
              blocks: [{ kind: 'paragraph', text: 'Test paragraph.', page: 1, confidence: 1 }],
              warnings: [],
              stats: { headings: 0, paragraphs: 1, footnotes: 0, removedRunningHeaders: 0 },
            } }
            : { job: { id: 'test-pdf', status: 'completed', pagesProcessed: 1, pagesTotal: 1 } };
          await route.fulfill({ json: payload });
        });
      }
      await signInToStudio(page);
      await page.getByRole('button', { name: /^New OMI study/ }).click();
      await openDocumentMenu(page);
      const manuscript = createVersionedTestManuscript();
      const bytes = format === 'docx' ? buildDocxExport(manuscript).bytes
        : format === 'odt' ? buildOdtExport(manuscript).bytes
          : new TextEncoder().encode('%PDF-1.7\nSynthetic UI fixture');
      const input = page.locator(`input[type="file"][accept^=".${format}"]`);
      const file = { name: `candidate.${format}`, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) };
      await input.setInputFiles(file);
      const review = page.getByRole('region', { name: 'Review import source', exact: true });
      await expect(review.getByRole('heading')).toBeFocused();
      await expect(review.getByRole('heading')).toBeInViewport();
      await expect(review.getByRole('status')).toContainText('confirmation is still required');
      await expect(review).toContainText('Then click “Create manuscript”');
      const confirm = review.getByRole('button', { name: 'Create manuscript', exact: true });
      await expect(confirm).toBeDisabled();

      // Cancelling preparation leaves the current document and menu in place.
      await review.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(review).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Manuscript menu' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Test manuscript', exact: true })).toHaveCount(0);
      await input.setInputFiles(file);
      await expect(review.getByRole('heading')).toBeFocused();
      if (width === 1440) {
        await review.getByRole('checkbox', { name: /^This is my own work/ }).check();
      } else {
        await review.getByRole('checkbox', { name: /^I checked the source/ }).check();
      }
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect(page.getByRole('dialog', { name: 'Manuscript menu' })).toHaveCount(0);
      await expect(page.locator('section.editor')).toContainText('Test paragraph.');
      await expect(page.getByRole('tab', { name: 'Test manuscript', exact: true })).toBeVisible();
    });
  }

  test(`opening a saved cloud manuscript reveals the editor (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 851 });
    const manuscript = createVersionedTestManuscript();
    const packed = await buildOmiContainer(manuscript);
    await installMockStudioApi(page, { savedDocuments: [{
      id: 'saved-test', title: 'Test manuscript', connectionName: 'Test cloud',
      createdAt: '2026-08-07T12:00:00.000Z', sizeBytes: String(packed.bytes.length),
      locationUrl: null, providerPath: '/test.omi',
    }] });
    await page.route('**/api/backups/saved-test/content', (route) => route.fulfill({ body: Buffer.from(packed.bytes) }));
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await openDocumentMenu(page);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-profile-saved-documents="true"]')
      .getByRole('button', { name: 'Open in Studio', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Manuscript menu' })).toHaveCount(0);
    await expect(page.locator('section.editor')).toContainText('Test paragraph.');
  });
}
