import type {
  OmiBibliographicContributor,
  OmiBibliographicIdentifier,
  OmiBibliographicRecord,
  OmiBibliographicResourceType,
  OmiCitation,
  OmiCitationLocator,
  OmiCitationLocatorType,
  OmiSection,
} from '../types/omi';

export const BIBLIOGRAPHIC_RESOURCE_TYPES: OmiBibliographicResourceType[] = [
  'journal-article',
  'book',
  'book-chapter',
  'conference-paper',
  'thesis',
  'dissertation',
  'report',
  'preprint',
  'dataset',
  'software',
  'standard',
  'archival-source',
  'manuscript',
  'web-page',
];

export const CITATION_LOCATOR_TYPES: OmiCitationLocatorType[] = [
  'page',
  'page-range',
  'chapter',
  'section',
  'paragraph',
  'figure',
  'table',
  'folio',
  'line',
  'timestamp',
];

export interface BibliographicRecordInput {
  type?: OmiBibliographicResourceType;
  title?: string;
  subtitle?: string;
  contributors?: OmiBibliographicContributor[];
  containerTitle?: string;
  issued?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  language?: string;
  identifiers?: OmiBibliographicIdentifier[];
  url?: string;
  accessed?: string;
}

export interface CitationOccurrenceInput {
  id?: string;
  target: string;
  anchorId?: string;
  targetBlockId: string;
  locator?: OmiCitationLocator;
  prefix?: string;
  suffix?: string;
  mode?: OmiCitation['mode'];
  intent?: string;
}

export interface CitationAnchorReference {
  citationId: string;
  anchorId: string;
  targetBlockId: string;
}

export function createStableCitationId(prefix: 'bib' | 'cit' | 'anchor'): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBibliographicContributor(
  role: OmiBibliographicContributor['role'] = 'author',
): OmiBibliographicContributor {
  return {
    id: createStableCitationId('bib'),
    role,
    givenName: '',
    familyName: '',
  };
}

export function createBibliographicRecord(
  input: BibliographicRecordInput = {},
  timestamp = new Date().toISOString(),
): OmiBibliographicRecord {
  return normalizeBibliographicRecord({
    id: createStableCitationId('bib'),
    type: input.type ?? 'journal-article',
    title: input.title ?? '',
    subtitle: input.subtitle,
    contributors:
      input.contributors?.length
        ? input.contributors
        : [createBibliographicContributor('author')],
    containerTitle: input.containerTitle,
    issued: input.issued,
    publisher: input.publisher,
    place: input.place,
    volume: input.volume,
    issue: input.issue,
    pages: input.pages,
    language: input.language,
    identifiers: input.identifiers ?? [],
    url: input.url,
    accessed: input.accessed,
    status: 'provisional',
    createdAt: timestamp,
    modifiedAt: timestamp,
  });
}

export function normalizeBibliographicRecord(
  record: OmiBibliographicRecord,
): OmiBibliographicRecord {
  const normalizedIdentifiers = normalizeIdentifiers(record.identifiers ?? []);
  const normalizedUrl = normalizeOptional(record.url);
  const urlIdentifier = normalizedUrl
    ? normalizedIdentifiers.some(
        (identifier) => identifier.scheme.toLowerCase() === 'url',
      )
      ? normalizedIdentifiers
      : [...normalizedIdentifiers, { scheme: 'url', value: normalizedUrl }]
    : normalizedIdentifiers;

  return {
    ...record,
    title: normalizeWhitespace(record.title),
    subtitle: normalizeOptional(record.subtitle),
    contributors: record.contributors
      .map(normalizeContributor)
      .filter(hasContributorName),
    containerTitle: normalizeOptional(record.containerTitle),
    issued: normalizeOptional(record.issued),
    publisher: normalizeOptional(record.publisher),
    place: normalizeOptional(record.place),
    volume: normalizeOptional(record.volume),
    issue: normalizeOptional(record.issue),
    pages: normalizeOptional(record.pages),
    language: normalizeOptional(record.language),
    identifiers: urlIdentifier,
    url: normalizedUrl,
    accessed: normalizeOptional(record.accessed),
  };
}

