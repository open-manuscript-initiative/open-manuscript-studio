import { useStudioStore } from './useStudioStore';
import { OMI_IDENTITY_MODEL_VERSION } from '../model/identity';
import { createInitialVersioningEnvelope } from '../model/versioning';
import type { PdfImportBlock, PdfImportResult } from '../services/pdfImport';
import type {
  OmiAnnotation,
  OmiBlock,
  OmiManuscript,
  OmiManuscriptState,
  OmiSection,
} from '../types/omi';

export function applyPdfImportResult(result: PdfImportResult): string {
  const current = useStudioStore.getState().manuscript;
  const timestamp = new Date().toISOString();
  const manuscriptId = crypto.randomUUID();
  const annotations: OmiAnnotation[] = [];
  const sections: OmiSection[] = [];
  const importedBlocks = coalescePdfParagraphLines(result.blocks);

  let section: OmiSection = createSection('Imported PDF');
  sections.push(section);
  let previousTextBlock: OmiBlock | null = null;

  for (const imported of importedBlocks) {
    if (imported.kind === 'heading' && (imported.headingLevel ?? 1) === 1) {
      if (section.blocks.length === 0 && section.title === 'Imported PDF') {
        section.title = imported.text;
      } else {
        section = createSection(imported.text);
        sections.push(section);
      }
      previousTextBlock = null;
      continue;
    }

    if (imported.kind === 'footnote') {
      if (!previousTextBlock) continue;
      annotations.push({
        id: crypto.randomUUID(),
        type: 'note',
        noteKind: 'footnote',
        anchorId: crypto.randomUUID(),
        targetBlockId: previousTextBlock.id,
        ...(imported.noteMarker ? { targetText: imported.noteMarker } : {}),
        body: imported.text,
        renderingHint: 'footnote',
        createdAt: timestamp,
        modifiedAt: timestamp,
      });
      continue;
    }

    const block: OmiBlock = {
      id: crypto.randomUUID(),
      type: imported.kind === 'heading' ? 'heading' : 'paragraph',
      content: imported.text,
    };
    section.blocks.push(block);
    previousTextBlock = block;
  }

  if (sections.length > 1 && sections[0]?.blocks.length === 0 && sections[0].title === 'Imported PDF') {
    sections.shift();
  }
  if (sections.length === 0) sections.push(createSection('Imported PDF'));

  const state: OmiManuscriptState = {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: manuscriptId,
    version: current.version,
    identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
    locale: current.locale,
    title: result.title,
    abstract: '',
    keywords: [],
    sectionNumberingStyle: 'decimal',
    citationStyle: current.citationStyle ?? 'apa-7',
    crossReferenceNumbering: 'document',
    agents: [],
    contributions: [],
    tombstones: [],
    sections,
    annotations,
    bibliographicRecords: [],
    citations: [],
    citationClusters: [],
    crossReferences: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const envelope = createInitialVersioningEnvelope(state, {
    summary: `Imported PDF manuscript: ${result.source.fileName}`,
    timestamp,
    completeness: result.warnings.length > 0 ? 'shallow' : 'complete',
  });
  const manuscript: OmiManuscript = { ...state, ...envelope };
  useStudioStore.getState().loadManuscript(manuscript);
  return manuscriptId;
}

/**
 * PDF extractors frequently expose each visual line as an independent text
 * block. Merge likely wrapped lines before materializing OMI paragraphs while
 * keeping headings, notes, page changes and likely short paragraph endings as
 * boundaries. Decisions are based on the previous original PDF line, not on
 * the already accumulated paragraph text.
 */
function coalescePdfParagraphLines(blocks: readonly PdfImportBlock[]): PdfImportBlock[] {
  const merged: PdfImportBlock[] = [];
  let previousSourceLine: PdfImportBlock | null = null;

  for (const current of blocks) {
    const previousMerged = merged.at(-1);
    const canJoin =
      current.kind === 'paragraph' &&
      previousMerged?.kind === 'paragraph' &&
      previousSourceLine?.kind === 'paragraph' &&
      previousSourceLine.page === current.page &&
      shouldJoinWrappedLine(previousSourceLine.text, current.text);

    if (canJoin) {
      previousMerged.text = joinWrappedText(previousMerged.text, current.text);
      previousMerged.confidence = Math.min(previousMerged.confidence, current.confidence);
    } else {
      merged.push({ ...current });
    }

    previousSourceLine = current;
  }

  return merged;
}

function shouldJoinWrappedLine(previous: string, current: string): boolean {
  const left = previous.trim();
  const right = current.trim();
  if (!left || !right) return false;

  if (/\p{L}-$/u.test(left) && /^\p{Ll}/u.test(right)) return true;
  if (/[,;:–—]$/u.test(left)) return true;
  if (/^[\p{Ll}\p{M}]/u.test(right)) return true;

  // A full journal line is usually a soft wrap. A short sentence-ending line
  // is instead treated as a paragraph boundary. Keeping the decision tied to
  // the original line avoids accidentally absorbing the next paragraph after
  // several lines have already been merged.
  return left.length >= 50;
}

function joinWrappedText(previous: string, current: string): string {
  const left = previous.trimEnd();
  const right = current.trimStart();
  if (/\p{L}-$/u.test(left) && /^\p{Ll}/u.test(right)) {
    return `${left.slice(0, -1)}${right}`;
  }
  return `${left} ${right}`.replace(/\s+/gu, ' ').trim();
}

function createSection(title: string): OmiSection {
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [],
  };
}
