export interface OmiIndexDefinition {
  id: string;
  title: string;
  kind?: string;
}

export type OmiIndexEntryRelation = 'location' | 'see' | 'see-also';

export interface OmiIndexTextRange {
  /** Stable block containing the beginning of the indexed range. */
  startBlockId: string;
  startOffset: number;
  /** Stable block containing the end of the indexed range. */
  endBlockId: string;
  endOffset: number;
  /** Cached selected text for human-readable review and DOCX XE export. */
  text?: string;
}

export interface OmiIndexEntry {
  id: string;
  /** Optional document-defined index. Legacy entries without this field use the default index. */
  indexId?: string;
  kind: 'name' | 'subject' | string;
  /** Hierarchical term path. terms[0] is the main entry; following values are subentries. */
  terms: string[];
  sortKey?: string;
  /** Stable parent identity for author-created hierarchical entries. */
  parentEntryId?: string;
  /** Normal occurrence, See redirect, or See also relation. */
  relation?: OmiIndexEntryRelation;
  /** Stable semantic target for See / See also. */
  relatedEntryId?: string;
  /** Retained when an imported relation cannot yet be resolved to a local entry id. */
  relatedTerm?: string;
  targetBlockId?: string;
  anchorId?: string;
  targetText?: string;
  /** Plain-text character offset inside the target block, used for exact navigation. */
  targetTextOffset?: number;
  /** A semantic text range; pagination is deliberately not stored in the manuscript. */
  range?: OmiIndexTextRange;
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

export interface OmiIndexValidationIssue {
  entryId: string;
  type:
    | 'empty-term'
    | 'missing-parent'
    | 'missing-related-entry'
    | 'self-reference'
    | 'missing-range-target'
    | 'invalid-range';
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
  targetBlockId?: string;
  indexId?: string;
  targetText?: string;
  targetTextOffset?: number;
  subterm?: string;
  terms?: string[];
  sortKey?: string;
  id?: string;
  anchorId?: string;
  kind?: string;
  parentEntryId?: string;
  relation?: OmiIndexEntryRelation;
  relatedEntryId?: string;
  relatedTerm?: string;
  range?: OmiIndexTextRange;
}): OmiIndexEntry {
  const suppliedTerms = input.terms?.map((term) => term.trim()).filter(Boolean);
  const term = input.term.trim();
  const subterm = input.subterm?.trim();
  const terms = suppliedTerms?.length
    ? suppliedTerms
    : [term, ...(subterm ? [subterm] : [])].filter(Boolean);
  if (!terms.length) throw new Error('An index entry term is required.');

  const relation = input.relation ?? 'location';
  if (relation !== 'location' && !input.relatedEntryId && !input.relatedTerm?.trim()) {
    throw new Error('A See or See also entry requires a related index entry.');
  }

  const firstTargetBlock = input.range?.startBlockId ?? input.targetBlockId;
  return {
    id: input.id ?? crypto.randomUUID(),
    indexId: input.indexId || undefined,
    kind: input.kind ?? 'index',
    terms,
    sortKey: input.sortKey?.trim() || undefined,
    parentEntryId: input.parentEntryId || undefined,
    relation,
    relatedEntryId: input.relatedEntryId || undefined,
    relatedTerm: input.relatedTerm?.trim() || undefined,
    targetBlockId: firstTargetBlock,
    anchorId: firstTargetBlock ? (input.anchorId ?? crypto.randomUUID()) : input.anchorId,
    targetText: input.targetText?.trim() || input.range?.text?.trim() || terms.at(-1),
    targetTextOffset:
      typeof input.targetTextOffset === 'number' && input.targetTextOffset >= 0
        ? input.targetTextOffset
        : input.range?.startOffset,
    range: input.range,
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

export function createIndexSubentry(input: {
  parent: OmiIndexEntry;
  term: string;
  targetBlockId?: string;
  targetText?: string;
  targetTextOffset?: number;
  range?: OmiIndexTextRange;
}): OmiIndexEntry {
  const term = input.term.trim();
  if (!term) throw new Error('A subentry term is required.');
  return createManualIndexEntry({
    term,
    terms: [...input.parent.terms, term],
    indexId: input.parent.indexId,
    kind: input.parent.kind,
    parentEntryId: input.parent.id,
    targetBlockId: input.targetBlockId,
    targetText: input.targetText,
    targetTextOffset: input.targetTextOffset,
    range: input.range,
  });
}

export function indexEntryDisplayLabel(entry: Pick<OmiIndexEntry, 'terms'>): string {
  return entry.terms.map((term) => term.trim()).filter(Boolean).join(' — ');
}

export function validateIndexEntries(input: {
  entries: readonly OmiIndexEntry[];
  blockIds?: ReadonlySet<string>;
}): OmiIndexValidationIssue[] {
  const issues: OmiIndexValidationIssue[] = [];
  const byId = new Map(input.entries.map((entry) => [entry.id, entry]));

  for (const entry of input.entries) {
    if (!entry.terms.some((term) => term.trim())) {
      issues.push({ entryId: entry.id, type: 'empty-term' });
    }
    if (entry.parentEntryId && !byId.has(entry.parentEntryId)) {
      issues.push({ entryId: entry.id, type: 'missing-parent' });
    }
    if (entry.relatedEntryId === entry.id) {
      issues.push({ entryId: entry.id, type: 'self-reference' });
    } else if (entry.relatedEntryId && !byId.has(entry.relatedEntryId)) {
      issues.push({ entryId: entry.id, type: 'missing-related-entry' });
    } else if ((entry.relation === 'see' || entry.relation === 'see-also') && !entry.relatedEntryId && !entry.relatedTerm?.trim()) {
      issues.push({ entryId: entry.id, type: 'missing-related-entry' });
    }

    if (entry.range) {
      const { startBlockId, endBlockId, startOffset, endOffset } = entry.range;
      if (input.blockIds && (!input.blockIds.has(startBlockId) || !input.blockIds.has(endBlockId))) {
        issues.push({ entryId: entry.id, type: 'missing-range-target' });
      }
      if (startOffset < 0 || endOffset < 0 || (startBlockId === endBlockId && endOffset < startOffset)) {
        issues.push({ entryId: entry.id, type: 'invalid-range' });
      }
    }
  }
  return issues;
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
    /** User-defined document indexes (name index, place index, subject index, etc.). */
    indexDefinitions?: OmiIndexDefinition[];
    /** Semantic manuscript index markers, including imported Word XE fields. */
    indexEntries?: OmiIndexEntry[];
    /** Generated-index declarations, including imported Word INDEX fields. */
    generatedIndexes?: OmiGeneratedIndex[];
  }
}