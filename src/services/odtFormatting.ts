import { normalizeDirectValue, type DirectFormat } from '../model/directFormatting';
import { normalizeParagraphValue, type ParagraphFormat } from '../model/directParagraphFormatting';
import type { OmiInlineRun } from '../model/inlineSemantics';
import { normalizeInlineLanguageTag } from '../model/richText';

type Properties = Record<string, string>;
const HIGHLIGHTS: Record<string, string> = { yellow:'#FFFF00', green:'#00FF00', cyan:'#00FFFF', magenta:'#FF00FF', blue:'#0000FF', red:'#FF0000', darkBlue:'#000080', darkCyan:'#008080', darkGreen:'#008000', darkMagenta:'#800080', darkRed:'#800000', darkYellow:'#808000', darkGray:'#808080', lightGray:'#C0C0C0', black:'#000000', white:'#FFFFFF' };
export function odtCharacterProperties(run: OmiInlineRun): Properties {
  const p: Properties = {};
  const has = (kind: OmiInlineRun['semantics'][number]) => run.semantics.includes(kind);
  const direct = run.directFormatting ?? {};
  const value = (name: DirectFormat) => normalizeDirectValue(name, direct[name]);
  if (has('strong')) p['fo:font-weight'] = 'bold';
  if (has('emphasis')) p['fo:font-style'] = 'italic';
  if (has('small-caps')) p['fo:font-variant'] = 'small-caps';
  if (has('superscript')) p['style:text-position'] = 'super 58%';
  if (has('subscript')) p['style:text-position'] = 'sub 58%';
  if (has('underline')) {
    p['style:text-underline-style'] = direct.underlineStyle === 'wave' ? 'wave' : direct.underlineStyle === 'dotted' ? 'dotted' : 'solid';
    if (direct.underlineStyle === 'double') p['style:text-underline-type'] = 'double';
  }
  if (has('strike') || value('omiDoubleStrike')) p['style:text-line-through-style'] = 'solid';
  if (value('omiDoubleStrike')) p['style:text-line-through-type'] = 'double';
  if (value('omiUppercase')) p['fo:text-transform'] = 'uppercase';
  if (value('omiOutline')) p['style:text-outline'] = 'true';
  if (value('omiShadow')) p['fo:text-shadow'] = '#888888 1pt 1pt';
  for (const [name, property, unit] of [
    ['omiFontSize','fo:font-size','pt'], ['omiTracking','fo:letter-spacing','pt'],
    ['omiCharacterScale','style:text-scale','%'], ['omiTextColor','fo:color',''],
    ['omiCharacterBackground','fo:background-color',''],
  ] as const) {
    const v = value(name); if (v !== undefined) p[property] = String(v) + unit;
  }
  const highlight = value('omiHighlight');
  if (typeof highlight === 'string') p['fo:background-color'] = HIGHLIGHTS[highlight]!;
  if (run.sourceFontFamily) p['fo:font-family'] = run.sourceFontFamily;
  else if (has('code')) p['fo:font-family'] = 'Liberation Mono';
  const lang = normalizeInlineLanguageTag(run.language);
  if (lang) {
    const locale = new Intl.Locale(lang);
    p['fo:language'] = locale.language;
    if (locale.region) p['fo:country'] = locale.region;
    if (locale.script) p['fo:script'] = locale.script;
  }
  return p;
}
export function odtParagraphProperties(attrs: Record<string, unknown> | undefined): Properties {
  const p: Properties = {};
  const v = (name: ParagraphFormat) => normalizeParagraphValue(name, attrs?.[name]);
  if (v('omiAlign')) p['fo:text-align'] = String(v('omiAlign'));
  for (const [name, property] of [
    ['omiLeftIndent','fo:margin-left'], ['omiRightIndent','fo:margin-right'], ['omiFirstLineIndent','fo:text-indent'],
    ['omiSpaceBefore','fo:margin-top'], ['omiSpaceAfter','fo:margin-bottom'],
  ] as const) {
    const value = v(name); if (value !== undefined) p[property] = value + 'pt';
  }
  const line = v('omiLineSpacing');
  if (line !== undefined) {
    const rule = v('omiLineRule') ?? 'auto';
    if (rule === 'atLeast') p['style:line-height-at-least'] = line + 'pt';
    else p['fo:line-height'] = rule === 'exact' ? line + 'pt' : Number(line) * 100 + '%';
  }
  const widow = v('omiWidowControl');
  if (widow !== undefined) { p['fo:widows'] = widow ? '2' : '1'; p['fo:orphans'] = widow ? '2' : '1'; }
  const next = v('omiKeepNext');
  if (next !== undefined) p['fo:keep-with-next'] = next ? 'always' : 'auto';
  const lines = v('omiKeepLines');
  if (lines !== undefined) p['fo:keep-together'] = lines ? 'always' : 'auto';
  const before = v('omiPageBreakBefore');
  if (before !== undefined) p['fo:break-before'] = before ? 'page' : 'auto';
  return p;
}
const lengthPt = (raw: string | undefined): number | undefined => {
  const m = raw?.trim().match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(pt|cm|mm|in|pc)$/);
  if (!m) return undefined;
  return Number(m[1]) * (({pt:1, cm:72/2.54, mm:72/25.4, in:72, pc:12} as Record<string, number>)[m[2]!] ?? 1);
};
export function readOdtParagraphProperties(read: (name: string) => string | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const add = (name: ParagraphFormat, raw: unknown) => { const v = normalizeParagraphValue(name, raw); if (v !== undefined) result[name] = v; };
  const alignment = read('fo:text-align');
  add('omiAlign', alignment === 'start' ? 'left' : alignment === 'end' ? 'right' : alignment);
  for (const [name, property] of [
    ['omiLeftIndent','fo:margin-left'], ['omiRightIndent','fo:margin-right'], ['omiFirstLineIndent','fo:text-indent'],
    ['omiSpaceBefore','fo:margin-top'], ['omiSpaceAfter','fo:margin-bottom'],
  ] as const) add(name, lengthPt(read(property)));
  const min = lengthPt(read('style:line-height-at-least'));
  const line = read('fo:line-height');
  const exact = lengthPt(line);
  if (min !== undefined) { add('omiLineRule','atLeast'); add('omiLineSpacing',min); }
  else if (exact !== undefined) { add('omiLineRule','exact'); add('omiLineSpacing',exact); }
  else if (line && /^\d+(?:\.\d+)?%$/.test(line)) { add('omiLineRule','auto'); add('omiLineSpacing',parseFloat(line)/100); }
  const widows = read('fo:widows'); const orphans = read('fo:orphans');
  if (widows !== undefined || orphans !== undefined) add('omiWidowControl', Number(widows ?? 0) > 1 || Number(orphans ?? 0) > 1);
  for (const [name, property, enabled] of [
    ['omiKeepNext','fo:keep-with-next','always'], ['omiKeepLines','fo:keep-together','always'], ['omiPageBreakBefore','fo:break-before','page'],
  ] as const) {
    const value = read(property);
    if (value === enabled || value === 'auto') add(name,value === enabled);
  }
  return result;
}
export function readOdtDirectProperties(read: (name: string) => string | undefined, styleName: string): Array<{ type: string; attrs?: Record<string, unknown> }> {
  const marks: Array<{ type: string; attrs?: Record<string, unknown> }> = [];
  const add = (type: DirectFormat, raw: unknown) => { const value = normalizeDirectValue(type, raw); if (value !== undefined) marks.push({ type, attrs: { value } }); };
  add('omiFontSize', lengthPt(read('fo:font-size')));
  add('omiTracking', lengthPt(read('fo:letter-spacing')));
  const scale = read('style:text-scale');
  if (scale && /^\d+(?:\.\d+)?%$/.test(scale)) add('omiCharacterScale',parseFloat(scale));
  add('omiTextColor',read('fo:color'));
  const background = read('fo:background-color');
  const highlight = styleName.startsWith('OMIHighlight') && Object.entries(HIGHLIGHTS).find(([, color]) => color === background?.toUpperCase())?.[0];
  if (highlight) add('omiHighlight',highlight);
  else add('omiCharacterBackground',background);
  if (read('fo:text-transform') === 'uppercase') add('omiUppercase',true);
  if (read('style:text-line-through-type') === 'double') add('omiDoubleStrike',true);
  if (read('style:text-outline') === 'true') add('omiOutline',true);
  if (read('fo:text-shadow') && read('fo:text-shadow') !== 'none') add('omiShadow',true);
  const underline = read('style:text-underline-style');
  if (underline && underline !== 'none') {
    const variant = read('style:text-underline-type') === 'double' ? 'double' : ['wave','dotted'].includes(underline) ? underline : undefined;
    if (variant) marks.push({ type:'omiUnderline',attrs:{variant} });
  }
  const font = read('fo:font-family')?.replace(/^['"]|['"]$/g,'');
  if (font && font.length <= 128 && Array.from(font).every(c=>c.charCodeAt(0)>=32 && c.charCodeAt(0)!==127)) marks.push({type:'omiSourceFont',attrs:{family:font}});
  const lang = read('fo:language');
  const country = read('fo:country');
  const script = read('fo:script');
  if (lang && lang !== 'none') {
    const tag = normalizeInlineLanguageTag([lang,script,country === 'none' ? undefined : country].filter(Boolean).join('-'));
    if (tag) marks.push({type:'omiLanguage',attrs:{lang:tag}});
  }
  return marks;
}
export function odtRunHasDirectFormatting(run: OmiInlineRun): boolean {
  return Object.keys(run.directFormatting ?? {}).length > 0;
}