export function createCitationOccurrence(
  input: CitationOccurrenceInput,
  timestamp = new Date().toISOString(),
): OmiCitation {
  return {
    id: input.id ?? createStableCitationId('cit'),
    target: input.target,
    anchorId: input.anchorId ?? createStableCitationId('anchor'),
    targetBlockId: input.targetBlockId,
    locator: normalizeLocator(input.locator),
    prefix: normalizeOptional(input.prefix),
    suffix: normalizeOptional(input.suffix),
    mode: input.mode ?? 'parenthetical',
    intent: normalizeOptional(input.intent),
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function normalizeLocator(
  locator: OmiCitationLocator | undefined,
): OmiCitationLocator | undefined {
  if (!locator) {
    return undefined;
  }

  const value = normalizeWhitespace(locator.value);

  return value
    ? {
        type: locator.type || 'page',
        value,
      }
    : undefined;
}

export function formatCitationLabel(
  record: OmiBibliographicRecord | undefined,
  citation: OmiCitation,
): string {
  if (!record) {
    return '[unresolved]';
  }

  const creator = formatShortCreator(record);
  const year = normalizeWhitespace(record.issued ?? '') || 'n.d.';
  const locator = citation.locator?.value?.trim();
  const core = [creator || shortenTitle(record.title), year]
    .filter(Boolean)
    .join(' ');
  const located = locator ? `${core}, ${locator}` : core;
  const prefixed = citation.prefix?.trim()
    ? `${citation.prefix.trim()} ${located}`
    : located;

  return citation.suffix?.trim()
    ? `${prefixed}, ${citation.suffix.trim()}`
    : prefixed;
}

export function formatBibliographyEntry(
  record: OmiBibliographicRecord,
): string {
  const creator = formatBibliographyCreators(record);
  const title = record.subtitle
    ? `${record.title}: ${record.subtitle}`
    : record.title;
  const container = record.containerTitle
    ? formatContainer(record)
    : '';
  const publication = [record.place, record.publisher, record.issued]
    .filter(Boolean)
    .join(': ');
  const doi = getBibliographicIdentifier(record, 'doi');
  const url = doi
    ? `https://doi.org/${doi}`
    : record.url || getBibliographicIdentifier(record, 'url');

  return [
    creator ? `${creator}.` : '',
    title ? `${title}.` : '',
    container,
    publication ? `${publication}.` : '',
    url ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getBibliographicIdentifier(
  record: OmiBibliographicRecord,
  scheme: string,
): string | undefined {
  return record.identifiers.find(
    (identifier) => identifier.scheme.toLowerCase() === scheme.toLowerCase(),
  )?.value;
}

export function setBibliographicIdentifier(
  record: OmiBibliographicRecord,
  scheme: string,
  value: string,
): OmiBibliographicRecord {
  const normalizedValue =
    scheme.toLowerCase() === 'doi'
      ? normalizeDoi(value)
      : normalizeWhitespace(value);
  const identifiers = record.identifiers.filter(
    (identifier) => identifier.scheme.toLowerCase() !== scheme.toLowerCase(),
  );

  return {
    ...record,
    identifiers: normalizedValue
      ? [...identifiers, { scheme: scheme.toLowerCase(), value: normalizedValue }]
      : identifiers,
  };
}

export function normalizeDoi(value: string): string {
  return value
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .trim();
}

export function findLikelyDuplicateRecord(
  records: readonly OmiBibliographicRecord[],
  candidate: OmiBibliographicRecord,
): OmiBibliographicRecord | undefined {
  const candidateDoi = normalizeDoi(
    getBibliographicIdentifier(candidate, 'doi') ?? '',
  ).toLowerCase();

  if (candidateDoi) {
    const doiMatch = records.find((record) =>
      normalizeDoi(getBibliographicIdentifier(record, 'doi') ?? '').toLowerCase() ===
      candidateDoi,
    );

    if (doiMatch) {
      return doiMatch;
    }
  }

  const title = normalizeForComparison(candidate.title);
  const creator = normalizeForComparison(formatShortCreator(candidate));
  const issued = normalizeForComparison(candidate.issued ?? '');

  if (!title) {
    return undefined;
  }

  return records.find(
    (record) =>
      normalizeForComparison(record.title) === title &&
      normalizeForComparison(formatShortCreator(record)) === creator &&
      normalizeForComparison(record.issued ?? '') === issued,
  );
}

export function countCitationsForRecord(
  citations: readonly OmiCitation[],
  recordId: string,
): number {
  return citations.filter((citation) => citation.target === recordId).length;
}

export function collectCitationAnchors(
  sections: readonly OmiSection[],
): CitationAnchorReference[] {
  const anchors: CitationAnchorReference[] = [];

  for (const section of sections) {
    for (const block of section.blocks) {
      walkStructuredContent(block.content, (node) => {
        if (node.type !== 'omiCitation' || !isRecord(node.attrs)) {
          return;
        }

        const citationId = stringValue(node.attrs.citationId);
        const anchorId = stringValue(node.attrs.anchorId);

        if (citationId && anchorId) {
          anchors.push({
            citationId,
            anchorId,
            targetBlockId: block.id,
          });
        }
      });
    }
  }

  return anchors;
}

export function removeCitationAnchorFromSections(
  sections: readonly OmiSection[],
  citationId: string,
): OmiSection[] {
  return sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      content: transformStructuredContent(block.content, (node) => {
        if (
          node.type === 'omiCitation' &&
          isRecord(node.attrs) &&
          stringValue(node.attrs.citationId) === citationId
        ) {
          return null;
        }

        return node;
      }),
    })),
  }));
}

export function synchronizeCitationLabels(
  sections: readonly OmiSection[],
  citations: readonly OmiCitation[],
  records: readonly OmiBibliographicRecord[],
): OmiSection[] {
  const citationMap = new Map(citations.map((citation) => [citation.id, citation]));
  const recordMap = new Map(records.map((record) => [record.id, record]));

  return sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      content: transformStructuredContent(block.content, (node) => {
        if (node.type !== 'omiCitation' || !isRecord(node.attrs)) {
          return node;
        }

        const citationId = stringValue(node.attrs.citationId);
        const citation = citationId ? citationMap.get(citationId) : undefined;

        if (!citation) {
          return node;
        }

        return {
          ...node,
          attrs: {
            ...node.attrs,
            anchorId: citation.anchorId,
            label: formatCitationLabel(recordMap.get(citation.target), citation),
          },
        };
      }),
    })),
  }));
}

