export interface OmiIndexDefinition {
  id: string;
  title: string;
  kind?: string;
}

export interface OmiIndexEntry {
  id: string;
  /** Optional document-defined index. Legacy entries without this field use the default index. */
  indexId?: string;
  kind: 'name' | 'subject' | string;
  terms: string[];
  sortKey?: string;
  targetBlockId?: string;
  anchorId?: string;
  targetText?: string;
  /** Plain-text character offset inside the target block, used for exact navigation. */
  targetTextOffset?: number;
  source?: {
    format: 'manual' | 'docx-xe' | 'ai-suggestion' | string;
    instruction?: string;
  };
}

export interface OmiGeneratedIndex {
  id: string;
  kind: 'name' | 'subject' | string;
  title?: string;
  source?: {
    format: 'docx-index' | string;
    instruction?: string;
  };
}

export interface GroupedIndexEntry {
  key: string;
  terms: string[];
  label: string;
  count: number;
  entries: OmiIndexEntry[];
}

export const DEFAULT_INDEX_ID = 'omi-default-index';

export function createDefaultIndexDefinition(locale = 'en'): OmiIndexDefinition {
  return {
    id: DEFAULT_INDEX_ID,
    title: locale === 'hu' ? 'Névmutató' : locale === 'de' ? 'Personenregister' : 'Name index',
    kind: 'name',
  };
}

export function getDocumentIndexDefinitions(input: {
  locale?: string;
  indexDefinitions?: readonly OmiIndexDefinition[];
  entries?: readonly OmiIndexEntry[];
}): OmiIndexDefinition[] {
  const definitions = [...(input.indexDefinitions ?? [])].filter(
    (definition) => Boolean(definition?.id && definition.title?.trim()),
  );
  const needsDefault = (input.entries ?? []).some((entry) => !entry.indexId);
  if ((needsDefault || definitions.length === 0) && !definitions.some((item) => item.id === DEFAULT_INDEX_ID)) {
    definitions.unshift(createDefaultIndexDefinition(input.locale));
  }
  return definitions;
}

export function createManualIndexEntry(input: {
  term: string;
  targetBlockId: string;
  indexId?: string;
  targetText?: string;
  targetTextOffset?: number;
  subterm?: string;
  sortKey?: string;
  id?: string;
  anchorId?: string;
  kind?: string;
}): OmiIndexEntry {
  const term = input.term.trim();
  const subterm = input.subterm?.trim();
  return {
    id: input.id ?? crypto.randomUUID(),
    indexId: input.indexId || undefined,
    kind: input.kind ?? 'index',
    terms: [term, ...(subterm ? [subterm] : [])],
    sortKey: input.sortKey?.trim() || undefined,
    targetBlockId: input.targetBlockId,
    anchorId: input.anchorId ?? crypto.randomUUID(),
    targetText: input.targetText?.trim() || term,
    targetTextOffset:
      typeof input.targetTextOffset === 'number' && input.targetTextOffset >= 0
        ? input.targetTextOffset
        : undefined,
    source: { format: 'manual' },
  };
}

/** Backward-compatible helper retained for existing callers/imports. */
export function createManualNameIndexEntry(input: {
  term: string;
  targetBlockId: string;
  targetText?: string;
  targetTextOffset?: number;
  subterm?: string;
  sortKey?: string;
  id?: string;
  anchorId?: string;
}): OmiIndexEntry {
  return createManualIndexEntry({
    ...input,
    indexId: DEFAULT_INDEX_ID,
    kind: 'name',
  });
}

export function groupIndexEntries(entries: readonly OmiIndexEntry[]): GroupedIndexEntry[] {
  const groups = new Map<string, GroupedIndexEntry>();

  for (const entry of entries) {
    const terms = entry.terms.map((term) => term.trim()).filter(Boolean);
    if (!terms.length) continue;
    const key = terms.join('\u0000').toLocaleLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.entries.push(entry);
      continue;
    }
    groups.set(key, {
      key,
      terms,
      label: terms.join(' — '),
      count: 1,
      entries: [entry],
    });
  }

  return Array.from(groups.values()).sort((left, right) =>
    (left.entries[0]?.sortKey || left.label).localeCompare(
      right.entries[0]?.sortKey || right.label,
      undefined,
      { sensitivity: 'base' },
    ),
  );
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** User-defined document indexes (name index, place index, list of figures, etc.). */
    indexDefinitions?: OmiIndexDefinition[];
    /** Semantic manuscript index markers, including imported Word XE fields. */
    indexEntries?: OmiIndexEntry[];
    /** Generated-index declarations, including imported Word INDEX fields. */
    generatedIndexes?: OmiGeneratedIndex[];
  }
}