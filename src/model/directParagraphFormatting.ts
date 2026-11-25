/** Local paragraph overrides in point units. Named publication styles remain
 * separate; absent values inherit from the selected paragraph style. */
export const PARAGRAPH_FORMATS = {
  omiParagraphBackground: { color: true },
  omiParagraphBorders: { structured: 'borders' },
  omiParagraphTabs: { structured: 'tabs' },
  omiParagraphDirection: { choices: ['ltr','rtl'] },
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
  if ('color' in definition) return typeof input === 'string' && /^#[0-9a-f]{6}$/i.test(input) ? input.toUpperCase() : undefined;
  if ('structured' in definition) return normalizeDecoration(definition.structured, input);
  if ('toggle' in definition) return input === true || input === 'true' ? true : input === false || input === 'false' ? false : undefined;
  if ('choices' in definition) return typeof input === 'string' && (definition.choices as readonly string[]).includes(input) ? input : undefined;
  if (typeof input !== 'number' && (typeof input !== 'string' || !input.trim())) return undefined;
  const value = Number(input);
  return Number.isFinite(value) && value >= definition.min && value <= definition.max ? Math.round(value * 100) / 100 : undefined;
}

export const BORDER_SIDES = ['top','left','bottom','right'] as const;
export type ParagraphBorder = { style: string; width: number; color: string; space: number };
export type ParagraphTab = { position: number; alignment: string; leader: string };
function bounded(input: unknown, min: number, max: number): number | undefined {
  return typeof input === 'number' && Number.isFinite(input) && input >= min && input <= max ? Math.round(input * 100) / 100 : undefined;
}
/** Canonical JSON strings are used in attributes so equality and DOM roundtrip
 * remain deterministic. Only validated properties reach CSS or XML. */
function normalizeDecoration(kind: 'borders' | 'tabs', input: unknown): string | undefined {
  try {
    const parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    if (kind === 'borders') {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
      const result: Record<string, ParagraphBorder> = {};
      for (const side of BORDER_SIDES) {
        const b = (parsed as Record<string, ParagraphBorder>)[side];
        if (!b) continue;
        const width = typeof b.width === 'number' && Number.isFinite(b.width) && b.width >= 0.125 && b.width <= 12 ? Math.round(b.width * 8) / 8 : undefined, space = bounded(b.space, 0, 31);
        if (width === undefined || space === undefined || !['single','double','dotted','dashed','nil'].includes(b.style) || !/^#[0-9a-f]{6}$/i.test(b.color)) return undefined;
        result[side] = { style:b.style, width, color:b.color.toUpperCase(), space };
      }
      return JSON.stringify(result);
    }
    if (!Array.isArray(parsed) || parsed.length > 64) return undefined;
    const result: ParagraphTab[] = [];
    for (const t of parsed as ParagraphTab[]) {
      const position = bounded(t.position, 0, 2000);
      if (position === undefined || !['left','center','right','decimal','clear'].includes(t.alignment) || !['none','dot','hyphen','underscore','middleDot','heavy'].includes(t.leader)) return undefined;
      if (result.some(item => item.position === position)) return undefined;
      result.push({position,alignment:t.alignment,leader:t.leader});
    }
    return JSON.stringify(result.sort((a,b)=>a.position-b.position));
  } catch { return undefined; }
}
export function paragraphBorders(attrs: Record<string, unknown> | undefined): Record<string, ParagraphBorder> {
  return JSON.parse(normalizeDecoration('borders',attrs?.omiParagraphBorders) ?? '{}');
}
export function paragraphTabs(attrs: Record<string, unknown> | undefined): ParagraphTab[] {
  return JSON.parse(normalizeDecoration('tabs',attrs?.omiParagraphTabs) ?? '[]');
}

export function paragraphFormattingCss(attrs: Record<string, unknown> | undefined, target: 'editor' | 'html' | 'print'): string {
  const v = (name: ParagraphFormat) => normalizeParagraphValue(name, attrs?.[name]);
  const alignment = v('omiAlign');
  const css: string[] = [];
  const background = v('omiParagraphBackground');
  if (background) css.push('background-color:' + background);
  for (const [side,border] of Object.entries(paragraphBorders(attrs))) {
    css.push('border-' + side + ':' + (border.style === 'nil' ? 'none' : border.width + 'pt ' + (border.style === 'single' ? 'solid' : border.style) + ' ' + border.color));
    if (border.style !== 'nil') css.push('padding-' + side + ':' + border.space + 'pt');
  }
  const direction = v('omiParagraphDirection');
  if (direction) css.push('direction:' + direction);
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
    + paragraphDecorationWordXml(attrs)
    + (v('omiParagraphDirection') ? '<w:bidi w:val="' + (v('omiParagraphDirection') === 'rtl' ? '1' : '0') + '"/>' : '')
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
  const fill = read('shd','fill');
  if (fill) add('omiParagraphBackground','#' + fill);
  const bidi = read('bidi','val');
  if (bidi !== undefined || exists('bidi')) add('omiParagraphDirection', /^(?:0|false|off)$/i.test(bidi ?? '1') ? 'ltr' : 'rtl');
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

function paragraphDecorationWordXml(attrs: Record<string, unknown> | undefined): string {
  const borders = Object.entries(paragraphBorders(attrs)).map(([side,b]) =>
    '<w:' + side + ' w:val="' + b.style + '" w:sz="' + Math.round(b.width*8) + '" w:color="' + b.color.slice(1) + '" w:space="' + Math.round(b.space) + '"/>').join('');
  const fill = normalizeParagraphValue('omiParagraphBackground',attrs?.omiParagraphBackground);
  const tabs = paragraphTabs(attrs).map(t => '<w:tab w:val="' + t.alignment + '" w:pos="' + Math.round(t.position*20) + '" w:leader="' + t.leader + '"/>').join('');
  return (borders ? '<w:pBdr>' + borders + '</w:pBdr>' : '') + (typeof fill === 'string' ? '<w:shd w:val="clear" w:fill="' + fill.slice(1) + '"/>' : '') + (tabs ? '<w:tabs>' + tabs + '</w:tabs>' : '');
}
export function readWordParagraphDecoration(children: (parent: string, child: string) => Record<string,string>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const borders: Record<string, ParagraphBorder> = {};
  for (const side of BORDER_SIDES) {
    const b = children('pBdr',side)[0];
    if (b) borders[side] = { style:b.val ?? 'single', width:Number(b.sz ?? 4)/8, color:'#' + (b.color === 'auto' ? '000000' : b.color ?? '000000'), space:Number(b.space ?? 0) };
  }
  const tabs = children('tabs','tab').map(t=>({position:Number(t.pos)/20,alignment:t.val,leader:t.leader ?? 'none'}));
  if (Object.keys(borders).length) { const value = normalizeDecoration('borders',borders); if (value !== undefined) result.omiParagraphBorders = value; }
  if (tabs.length) { const value = normalizeDecoration('tabs',tabs); if (value !== undefined) result.omiParagraphTabs = value; }
  return result;
}
