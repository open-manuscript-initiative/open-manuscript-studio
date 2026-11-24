/** Local paragraph overrides in point units. Named publication styles remain
 * separate; absent values inherit from the selected paragraph style. */
export const PARAGRAPH_FORMATS = {
  omiAlign: { choices: ['left', 'center', 'right', 'justify'] },
  omiLeftIndent: { min: 0, max: 1000 },
  omiRightIndent: { min: 0, max: 1000 },
  omiFirstLineIndent: { min: -1000, max: 1000 },
  omiSpaceBefore: { min: 0, max: 1000 },
  omiSpaceAfter: { min: 0, max: 1000 },
  omiLineSpacing: { min: 0.05, max: 1000 },
  omiLineRule: { choices: ['auto', 'exact', 'atLeast'] },
  omiWidowControl: { toggle: true },
  omiKeepNext: { toggle: true },
  omiKeepLines: { toggle: true },
  omiPageBreakBefore: { toggle: true },
} as const;
export type ParagraphFormat = keyof typeof PARAGRAPH_FORMATS;
export const PARAGRAPH_FORMAT_NAMES = Object.keys(PARAGRAPH_FORMATS) as ParagraphFormat[];
export function normalizeParagraphValue(name: ParagraphFormat, input: unknown): string | number | boolean | undefined {
  const definition = PARAGRAPH_FORMATS[name];
  if ('toggle' in definition) return input === true || input === 'true' ? true : input === false || input === 'false' ? false : undefined;
  if ('choices' in definition) return typeof input === 'string' && (definition.choices as readonly string[]).includes(input) ? input : undefined;
  if (typeof input !== 'number' && (typeof input !== 'string' || !input.trim())) return undefined;
  const value = Number(input);
  return Number.isFinite(value) && value >= definition.min && value <= definition.max ? Math.round(value * 100) / 100 : undefined;
}
export function paragraphFormattingCss(attrs: Record<string, unknown> | undefined, target: 'editor' | 'html' | 'print'): string {
  const v = (name: ParagraphFormat) => normalizeParagraphValue(name, attrs?.[name]);
  const alignment = v('omiAlign');
  const css: string[] = [];
  if (alignment) css.push('text-align:' + (alignment === 'justify' && target === 'html' ? 'left' : alignment));
  const point = (name: ParagraphFormat, property: string) => {
    const value = v(name);
    if (value !== undefined) css.push(property + ':' + value + 'pt');
  };
  point('omiLeftIndent', 'margin-left'); point('omiRightIndent', 'margin-right');
  point('omiFirstLineIndent', 'text-indent'); point('omiSpaceBefore', 'margin-top'); point('omiSpaceAfter', 'margin-bottom');
  const line = v('omiLineSpacing');
  if (line !== undefined) css.push('line-height:' + line + (v('omiLineRule') === 'auto' || !v('omiLineRule') ? '' : 'pt'));
  if (target === 'print') {
    const widow = v('omiWidowControl');
    if (widow !== undefined) css.push('widows:' + (widow ? 2 : 1), 'orphans:' + (widow ? 2 : 1));
    const next = v('omiKeepNext');
    if (next !== undefined) css.push('break-after:' + (next ? 'avoid-page' : 'auto'));
    const lines = v('omiKeepLines');
    if (lines !== undefined) css.push('break-inside:' + (lines ? 'avoid-page' : 'auto'));
    const before = v('omiPageBreakBefore');
    if (before !== undefined) css.push('break-before:' + (before ? 'page' : 'auto'));
  }
  return css.join(';');
}
export function paragraphFormattingWordXml(attrs: Record<string, unknown> | undefined): string {
  const v = (name: ParagraphFormat) => normalizeParagraphValue(name, attrs?.[name]);
  const align = v('omiAlign');
  const word = (name: ParagraphFormat, property: string, factor = 20) => {
    const value = v(name);
    return value === undefined ? '' : ' w:' + property + '="' + Math.round(Number(value) * factor) + '"';
  };
  const first = v('omiFirstLineIndent');
  const indent = word('omiLeftIndent', 'left') + word('omiRightIndent', 'right')
    + (first === undefined ? '' : ' w:' + (Number(first) < 0 ? 'hanging' : 'firstLine') + '="' + Math.round(Math.abs(Number(first)) * 20) + '"');
  const line = v('omiLineSpacing');
  const rule = v('omiLineRule') ?? 'auto';
  const spacing = word('omiSpaceBefore', 'before') + word('omiSpaceAfter', 'after')
    + (line === undefined ? '' : ' w:line="' + Math.round(Number(line) * (rule === 'auto' ? 240 : 20)) + '" w:lineRule="' + rule + '"');
  const flag = (name: ParagraphFormat, tag: string) => {
    const value = v(name);
    return value === undefined ? '' : '<w:' + tag + ' w:val="' + (value ? '1' : '0') + '"/>';
  };
  return flag('omiKeepNext','keepNext') + flag('omiKeepLines','keepLines') + flag('omiPageBreakBefore','pageBreakBefore') + flag('omiWidowControl','widowControl')
    + (spacing ? '<w:spacing' + spacing + '/>' : '')
    + (indent ? '<w:ind' + indent + '/>' : '')
    + (align ? '<w:jc w:val="' + (align === 'justify' ? 'both' : align) + '"/>' : '');
}
export function readWordParagraphFormatting(read: (property: string, attribute: string) => string | undefined, exists: (property: string) => boolean = () => false): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const add = (name: ParagraphFormat, raw: unknown) => {
    const value = normalizeParagraphValue(name, raw);
    if (value !== undefined) result[name] = value;
  };
  const number = (property: string, attribute: string, name: ParagraphFormat, factor: number) => {
    const value = read(property, attribute);
    if (value !== undefined && value.trim()) add(name, Number(value) / factor);
  };
  const align = read('jc', 'val');
  add('omiAlign', align === 'both' ? 'justify' : align);
  number('ind', 'left', 'omiLeftIndent', 20);
  number('ind', 'right', 'omiRightIndent', 20);
  number('ind', 'firstLine', 'omiFirstLineIndent', 20);
  number('ind', 'hanging', 'omiFirstLineIndent', -20);
  number('spacing', 'before', 'omiSpaceBefore', 20);
  number('spacing', 'after', 'omiSpaceAfter', 20);
  if (read('spacing', 'line') !== undefined) {
    const rule = read('spacing', 'lineRule') ?? 'auto';
    add('omiLineRule', rule);
    number('spacing', 'line', 'omiLineSpacing', rule === 'auto' ? 240 : 20);
  }
  for (const [name, property] of [
    ['omiWidowControl','widowControl'], ['omiKeepNext','keepNext'], ['omiKeepLines','keepLines'], ['omiPageBreakBefore','pageBreakBefore'],
  ] as const) {
    const raw = read(property,'val');
    if (raw !== undefined || exists(property)) add(name, !/^(?:0|false|off)$/i.test(raw ?? '1'));
  }
  return result;
}
