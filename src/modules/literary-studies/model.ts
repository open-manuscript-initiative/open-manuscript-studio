/** Literature research data is separate from the OMI manuscript model. */
export const LITERARY_SCHEMA_VERSION = 1 as const;
export const LITERARY_ANNOTATION_KINDS = [
  'motif', 'narratology', 'poetics', 'rhetoric', 'genre', 'intertext', 'reception', 'other',
] as const;
export const LITERARY_RELATIONS = ['allusion', 'quotation', 'adaptation', 'translation', 'influence', 'comparison'] as const;
export type LiteraryAnnotationKind = (typeof LITERARY_ANNOTATION_KINDS)[number];
export type LiteraryRelation = (typeof LITERARY_RELATIONS)[number];

export interface LiteraryWork {
  id: string;
  title: string;
  creator: string;
  date: string;
  language: string;
  genre: string;
  edition: string;
  source: string;
  rights: string;
  text: string;
}
export interface LiteraryAnnotation {
  id: string;
  workId: string;
  start: number; // UTF-16 offsets (HTML textarea selection offsets)
  end: number;
  quote: string; // Verbatim selection to diagnose changes in the source text
  kind: LiteraryAnnotationKind;
  interpretation: string;
  evidence: string;
}
export interface LiteraryRelationRecord {
  id: string;
  fromWorkId: string;
  toWorkId: string;
  relation: LiteraryRelation;
  evidence: string;
  note: string;
}
export interface LiteraryWorkspace {
  schemaVersion: typeof LITERARY_SCHEMA_VERSION;
  title: string;
  researchQuestion: string;
  methodology: string;
  works: LiteraryWork[];
  annotations: LiteraryAnnotation[];
  relations: LiteraryRelationRecord[];
}
export function createLiteraryWorkspace(): LiteraryWorkspace {
  return { schemaVersion: 1, title: '', researchQuestion: '', methodology: '', works: [], annotations: [], relations: [] };
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hasStrings = (object: Record<string, unknown>, fields: readonly string[]) =>
  fields.every(field => typeof object[field] === 'string');
const hasUniqueIds = (entries: readonly { id: string }[]) => new Set(entries.map(item => item.id)).size === entries.length;
const validRange = (annotation: LiteraryAnnotation, text: string) =>
  Number.isSafeInteger(annotation.start) && Number.isSafeInteger(annotation.end)
  && annotation.start >= 0 && annotation.end > annotation.start && annotation.end <= text.length;

export function isLiteraryWorkspace(value: unknown): value is LiteraryWorkspace {
  if (!isRecord(value) || value.schemaVersion !== 1
    || !hasStrings(value, ['title', 'researchQuestion', 'methodology'])
    || !Array.isArray(value.works) || !Array.isArray(value.annotations) || !Array.isArray(value.relations)
    || value.works.length > 100 || value.annotations.length > 10000 || value.relations.length > 10000) return false;
  const works = value.works as LiteraryWork[];
  if (!works.every(w => isRecord(w) && hasStrings(w, ['id', 'title', 'creator', 'date', 'language', 'genre', 'edition', 'source', 'rights', 'text'])
    && w.id.length > 0 && w.text.length <= 1000000) || !hasUniqueIds(works)) return false;
  const workIds = new Set(works.map(w => w.id));
  const annotations = value.annotations as LiteraryAnnotation[];
  if (!annotations.every(a => isRecord(a) && hasStrings(a, ['id', 'workId', 'quote', 'kind', 'interpretation', 'evidence'])
    && a.id.length > 0 && workIds.has(a.workId)
    && (LITERARY_ANNOTATION_KINDS as readonly string[]).includes(a.kind)
    && validRange(a, works.find(w => w.id === a.workId)!.text)
    && a.quote.length > 0) || !hasUniqueIds(annotations)) return false;
  const relations = value.relations as LiteraryRelationRecord[];
  return relations.every(r => isRecord(r) && hasStrings(r, ['id', 'fromWorkId', 'toWorkId', 'relation', 'evidence', 'note'])
    && r.id.length > 0 && workIds.has(r.fromWorkId) && workIds.has(r.toWorkId)
    && (LITERARY_RELATIONS as readonly string[]).includes(r.relation))
    && hasUniqueIds(relations);
}

/** An annotation becomes stale if its text has changed; never silently move a citation. */
export function isAnnotationAnchored(annotation: LiteraryAnnotation, work: LiteraryWork): boolean {
  return annotation.workId === work.id && validRange(annotation, work.text)
    && work.text.slice(annotation.start, annotation.end) === annotation.quote;
}

/** Reanchor only when the exact quotation occurs once; ambiguous matches require manual review. */
export function uniqueReanchor(annotation: LiteraryAnnotation, work: LiteraryWork): LiteraryAnnotation | null {
  const first = work.text.indexOf(annotation.quote);
  if (first < 0 || work.text.indexOf(annotation.quote, first + 1) !== -1) return null;
  return { ...annotation, start: first, end: first + annotation.quote.length };
}

export function extractAnnotation(
  work: LiteraryWork,
  id: string,
  start: number,
  end: number,
  kind: LiteraryAnnotationKind,
  interpretation: string,
  evidence: string,
): LiteraryAnnotation | null {
  const quote = work.text.slice(start, end);
  if (!id || !quote.trim() || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start < 0 || end > work.text.length || start >= end) return null;
  return { id, workId: work.id, start, end, quote, kind, interpretation, evidence };
}

const WORD_PATTERN = /[\p{L}\p{M}]+(?:[’'-][\p{L}\p{M}]+)*/gu;
export function wordFrequencies(text: string, locale = 'en'): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  let safeLocale = 'en';
  try { safeLocale = Intl.getCanonicalLocales(locale)[0] ?? 'en'; } catch { /* Invalid source metadata uses English fallback. */ }
  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0].toLocaleLowerCase(safeLocale);
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts].map(([word, count]) => ({ word, count })).sort((a, b) =>
    b.count - a.count || a.word.localeCompare(b.word, safeLocale));
}
/** Regex matching preserves UTF-16 offsets even for Unicode case-folding edge cases. */
export function concordance(text: string, query: string, _locale = 'en', limit = 50): { before: string; hit: string; after: string; offset: number }[] {
  const needle = query.trim();
  if (!needle || needle.length > 150) return [];
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\needle.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')'), 'giu');
  const results: { before: string; hit: string; after: string; offset: number }[] = [];
  for (const match of text.matchAll(pattern)) {
    if (results.length >= Math.max(0, Math.min(limit, 200))) break;
    const offset = match.index;
    const hit = match[0];
    results.push({
      before: text.slice(Math.max(0, offset - 45), offset),
      hit,
      after: text.slice(offset + hit.length, offset + hit.length + 45),
      offset,
    });
  }
  return results;
}

/** Exported annotations are stored in JSON; this CSV is a human-readable, source-aware report. */
export function annotationsCsv(workspace: LiteraryWorkspace): string {
  const quote = (value: string) => {
    // CSV quoting alone does not prevent spreadsheet formula execution.
    const safe = /^[=+@-]/u.test(value.trimStart()) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const rows: string[][] = [
    ['work', 'creator', 'edition', 'source', 'kind', 'offset_start', 'offset_end', 'anchor_valid', 'quotation', 'interpretation', 'evidence'],
  ];
  for (const item of workspace.annotations) {
    const work = workspace.works.find(candidate => candidate.id === item.workId);
    if (!work) continue;
    rows.push([work.title, work.creator, work.edition, work.source, item.kind,
      String(item.start), String(item.end), String(isAnnotationAnchored(item, work)),
      item.quote, item.interpretation, item.evidence]);
  }
  return rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
