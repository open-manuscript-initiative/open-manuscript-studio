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

interface MaterializedPdfNote {
  marker: string;
  noteId: string;
  anchorId: string;
  body: string;
}

export function applyPdfImportResult(result: PdfImportResult): string {
  const current = useStudioStore.getState().manuscript;
  const timestamp = new Date().toISOString();
  const manuscriptId = crypto.randomUUID();
  const annotations: OmiAnnotation[] = [];
  const sections: OmiSection[] = [];
  const importedBlocks = coalescePdfParagraphLines(result.blocks);
  const footnotes = indexPdfFootnotes(importedBlocks);
  const consumedFootnotes = new Set<string>();

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
      const marker = imported.noteMarker?.trim();
      if (marker && consumedFootnotes.has(noteTargetKey(imported.page, marker))) continue;

      // Keep an unlinked note rather than dropping data if PDF reconstruction
      // could not locate a trustworthy inline marker for it.
      if (previousTextBlock) {
        annotations.push({
          id: crypto.randomUUID(),
          type: 'note',
          noteKind: 'footnote',
          anchorId: crypto.randomUUID(),
          targetBlockId: previousTextBlock.id,
          ...(marker ? { targetText: marker } : {}),
          body: imported.text,
          renderingHint: 'footnote',
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }
      continue;
    }

    const blockId = crypto.randomUUID();
    const notes = materializeNotesForBlock(imported, footnotes, consumedFootnotes);
    const block: OmiBlock = {
      id: blockId,
      type: imported.kind === 'heading' ? 'heading' : 'paragraph',
      content: notes.length > 0
        ? createRichTextWithNoteAnchors(imported.text, notes)
        : imported.text,
    };
    section.blocks.push(block);
    previousTextBlock = block;

    for (const note of notes) {
      annotations.push({
        id: note.noteId,
        type: 'note',
        noteKind: 'footnote',
        anchorId: note.anchorId,
        targetBlockId: block.id,
        targetText: note.marker,
        body: note.body,
        renderingHint: 'footnote',
        createdAt: timestamp,
        modifiedAt: timestamp,
      });
    }
  }

  if (sections.length > 1 && sections[0]?.blocks.length === 0 && sections[0].title === 'Imported PDF') {
    sections.shift();
  }
  if (sections.length === 0) sections.push(createSection('Imported PDF'));

  preservePdfPublicationMetadata(result, sections, annotations, timestamp);

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

function indexPdfFootnotes(blocks: readonly PdfImportBlock[]): Map<string, PdfImportBlock> {
  const footnotes = new Map<string, PdfImportBlock>();
  for (const block of blocks) {
    const marker = block.kind === 'footnote' ? block.noteMarker?.trim() : undefined;
    if (!marker) continue;
    footnotes.set(noteTargetKey(block.page, marker), block);
  }
  return footnotes;
}

function materializeNotesForBlock(
  block: PdfImportBlock,
  footnotes: ReadonlyMap<string, PdfImportBlock>,
  consumed: Set<string>,
): MaterializedPdfNote[] {
  if (block.kind !== 'paragraph' || !block.noteAnchors?.length) return [];

  const notes: MaterializedPdfNote[] = [];
  for (const rawMarker of block.noteAnchors) {
    const marker = rawMarker.trim();
    const key = noteTargetKey(block.page, marker);
    const footnote = footnotes.get(key);
    if (!marker || !footnote || consumed.has(key)) continue;
    if (findInlineMarkerOffset(block.text, marker) < 0) continue;

    notes.push({
      marker,
      noteId: crypto.randomUUID(),
      anchorId: crypto.randomUUID(),
      body: footnote.text,
    });
    consumed.add(key);
  }
  return notes;
}

/**
 * Convert a legacy text block into the same Tiptap structure produced by the
 * native OmiNoteExtension. The printed marker is replaced by an atom node, so
 * the editor renders a clickable note point instead of an unrelated number.
 */
function createRichTextWithNoteAnchors(
  text: string,
  notes: readonly MaterializedPdfNote[],
): string {
  const placements = notes
    .map((note) => ({ note, offset: findInlineMarkerOffset(text, note.marker) }))
    .filter((placement) => placement.offset >= 0)
    .sort((left, right) => left.offset - right.offset);

  const content: Array<Record<string, unknown>> = [];
  let cursor = 0;
  for (const placement of placements) {
    if (placement.offset < cursor) continue;
    const before = text.slice(cursor, placement.offset);
    if (before) content.push({ type: 'text', text: before });
    content.push({
      type: 'omiNote',
      attrs: {
        noteId: placement.note.noteId,
        anchorId: placement.note.anchorId,
        label: placement.note.marker,
        noteType: 'footnote',
      },
    });
    cursor = placement.offset + placement.note.marker.length;
  }
  const after = text.slice(cursor);
  if (after) content.push({ type: 'text', text: after });

  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content }],
  });
}

function findInlineMarkerOffset(text: string, marker: string): number {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(`(?:^|[^0-9])(${escaped})(?=$|[^0-9])`, 'gu');
  let result = -1;
  for (const match of text.matchAll(expression)) {
    if (match.index === undefined) continue;
    const capture = match[1];
    if (!capture) continue;
    result = match.index + match[0].indexOf(capture);
  }
  return result;
}

/**
 * The current OMI alpha schema has no manuscript-level rights/identifier bag.
 * Keep publication metadata losslessly as hidden semantic annotations instead
 * of leaving DOI/copyright footer lines in editable body text. A future
 * metadata-model migration can promote these values without reparsing the PDF.
 */
function preservePdfPublicationMetadata(
  result: PdfImportResult,
  sections: readonly OmiSection[],
  annotations: OmiAnnotation[],
  timestamp: string,
): void {
  const target = sections.flatMap((item) => item.blocks)[0];
  if (!target || !result.metadata) return;

  for (const doi of result.metadata.dois) {
    annotations.push({
      id: crypto.randomUUID(),
      type: 'semantic',
      targetBlockId: target.id,
      targetText: 'doi',
      body: doi,
      renderingHint: 'hidden',
      createdAt: timestamp,
      modifiedAt: timestamp,
    });
  }

  for (const statement of result.metadata.copyrightStatements) {
    annotations.push({
      id: crypto.randomUUID(),
      type: 'semantic',
      targetBlockId: target.id,
      targetText: 'copyright',
      body: statement,
      renderingHint: 'hidden',
      createdAt: timestamp,
      modifiedAt: timestamp,
    });
  }
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
      !isStandaloneNoteMarker(previousSourceLine.text) &&
      !isStandaloneNoteMarker(current.text) &&
      shouldJoinWrappedLine(previousSourceLine.text, current.text);

    if (canJoin) {
      previousMerged.text = joinWrappedText(previousMerged.text, current.text);
      previousMerged.confidence = Math.min(previousMerged.confidence, current.confidence);
      const anchors = new Set([
        ...(previousMerged.noteAnchors ?? []),
        ...(current.noteAnchors ?? []),
      ]);
      if (anchors.size) previousMerged.noteAnchors = [...anchors];
    } else {
      merged.push({
        ...current,
        ...(current.noteAnchors ? { noteAnchors: [...current.noteAnchors] } : {}),
      });
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

function isStandaloneNoteMarker(text: string): boolean {
  return /^[1-9][0-9]{0,2}$/u.test(text.trim());
}

function noteTargetKey(page: number, marker: string): string {
  return `${page}:${marker}`;
}

function createSection(title: string): OmiSection {
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [],
  };
}
