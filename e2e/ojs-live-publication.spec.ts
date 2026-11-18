import { expect, test } from '@playwright/test';
import type { PublicationArtifactRequest } from '../src/services/publicationArtifact';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  });

for (const width of [1440, 393]) {
  test(`live publisher style prepares selected HTML/PDF and hands exact files to OJS (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    const connectionId = '20000000-0000-4000-8000-000000000003';
    const transfers: Array<
      Extract<PublicationArtifactRequest, { action: 'transfer' }>
    > = [];
    const pdfInputs: string[] = [];
    await page.route('**/api/integrations/catalog', (route) =>
      route.fulfill({
        json: {
          providers: [
            {
              id: 'ojs',
              connections: [
                {
                  id: connectionId,
                  providerId: 'ojs',
                  connectionKey: 'journal',
                  displayName: 'Synthetic Journal',
                  enabled: true,
                },
              ],
            },
          ],
        },
      }),
    );
    await page.route('**/api/publication/render/pdf', async (route) => {
      pdfInputs.push(route.request().postDataJSON().html);
      await route.fulfill({
        contentType: 'application/pdf',
        headers: {
          'X-OMI-PDF-Renderer': 'synthetic-pdf',
          'X-OMI-PDF-Renderer-Version': '1',
        },
        body: Buffer.from('%PDF-1.7\nSynthetic fixture\n%%EOF'),
      });
    });
    await page.route('**/publication-artifact', async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === 'inspect')
        return route.fulfill({
          json: {
            target: {
              protocol: 'omi-publication-artifact/1',
              submissionId: 12,
              publicationId: 13,
              title: 'Synthetic OJS Production article',
              locales: ['hu'],
              genres: [{ id: 2, label: 'Article' }],
              provenance: {
                required: true,
                model: 'omi-publication-build',
                version: '0.1.0',
                digest: 'sha256',
              },
              published: false,
              workflowToken: 'a'.repeat(64),
              formats: ['html', 'pdf-print', 'pdf-interactive'].map((id) => ({
                id,
                label: id,
                mediaType: id === 'html' ? 'text/html' : 'application/pdf',
                extension: id === 'html' ? 'html' : 'pdf',
                maxBytes: 32 * 1024 * 1024,
                available: true,
                requires: null,
              })),
            },
          },
        });
      transfers.push(body);
      return route.fulfill({
        json: {
          receipt: {
            protocol: 'omi-publication-artifact/1',
            submissionId: 12,
            publicationId: 13,
            format: body.format,
            mediaType: body.mediaType,
            artifactFileName: body.fileName,
            galleyId: body.format === 'html' ? 21 : 22,
            submissionFileId: 31,
            sha256: body.build.output.digest.value,
            buildId: body.build.id,
            provenanceVerified: true,
            unchanged: false,
            published: false,
          },
        },
      });
    });
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { createHtmlGalleyStudy } = await import(
        '/tests/fixtures/htmlGalleyStudy.ts'
      );
      const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } =
        await import('/src/services/publicationStyleExport.ts');
      const style = clonePublicationStyleTemplate();
      style.styles.body.fontSize = 16.7;
      localStorage.setItem(
        PUBLICATION_STYLE_STORAGE_KEY,
        JSON.stringify(style),
      );
      useStudioStore.getState().loadManuscript(createHtmlGalleyStudy());
    });
    await page
      .getByRole('button', { name: 'Manuscript menu', exact: true })
      .first()
      .click();
    const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
    await menu
      .getByRole('button', { name: 'Live publication editor', exact: true })
      .click();
    await expect(menu.getByRole('heading', { name: 'Live publication editor' })).toBeVisible();
    if (width < 600) {
      await expect(menu.locator('.publication-mobile-preview-note')).toBeVisible();
      await expect(menu.getByRole('toolbar', { name: 'Live publication editor' })).toHaveCount(0);
    }
    await menu
      .getByRole('button', {
        name: 'Publish the typeset study to OJS',
        exact: true,
      })
      .click();
    const panel = menu.getByRole('region', {
      name: 'Publish the typeset study to OJS',
    });
    await panel
      .getByRole('combobox', { name: 'OJS connection', exact: true })
      .selectOption(connectionId);
    await panel
      .getByRole('spinbutton', { name: 'OJS submission ID', exact: true })
      .fill('12');
    await panel
      .getByRole('button', { name: 'Inspect OJS Production', exact: true })
      .click();
    await expect(
      panel.getByText('Synthetic OJS Production article'),
    ).toBeVisible();
    const transfer = panel.getByRole('button', {
      name: 'Transfer selected outputs to OJS',
      exact: true,
    });
    // HTML alone never starts a PDF render.
    await panel.getByRole('checkbox', { name: 'PDF', exact: true }).uncheck();
    await panel
      .getByRole('button', { name: 'Prepare selected outputs', exact: true })
      .click();
    await expect(panel.frameLocator('iframe').locator('body')).toBeVisible();
    expect(pdfInputs).toHaveLength(0);
    await expect(transfer).toBeDisabled();
    await expect(panel.locator('iframe')).toHaveAttribute('sandbox', '');
    // Both outputs share the publisher style, while HTML remains responsive.
    await panel.getByRole('checkbox', { name: 'PDF', exact: true }).check();
    await panel
      .getByRole('button', { name: 'Prepare selected outputs', exact: true })
      .click();
    await expect(
      panel.getByRole('link', { name: 'Open PDF preview' }),
    ).toHaveAttribute('href', /^blob:/);
    expect(pdfInputs).toHaveLength(1);
    expect(pdfInputs[0]).toContain('16.7pt');
    expect(await panel.locator('iframe').getAttribute('srcdoc')).toContain(
      '16.7pt',
    );
    await panel
      .getByRole('checkbox', { name: /I checked the destination and previews/ })
      .check();
    await transfer.click();
    await expect(panel.getByRole('status')).toContainText(
      'All selected files are in OJS',
    );
    expect(transfers.map((item) => item.format)).toEqual(['html', 'pdf-print']);
    for (const item of transfers) {
      expect(item.expectedWorkflowToken).toBe('a'.repeat(64));
      expect(item.confirmed).toBe(true);
      expect(item.build.manuscript.revisionId).toBe(
        transfers[0].build.manuscript.revisionId,
      );
    }
    expect(transfers[0].build.profile.digest.value).toBe(
      transfers[1].build.profile.digest.value,
    );
    await expect(
      panel
        .getByRole('list', { name: 'Confirmed in OJS' })
        .getByRole('listitem'),
    ).toHaveCount(2);
  });
}
