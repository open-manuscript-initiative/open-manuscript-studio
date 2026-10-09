export const HISTORY_ARCHIVE_SOURCE_IDS = [
  'europeana',
  'nara',
  'romanian',
  'hungarian',
  'uk',
  'italian',
  'spanish',
  'dutch',
  'french',
  'german',
] as const;

export type HistoryArchiveSourceId = (typeof HISTORY_ARCHIVE_SOURCE_IDS)[number];

export const DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS: HistoryArchiveSourceId[] = [
  'europeana',
  'nara',
  'romanian',
  'hungarian',
];

const validSourceIds = new Set<string>(HISTORY_ARCHIVE_SOURCE_IDS);

export function getHistoryArchiveSourcesStorageKey(userId: string, workspaceId: string): string {
  return `omi:history-archive-sources:v1:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceId)}`;
}

/** Reads saved source IDs, falling back to the familiar four panels for first-time users. */
export function readVisibleHistoryArchiveSources(raw: string | null): HistoryArchiveSourceId[] {
  if (raw === null) return [...DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS];
    return [...new Set(parsed.filter((id): id is HistoryArchiveSourceId =>
      typeof id === 'string' && validSourceIds.has(id),
    ))];
  } catch {
    return [...DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS];
  }
}