function normalizeContributor(
  contributor: OmiBibliographicContributor,
): OmiBibliographicContributor {
  return {
    ...contributor,
    givenName: normalizeOptional(contributor.givenName),
    familyName: normalizeOptional(contributor.familyName),
    literalName: normalizeOptional(contributor.literalName),
  };
}

function hasContributorName(contributor: OmiBibliographicContributor): boolean {
  return Boolean(
    contributor.literalName || contributor.familyName || contributor.givenName,
  );
}

function formatShortCreator(record: OmiBibliographicRecord): string {
  const authors = record.contributors.filter(
    (contributor) => contributor.role === 'author',
  );
  const creators = authors.length ? authors : record.contributors;
  const first = creators[0];

  if (!first) {
    return '';
  }

  const firstName = contributorDisplayName(first, true);

  if (creators.length === 1) {
    return firstName;
  }

  if (creators.length === 2) {
    return `${firstName} & ${contributorDisplayName(creators[1]!, true)}`;
  }

  return `${firstName} et al.`;
}

function formatBibliographyCreators(record: OmiBibliographicRecord): string {
  const authors = record.contributors.filter(
    (contributor) => contributor.role === 'author',
  );
  const creators = authors.length ? authors : record.contributors;

  return creators.map((contributor) => contributorDisplayName(contributor)).join('; ');
}

function contributorDisplayName(
  contributor: OmiBibliographicContributor,
  familyOnly = false,
): string {
  if (contributor.literalName) {
    return contributor.literalName;
  }

  if (familyOnly) {
    return contributor.familyName || contributor.givenName || '';
  }

  if (contributor.familyName && contributor.givenName) {
    return `${contributor.familyName}, ${contributor.givenName}`;
  }

  return contributor.familyName || contributor.givenName || '';
}

function formatContainer(record: OmiBibliographicRecord): string {
  const volumeIssue = record.volume
    ? record.issue
      ? `${record.volume}(${record.issue})`
      : record.volume
    : record.issue
      ? `(${record.issue})`
      : '';
  const pages = record.pages ? `: ${record.pages}` : '';

  return `${record.containerTitle}${volumeIssue ? ` ${volumeIssue}` : ''}${pages}.`;
}

function shortenTitle(title: string): string {
  const normalized = normalizeWhitespace(title);

  return normalized.length > 36
    ? `${normalized.slice(0, 33).trim()}…`
    : normalized;
}

function normalizeIdentifiers(
  identifiers: readonly OmiBibliographicIdentifier[],
): OmiBibliographicIdentifier[] {
  const normalized = new Map<string, OmiBibliographicIdentifier>();

  for (const identifier of identifiers) {
    const scheme = normalizeWhitespace(identifier.scheme).toLowerCase();
    const value =
      scheme === 'doi'
        ? normalizeDoi(identifier.value)
        : normalizeWhitespace(identifier.value);

    if (!scheme || !value) {
      continue;
    }

    normalized.set(`${scheme}:${value.toLowerCase()}`, { scheme, value });
  }

  return [...normalized.values()];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOptional(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || undefined;
}

function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value).normalize('NFKC').toLocaleLowerCase();
}

type JsonNode = {
  type?: string;
  attrs?: unknown;
  content?: unknown;
  [key: string]: unknown;
};

function walkStructuredContent(
  content: string,
  visitor: (node: JsonNode) => void,
): void {
  const root = parseStructuredContent(content);

  if (!root) {
    return;
  }

  walkNode(root, visitor);
}

function walkNode(node: JsonNode, visitor: (node: JsonNode) => void): void {
  visitor(node);

  if (!Array.isArray(node.content)) {
    return;
  }

  for (const child of node.content) {
    if (isRecord(child)) {
      walkNode(child as JsonNode, visitor);
    }
  }
}

function transformStructuredContent(
  content: string,
  transform: (node: JsonNode) => JsonNode | null,
): string {
  const root = parseStructuredContent(content);

  if (!root) {
    return content;
  }

  const transformed = transformNode(root, transform);

  return transformed ? JSON.stringify(transformed) : content;
}

function transformNode(
  node: JsonNode,
  transform: (node: JsonNode) => JsonNode | null,
): JsonNode | null {
  const transformed = transform(node);

  if (!transformed) {
    return null;
  }

  if (!Array.isArray(transformed.content)) {
    return transformed;
  }

  return {
    ...transformed,
    content: transformed.content
      .map((child) =>
        isRecord(child) ? transformNode(child as JsonNode, transform) : child,
      )
      .filter((child) => child !== null),
  };
}

function parseStructuredContent(content: string): JsonNode | undefined {
  try {
    const parsed: unknown = JSON.parse(content);

    return isRecord(parsed) ? (parsed as JsonNode) : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
