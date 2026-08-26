import type {
  OmiBibliographicRecord,
  OmiCitation,
  OmiManuscriptState,
} from '../types/omi';

export type OmiReferenceListCategoryKind =
  | 'archival-sources'
  | 'legislation'
  | 'scripture'
  | 'primary-sources'
  | 'custom';

export interface OmiReferenceListCategory {
  id: string;
  title: string;
  kind: OmiReferenceListCategoryKind;
  /** Optional exact bibliographic resource types accepted by this category. */
  resourceTypes?: string[];
  /** Optional citation intents accepted by this category. */
  citationIntents?: string[];
  /** Explicit record membership for cases that cannot be inferred from metadata. */
  recordIds?: string[];
  sort?: 'title' | 'author-title' | 'issued-title';
}

export interface OmiCategorizedReferenceList {
  id: string;
  title: string;
  categories: OmiReferenceListCategory[];
  includeUncited?: boolean;
  createdAt?: string;
  modifiedAt?: string;
}

export interface CategorizedReferenceListEntry {
  recordId: string;
  categoryId: string;
  title: string;
  authorLabel: string;
  issued?: string;
  resourceType: string;
  citationCount: number;
  citationIds: string[];
}

export interface CategorizedReferenceGroup {
  category: OmiReferenceListCategory;
  entries: CategorizedReferenceListEntry[];
}

export const REFERENCE_LIST_CATEGORY_PRESETS: ReadonlyArray<Omit<OmiReferenceListCategory, 'id'>> = [
  {
    title: 'Archival sources',
    kind: 'archival-sources',
    resourceTypes: ['archival-source', 'manuscript'],
    sort: 'title',
  },
  {
    title: 'Legislation',
    kind: 'legislation',
    citationIntents: ['legislation', 'law', 'legal-authority'],
    resourceTypes: ['standard'],
    sort: 'title',
  },
  {
    title: 'Scripture',
    kind: 'scripture',
    citationIntents: ['scripture', 'biblical-reference', 'bible'],
    sort: 'title',
  },
  {
    title: 'Primary sources',
    kind: 'primary-sources',
    citationIntents: ['primary-source'],
    resourceTypes: ['archival-source', 'manuscript'],
    sort: 'issued-title',
  },
];

