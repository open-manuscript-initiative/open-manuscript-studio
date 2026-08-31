import { useStudioStore } from './useStudioStore';
import { OMI_IDENTITY_MODEL_VERSION } from '../model/identity';
import { createInitialVersioningEnvelope } from '../model/versioning';
import type { PdfImportResult } from '../services/pdfImport';
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

  let section: OmiSection = createSection('Imported PDF');
  sections.push(section);
  let previousTextBlock: OmiBlock | null = null;

  for (const imported of result.blocks) {
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

function createSection(title: string): OmiSection {
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [],
  };
}
