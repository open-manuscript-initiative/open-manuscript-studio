import type {
  OmiBibliographicContributor,
  OmiBibliographicRecord,
  OmiCitation,
  OmiCitationStyleId,
} from '../types/omi.ts';

export const DEFAULT_CITATION_STYLE: OmiCitationStyleId = 'apa-7';

/**
 * Legacy built-ins kept stable for backwards compatibility and existing tests.
 * The full selector uses CITATION_STYLE_CATALOG below.
 */
export const CITATION_STYLE_IDS: readonly OmiCitationStyleId[] = [
  'apa-7',
  'chicago-author-date',
  'chicago-notes-bibliography',
  'mla-9',
  'iso-690',
] as const;

type BaseCitationStyle =
  | 'apa-7'
  | 'chicago-author-date'
  | 'chicago-notes-bibliography'
  | 'mla-9'
  | 'iso-690';

export interface CitationStyleDescriptor {
  id: string;
  label: string;
  category: string;
  baseStyle: BaseCitationStyle;
  numeric?: boolean;
}

function style(
  id: string,
  label: string,
  category: string,
  baseStyle: BaseCitationStyle,
  numeric = false,
): CitationStyleDescriptor {
  return { id, label, category, baseStyle, numeric };
}

/**
 * Curated cross-disciplinary CSL-oriented style registry.
 *
 * OMI stores the selected style as a presentation preference. Journal-specific
 * CSL XML can later be attached without rewriting bibliographic records.
 */
export const CITATION_STYLE_CATALOG: readonly CitationStyleDescriptor[] = [
  style('apa-7', 'APA 7th edition', 'Social sciences', 'apa-7'),
  style('apa-6', 'APA 6th edition', 'Social sciences', 'apa-7'),
  style('mla-9', 'MLA 9th edition', 'Humanities', 'mla-9'),
  style('mla-8', 'MLA 8th edition', 'Humanities', 'mla-9'),
  style('chicago-author-date', 'Chicago Author-Date', 'Humanities', 'chicago-author-date'),
  style('chicago-notes-bibliography', 'Chicago Notes & Bibliography', 'Humanities', 'chicago-notes-bibliography'),
  style('chicago-18-author-date', 'Chicago 18th edition – Author-Date', 'Humanities', 'chicago-author-date'),
  style('chicago-18-notes-bibliography', 'Chicago 18th edition – Notes & Bibliography', 'Humanities', 'chicago-notes-bibliography'),
  style('turabian-9-author-date', 'Turabian 9th edition – Author-Date', 'Humanities', 'chicago-author-date'),
  style('turabian-9-notes-bibliography', 'Turabian 9th edition – Notes & Bibliography', 'Humanities', 'chicago-notes-bibliography'),
  style('harvard-cite-them-right', 'Harvard – Cite Them Right', 'Author-date', 'chicago-author-date'),
  style('harvard-anglia-ruskin', 'Harvard – Anglia Ruskin University', 'Author-date', 'chicago-author-date'),
  style('harvard-imperial-college-london', 'Harvard – Imperial College London', 'Author-date', 'chicago-author-date'),
  style('elsevier-harvard', 'Elsevier – Harvard', 'Publisher', 'chicago-author-date'),
  style('springer-basic-author-date', 'Springer – Basic Author-Date', 'Publisher', 'chicago-author-date'),
  style('iso-690', 'ISO 690 – Author-date', 'Standards', 'iso-690'),
  style('iso-690-numeric', 'ISO 690 – Numeric', 'Standards', 'iso-690', true),
  style('din-1505-2', 'DIN 1505-2', 'Standards', 'iso-690'),
  style('gb-t-7714-2015-author-date', 'GB/T 7714-2015 – Author-Date', 'Standards', 'iso-690'),
  style('gb-t-7714-2015-numeric', 'GB/T 7714-2015 – Numeric', 'Standards', 'iso-690', true),
  style('gost-r-7-0-5-2008', 'GOST R 7.0.5-2008', 'Standards', 'iso-690', true),
  style('abnt-nbr-6023-2018', 'ABNT NBR 6023:2018', 'Standards', 'iso-690'),
  style('sist02', 'SIST02', 'Standards', 'iso-690'),
  style('vancouver', 'Vancouver', 'Medicine', 'iso-690', true),
  style('nlm', 'NLM', 'Medicine', 'iso-690', true),
  style('ama-11', 'AMA Manual of Style 11th edition', 'Medicine', 'iso-690', true),
  style('jama', 'JAMA', 'Medicine', 'iso-690', true),
  style('nejm', 'New England Journal of Medicine', 'Medicine', 'iso-690', true),
  style('bmj', 'BMJ', 'Medicine', 'iso-690', true),
  style('the-lancet', 'The Lancet', 'Medicine', 'iso-690', true),
  style('nature', 'Nature', 'Natural sciences', 'iso-690', true),
  style('science', 'Science', 'Natural sciences', 'iso-690', true),
  style('cell', 'Cell', 'Natural sciences', 'iso-690', true),
  style('acs', 'American Chemical Society (ACS)', 'Chemistry', 'iso-690', true),
  style('aip', 'American Institute of Physics (AIP)', 'Physics', 'iso-690', true),
  style('aps', 'American Physical Society (APS)', 'Physics', 'iso-690', true),
  style('ieee', 'IEEE', 'Engineering', 'iso-690', true),
  style('acm-sig-proceedings', 'ACM SIG Proceedings', 'Computing', 'iso-690', true),
  style('springer-basic-number', 'Springer – Basic Number', 'Publisher', 'iso-690', true),
  style('springer-vancouver', 'Springer – Vancouver', 'Publisher', 'iso-690', true),
  style('elsevier-vancouver', 'Elsevier – Vancouver', 'Publisher', 'iso-690', true),
  style('cse-name-year', 'CSE – Name-Year', 'Natural sciences', 'chicago-author-date'),
  style('cse-citation-name', 'CSE – Citation-Name', 'Natural sciences', 'iso-690', true),
  style('cse-citation-sequence', 'CSE – Citation-Sequence', 'Natural sciences', 'iso-690', true),
  style('asa', 'American Sociological Association (ASA)', 'Social sciences', 'chicago-author-date'),
  style('apsa', 'American Political Science Association (APSA)', 'Social sciences', 'chicago-author-date'),
  style('aaa', 'American Anthropological Association (AAA)', 'Social sciences', 'chicago-author-date'),
  style('bluebook', 'The Bluebook', 'Law', 'chicago-notes-bibliography'),
  style('oscola', 'OSCOLA', 'Law', 'chicago-notes-bibliography'),
  style('mhra', 'MHRA', 'Humanities', 'chicago-notes-bibliography'),
  style('american-historical-review', 'American Historical Review', 'History', 'chicago-notes-bibliography'),
  style('modern-humanities-research-association', 'Modern Humanities Research Association', 'Humanities', 'chicago-notes-bibliography'),
] as const;

