import type {
  OmiBibliographicContributor,
  OmiBibliographicRecord,
  OmiCitation,
  OmiCitationStyleId,
} from '../types/omi.ts';

export const DEFAULT_CITATION_STYLE: OmiCitationStyleId = 'apa-7';

export const CITATION_STYLE_IDS: readonly OmiCitationStyleId[] = [
  'apa-7',
  'chicago-author-date',
  'chicago-notes-bibliography',
  'mla-9',
  'iso-690',
] as const;

export interface CslJsonName {
  given?: string;
  family?: string;
  literal?: string;
}

export interface CslJsonDate {
  'date-parts'?: Array<Array<number | string>>;
  literal?: string;
}

/**
 * Focused CSL-JSON shape produced by Studio.
 *
 * Studio deliberately keeps its canonical OMI bibliographic model separate
 * from CSL. This adapter allows citation/publishing renderers to consume a
 * standard presentation-oriented representation without rewriting OMI data.
 */
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
  const issued = toCslDate(record.issued);
  const doi = identifier(record, 'doi');
  const isbn = identifier(record, 'isbn');
  const issn = identifier(record, 'issn');

  return compactObject({
    id: record.id,
    type: toCslType(record.type),
    title: record.subtitle
      ? `${normalize(record.title)}: ${normalize(record.subtitle)}`
      : normalize(record.title),
    author: authors.length ? authors : undefined,
    editor: editors.length ? editors : undefined,
    translator: translators.length ? translators : undefined,
    'container-title': optional(record.containerTitle),
    issued,
    publisher: optional(record.publisher),
    'publisher-place': optional(record.place),
    volume: optional(record.volume),
    issue: optional(record.issue),
    page: optional(record.pages),
    language: optional(record.language),
    DOI: doi,
    ISBN: isbn,
    ISSN: issn,
    URL: optional(record.url) || (doi ? `https://doi.org/${doi}` : undefined),
  }) as CslJsonItem;
}

export function renderCitationCluster(
  citations: readonly OmiCitation[],
  records: readonly OmiBibliographicRecord[],
  style: OmiCitationStyleId = DEFAULT_CITATION_STYLE,
  locale = 'en',
): string {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const rendered = citations.map((citation) =>
    renderCitationItem(citation, recordMap.get(citation.target), style, locale),
  );

  if (style === 'chicago-notes-bibliography') {
    return rendered.join('; ');
  }

  return `(${rendered.join('; ')})`;
}

