import {
  createBibliographicRecord,
  createStableCitationId,
  normalizeDoi,
} from '../model/citations';
import type {
  OmiBibliographicContributor,
  OmiBibliographicIdentifier,
  OmiBibliographicRecord,
  OmiBibliographicResourceType,
} from '../types/omi';

export type ReferenceInterchangeFormat = 'ris' | 'bibtex' | 'csl-json';

export interface ReferenceInterchangeIssue {
  index?: number;
  message: string;
}

export interface ReferenceInterchangeImportResult {
  format: ReferenceInterchangeFormat;
  records: OmiBibliographicRecord[];
  issues: ReferenceInterchangeIssue[];
}

export function detectReferenceInterchangeFormat(
  content: string,
  fileName = '',
): ReferenceInterchangeFormat | null {
  const extension = fileName.trim().toLowerCase().split('.').pop();
  if (extension === 'ris') return 'ris';
  if (extension === 'bib' || extension === 'bibtex') return 'bibtex';
  if (extension === 'json' || extension === 'csljson') return 'csl-json';

  const text = content.trimStart();
  if (/^TY  - /m.test(text)) return 'ris';
  if (/^@[a-z]+\s*[({]/i.test(text)) return 'bibtex';
  if (text.startsWith('{') || text.startsWith('[')) return 'csl-json';
  return null;
}

export function parseReferenceInterchange(
  content: string,
  format?: ReferenceInterchangeFormat,
  fileName = '',
): ReferenceInterchangeImportResult {
  const resolved = format ?? detectReferenceInterchangeFormat(content, fileName);
  if (!resolved) {
    throw new Error('Unsupported reference-library format.');
  }

  if (resolved === 'ris') return parseRis(content);
  if (resolved === 'bibtex') return parseBibTeX(content);
  return parseCslJson(content);
}

function parseRis(content: string): ReferenceInterchangeImportResult {
  const records: OmiBibliographicRecord[] = [];
  const issues: ReferenceInterchangeIssue[] = [];
  const blocks = collectRisBlocks(content);

  blocks.forEach((fields, index) => {
    const title = firstRis(fields, ['TI', 'T1', 'CT']);
    if (!title) {
      issues.push({ index, message: 'RIS record has no title and was skipped.' });
      return;
    }

    const contributors: OmiBibliographicContributor[] = [
      ...allRis(fields, ['AU', 'A1']).map((name) =>
        interchangeContributor('author', name),
      ),
      ...allRis(fields, ['ED', 'A2']).map((name) =>
        interchangeContributor('editor', name),
      ),
    ];

    const identifiers: OmiBibliographicIdentifier[] = [];
    pushIdentifier(identifiers, 'ris', firstRis(fields, ['ID']));
    pushIdentifier(identifiers, 'doi', normalizeDoi(firstRis(fields, ['DO']) ?? ''));

    for (const serial of allRis(fields, ['SN'])) {
      const value = serial.trim();
      if (!value) continue;
      pushIdentifier(
        identifiers,
        /^\d{4}-?\d{3}[\dX]$/i.test(value.replace(/\s/g, ''))
          ? 'issn'
          : 'isbn',
        value,
      );
    }

    const startPage = firstRis(fields, ['SP']);
    const endPage = firstRis(fields, ['EP']);
    const pages = startPage && endPage && endPage !== startPage
      ? `${startPage}-${endPage}`
      : startPage ?? endPage;

    records.push(markResolved(createBibliographicRecord({
      type: mapRisType(firstRis(fields, ['TY']) ?? ''),
      title,
      contributors,
      containerTitle: firstRis(fields, ['T2', 'JO', 'JF', 'JA', 'BT']),
      issued: normalizeIssued(firstRis(fields, ['PY', 'Y1', 'DA'])),
      publisher: firstRis(fields, ['PB']),
      place: firstRis(fields, ['CY', 'PP']),
      volume: firstRis(fields, ['VL']),
      issue: firstRis(fields, ['IS']),
      pages,
      language: firstRis(fields, ['LA']),
      identifiers,
      url: firstRis(fields, ['UR', 'L1']),
      accessed: normalizeIssued(firstRis(fields, ['Y2'])),
    })));
  });

  return { format: 'ris', records, issues };
}

function collectRisBlocks(content: string): Array<Map<string, string[]>> {
  const blocks: Array<Map<string, string[]>> = [];
  let current: Map<string, string[]> | null = null;
  let lastTag = '';

  const flush = () => {
    if (current && current.size > 0) blocks.push(current);
    current = null;
    lastTag = '';
  };

  for (const rawLine of content.replace(/\r\n?/g, '\n').split('\n')) {
    const match = rawLine.match(/^([A-Z0-9]{2})  -\s?(.*)$/);
    if (match) {
      const tag = match[1]!;
      const value = match[2] ?? '';
      if (tag === 'TY') {
        flush();
        current = new Map();
      }
      current ??= new Map();
      const values = current.get(tag) ?? [];
      values.push(value.trim());
      current.set(tag, values);
      lastTag = tag;
      if (tag === 'ER') flush();
      continue;
    }

    if (current && lastTag && rawLine.trim()) {
      const values = current.get(lastTag);
      if (values?.length) {
        values[values.length - 1] = `${values[values.length - 1]} ${rawLine.trim()}`.trim();
      }
    }
  }
  flush();
  return blocks;
}

function firstRis(
  fields: Map<string, string[]>,
  tags: readonly string[],
): string | undefined {
  for (const tag of tags) {
    const value = fields.get(tag)?.find((candidate) => candidate.trim());
    if (value) return value.trim();
  }
  return undefined;
}

function allRis(
  fields: Map<string, string[]>,
  tags: readonly string[],
): string[] {
  return tags.flatMap((tag) => fields.get(tag) ?? []).filter(Boolean);
}

function mapRisType(value: string): OmiBibliographicResourceType {
  switch (value.trim().toUpperCase()) {
    case 'JOUR':
    case 'MGZN':
    case 'NEWS':
      return 'journal-article';
    case 'BOOK':
      return 'book';
    case 'CHAP':
      return 'book-chapter';
    case 'CONF':
    case 'CPAPER':
      return 'conference-paper';
    case 'THES':
      return 'thesis';
    case 'RPRT':
      return 'report';
    case 'UNPB':
      return 'manuscript';
    case 'DATA':
      return 'dataset';
    case 'COMP':
      return 'software';
    case 'STAND':
      return 'standard';
    case 'ELEC':
    case 'WEB':
      return 'web-page';
    default:
      return 'archival-source';
  }
}

function parseBibTeX(content: string): ReferenceInterchangeImportResult {
  const records: OmiBibliographicRecord[] = [];
  const issues: ReferenceInterchangeIssue[] = [];
  const entries = collectBibEntries(content);

  entries.forEach((entry, index) => {
    const title = cleanBibValue(entry.fields.title ?? '');
    if (!title) {
      issues.push({ index, message: 'BibTeX entry has no title and was skipped.' });
      return;
    }

    const contributors: OmiBibliographicContributor[] = [
      ...parseBibNames(entry.fields.author).map((name) =>
        interchangeContributor('author', name),
      ),
      ...parseBibNames(entry.fields.editor).map((name) =>
        interchangeContributor('editor', name),
      ),
      ...parseBibNames(entry.fields.translator).map((name) =>
        interchangeContributor('translator', name),
      ),
    ];

    const identifiers: OmiBibliographicIdentifier[] = [];
    pushIdentifier(identifiers, 'bibtex', entry.key);
    pushIdentifier(identifiers, 'doi', normalizeDoi(cleanBibValue(entry.fields.doi ?? '')));
    pushIdentifier(identifiers, 'isbn', cleanBibValue(entry.fields.isbn ?? ''));
    pushIdentifier(identifiers, 'issn', cleanBibValue(entry.fields.issn ?? ''));

    records.push(markResolved(createBibliographicRecord({
      type: mapBibType(entry.type),
      title,
      subtitle: cleanOptionalBibValue(entry.fields.subtitle),
      contributors,
      containerTitle:
        cleanOptionalBibValue(entry.fields.journal) ??
        cleanOptionalBibValue(entry.fields.booktitle),
      issued:
        cleanOptionalBibValue(entry.fields.date) ??
        cleanOptionalBibValue(entry.fields.year),
      publisher: cleanOptionalBibValue(entry.fields.publisher),
      place:
        cleanOptionalBibValue(entry.fields.location) ??
        cleanOptionalBibValue(entry.fields.address),
      volume: cleanOptionalBibValue(entry.fields.volume),
      issue:
        cleanOptionalBibValue(entry.fields.number) ??
        cleanOptionalBibValue(entry.fields.issue),
      pages: cleanOptionalBibValue(entry.fields.pages),
      language:
        cleanOptionalBibValue(entry.fields.language) ??
        cleanOptionalBibValue(entry.fields.langid),
      identifiers,
      url: cleanOptionalBibValue(entry.fields.url),
      accessed: cleanOptionalBibValue(entry.fields.urldate),
    })));
  });

  return { format: 'bibtex', records, issues };
}

interface BibEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
}

function collectBibEntries(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const at = content.indexOf('@', cursor);
    if (at < 0) break;
    let pos = at + 1;
    while (/\s/.test(content[pos] ?? '')) pos += 1;
    const typeStart = pos;
    while (/[A-Za-z]/.test(content[pos] ?? '')) pos += 1;
    const type = content.slice(typeStart, pos).trim().toLowerCase();
    while (/\s/.test(content[pos] ?? '')) pos += 1;
    const open = content[pos];
    if (!type || (open !== '{' && open !== '(')) {
      cursor = at + 1;
      continue;
    }

    const close = open === '{' ? '}' : ')';
    const end = findBalancedEnd(content, pos, open, close);
    if (end < 0) break;
    const body = content.slice(pos + 1, end);
    const comma = findTopLevelComma(body);
    if (comma >= 0 && !['comment', 'preamble', 'string'].includes(type)) {
      const key = body.slice(0, comma).trim();
      entries.push({
        type,
        key,
        fields: parseBibFields(body.slice(comma + 1)),
      });
    }
    cursor = end + 1;
  }

  return entries;
}