export interface CustomCitationStyleConfig {
  name: string;
  baseStyle: BaseCitationStyle;
  citationPrefix?: string;
  citationSuffix?: string;
  citationDelimiter?: string;
  bibliographyPrefix?: string;
  bibliographySuffix?: string;
  uppercaseAuthors?: boolean;
  showYear?: boolean;
}

export function createCustomCitationStyleId(config: CustomCitationStyleConfig): string {
  return `custom:${encodeURIComponent(JSON.stringify(config))}`;
}

export function parseCustomCitationStyleId(
  id: string,
): CustomCitationStyleConfig | undefined {
  if (!id.startsWith('custom:')) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(id.slice('custom:'.length))) as Partial<CustomCitationStyleConfig>;
    if (!parsed.name || !parsed.baseStyle) return undefined;
    if (!CITATION_STYLE_IDS.includes(parsed.baseStyle as OmiCitationStyleId)) return undefined;
    return parsed as CustomCitationStyleConfig;
  } catch {
    return undefined;
  }
}

export function getCitationStyleDescriptor(id: string): CitationStyleDescriptor {
  const custom = parseCustomCitationStyleId(id);
  if (custom) {
    return style(id, custom.name, 'Custom', custom.baseStyle);
  }
  return CITATION_STYLE_CATALOG.find((candidate) => candidate.id === id)
    ?? CITATION_STYLE_CATALOG[0]!;
}

export interface CslJsonName {
  given?: string;
  family?: string;
  literal?: string;
}

export interface CslJsonDate {
  'date-parts'?: Array<Array<number | string>>;
  literal?: string;
}

export interface CslJsonItem {
  id: string;
  type: string;
  title: string;
  author?: CslJsonName[];
  editor?: CslJsonName[];
  translator?: CslJsonName[];
  'container-title'?: string;
  issued?: CslJsonDate;
  publisher?: string;
  'publisher-place'?: string;
  volume?: string;
  issue?: string;
  page?: string;
  language?: string;
  DOI?: string;
  ISBN?: string;
  ISSN?: string;
  URL?: string;
}