export function createCategorizedReferenceList(input: {
  title: string;
  categories?: OmiReferenceListCategory[];
  includeUncited?: boolean;
  id?: string;
}, timestamp = new Date().toISOString()): OmiCategorizedReferenceList {
  const title = input.title.trim();
  if (!title) throw new Error('A categorized reference list requires a title.');
  return {
    id: input.id ?? createStableId('ref-list'),
    title,
    categories: input.categories ?? [],
    includeUncited: input.includeUncited ?? false,
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function createReferenceListCategory(input: {
  title: string;
  kind?: OmiReferenceListCategoryKind;
  resourceTypes?: string[];
  citationIntents?: string[];
  recordIds?: string[];
  sort?: OmiReferenceListCategory['sort'];
  id?: string;
}): OmiReferenceListCategory {
  const title = input.title.trim();
  if (!title) throw new Error('A reference-list category requires a title.');
  return {
    id: input.id ?? createStableId('ref-category'),
    title,
    kind: input.kind ?? 'custom',
    resourceTypes: normalizeList(input.resourceTypes),
    citationIntents: normalizeList(input.citationIntents),
    recordIds: normalizeList(input.recordIds),
    sort: input.sort ?? 'author-title',
  };
}

export function buildCategorizedReferenceGroups(
  manuscript: Pick<OmiManuscriptState, 'bibliographicRecords' | 'citations'>,
  definition: OmiCategorizedReferenceList,
): CategorizedReferenceGroup[] {
  const records = manuscript.bibliographicRecords ?? [];
  const citations = manuscript.citations ?? [];
  const citationsByRecord = groupCitations(citations);

  return definition.categories.map((category) => {
    const entries = records
      .filter((record) => matchesCategory(record, citationsByRecord.get(record.id) ?? [], category))
      .filter((record) => definition.includeUncited || (citationsByRecord.get(record.id)?.length ?? 0) > 0)
      .map((record) => toEntry(record, citationsByRecord.get(record.id) ?? [], category.id))
      .sort((left, right) => compareEntries(left, right, category.sort ?? 'author-title'));
    return { category, entries };
  });
}

export function validateCategorizedReferenceLists(manuscript: Pick<OmiManuscriptState, 'bibliographicRecords'> & {
  categorizedReferenceLists?: OmiCategorizedReferenceList[];
}): Array<{ listId: string; categoryId?: string; type: 'empty-title' | 'duplicate-category' | 'missing-record' }> {
  const result: Array<{ listId: string; categoryId?: string; type: 'empty-title' | 'duplicate-category' | 'missing-record' }> = [];
  const recordIds = new Set((manuscript.bibliographicRecords ?? []).map((record) => record.id));
  for (const list of manuscript.categorizedReferenceLists ?? []) {
    if (!list.title.trim()) result.push({ listId: list.id, type: 'empty-title' });
    const seen = new Set<string>();
    for (const category of list.categories) {
      const normalized = category.title.trim().toLocaleLowerCase();
      if (seen.has(normalized)) result.push({ listId: list.id, categoryId: category.id, type: 'duplicate-category' });
      seen.add(normalized);
      for (const recordId of category.recordIds ?? []) {
        if (!recordIds.has(recordId)) result.push({ listId: list.id, categoryId: category.id, type: 'missing-record' });
      }
    }
  }
  return result;
}

function matchesCategory(record: OmiBibliographicRecord, citations: OmiCitation[], category: OmiReferenceListCategory): boolean {
  if ((category.recordIds ?? []).includes(record.id)) return true;
  const typeMatch = (category.resourceTypes ?? []).includes(record.type);
  const intentMatch = citations.some((citation) => citation.intent && (category.citationIntents ?? []).includes(citation.intent));
  return typeMatch || intentMatch;
}

function groupCitations(citations: readonly OmiCitation[]): Map<string, OmiCitation[]> {
  const result = new Map<string, OmiCitation[]>();
  for (const citation of citations) {
    const current = result.get(citation.target) ?? [];
    current.push(citation);
    result.set(citation.target, current);
  }
  return result;
}

function toEntry(record: OmiBibliographicRecord, citations: OmiCitation[], categoryId: string): CategorizedReferenceListEntry {
  return {
    recordId: record.id,
    categoryId,
    title: record.title,
    authorLabel: authorLabel(record),
    issued: record.issued,
    resourceType: record.type,
    citationCount: citations.length,
    citationIds: citations.map((citation) => citation.id),
  };
}

function authorLabel(record: OmiBibliographicRecord): string {
  const names = record.contributors
    .filter((contributor) => contributor.role === 'author' || contributor.role === 'editor')
    .map((contributor) => contributor.literalName?.trim() || [contributor.familyName, contributor.givenName].filter(Boolean).join(', '))
    .filter(Boolean);
  return names.join('; ');
}

function compareEntries(left: CategorizedReferenceListEntry, right: CategorizedReferenceListEntry, sort: NonNullable<OmiReferenceListCategory['sort']>): number {
  if (sort === 'issued-title') {
    const issued = (left.issued ?? '').localeCompare(right.issued ?? '', undefined, { sensitivity: 'base' });
    if (issued) return issued;
  }
  if (sort === 'author-title') {
    const author = left.authorLabel.localeCompare(right.authorLabel, undefined, { sensitivity: 'base' });
    if (author) return author;
  }
  return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
}

function normalizeList(values: readonly string[] | undefined): string[] | undefined {
  const normalized = Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
  return normalized.length ? normalized : undefined;
}

function createStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** Semantic, automatically generated grouped reference/authority lists. */
    categorizedReferenceLists?: OmiCategorizedReferenceList[];
  }
}