function findBalancedEnd(
  value: string,
  start: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findTopLevelComma(value: string): number {
  let braceDepth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === '{') braceDepth += 1;
    if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    if (char === ',' && braceDepth === 0) return index;
  }
  return -1;
}

function parseBibFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let cursor = 0;

  while (cursor < body.length) {
    while (/[,\s]/.test(body[cursor] ?? '')) cursor += 1;
    const nameStart = cursor;
    while (/[A-Za-z0-9_-]/.test(body[cursor] ?? '')) cursor += 1;
    const name = body.slice(nameStart, cursor).trim().toLowerCase();
    while (/\s/.test(body[cursor] ?? '')) cursor += 1;
    if (!name || body[cursor] !== '=') {
      cursor += 1;
      continue;
    }
    cursor += 1;
    while (/\s/.test(body[cursor] ?? '')) cursor += 1;

    const parts: string[] = [];
    while (cursor < body.length) {
      const char = body[cursor];
      if (char === '{') {
        const end = findBalancedEnd(body, cursor, '{', '}');
        if (end < 0) {
          parts.push(body.slice(cursor + 1));
          cursor = body.length;
          break;
        }
        parts.push(body.slice(cursor + 1, end));
        cursor = end + 1;
      } else if (char === '"') {
        const { value, next } = readQuotedBibValue(body, cursor);
        parts.push(value);
        cursor = next;
      } else {
        const start = cursor;
        while (cursor < body.length && !/[#,]/.test(body[cursor] ?? '')) {
          cursor += 1;
        }
        parts.push(body.slice(start, cursor).trim());
      }
      while (/\s/.test(body[cursor] ?? '')) cursor += 1;
      if (body[cursor] === '#') {
        cursor += 1;
        while (/\s/.test(body[cursor] ?? '')) cursor += 1;
        continue;
      }
      break;
    }
    fields[name] = parts.join('').trim();
    while (cursor < body.length && body[cursor] !== ',') cursor += 1;
    if (body[cursor] === ',') cursor += 1;
  }

  return fields;
}