export interface RenderedBibliographyEntry {
  recordId: string;
  text: string;
}

export function toCslJson(record: OmiBibliographicRecord): CslJsonItem {
  const authors = contributorsByRole(record, 'author').map(toCslName);
  const editors = contributorsByRole(record, 'editor').map(toCslName);
  const translators = contributorsByRole(record, 'translator').map(toCslName);
  const doi = identifier(record, 'doi');
  return compactObject({
    id: record.id,
    type: toCslType(record.type),
    title: fullTitle(record),
    author: authors.length ? authors : undefined,
    editor: editors.length ? editors : undefined,
    translator: translators.length ? translators : undefined,
    'container-title': optional(record.containerTitle),
    issued: toCslDate(record.issued),
    publisher: optional(record.publisher),
    'publisher-place': optional(record.place),
    volume: optional(record.volume),
    issue: optional(record.issue),
    page: optional(record.pages),
    language: optional(record.language),
    DOI: doi,
    ISBN: identifier(record, 'isbn'),
    ISSN: identifier(record, 'issn'),
    URL: optional(record.url) || (doi ? `https://doi.org/${doi}` : undefined),
  }) as CslJsonItem;
}

export function renderCitationCluster(
  citations: readonly OmiCitation[],
  records: readonly OmiBibliographicRecord[],
  styleId: OmiCitationStyleId = DEFAULT_CITATION_STYLE,
  locale = 'en',
): string {
  const rawId = String(styleId);
  const descriptor = getCitationStyleDescriptor(rawId);
  const custom = parseCustomCitationStyleId(rawId);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const rendered = citations.map((citation, index) =>
    descriptor.numeric
      ? renderNumericCitation(citation, index + 1, descriptor.baseStyle, locale)
      : renderCitationItem(citation, recordsById.get(citation.target), descriptor.baseStyle, locale),
  );

  if (descriptor.numeric) {
    const values = rendered.join(custom?.citationDelimiter ?? ', ');
    return `${custom?.citationPrefix ?? '['}${values}${custom?.citationSuffix ?? ']'}`;
  }

  if (descriptor.baseStyle === 'chicago-notes-bibliography') {
    const values = rendered.join(custom?.citationDelimiter ?? '; ');
    return `${custom?.citationPrefix ?? ''}${values}${custom?.citationSuffix ?? ''}`;
  }

  const values = rendered.join(custom?.citationDelimiter ?? '; ');
  return `${custom?.citationPrefix ?? '('}${values}${custom?.citationSuffix ?? ')'}`;
}

