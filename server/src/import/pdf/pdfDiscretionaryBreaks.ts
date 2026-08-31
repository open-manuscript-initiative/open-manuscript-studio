export const PDF_EXTRACTION_BREAK = '\uFFFE';

/**
 * Normalize the noncharacter U+FFFE emitted by some PDF text extractors for
 * discretionary line breaks. When it appears inside a single extracted word,
 * remove it directly (`finan\uFFFEcial` -> `financial`). When it survives at
 * a token/line edge, turn it into a soft hyphen so downstream line joining can
 * recognize that the next lowercase fragment belongs to the same word.
 */
export function normalizePdfDiscretionaryBreaks(value: string): string {
  return value
    .replace(/([\p{L}\p{M}])\uFFFE(?=[\p{L}\p{M}])/gu, '$1')
    .replace(/\uFFFE/gu, '\u00AD');
}
