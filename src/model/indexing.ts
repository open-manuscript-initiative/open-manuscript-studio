export interface OmiIndexEntry {
  id: string;
  kind: 'name' | 'subject' | string;
  terms: string[];
  sortKey?: string;
  targetBlockId?: string;
  source?: {
    format: 'docx-xe' | string;
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
    /** Semantic manuscript index markers, including imported Word XE fields. */
    indexEntries?: OmiIndexEntry[];
    /** Generated-index declarations, including imported Word INDEX fields. */
    generatedIndexes?: OmiGeneratedIndex[];
  }
}