export function renderBibliography(
  records: readonly OmiBibliographicRecord[],
  style: OmiCitationStyleId = DEFAULT_CITATION_STYLE,
  locale = 'en',
): RenderedBibliographyEntry[] {
  return records
    .map((record) => ({
      recordId: record.id,
      text: renderBibliographyRecord(record, style, locale),
      sortKey: bibliographySortKey(record, style),
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey, locale))
    .map(({ recordId, text }) => ({ recordId, text }));
}

export function renderBibliographyRecord(
  record: OmiBibliographicRecord,
  style: OmiCitationStyleId = DEFAULT_CITATION_STYLE,
  locale = 'en',
): string {
  switch (style) {
    case 'apa-7':
      return renderApaBibliography(record, locale);
    case 'chicago-author-date':
      return renderChicagoAuthorDateBibliography(record, locale);
    case 'chicago-notes-bibliography':
      return renderChicagoNotesBibliography(record, locale);
    case 'mla-9':
      return renderMlaBibliography(record, locale);
    case 'iso-690':
      return renderIsoBibliography(record, locale);
  }
}

function renderCitationItem(
  citation: OmiCitation,
  record: OmiBibliographicRecord | undefined,
  style: OmiCitationStyleId,
  locale: string,
): string {
  if (!record) {
    return localized(locale, 'unresolved');
  }

  const author = shortAuthor(record, style, locale);
  const year = publicationYear(record) || localized(locale, 'noDate');
  const title = shortTitle(record.title);
  const locator = renderLocator(citation, style, locale);
  let core: string;

  switch (style) {
    case 'apa-7':
      core = joinDefined([author || title, year], ', ');
      break;
    case 'chicago-author-date':
      core = joinDefined([author || title, year], ' ');
      break;
    case 'chicago-notes-bibliography':
      core = joinDefined([author || title, title && author ? title : undefined], ', ');
      break;
    case 'mla-9':
      core = author || title;
      break;
    case 'iso-690':
      core = joinDefined([author ? author.toLocaleUpperCase(locale) : title, year], ', ');
      break;
  }

  const withLocator = locator ? `${core}${locatorSeparator(style)}${locator}` : core;
  const withPrefix = citation.prefix?.trim()
    ? `${citation.prefix.trim()} ${withLocator}`
    : withLocator;

  return citation.suffix?.trim()
    ? `${withPrefix}, ${citation.suffix.trim()}`
    : withPrefix;
}

function renderApaBibliography(
  record: OmiBibliographicRecord,
  locale: string,
): string {
  const creators = apaCreators(record, locale);
  const year = publicationYear(record) || localized(locale, 'noDate');
  const title = fullTitle(record);
  const container = containerSegment(record, 'apa');
  const publication = publicationSegment(record, false);
  const online = onlineIdentifier(record);

  return sentence([
    creators ? `${creators} (${year}).` : `(${year}).`,
    title ? `${title}.` : '',
    container,
    publication,
    online,
  ]);
}

function renderChicagoAuthorDateBibliography(
  record: OmiBibliographicRecord,
  locale: string,
): string {
  const creators = chicagoCreators(record, locale);
  const year = publicationYear(record) || localized(locale, 'noDate');
  const title = quoteArticleTitle(record, fullTitle(record));
  const container = containerSegment(record, 'chicago');
  const publication = publicationSegment(record, true);
  const online = onlineIdentifier(record);

  return sentence([
    creators ? `${creators}.` : '',
    `${year}.`,
    title ? `${title}.` : '',
    container,
    publication,
    online,
  ]);
}

function renderChicagoNotesBibliography(
  record: OmiBibliographicRecord,
  locale: string,
): string {
  const creators = chicagoCreators(record, locale);
  const title = quoteArticleTitle(record, fullTitle(record));
  const container = containerSegment(record, 'chicago');
  const publication = chicagoNotesPublication(record);
  const online = onlineIdentifier(record);

  return sentence([
    creators ? `${creators}.` : '',
    title ? `${title}.` : '',
    container,
    publication,
    online,
  ]);
}

function renderMlaBibliography(
  record: OmiBibliographicRecord,
  locale: string,
): string {
  const creators = mlaCreators(record, locale);
  const title = quoteArticleTitle(record, fullTitle(record));
  const container = optional(record.containerTitle);
  const volume = record.volume ? `${localized(locale, 'volume')} ${record.volume}` : '';
  const issue = record.issue ? `${localized(locale, 'number')} ${record.issue}` : '';
  const year = publicationYear(record);
  const pages = record.pages ? `${localized(locale, 'pages')} ${record.pages}` : '';
  const publisher = optional(record.publisher);
  const online = onlineIdentifier(record);

  return sentence([
    creators ? `${creators}.` : '',
    title ? `${title}.` : '',
    container ? `${container},` : '',
    commaSeries([volume, issue, year, pages, publisher]),
    online,
  ]);
}

function renderIsoBibliography(
  record: OmiBibliographicRecord,
  locale: string,
): string {
  const creators = isoCreators(record, locale);
  const title = fullTitle(record);
  const container = optional(record.containerTitle);
  const year = publicationYear(record);
  const volume = record.volume ? `${localized(locale, 'volume')} ${record.volume}` : '';
  const issue = record.issue ? `${localized(locale, 'number')} ${record.issue}` : '';
  const pages = record.pages ? `${localized(locale, 'pages')} ${record.pages}` : '';
  const publication = publicationSegment(record, true);
  const online = onlineIdentifier(record);

  return sentence([
    creators ? `${creators}.` : '',
    title ? `${title}.` : '',
    container ? `${container}.` : '',
    commaSeries([year, volume, issue, pages]),
    publication,
    online,
  ]);
}

function shortAuthor(
  record: OmiBibliographicRecord,
  style: OmiCitationStyleId,
  locale: string,
): string {
  const contributors = preferredCreators(record);
  const first = contributors[0];

  if (!first) return '';

  const firstName = familyOrLiteral(first);

  if (contributors.length === 1) {
    return firstName;
  }

  if (contributors.length === 2) {
    const connector = style === 'apa-7' ? '&' : localized(locale, 'and');
    return `${firstName} ${connector} ${familyOrLiteral(contributors[1]!)}`;
  }

  return `${firstName} ${localized(locale, 'etAl')}`;
}

function apaCreators(record: OmiBibliographicRecord, locale: string): string {
  const creators = preferredCreators(record);

  return creators
    .map((creator) => {
      if (creator.literalName) return creator.literalName;
      const family = optional(creator.familyName) || optional(creator.givenName) || '';
      const initials = initialsFor(creator.givenName);
      return joinDefined([family ? `${family},` : '', initials], ' ');
    })
    .map((value, index, values) =>
      index === values.length - 1 && values.length > 1
        ? `& ${value}`
        : value,
    )
    .join(creators.length > 2 ? ', ' : ' ')
    .replace(/, & /g, ', & ')
    .trim();
}

function chicagoCreators(record: OmiBibliographicRecord, locale: string): string {
  const creators = preferredCreators(record);

  return creators
    .map((creator, index) =>
      index === 0 ? invertedName(creator) : normalName(creator),
    )
    .reduce((accumulator, value, index) => {
      if (!accumulator) return value;
      if (index === creators.length - 1) {
        return `${accumulator}, ${localized(locale, 'and')} ${value}`;
      }
      return `${accumulator}, ${value}`;
    }, '');
}

function mlaCreators(record: OmiBibliographicRecord, locale: string): string {
  const creators = preferredCreators(record);

  if (creators.length === 0) return '';
  if (creators.length === 1) return invertedName(creators[0]!);
  if (creators.length === 2) {
    return `${invertedName(creators[0]!)}, ${localized(locale, 'and')} ${normalName(creators[1]!)}`;
  }

  return `${invertedName(creators[0]!)} ${localized(locale, 'etAl')}`;
}

function isoCreators(record: OmiBibliographicRecord, locale: string): string {
  const creators = preferredCreators(record);

  return creators
    .map((creator) => {
      if (creator.literalName) return creator.literalName.toLocaleUpperCase(locale);
      const family = optional(creator.familyName)?.toLocaleUpperCase(locale) ?? '';
      const given = optional(creator.givenName) ?? '';
      return joinDefined([family, given], ', ');
    })
    .join('; ');
}

function preferredCreators(record: OmiBibliographicRecord): OmiBibliographicContributor[] {
  const authors = contributorsByRole(record, 'author');
  if (authors.length) return authors;

  const editors = contributorsByRole(record, 'editor');
  if (editors.length) return editors;

  return [...record.contributors];
}

function contributorsByRole(
  record: OmiBibliographicRecord,
  role: string,
): OmiBibliographicContributor[] {
  return record.contributors.filter((contributor) => contributor.role === role);
}

function toCslName(contributor: OmiBibliographicContributor): CslJsonName {
  if (contributor.literalName) {
    return { literal: normalize(contributor.literalName) };
  }

  return compactObject({
    given: optional(contributor.givenName),
    family: optional(contributor.familyName),
  }) as CslJsonName;
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

function renderLocator(
  citation: OmiCitation,
  style: OmiCitationStyleId,
  locale: string,
): string {
  const locator = citation.locator;
  if (!locator?.value?.trim()) return '';

  const value = locator.value.trim();

  if (
    (style === 'apa-7' || style === 'iso-690') &&
    (locator.type === 'page' || locator.type === 'page-range')
  ) {
    const label = locator.type === 'page-range'
      ? localized(locale, 'pages')
      : localized(locale, 'page');
    return `${label} ${value}`;
  }

  if (locator.type === 'chapter') {
    return `${localized(locale, 'chapter')} ${value}`;
  }

  if (locator.type === 'section') {
    return `${localized(locale, 'section')} ${value}`;
  }

  if (locator.type === 'figure') {
    return `${localized(locale, 'figure')} ${value}`;
  }

  if (locator.type === 'table') {
    return `${localized(locale, 'table')} ${value}`;
  }

  if (locator.type === 'folio') {
    return `${localized(locale, 'folio')} ${value}`;
  }

  if (locator.type === 'line') {
    return `${localized(locale, 'line')} ${value}`;
  }

  return value;
}

function locatorSeparator(style: OmiCitationStyleId): string {
  return style === 'chicago-notes-bibliography' ? ', ' : ', ';
}

function containerSegment(
  record: OmiBibliographicRecord,
  family: 'apa' | 'chicago',
): string {
  if (!record.containerTitle) return '';

  const volumeIssue = record.volume
    ? record.issue
      ? family === 'apa'
        ? `${record.volume}(${record.issue})`
        : `${record.volume}, no. ${record.issue}`
      : record.volume
    : record.issue
      ? family === 'apa'
        ? `(${record.issue})`
        : `no. ${record.issue}`
      : '';
  const pages = record.pages
    ? family === 'apa'
      ? `, ${record.pages}`
      : `: ${record.pages}`
    : '';

  return `${record.containerTitle}${volumeIssue ? ` ${volumeIssue}` : ''}${pages}.`;
}

function publicationSegment(record: OmiBibliographicRecord, includeYear: boolean): string {
  const placePublisher = [record.place, record.publisher]
    .filter(Boolean)
    .join(': ');
  const year = includeYear ? publicationYear(record) : '';
  const value = [placePublisher, year].filter(Boolean).join(', ');
  return value ? `${value}.` : '';
}

function chicagoNotesPublication(record: OmiBibliographicRecord): string {
  const placePublisher = [record.place, record.publisher]
    .filter(Boolean)
    .join(': ');
  const year = publicationYear(record);

  if (!placePublisher && !year) return '';
  if (placePublisher && year) return `${placePublisher}, ${year}.`;
  return `${placePublisher || year}.`;
}

function onlineIdentifier(record: OmiBibliographicRecord): string {
  const doi = identifier(record, 'doi');
  if (doi) return `https://doi.org/${doi}`;
  return optional(record.url) ?? '';
}

function identifier(record: OmiBibliographicRecord, scheme: string): string | undefined {
  return record.identifiers.find(
    (candidate) => candidate.scheme.toLocaleLowerCase() === scheme.toLocaleLowerCase(),
  )?.value?.trim() || undefined;
}

function quoteArticleTitle(record: OmiBibliographicRecord, title: string): string {
  if (!title) return '';

  return record.type === 'journal-article' ||
    record.type === 'book-chapter' ||
    record.type === 'conference-paper'
    ? `“${title}”`
    : title;
}

function bibliographySortKey(
  record: OmiBibliographicRecord,
  style: OmiCitationStyleId,
): string {
  const creator = familyOrLiteral(preferredCreators(record)[0]);
  const year = publicationYear(record);

  return style === 'iso-690'
    ? `${creator.toLocaleUpperCase()}|${year}|${record.title}`
    : `${creator}|${year}|${record.title}`;
}

function publicationYear(record: OmiBibliographicRecord): string {
  const value = optional(record.issued);
  if (!value) return '';
  const match = value.match(/\b(\d{4})\b/);
  return match?.[1] ?? value;
}

function fullTitle(record: OmiBibliographicRecord): string {
  const title = normalize(record.title);
  const subtitle = optional(record.subtitle);
  return subtitle ? `${title}: ${subtitle}` : title;
}

function shortTitle(title: string): string {
  const normalized = normalize(title);
  return normalized.length > 42
    ? `${normalized.slice(0, 39).trim()}…`
    : normalized;
}

function familyOrLiteral(contributor: OmiBibliographicContributor | undefined): string {
  if (!contributor) return '';
  return optional(contributor.familyName) ||
    optional(contributor.literalName) ||
    optional(contributor.givenName) ||
    '';
}

function invertedName(contributor: OmiBibliographicContributor): string {
  if (contributor.literalName) return normalize(contributor.literalName);
  const family = optional(contributor.familyName) ?? '';
  const given = optional(contributor.givenName) ?? '';
  return family && given ? `${family}, ${given}` : family || given;
}

function normalName(contributor: OmiBibliographicContributor): string {
  if (contributor.literalName) return normalize(contributor.literalName);
  return joinDefined([optional(contributor.givenName), optional(contributor.familyName)], ' ');
}

function initialsFor(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}.`)
    .join(' ');
}

function commaSeries(values: Array<string | undefined>): string {
  const compact = values.filter((value): value is string => Boolean(value));
  return compact.length ? `${compact.join(', ')}.` : '';
}

function sentence(values: Array<string | undefined>): string {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\.\./g, '.')
    .trim();
}

function joinDefined(
  values: Array<string | undefined>,
  separator: string,
): string {
  return values.filter((value): value is string => Boolean(value?.trim())).join(separator);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function optional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalize(value);
  return normalized || undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => candidate !== undefined),
  ) as Partial<T>;
}

type LocalizedToken =
  | 'and'
  | 'etAl'
  | 'noDate'
  | 'unresolved'
  | 'page'
  | 'pages'
  | 'chapter'
  | 'section'
  | 'figure'
  | 'table'
  | 'folio'
  | 'line'
  | 'volume'
  | 'number';

const TOKENS: Record<string, Record<LocalizedToken, string>> = {
  en: {
    and: 'and',
    etAl: 'et al.',
    noDate: 'n.d.',
    unresolved: '[unresolved]',
    page: 'p.',
    pages: 'pp.',
    chapter: 'chap.',
    section: 'sec.',
    figure: 'fig.',
    table: 'table',
    folio: 'fol.',
    line: 'line',
    volume: 'vol.',
    number: 'no.',
  },
  hu: {
    and: 'és',
    etAl: 'et al.',
    noDate: 'é. n.',
    unresolved: '[feloldatlan]',
    page: 'p.',
    pages: 'pp.',
    chapter: 'fej.',
    section: 'szak.',
    figure: 'ábra',
    table: 'tábl.',
    folio: 'fol.',
    line: 'sor',
    volume: 'köt.',
    number: 'sz.',
  },
  de: {
    and: 'und',
    etAl: 'et al.',
    noDate: 'o. J.',
    unresolved: '[nicht aufgelöst]',
    page: 'S.',
    pages: 'S.',
    chapter: 'Kap.',
    section: 'Abschn.',
    figure: 'Abb.',
    table: 'Tab.',
    folio: 'Bl.',
    line: 'Z.',
    volume: 'Bd.',
    number: 'Nr.',
  },
};

function localized(locale: string, token: LocalizedToken): string {
  const language = locale.toLocaleLowerCase().split('-')[0] ?? 'en';
  return TOKENS[language]?.[token] ?? TOKENS.en![token];
}