export function renderBibliography(
  records: readonly OmiBibliographicRecord[],
  styleId: OmiCitationStyleId = DEFAULT_CITATION_STYLE,
  locale = 'en',
): RenderedBibliographyEntry[] {
  const descriptor = getCitationStyleDescriptor(String(styleId));
  return records
    .map((record, index) => ({
      recordId: record.id,
      text: descriptor.numeric
        ? `${index + 1}. ${renderBibliographyRecord(record, styleId, locale)}`
        : renderBibliographyRecord(record, styleId, locale),
      sortKey: descriptor.numeric ? String(index).padStart(8, '0') : bibliographySortKey(record),
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey, locale))
    .map(({ recordId, text }) => ({ recordId, text }));
}

export function renderBibliographyRecord(
  record: OmiBibliographicRecord,
  styleId: OmiCitationStyleId = DEFAULT_CITATION_STYLE,
  locale = 'en',
): string {
  const rawId = String(styleId);
  const descriptor = getCitationStyleDescriptor(rawId);
  const custom = parseCustomCitationStyleId(rawId);
  let rendered: string;
  switch (descriptor.baseStyle) {
    case 'apa-7':
      rendered = renderApaBibliography(record, locale);
      break;
    case 'chicago-author-date':
      rendered = renderChicagoAuthorDateBibliography(record, locale);
      break;
    case 'chicago-notes-bibliography':
      rendered = renderChicagoNotesBibliography(record, locale);
      break;
    case 'mla-9':
      rendered = renderMlaBibliography(record, locale);
      break;
    case 'iso-690':
      rendered = renderIsoBibliography(record, locale);
      break;
  }

  if (custom?.uppercaseAuthors) {
    const creator = preferredCreators(record)[0];
    const family = creator ? familyOrLiteral(creator) : '';
    if (family) rendered = rendered.replace(family, family.toLocaleUpperCase(locale));
  }
  return `${custom?.bibliographyPrefix ?? ''}${rendered}${custom?.bibliographySuffix ?? ''}`;
}

function renderNumericCitation(
  citation: OmiCitation,
  number: number,
  baseStyle: BaseCitationStyle,
  locale: string,
): string {
  const locator = renderLocator(citation, baseStyle, locale);
  return locator ? `${number}, ${locator}` : String(number);
}

function renderCitationItem(
  citation: OmiCitation,
  record: OmiBibliographicRecord | undefined,
  styleId: BaseCitationStyle,
  locale: string,
): string {
  if (!record) return localized(locale, 'unresolved');
  const author = shortAuthor(record, styleId, locale);
  const year = publicationYear(record) || localized(locale, 'noDate');
  const title = shortTitle(record.title);
  const locator = renderLocator(citation, styleId, locale);
  let core = '';
  switch (styleId) {
    case 'apa-7': core = joinDefined([author || title, year], ', '); break;
    case 'chicago-author-date': core = joinDefined([author || title, year], ' '); break;
    case 'chicago-notes-bibliography': core = joinDefined([author || title, title && author ? title : undefined], ', '); break;
    case 'mla-9': core = author || title; break;
    case 'iso-690': core = joinDefined([author ? author.toLocaleUpperCase(locale) : title, year], ', '); break;
  }
  const withLocator = locator ? `${core}${locatorSeparator(styleId)}${locator}` : core;
  const withPrefix = citation.prefix?.trim() ? `${citation.prefix.trim()} ${withLocator}` : withLocator;
  return citation.suffix?.trim() ? `${withPrefix}, ${citation.suffix.trim()}` : withPrefix;
}

function renderApaBibliography(record: OmiBibliographicRecord, locale: string): string {
  const creators = apaCreators(record);
  const year = publicationYear(record) || localized(locale, 'noDate');
  return sentence([
    creators ? `${creators} (${year}).` : `(${year}).`,
    `${fullTitle(record)}.`,
    containerSegment(record, 'apa'),
    publicationSegment(record, false),
    onlineIdentifier(record),
  ]);
}

function renderChicagoAuthorDateBibliography(record: OmiBibliographicRecord, locale: string): string {
  const creators = chicagoCreators(record, locale);
  const year = publicationYear(record) || localized(locale, 'noDate');
  return sentence([
    creators ? `${creators}.` : '',
    `${year}.`,
    `${quoteArticleTitle(record, fullTitle(record))}.`,
    containerSegment(record, 'chicago'),
    publicationSegment(record, true),
    onlineIdentifier(record),
  ]);
}

function renderChicagoNotesBibliography(record: OmiBibliographicRecord, locale: string): string {
  const creators = chicagoCreators(record, locale);
  return sentence([
    creators ? `${creators}.` : '',
    `${quoteArticleTitle(record, fullTitle(record))}.`,
    containerSegment(record, 'chicago'),
    publicationSegment(record, true),
    onlineIdentifier(record),
  ]);
}

function renderMlaBibliography(record: OmiBibliographicRecord, locale: string): string {
  const creators = mlaCreators(record, locale);
  const container = optional(record.containerTitle);
  const volume = record.volume ? `${localized(locale, 'volume')} ${record.volume}` : '';
  const issue = record.issue ? `${localized(locale, 'number')} ${record.issue}` : '';
  const pages = record.pages ? `${localized(locale, 'pages')} ${record.pages}` : '';
  return sentence([
    creators ? `${creators}.` : '',
    `${quoteArticleTitle(record, fullTitle(record))}.`,
    container ? `${container},` : '',
    commaSeries([volume, issue, publicationYear(record), pages, optional(record.publisher)]),
    onlineIdentifier(record),
  ]);
}

function renderIsoBibliography(record: OmiBibliographicRecord, locale: string): string {
  const creators = isoCreators(record, locale);
  return sentence([
    creators ? `${creators}.` : '',
    `${fullTitle(record)}.`,
    record.containerTitle ? `${record.containerTitle}.` : '',
    commaSeries([
      publicationYear(record),
      record.volume ? `${localized(locale, 'volume')} ${record.volume}` : '',
      record.issue ? `${localized(locale, 'number')} ${record.issue}` : '',
      record.pages ? `${localized(locale, 'pages')} ${record.pages}` : '',
    ]),
    publicationSegment(record, true),
    onlineIdentifier(record),
  ]);
}

function shortAuthor(record: OmiBibliographicRecord, styleId: BaseCitationStyle, locale: string): string {
  const creators = preferredCreators(record);
  if (!creators[0]) return '';
  const first = familyOrLiteral(creators[0]);
  if (creators.length === 1) return first;
  if (creators.length === 2) {
    const connector = styleId === 'apa-7' ? '&' : localized(locale, 'and');
    return `${first} ${connector} ${familyOrLiteral(creators[1]!)}`;
  }
  return `${first} ${localized(locale, 'etAl')}`;
}

function apaCreators(record: OmiBibliographicRecord): string {
  const creators = preferredCreators(record);
  return creators.map((creator) => {
    if (creator.literalName) return creator.literalName;
    const family = optional(creator.familyName) || optional(creator.givenName) || '';
    const initials = initialsFor(creator.givenName);
    return joinDefined([family ? `${family},` : '', initials], ' ');
  }).map((value, index, values) => index === values.length - 1 && values.length > 1 ? `& ${value}` : value)
    .join(creators.length > 2 ? ', ' : ' ').trim();
}

function chicagoCreators(record: OmiBibliographicRecord, locale: string): string {
  const creators = preferredCreators(record);
  return creators.map((creator, index) => index === 0 ? invertedName(creator) : normalName(creator))
    .reduce((acc, value, index) => {
      if (!acc) return value;
      return index === creators.length - 1 ? `${acc}, ${localized(locale, 'and')} ${value}` : `${acc}, ${value}`;
    }, '');
}

function mlaCreators(record: OmiBibliographicRecord, locale: string): string {
  const creators = preferredCreators(record);
  if (!creators.length) return '';
  if (creators.length === 1) return invertedName(creators[0]!);
  if (creators.length === 2) return `${invertedName(creators[0]!)}, ${localized(locale, 'and')} ${normalName(creators[1]!)}`;
  return `${invertedName(creators[0]!)} ${localized(locale, 'etAl')}`;
}

function isoCreators(record: OmiBibliographicRecord, locale: string): string {
  return preferredCreators(record).map((creator) => {
    if (creator.literalName) return creator.literalName.toLocaleUpperCase(locale);
    return joinDefined([
      optional(creator.familyName)?.toLocaleUpperCase(locale),
      optional(creator.givenName),
    ], ', ');
  }).join('; ');
}

function preferredCreators(record: OmiBibliographicRecord): OmiBibliographicContributor[] {
  const authors = contributorsByRole(record, 'author');
  if (authors.length) return authors;
  const editors = contributorsByRole(record, 'editor');
  return editors.length ? editors : [...record.contributors];
}

function contributorsByRole(record: OmiBibliographicRecord, role: string): OmiBibliographicContributor[] {
  return record.contributors.filter((contributor) => contributor.role === role);
}

function toCslName(contributor: OmiBibliographicContributor): CslJsonName {
  if (contributor.literalName) return { literal: normalize(contributor.literalName) };
  return compactObject({ given: optional(contributor.givenName), family: optional(contributor.familyName) }) as CslJsonName;
}

function toCslDate(value: string | undefined): CslJsonDate | undefined {
  const normalized = optional(value);
  if (!normalized) return undefined;
  const match = normalized.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!match) return { literal: normalized };
  const parts: Array<number | string> = [Number(match[1])];
  if (match[2]) parts.push(Number(match[2]));
  if (match[3]) parts.push(Number(match[3]));
  return { 'date-parts': [parts] };
}

