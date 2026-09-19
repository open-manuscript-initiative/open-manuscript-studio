import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  expect,
  test,
  type Download,
  type Page,
} from '@playwright/test';

import {
  installMockStudioApi,
  signInToStudio,
} from './support/mockStudioApi';
import { REFERENCE_IMAGE_PNG_BASE64 } from '../tests/referenceManuscriptFixture.ts';

const REFERENCE_FIXTURE = resolve(
  process.cwd(),
  'tests/fixtures/reference-manuscript-all-features.omi.json',
);
const UI_EDIT = 'UI lifecycle edit persisted through download and reopen.';

test.describe.configure({ mode: 'serial' });

test('opens, edits, saves, closes and reopens the complete reference manuscript through the real UI', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await signInToStudio(page);

  await openManuscriptThroughUi(page, REFERENCE_FIXTURE);
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();

  await appendLifecycleEditThroughUi(page);
  await expect(page.locator('.omi-tiptap-editor[contenteditable="true"]').first()).toContainText(UI_EDIT);

  const downloaded = await exportFromUi(page, 'omi-json', /\.omi\.json$/);
  const downloadedPath = await downloaded.path();
  assertDownloadPath(downloadedPath);

  const savedRaw = readFileSync(downloadedPath, 'utf8');
  const saved = JSON.parse(savedRaw) as {
    id?: string;
    title?: string;
    sections?: unknown[];
    namedAnchors?: unknown[];
    generatedListDefinitions?: unknown[];
    revisionHistory?: { revisions?: unknown[] };
    embeddedPublicationProfile?: { id?: string };
  };

  expect(saved.id).toBe('reference-manuscript-all-features');
  expect(saved.title).toContain('OMI Reference Manuscript');
  expect(savedRaw).toContain(UI_EDIT);
  expect(saved.sections?.length).toBeGreaterThanOrEqual(4);
  expect(saved.namedAnchors?.length).toBeGreaterThanOrEqual(2);
  expect(saved.generatedListDefinitions?.length).toBeGreaterThanOrEqual(6);
  expect(saved.embeddedPublicationProfile?.id).toBe('omi-reference-complete');
  expect(saved.revisionHistory?.revisions?.length).toBeGreaterThanOrEqual(3);

  await closeDocumentThroughUi(page);
  await expect(page.getByRole('heading', { name: 'No document is open' })).toBeVisible();

  await openManuscriptThroughUi(page, downloadedPath);
  await expect(page.locator('.omi-tiptap-editor[contenteditable="true"]').first()).toContainText(UI_EDIT);

  const reopened = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const manuscript = useStudioStore.getState().manuscript;
    return {
      id: manuscript.id,
      title: manuscript.title,
      revisions: manuscript.revisionHistory.revisions.length,
      notes: manuscript.annotations.length,
      references: manuscript.bibliographicRecords?.length ?? 0,
      namedAnchors: manuscript.namedAnchors?.length ?? 0,
      generatedLists: manuscript.generatedListDefinitions?.length ?? 0,
      publicationProfile: manuscript.embeddedPublicationProfile?.id ?? null,
      hasOjsOpenScience: Boolean(
        manuscript.extensions?.['org.pkp.ojs']?.openScience,
      ),
    };
  });

  expect(reopened).toEqual({
    id: 'reference-manuscript-all-features',
    title: 'OMI Reference Manuscript: Complete Feature and Lifecycle Corpus',
    revisions: saved.revisionHistory?.revisions?.length,
    notes: 6,
    references: 5,
    namedAnchors: 2,
    generatedLists: 6,
    publicationProfile: 'omi-reference-complete',
    hasOjsOpenScience: true,
  });
  expect(api.unhandledRequests).toEqual([]);
});

test('starts all stable publication exports for the reference manuscript from Export and tools', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await signInToStudio(page);
  await openManuscriptThroughUi(page, REFERENCE_FIXTURE);
  await installReferenceAssetPayload(page);

  const docx = await exportFromUi(page, 'docx', /\.docx$/);
  const epub = await exportFromUi(page, 'epub', /\.epub$/);
  const html = await exportFromUi(page, 'html', /\.html\.zip$/);
  const jats = await exportFromUi(page, 'jats', /\.jats\.xml$/);
  const printPdf = await exportFromUi(page, 'pdf', /\.pdf$/, {
    content: 'publication',
    mode: 'print',
  });
  const interactivePdf = await exportFromUi(page, 'pdf', /\.pdf$/, {
    content: 'publication',
    mode: 'interactive',
  });

  for (const download of [docx, epub, html, jats, printPdf, interactivePdf]) {
    const path = await download.path();
    assertDownloadPath(path);
    expect(readFileSync(path).byteLength).toBeGreaterThan(10);
  }

  expect(
    api.publicationRequests.filter(
      (request) => request === 'POST /api/publication/validate/jats',
    ),
  ).toHaveLength(1);
  expect(
    api.publicationRequests.filter(
      (request) => request === 'POST /api/publication/render/pdf',
    ),
  ).toHaveLength(2);
  expect(api.unhandledRequests).toEqual([]);
});

async function openManuscriptThroughUi(
  page: Page,
  filePath: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Document', exact: true }).click();

  const chooserPromise = page.waitForEvent('filechooser');
  await menu.getByRole('button', { name: 'Open', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);

  await expect(menu.getByRole('status')).toContainText('Manuscript opened.');
  await menu.getByRole('button', { name: 'Close manuscript menu' }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
}

async function appendLifecycleEditThroughUi(page: Page): Promise<void> {
  const editor = page.locator('.omi-tiptap-editor[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(UI_EDIT);
  await expect(editor).toContainText(UI_EDIT);
}

async function closeDocumentThroughUi(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Document', exact: true }).click();

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await menu.getByRole('button', { name: 'Close document', exact: true }).click();
  await menu.getByRole('button', { name: 'Close manuscript menu' }).click();
}

async function exportFromUi(
  page: Page,
  format: 'omi-json' | 'docx' | 'epub' | 'html' | 'jats' | 'pdf',
  fileName: RegExp,
  pdf?: {
    content: 'publication' | 'editorial';
    mode: 'print' | 'interactive';
  },
): Promise<Download> {
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  if (!(await menu.isVisible())) {
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await expect(menu).toBeVisible();
  }

  await menu.getByRole('button', { name: 'Export and tools', exact: true }).click();
  const formatSelect = menu.getByLabel('Export format');
  await formatSelect.selectOption(format);

  if (format === 'pdf' && pdf) {
    await menu.getByLabel('Print view').selectOption(pdf.content);
    await menu.getByLabel('PDF variant').selectOption(pdf.mode);
  }

  const downloadPromise = page.waitForEvent('download');
  await menu.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;

  await expect(menu.getByRole('status').filter({ hasText: 'Export completed.' })).toBeVisible();
  expect(download.suggestedFilename()).toMatch(fileName);
  return download;
}

async function installReferenceAssetPayload(page: Page): Promise<void> {
  await page.evaluate(async (base64) => {
    const { putAssetPayload } = await import('/src/services/assetRepository.ts');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    await putAssetPayload(
      'reference-manuscript-all-features',
      'asset-image',
      bytes,
    );
  }, REFERENCE_IMAGE_PNG_BASE64);
}

function assertDownloadPath(
  value: string | null,
): asserts value is string {
  expect(value).not.toBeNull();
}
