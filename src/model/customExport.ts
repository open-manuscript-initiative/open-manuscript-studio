import type { OmiCitationStyleId, OmiManuscript } from '../types/omi';

export type CustomExportOutput = 'docx' | 'pdf' | 'html';
export type CustomExportBlockKind =
  | 'title'
  | 'subtitle'
  | 'motto'
  | 'author'
  | 'affiliation'
  | 'abstract'
  | 'keywords'
  | 'body'
  | 'notes'
  | 'bibliography';

export type CustomExportNoteMode = 'footnote' | 'endnote' | 'author-note' | 'all';
export type CustomExportAlignment = 'left' | 'center' | 'right' | 'justify';

export interface CustomExportTypography {
  fontFamily: string;
  fontSizePt: number;
  bold?: boolean;
  italic?: boolean;
  alignment?: CustomExportAlignment;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  lineHeight?: number;
}

export interface CustomExportBlock {
  id: string;
  kind: CustomExportBlockKind;
  enabled: boolean;
  language?: string;
  typography: CustomExportTypography;
  noteMode?: CustomExportNoteMode;
  bibliographyStyle?: OmiCitationStyleId;
}

/**
 * Formatting/content rule for one inline citation occurrence class.
 *
 * `content` is a token template. Supported tokens are intentionally based on
 * portable OMI bibliographic/citation data rather than renderer-specific HTML.
 */
export interface CustomExportCitationOccurrenceRule {
  content: string;
  typography: CustomExportTypography;
}

export interface CustomExportCitationStyle {
  enabled: boolean;
  first: CustomExportCitationOccurrenceRule;
  subsequent: CustomExportCitationOccurrenceRule;
}

export interface CustomExportTemplate {
  id: string;
  name: string;
  output: CustomExportOutput;
  blocks: CustomExportBlock[];
  citationStyle?: CustomExportCitationStyle;
}

export interface OmiLocalizedFrontMatterEntry {
  abstract?: string;
  keywords?: string[];
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    localizedFrontMatter?: Record<string, OmiLocalizedFrontMatterEntry>;
  }
}

const DEFAULT_FONT = 'Times New Roman';
const DEFAULT_BODY_SIZE = 12;

export const CUSTOM_CITATION_CONTENT_TOKENS = [
  '{citation}',
  '{author}',
  '{title}',
  '{shortTitle}',
  '{year}',
  '{container}',
  '{place}',
  '{publisher}',
  '{volume}',
  '{issue}',
  '{pages}',
  '{locator}',
  '{doi}',
  '{url}',
] as const;

function typography(fontSizePt: number, overrides: Partial<CustomExportTypography> = {}): CustomExportTypography {
  return {
    fontFamily: DEFAULT_FONT,
    fontSizePt,
    alignment: 'left',
    spaceBeforePt: 0,
    spaceAfterPt: 6,
    lineHeight: 1.15,
    ...overrides,
  };
}

export function defaultCustomCitationStyle(): CustomExportCitationStyle {
  const inline = typography(10, { spaceAfterPt: 0, lineHeight: 1 });
  return {
    enabled: false,
    // Keeping {citation} as the default preserves the manuscript's current
    // citation renderer until an export template deliberately overrides it.
    first: {
      content: '{citation}',
      typography: { ...inline },
    },
    subsequent: {
      content: '{citation}',
      typography: { ...inline },
    },
  };
}

export function defaultCustomExportTemplate(manuscript: Pick<OmiManuscript, 'locale' | 'citationStyle'>): CustomExportTemplate {
  const locale = normalizeLanguage(manuscript.locale);
  return {
    id: 'default',
    name: 'Custom export',
    output: 'docx',
    citationStyle: defaultCustomCitationStyle(),
    blocks: [
      { id: 'author', kind: 'author', enabled: true, typography: typography(12, { alignment: 'center' }) },
      { id: 'affiliation', kind: 'affiliation', enabled: true, typography: typography(10, { alignment: 'center', italic: true }) },
      { id: 'title', kind: 'title', enabled: true, typography: typography(18, { alignment: 'center', bold: true, spaceAfterPt: 8 }) },
      { id: 'subtitle', kind: 'subtitle', enabled: true, typography: typography(14, { alignment: 'center', spaceAfterPt: 8 }) },
      { id: 'motto', kind: 'motto', enabled: true, typography: typography(11, { alignment: 'right', italic: true, spaceAfterPt: 12 }) },
      { id: `abstract-${locale}`, kind: 'abstract', enabled: true, language: locale, typography: typography(11, { spaceAfterPt: 8 }) },
      { id: `keywords-${locale}`, kind: 'keywords', enabled: true, language: locale, typography: typography(11, { spaceAfterPt: 12 }) },
      { id: 'body', kind: 'body', enabled: true, typography: typography(DEFAULT_BODY_SIZE, { alignment: 'justify', spaceAfterPt: 6 }) },
      { id: 'notes', kind: 'notes', enabled: true, noteMode: 'all', typography: typography(10, { spaceAfterPt: 4 }) },
      {
        id: 'bibliography',
        kind: 'bibliography',
        enabled: true,
        bibliographyStyle: manuscript.citationStyle ?? 'apa-7',
        typography: typography(10, { spaceAfterPt: 4 }),
      },
    ],
  };
}

export function normalizeCustomExportTemplate(
  template: CustomExportTemplate,
): CustomExportTemplate {
  return template.citationStyle
    ? template
    : { ...template, citationStyle: defaultCustomCitationStyle() };
}

export function customExportLanguages(manuscript: OmiManuscript): string[] {
  const values = [
    normalizeLanguage(manuscript.locale),
    ...Object.keys(manuscript.localizedFrontMatter ?? {}).map(normalizeLanguage),
  ].filter(Boolean);
  return [...new Set(values)];
}

export function resolveLocalizedAbstract(manuscript: OmiManuscript, language?: string): string {
  const requested = normalizeLanguage(language || manuscript.locale);
  const main = normalizeLanguage(manuscript.locale);
  if (requested === main) return manuscript.abstract?.trim() ?? '';
  return manuscript.localizedFrontMatter?.[requested]?.abstract?.trim() ?? '';
}

export function resolveLocalizedKeywords(manuscript: OmiManuscript, language?: string): string[] {
  const requested = normalizeLanguage(language || manuscript.locale);
  const main = normalizeLanguage(manuscript.locale);
  if (requested === main) return manuscript.keywords.filter((item) => item.trim());
  return manuscript.localizedFrontMatter?.[requested]?.keywords?.filter((item) => item.trim()) ?? [];
}

export function normalizeLanguage(value: string): string {
  return value.trim().replace('_', '-').toLowerCase();
}
