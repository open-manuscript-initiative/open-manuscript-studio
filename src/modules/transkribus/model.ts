import type { OmiAnnotation, OmiBibliographicRecord, OmiBlock, OmiSourceAttribution } from '../../types/omi';
import { selfAuthoredExternalBlockOrigin } from '../../model/importedDocumentSource';
import { isTranskribusJob, type TranskribusJob } from './api';

export const TRANSKRIBUS_RIGHTS = ['unknown', 'public-domain', 'cc-by', 'cc-by-sa', 'permission', 'self-authored'] as const;
export type TranskribusRights = typeof TRANSKRIBUS_RIGHTS[number];
export interface SavedTranskribusJob {
  version: 1;
  job: TranskribusJob;
  modelId: number;
  modelName?: string;
  fileName: string;
  title: string;
  source: string;
  text: string;
  rights: TranskribusRights;
}

export function isSavedTranskribusJob(value: unknown): value is SavedTranskribusJob {
  if (!value || typeof value !== 'object') return false;
  const item = value as SavedTranskribusJob;
  return item.version === 1 && isTranskribusJob(item.job) && Number.isSafeInteger(item.modelId) && item.modelId > 0 &&
    (item.modelName === undefined || (typeof item.modelName === 'string' && item.modelName.length <= 300)) &&
    ['fileName', 'title', 'source', 'text'].every(key => typeof item[key as keyof SavedTranskribusJob] === 'string') &&
    item.text.length <= 1_000_000 && TRANSKRIBUS_RIGHTS.includes(item.rights);
}

export function transkribusStorageKey(userId: string, workspaceId: string): string {
  return `omi:transkribus:v1:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceId)}`;
}

export function buildTranskribusImport(input: SavedTranskribusJob, sourceLabel: string, timestamp: string,
  newId: () => string = () => crypto.randomUUID(), existingRecords: readonly OmiBibliographicRecord[] = [],
): { blocks: OmiBlock[]; annotations: OmiAnnotation[]; bibliographicRecords: OmiBibliographicRecord[]; sourceAttributions: OmiSourceAttribution[] } {
  if (!isSavedTranskribusJob(input) || input.job.status !== 'FINISHED' || !input.text.trim() ||
      (input.rights !== 'self-authored' && !input.source.trim())) {
    throw new Error('A completed, reviewed transcription and its source are required.');
  }
  const block: OmiBlock = {
    id: newId(), type: 'paragraph',
    content: JSON.stringify({ type: 'doc', content: input.text.split(/\r?\n/).map(text => ({
      type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}),
    })) }),
  };
  const annotations: OmiAnnotation[] = [{
    id: newId(), type: 'semantic', targetBlockId: block.id, targetText: 'omi:transkribus-transcription',
    body: JSON.stringify({ provider: 'Transkribus', processId: input.job.processId, modelId: input.modelId,
      ...(input.modelName ? { modelName: input.modelName } : {}),
      rights: input.rights, reviewed: true, importedAt: timestamp }),
    renderingHint: 'hidden', createdAt: timestamp, modifiedAt: timestamp,
  }];
  if (input.rights === 'self-authored') {
    annotations.push(selfAuthoredExternalBlockOrigin(block.id, timestamp, newId));
    return { blocks: [block], annotations, bibliographicRecords: [], sourceAttributions: [] };
  }
  const source = input.source.trim();
  const existing = existingRecords.find(record => record.title === source);
  const record: OmiBibliographicRecord = existing ?? {
    id: newId(), type: 'manuscript', title: source, contributors: [], identifiers: [],
    status: 'provisional', createdAt: timestamp, modifiedAt: timestamp,
  };
  const relation: OmiSourceAttribution = {
    id: newId(), sourceObjectId: block.id, targetBibliographicRecordId: record.id,
    predicate: 'prov:wasDerivedFrom', role: 'transcription-source', assertionStatus: 'author-confirmed',
    createdAt: timestamp, modifiedAt: timestamp,
  };
  const notice: OmiBlock = {
    id: newId(), type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph',
      content: [{ type: 'text', text: `${sourceLabel}: ${source}` }],
    }] }),
  };
  return { blocks: [block, notice], annotations, bibliographicRecords: existing ? [] : [record], sourceAttributions: [relation] };
}
