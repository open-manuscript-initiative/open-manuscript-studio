import { MAX_VISUAL_IMPORT_BYTES } from '../model/visualBlocks';
import { parseDocxManuscriptWithInlineSemantics } from './docxInlineSemanticsImport';
import {
  parseDocxManuscript,
  type DocxManuscriptImportPlan,
} from './docxManuscriptImport';
import { parseDocxMonograph } from './docxMonographImport';

// A long, text-heavy book can compress surprisingly well. Keep this threshold
// deliberately low so manuscript-length DOCX files avoid the expensive second
// full document.xml parse even when the ZIP itself is only around a megabyte.
export const LARGE_DOCX_THRESHOLD_BYTES = 1024 * 1024;
export const MONOGRAPH_DOCX_THRESHOLD_BYTES = 4 * 1024 * 1024;
export const MONOGRAPH_DOCUMENT_XML_THRESHOLD_BYTES = 8 * 1024 * 1024;
export const MAX_DOCX_PACKAGE_BYTES = 200 * 1024 * 1024;

export type DocxImportStage =
  | 'preparing'
  | 'parsing'
  | 'finalizing';

export interface DocxImportProgress {
  stage: DocxImportStage;
  largeDocumentMode: boolean;
  monographMode: boolean;
  processedParagraphs?: number;
  totalParagraphs?: number;
}

export interface DocxImportOptions {
  onProgress?: (progress: DocxImportProgress) => void;
}

/**
 * Chooses among three DOCX paths:
 * - normal: structural import plus compatibility inline enrichment;
 * - large: one structural DOM pass only;
 * - monograph: low-memory paragraph scanning for very large/complex books.
 *
 * The monograph path is designed for real scholarly books containing thousands
 * of paragraphs, footnotes and Word fields such as XE, TOC and PAGEREF. It
 * avoids constructing a single DOM for a multi-megabyte document.xml and
 * yields periodically so the browser remains responsive.
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
  const documentXmlBytes = largeDocumentMode
    ? await inspectDocumentXmlUncompressedBytes(file)
    : 0;
  const monographMode = isMonographComplexity({
    fileSize: file.size,
    documentXmlBytes,
  });

  options.onProgress?.({ stage: 'preparing', largeDocumentMode, monographMode });
  await yieldToBrowser();

  options.onProgress?.({ stage: 'parsing', largeDocumentMode, monographMode });
  const plan = monographMode
    ? await parseDocxMonograph(file, {
        onProgress: ({ processedParagraphs, totalParagraphs }) => {
          options.onProgress?.({
            stage: 'parsing',
            largeDocumentMode,
            monographMode,
            processedParagraphs,
            totalParagraphs,
          });
        },
      })
    : largeDocumentMode
      ? await parseDocxManuscript(createLargeDocxFacade(file))
      : await parseDocxManuscriptWithInlineSemantics(file);

  options.onProgress?.({ stage: 'finalizing', largeDocumentMode, monographMode });
  await yieldToBrowser();
  return plan;
}

export function isLargeDocx(file: Pick<File, 'size'>): boolean {
  return file.size >= LARGE_DOCX_THRESHOLD_BYTES;
}

export function isMonographComplexity(input: {
  fileSize: number;
  documentXmlBytes: number;
}): boolean {
  return (
    input.fileSize >= MONOGRAPH_DOCX_THRESHOLD_BYTES ||
    input.documentXmlBytes >= MONOGRAPH_DOCUMENT_XML_THRESHOLD_BYTES
  );
}

/**
 * Reads only the ZIP central directory to obtain the uncompressed size of
 * word/document.xml. No XML decompression or DOM construction is needed for
 * this routing decision.
 */
async function inspectDocumentXmlUncompressedBytes(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const minimum = Math.max(0, bytes.length - 0xffff - 22);
    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        eocd = offset;
        break;
      }
    }
    if (eocd < 0) return 0;

    const entryCount = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) return 0;
      const uncompressedSize = view.getUint32(offset + 24, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
      if (name === 'word/document.xml') return uncompressedSize;
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
  } catch {
    // Fall back to the ordinary large-document route if package inspection
    // fails; the actual parser will still surface any real DOCX corruption.
  }
  return 0;
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