function toCslType(type: string): string {
  switch (type) {
    case 'journal-article': return 'article-journal';
    case 'book-chapter': return 'chapter';
    case 'conference-paper': return 'paper-conference';
    case 'dissertation':
    case 'thesis': return 'thesis';
    case 'preprint': return 'article';
    case 'web-page': return 'webpage';
    case 'archival-source': return 'document';
    default: return type;
  }
}

function renderLocator(citation: OmiCitation, styleId: BaseCitationStyle, locale: string): string {
  const locator = citation.locator;
  if (!locator?.value?.trim()) return '';
  const value = locator.value.trim();
  if ((styleId === 'apa-7' || styleId === 'iso-690') && (locator.type === 'page' || locator.type === 'page-range')) {
    return `${locator.type === 'page-range' ? localized(locale, 'pages') : localized(locale, 'page')} ${value}`;
  }
  return value;
}

function locatorSeparator(styleId: BaseCitationStyle): string {
  return styleId === 'chicago-author-date' ? ', ' : ', ';
}

function fullTitle(record: OmiBibliographicRecord): string {
  const title = normalize(record.title);
  const subtitle = optional(record.subtitle);
  return subtitle ? `${title}: ${subtitle}` : title;
}

function shortTitle(title: string): string {
  const normalized = normalize(title);
  return normalized.length > 42 ? `${normalized.slice(0, 39).trim()}…` : normalized;
}

