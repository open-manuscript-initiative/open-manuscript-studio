/** Portable, validated local list settings. Native numbering labels are
 * metadata, never inserted into the editable paragraph text. */
export const LIST_FORMATS = ['decimal','upperRoman','lowerRoman','upperLetter','lowerLetter','decimalZero','bullet','none'] as const;
export type ListFormat = typeof LIST_FORMATS[number];
export const LIST_ATTRIBUTE_NAMES = ['omiListFormat','omiListLabel','omiListId','omiListLevel','omiListStart','omiListOverrideStart','omiListLeft','omiListHanging'] as const;
export type ListAttribute = typeof LIST_ATTRIBUTE_NAMES[number];

export function normalizeListAttribute(name: ListAttribute, value: unknown): string | number | undefined {
  if (name === 'omiListFormat') return LIST_FORMATS.includes(value as ListFormat) ? value as string : undefined;
  if (name === 'omiListLabel') return typeof value === 'string' && value.length <= 128 && !Array.from(value).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ? value : undefined;
  if (name === 'omiListId') return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return undefined;
  const min = (name === 'omiListStart' || name === 'omiListOverrideStart') ? 1 : 0;
  const max = name === 'omiListLevel' ? 8 : (name === 'omiListStart' || name === 'omiListOverrideStart') ? 999999 : 40000;
  return n >= min && n <= max ? n : undefined;
}
export function listPresentation(attrs: Record<string, unknown> | undefined): { type?: string; style?: string } {
  const format = normalizeListAttribute('omiListFormat', attrs?.omiListFormat);
  const types: Record<string,string> = { upperRoman:'I', lowerRoman:'i', upperLetter:'A', lowerLetter:'a' };
  if (typeof format !== 'string') return {};
  if (types[format]) return { type: types[format] };
  if (format === 'decimalZero') return { style:'list-style-type:decimal-leading-zero' };
  if (format === 'none') return { style:'list-style-type:none' };
  return {};
}