function readQuotedBibValue(
  body: string,
  start: number,
): { value: string; next: number } {
  let cursor = start + 1;
  let escaped = false;
  let value = '';
  while (cursor < body.length) {
    const char = body[cursor]!;
    if (escaped) {
      value += char;
      escaped = false;
      cursor += 1;
      continue;
    }
    if (char === '\\') {
      value += char;
      escaped = true;
      cursor += 1;
      continue;
    }
    if (char === '"') return { value, next: cursor + 1 };
    value += char;
    cursor += 1;
  }
  return { value, next: cursor };
}

function cleanBibValue(value: string): string {
  return value
    .replace(/[{}]/g, '')
    .replace(/\\([&%_$#])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanOptionalBibValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return cleanBibValue(value) || undefined;
}

function parseBibNames(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\s+and\s+/i)
    .map(cleanBibValue)
    .filter(Boolean);
}

function mapBibType(value: string): OmiBibliographicResourceType {
  switch (value.trim().toLowerCase()) {
    case 'article':
      return 'journal-article';
    case 'book':
    case 'booklet':
      return 'book';
    case 'inbook':
    case 'incollection':
      return 'book-chapter';
    case 'conference':
    case 'inproceedings':
    case 'proceedings':
      return 'conference-paper';
    case 'phdthesis':
      return 'dissertation';
    case 'mastersthesis':
    case 'thesis':
      return 'thesis';
    case 'techreport':
    case 'report':
      return 'report';
    case 'dataset':
      return 'dataset';
    case 'software':
      return 'software';
    case 'standard':
      return 'standard';
    case 'unpublished':
      return 'manuscript';
    case 'online':
    case 'webpage':
      return 'web-page';
    default:
      return 'archival-source';
  }
}

function parseCslJson(content: string): ReferenceInterchangeImportResult {
  const decoded = JSON.parse(content) as unknown;
  const items = cslItems(decoded);
  const records: OmiBibliographicRecord[] = [];
  const issues: ReferenceInterchangeIssue[] = [];

  items.forEach((raw, index) => {
    const item = asRecord(raw);
    const title = text(item?.title);
    if (!item || !title) {
      issues.push({ index, message: 'CSL JSON item has no title and was skipped.' });
      return;
    }

    const contributors: OmiBibliographicContributor[] = [
      ...cslNames(item.author).map((name) => cslContributor('author', name)),
      ...cslNames(item.editor).map((name) => cslContributor('editor', name)),
      ...cslNames(item.translator).map((name) => cslContributor('translator', name)),
    ];
    const identifiers: OmiBibliographicIdentifier[] = [];
    pushIdentifier(identifiers, 'csl', text(item.id));
    pushIdentifier(identifiers, 'doi', normalizeDoi(text(item.DOI) ?? ''));
    pushIdentifier(identifiers, 'isbn', joinedText(item.ISBN));
    pushIdentifier(identifiers, 'issn', joinedText(item.ISSN));
    pushIdentifier(identifiers, 'pmid', text(item.PMID));
    pushIdentifier(identifiers, 'pmcid', text(item.PMCID));

    records.push(markResolved(createBibliographicRecord({
      type: mapCslType(text(item.type) ?? ''),
      title,
      subtitle: text(item['title-short']),
      contributors,
      containerTitle: joinedText(item['container-title']),
      issued: cslDate(item.issued),
      publisher: text(item.publisher),
      place: text(item['publisher-place']),
      volume: text(item.volume),
      issue: text(item.issue),
      pages: text(item.page),
      language: text(item.language),
      identifiers,
      url: text(item.URL),
      accessed: cslDate(item.accessed),
    })));
  });

  return { format: 'csl-json', records, issues };
}

function cslItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const root = asRecord(value);
  if (Array.isArray(root?.items)) return root.items;
  return root ? [root] : [];
}

function cslNames(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function cslContributor(
  role: OmiBibliographicContributor['role'],
  value: Record<string, unknown>,
): OmiBibliographicContributor {
  return {
    id: createStableCitationId('bib'),
    role,
    givenName: text(value.given),
    familyName: text(value.family),
    literalName: text(value.literal),
  };
}

function mapCslType(value: string): OmiBibliographicResourceType {
  switch (value.trim().toLowerCase()) {
    case 'article-journal':
    case 'article-magazine':
    case 'article-newspaper':
      return 'journal-article';
    case 'book':
      return 'book';
    case 'chapter':
    case 'entry':
    case 'entry-dictionary':
    case 'entry-encyclopedia':
      return 'book-chapter';
    case 'paper-conference':
      return 'conference-paper';
    case 'thesis':
      return 'thesis';
    case 'report':
      return 'report';
    case 'dataset':
      return 'dataset';
    case 'software':
      return 'software';
    case 'standard':
      return 'standard';
    case 'manuscript':
      return 'manuscript';
    case 'webpage':
    case 'post':
    case 'post-weblog':
      return 'web-page';
    default:
      return 'archival-source';
  }
}

function cslDate(value: unknown): string | undefined {
  const root = asRecord(value);
  const raw = text(root?.raw);
  if (raw) return raw;
  const parts = Array.isArray(root?.['date-parts'])
    ? root?.['date-parts']
    : undefined;
  const first = Array.isArray(parts?.[0]) ? parts?.[0] : undefined;
  if (!first?.length) return undefined;
  const values = first
    .slice(0, 3)
    .map((part) => typeof part === 'number' ? String(part) : text(part))
    .filter((part): part is string => Boolean(part));
  if (!values.length) return undefined;
  return values
    .map((part, index) => index === 0 ? part : part.padStart(2, '0'))
    .join('-');
}

function interchangeContributor(
  role: OmiBibliographicContributor['role'],
  rawName: string,
): OmiBibliographicContributor {
  const name = rawName.replace(/\s+/g, ' ').trim();
  if (!name) {
    return { id: createStableCitationId('bib'), role };
  }
  const comma = name.indexOf(',');
  if (comma >= 0) {
    return {
      id: createStableCitationId('bib'),
      role,
      familyName: name.slice(0, comma).trim() || undefined,
      givenName: name.slice(comma + 1).trim() || undefined,
    };
  }

  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 2) {
    return {
      id: createStableCitationId('bib'),
      role,
      givenName: parts[0],
      familyName: parts[1],
    };
  }

  return {
    id: createStableCitationId('bib'),
    role,
    literalName: name,
  };
}

function normalizeIssued(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const year = value.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1];
  return year ?? value.trim() || undefined;
}

function pushIdentifier(
  target: OmiBibliographicIdentifier[],
  scheme: string,
  value: string | undefined,
): void {
  const normalized = value?.trim();
  if (!normalized) return;
  if (
    target.some(
      (item) =>
        item.scheme.toLowerCase() === scheme.toLowerCase() &&
        item.value.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    return;
  }
  target.push({ scheme: scheme.toLowerCase(), value: normalized });
}

function markResolved(record: OmiBibliographicRecord): OmiBibliographicRecord {
  return { ...record, status: 'resolved' };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function joinedText(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const joined = value.map(text).filter(Boolean).join('; ');
    return joined || undefined;
  }
  return text(value);
}
