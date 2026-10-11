import type { OmiAnnotation, OmiBibliographicRecord, OmiBlock, OmiSourceAttribution } from '../types/omi';
import { selfAuthoredExternalBlockOrigin } from './importedDocumentSource';

export interface ExternalObjectDraft {
  block: OmiBlock;
  source: string;
}

/** Keep object and visible source adjacent in the portable manuscript. */
export function buildSourcedVisualBlocks(
  drafts: readonly ExternalObjectDraft[],
  sourceLabel: string,
  newId: () => string = () => crypto.randomUUID(),
): OmiBlock[] {
  if (drafts.length === 0 || drafts.some(({ block, source }) => !block.visual || !source.trim())) {
    throw new Error('Every imported visual object requires a source.');
  }
  return drafts.flatMap(({ block, source }) => [
    block,
    {
      id: newId(),
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: `${sourceLabel}: ${source.trim()}` }],
        }],
      }),
    },
  ]);
}

export function prefillExternalSource(fileName: string, sourcePart?: string): string {
  return [fileName.trim(), sourcePart?.trim()].filter(Boolean).join(' · ');
}

/** Previewed ownership is per imported object, including mixed batches. */
export function buildAttributedVisualImport(
  drafts: readonly (ExternalObjectDraft & { selfAuthoredExternal?: boolean })[],
  sourceLabel: string,
  timestamp: string,
  newId: () => string = () => crypto.randomUUID(),
  existingRecords: readonly OmiBibliographicRecord[] = [],
): { blocks: OmiBlock[]; annotations: OmiAnnotation[]; bibliographicRecords: OmiBibliographicRecord[]; sourceAttributions: OmiSourceAttribution[] } {
  if (drafts.length === 0 || drafts.some(({ block, source, selfAuthoredExternal }) =>
    !block.visual || (!selfAuthoredExternal && !source.trim()))) {
    throw new Error('Every third-party visual object requires a source.');
  }
  const annotations: OmiAnnotation[] = [];
  const bibliographicRecords: OmiBibliographicRecord[] = [];
  const sourceAttributions: OmiSourceAttribution[] = [];
  const recordsByTitle = new Map(existingRecords.map((record) => [record.title.trim().toLocaleLowerCase(), record]));
  const blocks = drafts.flatMap(({ block, source, selfAuthoredExternal }) => {
    if (selfAuthoredExternal) {
      annotations.push(selfAuthoredExternalBlockOrigin(block.id, timestamp, newId));
      const visual = block.visual!;
      const provenance = visual.provenance;
      // A local filename is a suggested citation, not a public authorship fact.
      const privateSafeVisual = provenance
        ? { ...visual, provenance: { sourceFormat: provenance.sourceFormat, importedAt: provenance.importedAt } }
        : visual;
      return [{ ...block, visual: privateSafeVisual } as OmiBlock];
    }
    const title = source.trim();
    let record = recordsByTitle.get(title.toLocaleLowerCase());
    if (!record) {
      record = { id: newId(), type: 'other', title, contributors: [], identifiers: [], status: 'provisional', createdAt: timestamp, modifiedAt: timestamp };
      recordsByTitle.set(title.toLocaleLowerCase(), record);
      bibliographicRecords.push(record);
    }
    sourceAttributions.push({
      id: newId(),
      sourceObjectId: block.id,
      targetBibliographicRecordId: record.id,
      predicate: 'prov:wasDerivedFrom',
      role: 'import-source',
      assertionStatus: 'author-confirmed',
      createdAt: timestamp,
      modifiedAt: timestamp,
    });
    return buildSourcedVisualBlocks([{ block, source: title }], sourceLabel, newId);
  });
  return { blocks, annotations, bibliographicRecords, sourceAttributions };
}