function quoteArticleTitle(record: OmiBibliographicRecord, title: string): string {
  return ['journal-article', 'book-chapter', 'conference-paper', 'web-page'].includes(record.type)
    ? `“${title}”`
    : title;
}

function containerSegment(record: OmiBibliographicRecord, styleId: 'apa' | 'chicago'): string {
  const container = optional(record.containerTitle);
  if (!container) return '';
  const volumeIssue = joinDefined([
    optional(record.volume),
    record.issue ? `(${record.issue})` : undefined,
  ], '');
  const pages = optional(record.pages);
  if (styleId === 'apa') return `${container}${volumeIssue ? `, ${volumeIssue}` : ''}${pages ? `, ${pages}` : ''}.`;
  return `${container}${volumeIssue ? ` ${volumeIssue}` : ''}${pages ? `: ${pages}` : ''}.`;
}

function publicationSegment(record: OmiBibliographicRecord, includePlace: boolean): string {
  const publisher = optional(record.publisher);
  const place = optional(record.place);
  if (!publisher && !place) return '';
  if (includePlace && place && publisher) return `${place}: ${publisher}.`;
  return `${publisher || place}.`;
}

function onlineIdentifier(record: OmiBibliographicRecord): string {
  const doi = identifier(record, 'doi');
  if (doi) return `https://doi.org/${doi}`;
  return optional(record.url) ?? '';
}

function identifier(record: OmiBibliographicRecord, scheme: string): string | undefined {
  return record.identifiers.find((candidate) => candidate.scheme.toLowerCase() === scheme.toLowerCase())?.value.trim() || undefined;
}

function publicationYear(record: OmiBibliographicRecord): string {
  return optional(record.issued)?.match(/\b\d{4}\b/)?.[0] ?? '';
}

function bibliographySortKey(record: OmiBibliographicRecord): string {
  const creator = preferredCreators(record)[0];
  return `${creator ? familyOrLiteral(creator) : ''}|${publicationYear(record)}|${record.title}`.toLocaleLowerCase();
}

function familyOrLiteral(contributor: OmiBibliographicContributor): string {
  return optional(contributor.familyName) || optional(contributor.literalName) || optional(contributor.givenName) || '';
}

function normalName(contributor: OmiBibliographicContributor): string {
  if (contributor.literalName) return normalize(contributor.literalName);
  return joinDefined([optional(contributor.givenName), optional(contributor.familyName)], ' ');
}

function invertedName(contributor: OmiBibliographicContributor): string {
  if (contributor.literalName) return normalize(contributor.literalName);
  const family = optional(contributor.familyName);
  const given = optional(contributor.givenName);
  return family && given ? `${family}, ${given}` : family || given || '';
}

function initialsFor(value: string | undefined): string {
  return (value ?? '').trim().split(/\s+/).filter(Boolean).map((part) => `${part[0]?.toLocaleUpperCase() ?? ''}.`).join(' ');
}

function localized(locale: string, key: 'and' | 'etAl' | 'noDate' | 'unresolved' | 'page' | 'pages' | 'volume' | 'number'): string {
  const language = locale.toLowerCase().split('-')[0];
  const dictionaries: Record<string, Record<typeof key, string>> = {
    en: { and: 'and', etAl: 'et al.', noDate: 'n.d.', unresolved: '[unresolved citation]', page: 'p.', pages: 'pp.', volume: 'vol.', number: 'no.' },
    hu: { and: 'és', etAl: 'et al.', noDate: 'é. n.', unresolved: '[feloldatlan hivatkozás]', page: 'p.', pages: 'pp.', volume: 'köt.', number: 'sz.' },
    de: { and: 'und', etAl: 'et al.', noDate: 'o. J.', unresolved: '[nicht aufgelöstes Zitat]', page: 'S.', pages: 'S.', volume: 'Bd.', number: 'Nr.' },
  };
  return (dictionaries[language] ?? dictionaries.en)![key];
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function sentence(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(' ').replace(/\s+/g, ' ').trim();
}

function commaSeries(parts: Array<string | undefined>): string {
  const values = parts.filter((part): part is string => Boolean(part?.trim()));
  return values.length ? `${values.join(', ')}.` : '';
}

function joinDefined(parts: Array<string | undefined>, separator: string): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(separator);
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ''));
}
