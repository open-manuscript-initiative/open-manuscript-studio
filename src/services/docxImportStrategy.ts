import { MAX_VISUAL_IMPORT_BYTES } from '../model/visualBlocks';
import {
  attachWordGeneratedLists,
  preflightWordGeneratedLists,
} from './docxGeneratedListImport';
import { attachWordIndexData } from './docxIndexImport';
import { attachWordIndexLocations } from './docxIndexLocationImport';
import { parseDocxManuscriptWithInlineSemantics } from './docxInlineSemanticsImport';
import {
  parseDocxManuscript,
  type DocxManuscriptImportPlan,
} from './docxManuscriptImport';
import { parseDocxMonograph } from './docxMonographImport';
import {
  attachWordTableOfContents,
  preflightWordTableOfContents,
} from './docxTocImport';

export const LARGE_DOCX_THRESHOLD_BYTES = 1024 * 1024;
export const MONOGRAPH_DOCX_THRESHOLD_BYTES = 4 * 1024 * 1024;
export const MONOGRAPH_DOCUMENT_XML_THRESHOLD_BYTES = 8 * 1024 * 1024;
export const MAX_DOCX_PACKAGE_BYTES = 200 * 1024 * 1024;

export type DocxImportStage = 'preparing' | 'parsing' | 'finalizing';

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

export async function parseDocxForStudio(
  file: File,
  options: DocxImportOptions = {},
): Promise<DocxManuscriptImportPlan> {
  if (!/\.docx$/i.test(file.name)) throw new Error('A DOCX file is required.');
  if (file.size > MAX_DOCX_PACKAGE_BYTES) {
    throw new Error(`DOCX import is limited to ${Math.round(MAX_DOCX_PACKAGE_BYTES / 1024 / 1024)} MB per file.`);
  }

  const largeDocumentMode = isLargeDocx(file);
  const documentXmlBytes = largeDocumentMode ? await inspectDocumentXmlUncompressedBytes(file) : 0;
  const monographMode = isMonographComplexity({ fileSize: file.size, documentXmlBytes });

  options.onProgress?.({ stage: 'preparing', largeDocumentMode, monographMode });

  // Word stores the visible results of TOC, caption-list and INDEX fields as
  // pagination-dependent cached paragraphs. Detect all of them before the body
  // parser starts so only their semantic OMI definitions survive the import.
  const [tocPreflight, generatedListPreflight] = await Promise.all([
    preflightWordTableOfContents(file),
    preflightWordGeneratedLists(file),
  ]);

  await yieldToBrowser();
  options.onProgress?.({ stage: 'parsing', largeDocumentMode, monographMode });

  const plan = monographMode
    ? await parseDocxMonograph(file, {
        onProgress: ({ processedParagraphs, totalParagraphs }) => options.onProgress?.({
          stage: 'parsing', largeDocumentMode, monographMode, processedParagraphs, totalParagraphs,
        }),
      })
    : largeDocumentMode
      ? await parseDocxManuscript(createLargeDocxFacade(file))
      : await parseDocxManuscriptWithInlineSemantics(file);

  options.onProgress?.({ stage: 'finalizing', largeDocumentMode, monographMode });
  const indexedPlan = await attachWordIndexData(file, plan);
  const locatedIndexPlan = await attachWordIndexLocations(file, indexedPlan);
  const tocPlan = await attachWordTableOfContents(file, locatedIndexPlan, tocPreflight);
  const semanticPlan = attachWordGeneratedLists(tocPlan, generatedListPreflight);
  await yieldToBrowser();
  return semanticPlan;
}

export function isLargeDocx(file: Pick<File, 'size'>): boolean {
  return file.size >= LARGE_DOCX_THRESHOLD_BYTES;
}

export function isMonographComplexity(input: { fileSize: number; documentXmlBytes: number }): boolean {
  return input.fileSize >= MONOGRAPH_DOCX_THRESHOLD_BYTES || input.documentXmlBytes >= MONOGRAPH_DOCUMENT_XML_THRESHOLD_BYTES;
}

async function inspectDocumentXmlUncompressedBytes(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const minimum = Math.max(0, bytes.length - 0xffff - 22);
    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
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
  } catch {}
  return 0;
}

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
