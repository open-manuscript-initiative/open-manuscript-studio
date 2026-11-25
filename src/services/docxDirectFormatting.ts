import { normalizeDirectValue, normalizeUnderlineStyle, type DirectFormat, type FormattingMark } from '../model/directFormatting';

/** Shared by the structural importer, enrichment pass and rich note importer.
 * The reader abstracts browser and xmldom XML implementations.
 */
export function wordDirectFormatting(read: (property: string, attribute?: string) => string | undefined, exists: (property: string) => boolean): Array<{ type: string; attrs?: Record<string, unknown> }> {
  const result: Array<{ type: string; attrs?: Record<string, unknown> }> = [];
  const add = (type: DirectFormat, raw: unknown) => {
    const value = normalizeDirectValue(type, raw);
    if (value !== undefined) result.push({ type, attrs: { value } });
  };
  const number = (property: string, name: DirectFormat, scale: number) => {
    const value = read(property);
    if (value !== undefined && value.trim()) add(name, Number(value) / scale);
  };
  number('sz', 'omiFontSize', 2);
  number('spacing', 'omiTracking', 20);
  number('position', 'omiBaseline', 2);
  number('w', 'omiCharacterScale', 1);
  number('kern', 'omiKerning', 2);
  add('omiTextColor', read('color'));
  add('omiHighlight', read('highlight'));
  add('omiLigatures', read('ligatures'));
  if (exists('rtl') || read('rtl') !== undefined) add('omiTextDirection', /^(?:0|false|off)$/i.test(read('rtl') ?? '1') ? 'ltr' : 'rtl');
  add('omiCharacterBackground', read('shd', 'fill'));
  for (const [property, type] of [
    ['caps', 'omiUppercase'], ['dstrike', 'omiDoubleStrike'],
    ['outline', 'omiOutline'], ['shadow', 'omiShadow'], ['vanish', 'omiHiddenText'],
  ] as const) if (exists(property) && !/^(?:0|false|off|none)$/i.test(read(property) ?? 'true')) add(type, true);
  const underline = normalizeUnderlineStyle(read('u'));
  if (underline) result.push({ type: 'omiUnderline', attrs: { variant: underline } });
  return result;
}

export function mergeWordDirectFormatting<T extends FormattingMark>(marks: T[], direct: T[]): T[] {
  const result = new Map(marks.map(mark => [mark.type, mark]));
  for (const mark of direct) result.set(mark.type, mark);
  return [...result.values()];
}
