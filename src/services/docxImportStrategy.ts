import { MAX_VISUAL_IMPORT_BYTES } from '../model/visualBlocks';
import { parseDocxManuscriptWithInlineSemantics } from './docxInlineSemanticsImport';
import {
  parseDocxManuscript,
  type DocxManuscriptImportPlan,
} from './docxManuscriptImport';

// A long, text-heavy book can compress surprisingly well. Keep this threshold
// deliberately low so manuscript-length DOCX files avoid the expensive second
// full document.xml parse even when the ZIP itself is only around a megabyte.
export const LARGE_DOCX_THRESHOLD_BYTES = 1024 * 1024;
export const MAX_DOCX_PACKAGE_BYTES = 200 * 1024 * 1024;

export type DocxImportStage =
  | 'preparing'
  | 'parsing'
  | 'finalizing';

export interface DocxImportProgress {
  stage: DocxImportStage;
  largeDocumentMode: boolean;
}

export interface DocxImportOptions {
  onProgress?: (progress: DocxImportProgress) => void;
}

/**
 * Chooses the lowest-memory DOCX import path that preserves the mature OMI
 * structural importer. Large packages skip the legacy second full XML pass
 * used only for compatibility inline enrichment. The structural importer
 * already recovers direct run formatting, citations, notes, lists, tables,
 * equations and media in its first pass.
 */
export async function parseDocxForStudio(
  file: File,
  options: DocxImportOptions = {},
): Promise<DocxManuscriptImportPlan> {
  if (!/\.docx$/i.test(file.name)) {
    throw new Error('A DOCX file is required.');
  }

  if (file.size > MAX_DOCX_PACKAGE_BYTES) {
    throw new Error(
      `DOCX import is limited to ${Math.round(MAX_DOCX_PACKAGE_BYTES / 1024 / 1024)} MB per file.`,
    );
  }

  const largeDocumentMode = isLargeDocx(file);
  options.onProgress?.({ stage: 'preparing', largeDocumentMode });
  await yieldToBrowser();

  options.onProgress?.({ stage: 'parsing', largeDocumentMode });
  const plan = largeDocumentMode
    ? await parseDocxManuscript(createLargeDocxFacade(file))
    : await parseDocxManuscriptWithInlineSemantics(file);

  options.onProgress?.({ stage: 'finalizing', largeDocumentMode });
  await yieldToBrowser();
  return plan;
}

export function isLargeDocx(file: Pick<File, 'size'>): boolean {
  return file.size >= LARGE_DOCX_THRESHOLD_BYTES;
}

/**
 * The old importer reused MAX_VISUAL_IMPORT_BYTES as a whole-DOCX package
 * limit. That constant protects visual payloads, but a Word package can
 * legitimately be much larger while containing reasonable media. Keep the
 * mature parser unchanged while replacing that legacy package-size gate with
 * MAX_DOCX_PACKAGE_BYTES above.
 */
function createLargeDocxFacade(file: File): File {
  if (file.size <= MAX_VISUAL_IMPORT_BYTES) return file;

  return new Proxy(file, {
    get(target, property) {
      if (property === 'size') return MAX_VISUAL_IMPORT_BYTES;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function' && typeof window !== 'undefined') {
      requestAnimationFrame(() => window.setTimeout(resolve, 0));
      return;
    }
    setTimeout(resolve, 0);
  });
}
