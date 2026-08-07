export type DocxImportWarningSeverity = 'info' | 'warning';

export interface DocxImportWarning {
  code: string;
  severity: DocxImportWarningSeverity;
  message: string;
  sourcePart?: string;
}

export interface DocxDetectedAuthor {
  displayName: string;
  givenName: string;
  familyName: string;
  source: 'core-properties' | 'author-style';
}

export interface DocxHeadingDescriptor {
  id: string;
  level: number;
}

export interface DocxHierarchyAssignment {
  id: string;
  parentId?: string;
}

export interface DocxImportStats {
  sections: number;
  paragraphs: number;
  lists: number;
  notes: number;
  images: number;
  tables: number;
  equations: number;
  citations: number;
  references: number;
  links: number;
  warnings: number;
}

export function headingLevelFromStyle(
  styleId: string | undefined,
  styleName: string | undefined,
  outlineLevel: number | undefined,
): number | undefined {
  if (
    outlineLevel !== undefined &&
    Number.isInteger(outlineLevel) &&
    outlineLevel >= 0 &&
    outlineLevel <= 8
  ) {
    return outlineLevel + 1;
  }

  const values = [styleId, styleName]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());

  for (const value of values) {
    const match = /(?:heading|überschrift|uberschrift|címsor|cimsor)\s*[_-]?\s*([1-9])/i.exec(
      value,
    );
    if (match?.[1]) return Number(match[1]);
  }

  return undefined;
}

export function buildHeadingHierarchy(
  headings: readonly DocxHeadingDescriptor[],
): DocxHierarchyAssignment[] {
  const stack: Array<{ id: string; level: number }> = [];
  const assignments: DocxHierarchyAssignment[] = [];

  for (const heading of headings) {
    const level = Math.max(1, Math.min(9, Math.trunc(heading.level)));

    while (stack.length && (stack.at(-1)?.level ?? 0) >= level) {
      stack.pop();
    }

    const parent = stack.at(-1);
    assignments.push({
      id: heading.id,
      parentId: parent?.id,
    });
    stack.push({ id: heading.id, level });
  }

  return assignments;
}

export function parseDetectedAuthors(
  value: string | undefined,
  source: DocxDetectedAuthor['source'],
): DocxDetectedAuthor[] {
  const raw = (value ?? '').trim();
  if (!raw) return [];

  const names = raw
    .split(/[;\n]+/)
    .map((name) => name.trim())
    .filter(Boolean);

  return deduplicateAuthors(
    names.map((displayName) => {
      const tokens = displayName.split(/\s+/).filter(Boolean);
      const familyName = tokens.length > 1 ? tokens.at(-1) ?? '' : tokens[0] ?? '';
      const givenName = tokens.length > 1 ? tokens.slice(0, -1).join(' ') : '';

      return {
        displayName,
        givenName,
        familyName,
        source,
      };
    }),
  );
}

export function mergeDetectedAuthors(
  ...groups: ReadonlyArray<readonly DocxDetectedAuthor[]>
): DocxDetectedAuthor[] {
  return deduplicateAuthors(groups.flatMap((group) => [...group]));
}

export function parseWordCitationInstruction(
  instruction: string | undefined,
): string[] {
  const input = (instruction ?? '').replace(/\s+/g, ' ').trim();
  if (!/\bCITATION\b/i.test(input)) return [];

  const citationStart = input.search(/\bCITATION\b/i);
  const remainder = input.slice(citationStart).replace(/^CITATION\s+/i, '');
  const tags: string[] = [];

  for (const token of tokenizeWordField(remainder)) {
    if (token.startsWith('\\')) break;
    const cleaned = token.replace(/^['"]|['"]$/g, '').trim();
    if (cleaned) tags.push(cleaned);
  }

  return Array.from(new Set(tags));
}

export function parseWordHyperlinkInstruction(
  instruction: string | undefined,
): string | undefined {
  const input = (instruction ?? '').replace(/\s+/g, ' ').trim();
  const match = /^HYPERLINK\s+(?:"([^"]+)"|'([^']+)'|([^\s\\]+))/i.exec(input);
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}

export function detectKeywordLine(
  text: string | undefined,
): string[] | undefined {
  const value = (text ?? '').trim();
  const match = /^(?:keywords?|key\s+words|kulcsszavak|schlüsselwörter|schlusselworter)\s*[:–—-]\s*(.+)$/i.exec(
    value,
  );
  if (!match?.[1]) return undefined;

  const keywords = match[1]
    .split(/[;,]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return keywords.length ? Array.from(new Set(keywords)) : undefined;
}

export function isTitleStyle(
  styleId: string | undefined,
  styleName: string | undefined,
): boolean {
  return [styleId, styleName].some((value) =>
    /^(?:title|titel|cím|cim)$/i.test((value ?? '').trim()),
  );
}

export function isAuthorStyle(
  styleId: string | undefined,
  styleName: string | undefined,
): boolean {
  return [styleId, styleName].some((value) =>
    /(?:^|\s)(?:author|authors|verfasser|autor|szerző|szerzo)(?:\s|$)/i.test(
      (value ?? '').trim(),
    ),
  );
}

export function isAbstractStyle(
  styleId: string | undefined,
  styleName: string | undefined,
): boolean {
  return [styleId, styleName].some((value) =>
    /(?:^|\s)(?:abstract|summary|zusammenfassung|összefoglalás|osszefoglalas)(?:\s|$)/i.test(
      (value ?? '').trim(),
    ),
  );
}

export function isQuoteStyle(
  styleId: string | undefined,
  styleName: string | undefined,
): boolean {
  return [styleId, styleName].some((value) =>
    /(?:quote|quotation|zitat|idézet|idezet)/i.test((value ?? '').trim()),
  );
}

export function isCodeStyle(
  styleId: string | undefined,
  styleName: string | undefined,
): boolean {
  return [styleId, styleName].some((value) =>
    /(?:code|source\s*code|quellcode|kód|kod)/i.test((value ?? '').trim()),
  );
}

export function mapWordSourceType(value: string | undefined): string {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'journalarticle':
    case 'articleinjournal':
      return 'journal-article';
    case 'book':
      return 'book';
    case 'booksection':
    case 'sectioninbook':
      return 'book-chapter';
    case 'conferenceproceedings':
    case 'conferencepaper':
      return 'conference-paper';
    case 'report':
      return 'report';
    case 'thesis':
      return 'thesis';
    case 'electronicSource':
    case 'internetsite':
    case 'website':
      return 'web-page';
    default:
      return 'manuscript';
  }
}

export function createEmptyDocxImportStats(): DocxImportStats {
  return {
    sections: 0,
    paragraphs: 0,
    lists: 0,
    notes: 0,
    images: 0,
    tables: 0,
    equations: 0,
    citations: 0,
    references: 0,
    links: 0,
    warnings: 0,
  };
}

function deduplicateAuthors(
  authors: readonly DocxDetectedAuthor[],
): DocxDetectedAuthor[] {
  const seen = new Set<string>();
  const result: DocxDetectedAuthor[] = [];

  for (const author of authors) {
    const key = author.displayName.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(author);
  }

  return result;
}

function tokenizeWordField(value: string): string[] {
  const tokens: string[] = [];
  const pattern = /"[^"]*"|'[^']*'|\S+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    tokens.push(match[0]);
  }

  return tokens;
}
