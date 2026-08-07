import {
  createBibliographicRecord,
  createStableCitationId,
  formatBibliographyEntry,
} from '../model/citations.ts';
import type {
  OmiBibliographicContributor,
  OmiBibliographicIdentifier,
  OmiBibliographicRecord,
  OmiBibliographicResourceType,
} from '../types/omi';

export type BibliographicProviderId =
  | 'crossref'
  | 'datacite'
  | 'openalex'
  | 'mtmt';

export interface BibliographicLookupSettings {
  enabledProviders: BibliographicProviderId[];
  crossrefMailto?: string;
  openAlexApiKey?: string;
}

export interface BibliographicLookupCandidate {
  key: string;
  record: OmiBibliographicRecord;
  providers: BibliographicProviderId[];
  sourceUrls: string[];
}

export type BibliographicLookupIssueCode =
  | 'missing-api-key'
  | 'request-failed'
  | 'invalid-response';

export interface BibliographicLookupIssue {
  provider: BibliographicProviderId;
  code: BibliographicLookupIssueCode;
  message: string;
}

export interface BibliographicLookupResponse {
  candidates: BibliographicLookupCandidate[];
  issues: BibliographicLookupIssue[];
}

export const BIBLIOGRAPHIC_PROVIDERS: BibliographicProviderId[] = [
  'crossref',
  'datacite',
  'openalex',
  'mtmt',
];

export const DEFAULT_BIBLIOGRAPHIC_LOOKUP_SETTINGS: BibliographicLookupSettings = {
  enabledProviders: ['crossref', 'datacite', 'mtmt'],
  crossrefMailto: '',
  openAlexApiKey: '',
};

const SETTINGS_KEY = 'omi-studio-bibliographic-lookup-settings';
const REQUEST_TIMEOUT_MS = 12_000;
const RESULT_LIMIT = 10;

export function loadBibliographicLookupSettings(): BibliographicLookupSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_BIBLIOGRAPHIC_LOOKUP_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);

    if (!raw) {
      return { ...DEFAULT_BIBLIOGRAPHIC_LOOKUP_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<BibliographicLookupSettings>;
    const enabledProviders = BIBLIOGRAPHIC_PROVIDERS.filter((provider) =>
      parsed.enabledProviders?.includes(provider),
    );

    return {
      enabledProviders:
        enabledProviders.length > 0
          ? enabledProviders
          : [...DEFAULT_BIBLIOGRAPHIC_LOOKUP_SETTINGS.enabledProviders],
      crossrefMailto: normalizeOptional(parsed.crossrefMailto),
      openAlexApiKey: normalizeOptional(parsed.openAlexApiKey),
    };
  } catch {
    return { ...DEFAULT_BIBLIOGRAPHIC_LOOKUP_SETTINGS };
  }
}

export function saveBibliographicLookupSettings(
  settings: BibliographicLookupSettings,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      enabledProviders: BIBLIOGRAPHIC_PROVIDERS.filter((provider) =>
        settings.enabledProviders.includes(provider),
      ),
      crossrefMailto: normalizeOptional(settings.crossrefMailto),
      openAlexApiKey: normalizeOptional(settings.openAlexApiKey),
    }),
  );
}

export function normalizeLookupDoi(value: string): string | undefined {
  const normalized = value
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .replace(/[.,;:)\]}]+$/g, '');

  return /^10\.\d{4,9}\/\S+$/i.test(normalized)
    ? normalized.toLowerCase()
    : undefined;
}

export async function searchBibliographicProviders(
  rawQuery: string,
  settings: BibliographicLookupSettings,
): Promise<BibliographicLookupResponse> {
  const query = rawQuery.trim();

  if (query.length < 2) {
    return { candidates: [], issues: [] };
  }

  const enabled = BIBLIOGRAPHIC_PROVIDERS.filter((provider) =>
    settings.enabledProviders.includes(provider),
  );
  const tasks = enabled.map(async (provider) => {
    try {
      if (provider === 'openalex' && !normalizeOptional(settings.openAlexApiKey)) {
        return {
          candidates: [] as BibliographicLookupCandidate[],
          issue: {
            provider,
            code: 'missing-api-key' as const,
            message: 'OpenAlex requires a configured API key.',
          },
        };
      }

      const candidates = await searchProvider(provider, query, settings);
      return { candidates, issue: undefined };
    } catch (error) {
      return {
        candidates: [] as BibliographicLookupCandidate[],
        issue: {
          provider,
          code: 'request-failed' as const,
          message: error instanceof Error ? error.message : 'Provider request failed.',
        },
      };
    }
  });
  const results = await Promise.all(tasks);
  const candidates = deduplicateCandidates(
    results.flatMap((result) => result.candidates),
  );
  const issues: BibliographicLookupIssue[] = [];

  for (const result of results) {
    if (result.issue) {
      issues.push(result.issue);
    }
  }

  return { candidates, issues };
}

