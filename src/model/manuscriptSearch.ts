export interface ManuscriptSearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface BlockReplaceResult {
  content: string;
  replacements: number;
}

export interface TextMatchRange {
  start: number;
  end: number;
}

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  [key: string]: unknown;
}

export function countMatchesInText(
  text: string,
  query: string,
  options: ManuscriptSearchOptions = {},
): number {
  return findTextMatchRanges(text, query, options).length;
}

export function findTextMatchRanges(
  text: string,
  query: string,
  options: ManuscriptSearchOptions = {},
): TextMatchRange[] {
  if (!query) return [];
  const regex = createSearchRegex(query, options);
  return Array.from(text.matchAll(regex), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function replaceInText(
  text: string,
  query: string,
  replacement: string,
  options: ManuscriptSearchOptions = {},
): { text: string; replacements: number } {
  if (!query) return { text, replacements: 0 };
  return replaceText(text, query, replacement, options);
}

export function replaceMatchInText(
  text: string,
  query: string,
  replacement: string,
  occurrenceIndex: number,
  options: ManuscriptSearchOptions = {},
): { text: string; replacements: number } {
  const ranges = findTextMatchRanges(text, query, options);
  const range = ranges[occurrenceIndex];
  if (!range) return { text, replacements: 0 };
  return {
    text: `${text.slice(0, range.start)}${replacement}${text.slice(range.end)}`,
    replacements: 1,
  };
}

export function countMatchesInBlockContent(
  content: string,
  query: string,
  options: ManuscriptSearchOptions = {},
): number {
  if (!query) return 0;
  const document = parseTiptapDocument(content);
  if (!document) return countMatchesInText(content, query, options);

  let matches = 0;
  visitTextNodes(document, (text) => {
    matches += countMatchesInText(text, query, options);
    return text;
  });
  return matches;
}

export function replaceInBlockContent(
  content: string,
  query: string,
  replacement: string,
  options: ManuscriptSearchOptions = {},
): BlockReplaceResult {
  if (!query) return { content, replacements: 0 };
  const document = parseTiptapDocument(content);
  if (!document) {
    const result = replaceText(content, query, replacement, options);
    return { content: result.text, replacements: result.replacements };
  }

  let replacements = 0;
  visitTextNodes(document, (text) => {
    const result = replaceText(text, query, replacement, options);
    replacements += result.replacements;
    return result.text;
  });

  return {
    content: replacements > 0 ? JSON.stringify(document) : content,
    replacements,
  };
}

export function replaceMatchInBlockContent(
  content: string,
  query: string,
  replacement: string,
  occurrenceIndex: number,
  options: ManuscriptSearchOptions = {},
): BlockReplaceResult {
  if (!query || occurrenceIndex < 0) return { content, replacements: 0 };
  const document = parseTiptapDocument(content);
  if (!document) {
    const result = replaceMatchInText(content, query, replacement, occurrenceIndex, options);
    return { content: result.text, replacements: result.replacements };
  }

  let remaining = occurrenceIndex;
  let replacements = 0;
  visitTextNodes(document, (text) => {
    if (replacements > 0) return text;
    const count = countMatchesInText(text, query, options);
    if (remaining >= count) {
      remaining -= count;
      return text;
    }
    const result = replaceMatchInText(text, query, replacement, remaining, options);
    replacements += result.replacements;
    return result.text;
  });

  return {
    content: replacements > 0 ? JSON.stringify(document) : content,
    replacements,
  };
}

function parseTiptapDocument(content: string): TiptapNode | null {
  if (!content.trim().startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || parsed.type !== 'doc') return null;
    return parsed as TiptapNode;
  } catch {
    return null;
  }
}

function visitTextNodes(
  node: TiptapNode,
  transform: (text: string) => string,
): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    node.text = transform(node.text);
  }
  if (!Array.isArray(node.content)) return;
  for (const child of node.content) {
    if (isRecord(child)) visitTextNodes(child as TiptapNode, transform);
  }
}

function replaceText(
  text: string,
  query: string,
  replacement: string,
  options: ManuscriptSearchOptions,
): { text: string; replacements: number } {
  let replacements = 0;
  const regex = createSearchRegex(query, options);
  const replaced = text.replace(regex, () => {
    replacements += 1;
    return replacement;
  });
  return { text: replaced, replacements };
}

function createSearchRegex(
  query: string,
  options: ManuscriptSearchOptions,
): RegExp {
  const escaped = escapeRegExp(query);
  const source = options.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
    : escaped;
  const flags = `gu${options.caseSensitive ? '' : 'i'}`;
  return new RegExp(source, flags);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
