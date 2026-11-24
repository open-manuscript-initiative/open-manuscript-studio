/** Direct character typography is distinct from scholarly inline semantics.
 * Values are bounded, typed and never treated as arbitrary CSS or XML.
 */
export const DIRECT_FORMATS = {
  omiFontSize: { min: 1, max: 400 },
  omiTracking: { min: -20, max: 100 },
  omiBaseline: { min: -100, max: 100 },
  omiCharacterScale: { min: 1, max: 600 },
  omiKerning: { min: 0, max: 400 },
  omiTextColor: { color: true },
  omiCharacterBackground: { color: true },
  omiHighlight: { choices: ['yellow', 'green', 'cyan', 'magenta', 'blue', 'red', 'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'darkGray', 'lightGray', 'black', 'white'] },
  omiUppercase: { toggle: true },
  omiDoubleStrike: { toggle: true },
  omiOutline: { toggle: true },
  omiShadow: { toggle: true },
  omiHiddenText: { toggle: true },
  omiLigatures: { choices: ['none','standard','contextual','historical','discretional','standardContextual','standardHistorical','standardDiscretional','contextualHistorical','contextualDiscretional','historicalDiscretional','standardContextualHistorical','standardContextualDiscretional','standardHistoricalDiscretional','contextualHistoricalDiscretional','all'] },
} as const;
export type DirectFormat = keyof typeof DIRECT_FORMATS;
export type DirectValue = string | number | boolean;
export type DirectFormatting = Partial<Record<DirectFormat, DirectValue>> & { underlineStyle?: string };
export type FormattingMark = { type?: string; attrs?: Record<string, unknown> };
export const DIRECT_FORMAT_NAMES = Object.keys(DIRECT_FORMATS) as DirectFormat[];

export function normalizeDirectValue(name: DirectFormat, raw: unknown): DirectValue | undefined {
  const definition = DIRECT_FORMATS[name];
  if ('min' in definition) {
    if (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim())) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= definition.min && value <= definition.max ? Math.round(value * 100) / 100 : undefined;
  }
  if ('color' in definition) return typeof raw === 'string' && /^#?[0-9a-f]{6}$/i.test(raw) ? '#' + raw.replace(/^#/, '').toUpperCase() : undefined;
  if ('toggle' in definition) return raw === true || raw === 'true' ? true : undefined;
  return typeof raw === 'string' && (definition.choices as readonly string[]).includes(raw) ? raw : undefined;
}
export function normalizeUnderlineStyle(value: unknown): string | undefined {
  return typeof value === 'string' && ['double', 'dotted', 'wave'].includes(value) ? value : undefined;
}
export function directFormattingFromMarks(marks: readonly FormattingMark[] | undefined): DirectFormatting {
  const result: DirectFormatting = {};
  for (const mark of marks ?? []) {
    if (mark.type === 'omiUnderline') {
      const style = normalizeUnderlineStyle(mark.attrs?.variant);
      if (style) result.underlineStyle = style;
    } else if (DIRECT_FORMAT_NAMES.includes(mark.type as DirectFormat)) {
      const name = mark.type as DirectFormat;
      const value = normalizeDirectValue(name, mark.attrs?.value);
      if (value !== undefined) result[name] = value;
    }
  }
  return result;
}
const HIGHLIGHTS: Record<string, string> = {
  yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000',
  darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#C0C0C0', black: '#000000', white: '#FFFFFF',
};
export function directFormattingCss(name: DirectFormat, raw: unknown): string {
  const value = normalizeDirectValue(name, raw);
  if (value === undefined) return '';
  switch (name) {
    case 'omiFontSize': return 'font-size:' + value + 'pt';
    case 'omiTracking': return 'letter-spacing:' + value + 'pt';
    case 'omiBaseline': return 'vertical-align:' + value + 'pt';
    case 'omiCharacterScale': return 'font-stretch:' + value + '%';
    case 'omiKerning': return Number(value) === 0 ? 'font-kerning:none' : 'font-kerning:normal';
    case 'omiTextColor': return 'color:' + value;
    case 'omiCharacterBackground': return 'background-color:' + value;
    case 'omiHighlight': return 'background-color:' + HIGHLIGHTS[String(value)];
    case 'omiUppercase': return 'text-transform:uppercase';
    case 'omiDoubleStrike': return 'text-decoration:line-through double';
    case 'omiOutline': return '-webkit-text-stroke:0.5px currentColor;color:transparent';
    case 'omiShadow': return 'text-shadow:1px 1px 1px #888';
    case 'omiHiddenText': return 'text-decoration:underline dotted;opacity:0.65';
    case 'omiLigatures': {
      if (value === 'none') return 'font-variant-ligatures:none';
      const flags = String(value).toLowerCase();
      const has = (name: string) => value === 'all' || flags.includes(name);
      return 'font-variant-ligatures:' + [
        has('standard') ? 'common-ligatures' : 'no-common-ligatures',
        has('contextual') ? 'contextual' : 'no-contextual',
        has('historical') ? 'historical-ligatures' : 'no-historical-ligatures',
        has('discretional') ? 'discretionary-ligatures' : 'no-discretionary-ligatures',
      ].join(' ');
    }
  }
}
export function underlineCss(value: unknown): string {
  const variant = normalizeUnderlineStyle(value);
  return variant ? 'text-decoration-style:' + (variant === 'wave' ? 'wavy' : variant) : '';
}
/** XML attributes below contain only normalized enums, numbers or hex colors. */
export function directFormattingWordXml(input: DirectFormatting): string {
  const v = (name: DirectFormat) => normalizeDirectValue(name, input[name]);
  const numeric = (name: DirectFormat, tag: string, scale: number) => {
    const value = v(name);
    return value === undefined ? '' : '<w:' + tag + ' w:val="' + Math.round(Number(value) * scale) + '"/>';
  };
  const color = (name: DirectFormat) => String(v(name) ?? '').replace(/^#/, '');
  const underline = normalizeUnderlineStyle(input.underlineStyle);
  return [
    v('omiUppercase') ? '<w:caps/>' : '',
    v('omiDoubleStrike') ? '<w:dstrike/>' : '',
    v('omiOutline') ? '<w:outline/>' : '',
    v('omiShadow') ? '<w:shadow/>' : '',
    v('omiHiddenText') ? '<w:vanish/>' : '',
    color('omiTextColor') ? '<w:color w:val="' + color('omiTextColor') + '"/>' : '',
    numeric('omiTracking', 'spacing', 20), numeric('omiCharacterScale', 'w', 1), numeric('omiKerning', 'kern', 2),
    numeric('omiBaseline', 'position', 2), numeric('omiFontSize', 'sz', 2),
    v('omiHighlight') ? '<w:highlight w:val="' + v('omiHighlight') + '"/>' : '',
    underline ? '<w:u w:val="' + underline + '"/>' : '',
    color('omiCharacterBackground') ? '<w:shd w:val="clear" w:fill="' + color('omiCharacterBackground') + '"/>' : '',
    v('omiLigatures') ? '<w14:ligatures w14:val="' + v('omiLigatures') + '"/>' : '',
  ].join('');
}