async function searchProvider(
  provider: BibliographicProviderId,
  query: string,
  settings: BibliographicLookupSettings,
): Promise<BibliographicLookupCandidate[]> {
  switch (provider) {
    case 'crossref':
      return searchCrossref(query, settings);
    case 'datacite':
      return searchDataCite(query);
    case 'openalex':
      return searchOpenAlex(query, settings.openAlexApiKey ?? '');
    case 'mtmt':
      return searchMtmt(query);
  }
}

export function buildCrossrefLookupUrl(
  query: string,
  mailto?: string,
): string {
  const doi = normalizeLookupDoi(query);
  const base = doi
    ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
    : 'https://api.crossref.org/works';
  const url = new URL(base);

  if (!doi) {
    url.searchParams.set('query.bibliographic', query.trim());
    url.searchParams.set('rows', String(RESULT_LIMIT));
  }

  if (normalizeOptional(mailto)) {
    url.searchParams.set('mailto', mailto!.trim());
  }

  return url.toString();
}

export function buildDataCiteLookupUrl(query: string): string {
  const doi = normalizeLookupDoi(query);
  const url = new URL(
    doi
      ? `https://api.datacite.org/dois/${encodeURIComponent(doi)}`
      : 'https://api.datacite.org/dois',
  );

  if (!doi) {
    url.searchParams.set('query', query.trim());
    url.searchParams.set('page[size]', String(RESULT_LIMIT));
  }

  return url.toString();
}

export function buildOpenAlexLookupUrl(
  query: string,
  apiKey: string,
): string {
  const doi = normalizeLookupDoi(query);
  const url = new URL('https://api.openalex.org/works');

  if (doi) {
    url.searchParams.set('filter', `doi:${doi}`);
  } else {
    url.searchParams.set('search', query.trim());
  }

  url.searchParams.set('per-page', String(RESULT_LIMIT));
  url.searchParams.set('api_key', apiKey.trim());
  return url.toString();
}

export function buildMtmtLookupUrls(query: string): string[] {
  const doi = normalizeLookupDoi(query);
  const conditions = doi
    ? [
        `identifiers.identifier;eq;${doi}`,
        `label;any;${doi}`,
      ]
    : [
        `title;any;${query.trim()}`,
        `label;any;${query.trim()}`,
      ];

  return conditions.map((condition) => {
    const url = new URL('https://m2.mtmt.hu/api/publication');
    url.searchParams.set('cond', condition);
    url.searchParams.set('size', String(RESULT_LIMIT));
    url.searchParams.set('depth', '1');
    url.searchParams.set('format', 'json');
    url.searchParams.set('labelLang', 'eng');
    return url.toString();
  });
}

async function searchCrossref(
  query: string,
  settings: BibliographicLookupSettings,
): Promise<BibliographicLookupCandidate[]> {
  const sourceUrl = buildCrossrefLookupUrl(query, settings.crossrefMailto);
  const payload = await fetchJson(sourceUrl);
  return parseCrossrefResponse(payload, sourceUrl);
}

async function searchDataCite(query: string): Promise<BibliographicLookupCandidate[]> {
  const sourceUrl = buildDataCiteLookupUrl(query);
  const payload = await fetchJson(sourceUrl);
  return parseDataCiteResponse(payload, sourceUrl);
}

async function searchOpenAlex(
  query: string,
  apiKey: string,
): Promise<BibliographicLookupCandidate[]> {
  const sourceUrl = buildOpenAlexLookupUrl(query, apiKey);
  const payload = await fetchJson(sourceUrl);
  return parseOpenAlexResponse(payload, redactApiKey(sourceUrl));
}

async function searchMtmt(query: string): Promise<BibliographicLookupCandidate[]> {
  let lastError: unknown;

  for (const sourceUrl of buildMtmtLookupUrls(query)) {
    try {
      const payload = await fetchJson(sourceUrl, {
        Accept: 'application/vnd.mtmt2-1.0+json, application/json',
      });
      const parsed = parseMtmtResponse(payload, sourceUrl);

      if (parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function fetchJson(
  url: string,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseCrossrefResponse(
  payload: unknown,
  sourceUrl = 'https://api.crossref.org/works',
): BibliographicLookupCandidate[] {
  const root = asRecord(payload);
  const message = asRecord(root?.message);
  const items = Array.isArray(message?.items)
    ? message.items
    : message
      ? [message]
      : [];

  return items
    .map((item) => mapCrossrefItem(item, sourceUrl))
    .filter(isCandidate);
}

export function parseDataCiteResponse(
  payload: unknown,
  sourceUrl = 'https://api.datacite.org/dois',
): BibliographicLookupCandidate[] {
  const root = asRecord(payload);
  const data = root?.data;
  const items = Array.isArray(data) ? data : data ? [data] : [];

  return items
    .map((item) => mapDataCiteItem(item, sourceUrl))
    .filter(isCandidate);
}

export function parseOpenAlexResponse(
  payload: unknown,
  sourceUrl = 'https://api.openalex.org/works',
): BibliographicLookupCandidate[] {
  const root = asRecord(payload);
  const items = Array.isArray(root?.results)
    ? root.results
    : root
      ? [root]
      : [];

  return items
    .map((item) => mapOpenAlexItem(item, sourceUrl))
    .filter(isCandidate);
}

export function parseMtmtResponse(
  payload: unknown,
  sourceUrl = 'https://m2.mtmt.hu/api/publication',
): BibliographicLookupCandidate[] {
  const root = asRecord(payload);
  const possibleContent = root?.content ?? root?.items ?? root?.data;
  const items = Array.isArray(possibleContent)
    ? possibleContent
    : Array.isArray(payload)
      ? payload
      : root && (root.mtid || root.title || root.label)
        ? [root]
        : [];

  return items
    .map((item) => mapMtmtItem(item, sourceUrl))
    .filter(isCandidate);
}

function mapCrossrefItem(
  raw: unknown,
  sourceUrl: string,
): BibliographicLookupCandidate | undefined {
  const item = asRecord(raw);
  if (!item) return undefined;

  const title = firstArrayString(item.title) || firstString(item.title);
  if (!title) return undefined;

  const doi = normalizeLookupDoi(firstString(item.DOI) ?? '');
  const authors = asArray(item.author).map((author) => {
    const value = asRecord(author);
    return bibliographicContributor(
      firstString(value?.given),
      firstString(value?.family),
      firstString(value?.name),
    );
  });
  const issued = extractCrossrefYear(item);
  const record = createResolvedRecord({
    type: mapCrossrefType(firstString(item.type)),
    title,
    subtitle: firstArrayString(item.subtitle),
    contributors: authors,
    containerTitle: firstArrayString(item['container-title']),
    issued,
    publisher: firstString(item.publisher),
    volume: firstString(item.volume),
    issue: firstString(item.issue),
    pages: firstString(item.page),
    language: firstString(item.language),
    identifiers: compactIdentifiers([
      doi ? { scheme: 'doi', value: doi } : undefined,
    ]),
    url: firstString(item.URL) || (doi ? `https://doi.org/${doi}` : undefined),
  });

  return candidate('crossref', record, sourceUrl);
}

function mapDataCiteItem(
  raw: unknown,
  sourceUrl: string,
): BibliographicLookupCandidate | undefined {
  const item = asRecord(raw);
  const attributes = asRecord(item?.attributes);
  if (!attributes) return undefined;

  const titles = asArray(attributes.titles);
  const primaryTitle = asRecord(titles[0]);
  const title = firstString(primaryTitle?.title) || firstString(attributes.title);
  if (!title) return undefined;

  const doi = normalizeLookupDoi(
    firstString(attributes.doi) || firstString(item?.id) || '',
  );
  const creators = asArray(attributes.creators).map((creator) => {
    const value = asRecord(creator);
    return bibliographicContributor(
      firstString(value?.givenName),
      firstString(value?.familyName),
      firstString(value?.name),
    );
  });
  const publisher = asRecord(attributes.publisher);
  const record = createResolvedRecord({
    type: mapDataCiteType(firstString(asRecord(attributes.types)?.resourceTypeGeneral)),
    title,
    contributors: creators,
    containerTitle: firstString(attributes.container),
    issued: stringifyScalar(attributes.publicationYear),
    publisher: firstString(publisher?.name) || firstString(attributes.publisher),
    language: firstString(attributes.language),
    identifiers: compactIdentifiers([
      doi ? { scheme: 'doi', value: doi } : undefined,
    ]),
    url: firstString(attributes.url) || (doi ? `https://doi.org/${doi}` : undefined),
  });

  return candidate('datacite', record, sourceUrl);
}

function mapOpenAlexItem(
  raw: unknown,
  sourceUrl: string,
): BibliographicLookupCandidate | undefined {
  const item = asRecord(raw);
  if (!item) return undefined;

  const title = firstString(item.title) || firstString(item.display_name);
  if (!title) return undefined;

  const authors = asArray(item.authorships).map((authorship) => {
    const author = asRecord(asRecord(authorship)?.author);
    return bibliographicContributor(undefined, undefined, firstString(author?.display_name));
  });
  const primaryLocation = asRecord(item.primary_location);
  const source = asRecord(primaryLocation?.source);
  const biblio = asRecord(item.biblio);
  const doi = normalizeLookupDoi(firstString(item.doi) ?? '');
  const openAlexId = firstString(item.id)?.replace(/^https?:\/\/openalex\.org\//i, '');
  const firstPage = firstString(biblio?.first_page);
  const lastPage = firstString(biblio?.last_page);
  const pages = firstPage
    ? lastPage && lastPage !== firstPage
      ? `${firstPage}-${lastPage}`
      : firstPage
    : undefined;
  const record = createResolvedRecord({
    type: mapOpenAlexType(firstString(item.type)),
    title,
    contributors: authors,
    containerTitle: firstString(source?.display_name),
    issued: stringifyScalar(item.publication_year),
    volume: firstString(biblio?.volume),
    issue: firstString(biblio?.issue),
    pages,
    language: firstString(item.language),
    identifiers: compactIdentifiers([
      doi ? { scheme: 'doi', value: doi } : undefined,
      openAlexId ? { scheme: 'openalex', value: openAlexId } : undefined,
    ]),
    url:
      firstString(primaryLocation?.landing_page_url) ||
      (doi ? `https://doi.org/${doi}` : firstString(item.id)),
  });

  return candidate('openalex', record, sourceUrl);
}

function mapMtmtItem(
  raw: unknown,
  sourceUrl: string,
): BibliographicLookupCandidate | undefined {
  const item = asRecord(raw);
  if (!item) return undefined;

  const title =
    firstString(item.title) ||
    firstString(asRecord(item.title)?.value) ||
    extractMtmtTitleFromLabel(firstString(item.label));
  if (!title) return undefined;

  const authors = asArray(item.authorships).map((authorship) => {
    const value = asRecord(authorship);
    const author = asRecord(value?.author);
    return bibliographicContributor(
      firstString(author?.givenName),
      firstString(author?.familyName),
      firstString(author?.label) || firstString(value?.label),
    );
  });
  const identifiers = extractMtmtIdentifiers(item);
  const mtid = stringifyScalar(item.mtid);
  if (mtid) identifiers.push({ scheme: 'mtmt', value: mtid });
  const doi = identifiers.find((identifier) => identifier.scheme === 'doi')?.value;
  const journal = asRecord(item.journal);
  const source = asRecord(item.source);
  const record = createResolvedRecord({
    type: mapMtmtType(item),
    title,
    contributors: authors,
    containerTitle:
      firstString(journal?.label) ||
      firstString(journal?.title) ||
      firstString(source?.label) ||
      firstString(item.containerTitle),
    issued: stringifyScalar(item.publishedYear) || stringifyScalar(item.year),
    publisher: firstString(asRecord(item.publisher)?.label) || firstString(item.publisher),
    place: firstString(item.place),
    volume: stringifyScalar(item.volume),
    issue: stringifyScalar(item.issue),
    pages:
      firstString(item.pages) ||
      joinPageRange(stringifyScalar(item.firstPage), stringifyScalar(item.lastPage)),
    language: firstString(asRecord(item.language)?.label) || firstString(item.language),
    identifiers: compactIdentifiers(identifiers),
    url:
      firstString(item.url) ||
      (mtid ? `https://m2.mtmt.hu/api/publication/${encodeURIComponent(mtid)}` : doi ? `https://doi.org/${doi}` : undefined),
  });

  return candidate('mtmt', record, sourceUrl);
}

function createResolvedRecord(
  input: Parameters<typeof createBibliographicRecord>[0],
): OmiBibliographicRecord {
  return {
    ...createBibliographicRecord(input),
    status: 'resolved',
  };
}

function candidate(
  provider: BibliographicProviderId,
  record: OmiBibliographicRecord,
  sourceUrl: string,
): BibliographicLookupCandidate {
  return {
    key: candidateIdentity(record),
    record,
    providers: [provider],
    sourceUrls: [sourceUrl],
  };
}

export function deduplicateCandidates(
  candidates: BibliographicLookupCandidate[],
): BibliographicLookupCandidate[] {
  const merged = new Map<string, BibliographicLookupCandidate>();

  for (const current of candidates) {
    const key = candidateIdentity(current.record);
    const previous = merged.get(key);

    if (!previous) {
      merged.set(key, { ...current, key });
      continue;
    }

    merged.set(key, {
      key,
      record: mergeRecords(previous.record, current.record),
      providers: unique([...previous.providers, ...current.providers]),
      sourceUrls: unique([...previous.sourceUrls, ...current.sourceUrls]),
    });
  }

  return [...merged.values()].sort((a, b) =>
    formatBibliographyEntry(a.record).localeCompare(formatBibliographyEntry(b.record)),
  );
}

function mergeRecords(
  first: OmiBibliographicRecord,
  second: OmiBibliographicRecord,
): OmiBibliographicRecord {
  const prefer = completenessScore(second) > completenessScore(first) ? second : first;
  const fallback = prefer === first ? second : first;

  return {
    ...prefer,
    title: prefer.title || fallback.title,
    subtitle: prefer.subtitle || fallback.subtitle,
    contributors:
      prefer.contributors.length > 0 ? prefer.contributors : fallback.contributors,
    containerTitle: prefer.containerTitle || fallback.containerTitle,
    issued: prefer.issued || fallback.issued,
    publisher: prefer.publisher || fallback.publisher,
    place: prefer.place || fallback.place,
    volume: prefer.volume || fallback.volume,
    issue: prefer.issue || fallback.issue,
    pages: prefer.pages || fallback.pages,
    language: prefer.language || fallback.language,
    identifiers: compactIdentifiers([...prefer.identifiers, ...fallback.identifiers]),
    url: prefer.url || fallback.url,
  };
}

function completenessScore(record: OmiBibliographicRecord): number {
  return [
    record.title,
    record.subtitle,
    record.contributors.length ? 'x' : '',
    record.containerTitle,
    record.issued,
    record.publisher,
    record.volume,
    record.issue,
    record.pages,
    record.language,
    record.url,
    record.identifiers.length ? 'x' : '',
  ].filter(Boolean).length;
}

function candidateIdentity(record: OmiBibliographicRecord): string {
  const doi = record.identifiers.find(
    (identifier) => identifier.scheme.toLowerCase() === 'doi',
  )?.value;

  if (doi) return `doi:${doi.toLowerCase()}`;

  const creator = record.contributors[0];
  const creatorKey = normalizeKey(
    creator?.familyName || creator?.literalName || creator?.givenName || '',
  );
  return `meta:${normalizeKey(record.title)}|${normalizeKey(record.issued ?? '')}|${creatorKey}`;
}

function mapCrossrefType(type: string | undefined): OmiBibliographicResourceType {
  switch (type) {
    case 'journal-article':
      return 'journal-article';
    case 'book':
    case 'monograph':
      return 'book';
    case 'book-chapter':
    case 'book-section':
      return 'book-chapter';
    case 'proceedings-article':
      return 'conference-paper';
    case 'posted-content':
      return 'preprint';
    case 'dissertation':
      return 'dissertation';
    case 'report':
      return 'report';
    default:
      return type || 'journal-article';
  }
}

function mapDataCiteType(type: string | undefined): OmiBibliographicResourceType {
  switch (type?.toLowerCase()) {
    case 'dataset': return 'dataset';
    case 'software': return 'software';
    case 'book': return 'book';
    case 'bookchapter': return 'book-chapter';
    case 'journalarticle': return 'journal-article';
    case 'conferencepaper': return 'conference-paper';
    case 'dissertation': return 'dissertation';
    case 'report': return 'report';
    case 'preprint': return 'preprint';
    default: return type?.toLowerCase() || 'journal-article';
  }
}

function mapOpenAlexType(type: string | undefined): OmiBibliographicResourceType {
  switch (type) {
    case 'article': return 'journal-article';
    case 'book': return 'book';
    case 'book-chapter': return 'book-chapter';
    case 'proceedings-article': return 'conference-paper';
    case 'dissertation': return 'dissertation';
    case 'dataset': return 'dataset';
    case 'preprint': return 'preprint';
    default: return type || 'journal-article';
  }
}

function mapMtmtType(item: Record<string, unknown>): OmiBibliographicResourceType {
  const labels = [
    firstString(asRecord(item.subType)?.label),
    firstString(asRecord(item.type)?.label),
    firstString(item.subType),
    firstString(item.type),
  ].filter(Boolean).join(' ').toLowerCase();

  if (labels.includes('book chapter') || labels.includes('könyvrész')) return 'book-chapter';
  if (labels.includes('book') || labels.includes('könyv')) return 'book';
  if (labels.includes('conference') || labels.includes('konferencia')) return 'conference-paper';
  if (labels.includes('thesis') || labels.includes('disszert') || labels.includes('phd')) return 'dissertation';
  if (labels.includes('report') || labels.includes('jelentés')) return 'report';
  if (labels.includes('web')) return 'web-page';
  return 'journal-article';
}

function extractCrossrefYear(item: Record<string, unknown>): string | undefined {
  for (const field of ['published-print', 'published-online', 'published', 'issued', 'created']) {
    const date = asRecord(item[field]);
    const parts = asArray(date?.['date-parts']);
    const first = Array.isArray(parts[0]) ? parts[0] : undefined;
    const year = first?.[0];
    if (typeof year === 'number' || typeof year === 'string') return String(year);
  }
  return undefined;
}

function extractMtmtIdentifiers(item: Record<string, unknown>): OmiBibliographicIdentifier[] {
  const result: OmiBibliographicIdentifier[] = [];
  for (const raw of asArray(item.identifiers)) {
    const identifier = asRecord(raw);
    if (!identifier) continue;
    const value =
      firstString(identifier.identifier) ||
      firstString(identifier.value) ||
      firstString(identifier.label);
    if (!value) continue;
    const source =
      firstString(asRecord(identifier.source)?.label) ||
      stringifyScalar(identifier.source) ||
      firstString(identifier.type) ||
      '';
    const scheme = inferIdentifierScheme(source, value);
    result.push({ scheme, value: scheme === 'doi' ? normalizeLookupDoi(value) ?? value : value });
  }
  return result;
}

function inferIdentifierScheme(source: string, value: string): string {
  const combined = `${source} ${value}`.toLowerCase();
  if (combined.includes('doi') || normalizeLookupDoi(value)) return 'doi';
  if (combined.includes('isbn')) return 'isbn';
  if (combined.includes('issn')) return 'issn';
  if (combined.includes('pmid') || combined.includes('pubmed')) return 'pmid';
  if (combined.includes('scopus')) return 'scopus';
  if (combined.includes('wos') || combined.includes('web of science')) return 'wos';
  return source.trim().toLowerCase().replace(/\s+/g, '-') || 'external';
}

function extractMtmtTitleFromLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  return label.split(/\n|\r/)[0]?.trim() || label.trim();
}

function bibliographicContributor(
  givenName?: string,
  familyName?: string,
  literalName?: string,
): OmiBibliographicContributor {
  return {
    id: createStableCitationId('bib'),
    role: 'author',
    givenName: normalizeOptional(givenName),
    familyName: normalizeOptional(familyName),
    literalName:
      normalizeOptional(givenName) || normalizeOptional(familyName)
        ? undefined
        : normalizeOptional(literalName),
  };
}

function compactIdentifiers(
  identifiers: Array<OmiBibliographicIdentifier | undefined>,
): OmiBibliographicIdentifier[] {
  const seen = new Set<string>();
  const result: OmiBibliographicIdentifier[] = [];

  for (const identifier of identifiers) {
    if (!identifier?.value?.trim()) continue;
    const scheme = identifier.scheme.toLowerCase().trim();
    const value = identifier.value.trim();
    const key = `${scheme}:${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ scheme, value });
  }

  return result;
}

function joinPageRange(first?: string, last?: string): string | undefined {
  if (!first) return undefined;
  return last && last !== first ? `${first}-${last}` : first;
}

function firstArrayString(value: unknown): string | undefined {
  return asArray(value).map(firstString).find(Boolean);
}

function firstString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringifyScalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function normalizeOptional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isCandidate(
  value: BibliographicLookupCandidate | undefined,
): value is BibliographicLookupCandidate {
  return Boolean(value);
}

function redactApiKey(url: string): string {
  const parsed = new URL(url);
  if (parsed.searchParams.has('api_key')) parsed.searchParams.set('api_key', 'redacted');
  return parsed.toString();
}
