import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecret,
} from '../secretCrypto.js';

export type ReferenceManagerProvider = 'zotero' | 'mendeley';

export interface ReferenceManagerContributor {
  role: 'author' | 'editor' | 'translator' | 'other';
  givenName?: string;
  familyName?: string;
  literalName?: string;
}

export interface ReferenceManagerRecord {
  provider: ReferenceManagerProvider;
  externalId: string;
  type:
    | 'journal-article'
    | 'book'
    | 'book-chapter'
    | 'conference-paper'
    | 'thesis'
    | 'dissertation'
    | 'report'
    | 'preprint'
    | 'dataset'
    | 'software'
    | 'standard'
    | 'archival-source'
    | 'manuscript'
    | 'web-page';
  title: string;
  subtitle?: string;
  contributors: ReferenceManagerContributor[];
  containerTitle?: string;
  issued?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  language?: string;
  identifiers: Array<{ scheme: string; value: string }>;
  url?: string;
  accessed?: string;
}

export interface ReferenceManagerSearchResult {
  records: ReferenceManagerRecord[];
  truncated: boolean;
}

interface MendeleyTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: 'bearer';
}

const REQUEST_TIMEOUT_MS = 15_000;
const MENDELEY_SEARCH_PAGE_SIZE = 500;

export async function searchReferenceManager(
  userId: string,
  provider: ReferenceManagerProvider,
  query: string,
): Promise<ReferenceManagerSearchResult> {
  const normalized = query.trim();
  if (normalized.length < 2) return { records: [], truncated: false };

  return provider === 'zotero'
    ? searchZotero(userId, normalized)
    : searchMendeley(userId, normalized);
}

export async function testReferenceManagerConnection(
  userId: string,
  provider: ReferenceManagerProvider,
): Promise<{ configured: boolean; healthy: boolean; message: string }> {
  try {
    if (provider === 'zotero') {
      const credentials = await resolveZoteroCredentials(userId);
      if (!credentials) {
        return {
          configured: false,
          healthy: false,
          message: 'Zotero API key is not configured.',
        };
      }
      const access = await zoteroKeyInfo(credentials.apiKey);
      return {
        configured: true,
        healthy: Boolean(access.userID),
        message: access.userID
          ? `Zotero personal library access is available for user ${access.userID}.`
          : 'Zotero did not return a personal-library user identifier.',
      };
    }

    if (!mendeleyServerConfigured()) {
      return {
        configured: false,
        healthy: false,
        message: 'Mendeley OAuth is not configured on this Studio server.',
      };
    }
    const token = await resolveMendeleyAccessToken(userId);
    if (!token) {
      return {
        configured: true,
        healthy: false,
        message: 'Mendeley OAuth is configured, but this user has not connected an account.',
      };
    }
    await fetchMendeleyDocuments(token, 1);
    return {
      configured: true,
      healthy: true,
      message: 'Mendeley personal library connection is healthy.',
    };
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      message:
        error instanceof Error
          ? error.message
          : `${provider} connection test failed.`,
    };
  }
}

export function mendeleyServerConfigured(): boolean {
  return Boolean(
    env.MENDELEY_CLIENT_ID &&
      env.MENDELEY_CLIENT_SECRET &&
      env.MENDELEY_REDIRECT_URI,
  );
}

export function mendeleyRedirectUri(): string {
  return (
    env.MENDELEY_REDIRECT_URI ||
    `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/api/integrations/mendeley/oauth/callback`
  );
}

export async function storeMendeleyTokenSet(
  userId: string,
  payload: unknown,
): Promise<void> {
  const token = parseMendeleyTokenResponse(payload);
  const encryptedSecret = JSON.stringify(
    encryptSecret(JSON.stringify(token)),
  );

  await prisma.userIntegration.upsert({
    where: {
      userId_providerId_connectionKey: {
        userId,
        providerId: 'mendeley',
        connectionKey: 'personal',
      },
    },
    update: {
      displayName: 'Mendeley personal library',
      authenticationMode: 'oauth2',
      enabled: true,
      encryptedSecret,
      status: 'CONNECTED',
      lastCheckedAt: new Date(),
      lastError: null,
    },
    create: {
      userId,
      providerId: 'mendeley',
      connectionKey: 'personal',
      displayName: 'Mendeley personal library',
      authenticationMode: 'oauth2',
      enabled: true,
      encryptedSecret,
      status: 'CONNECTED',
      lastCheckedAt: new Date(),
    },
  });
}

export async function exchangeMendeleyAuthorizationCode(
  code: string,
): Promise<MendeleyTokenSet> {
  if (!mendeleyServerConfigured()) {
    throw new Error('Mendeley OAuth is not configured.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: mendeleyRedirectUri(),
  });
  const response = await timedFetch('https://api.mendeley.com/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth(
        env.MENDELEY_CLIENT_ID!,
        env.MENDELEY_CLIENT_SECRET!,
      ),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `Mendeley authorization-code exchange failed with HTTP ${response.status}.`,
    );
  }
  return parseMendeleyTokenResponse(payload);
}

export async function storeExactMendeleyTokenSet(
  userId: string,
  token: MendeleyTokenSet,
): Promise<void> {
  const encryptedSecret = JSON.stringify(
    encryptSecret(JSON.stringify(token)),
  );
  await prisma.userIntegration.upsert({
    where: {
      userId_providerId_connectionKey: {
        userId,
        providerId: 'mendeley',
        connectionKey: 'personal',
      },
    },
    update: {
      displayName: 'Mendeley personal library',
      authenticationMode: 'oauth2',
      enabled: true,
      encryptedSecret,
      status: 'CONNECTED',
      lastCheckedAt: new Date(),
      lastError: null,
    },
    create: {
      userId,
      providerId: 'mendeley',
      connectionKey: 'personal',
      displayName: 'Mendeley personal library',
      authenticationMode: 'oauth2',
      enabled: true,
      encryptedSecret,
      status: 'CONNECTED',
      lastCheckedAt: new Date(),
    },
  });
}

async function searchZotero(
  userId: string,
  query: string,
): Promise<ReferenceManagerSearchResult> {
  const credentials = await resolveZoteroCredentials(userId);
  if (!credentials) throw new Error('Connect Zotero in Integrations first.');

  const keyInfo = await zoteroKeyInfo(credentials.apiKey);
  if (!keyInfo.userID) {
    throw new Error('The Zotero key does not expose a personal-library user ID.');
  }

  const url = new URL(
    `https://api.zotero.org/users/${encodeURIComponent(String(keyInfo.userID))}/items/top`,
  );
  url.searchParams.set('q', query);
  url.searchParams.set('qmode', 'everything');
  url.searchParams.set('limit', '50');
  url.searchParams.set('format', 'json');

  const response = await timedFetch(url, {
    headers: zoteroHeaders(credentials.apiKey),
  });
  if (!response.ok) {
    throw new Error(`Zotero search failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : [];
  return {
    records: items
      .map(mapZoteroItem)
      .filter((record): record is ReferenceManagerRecord => Boolean(record)),
    truncated: Number(response.headers.get('Total-Results') ?? '0') > items.length,
  };
}

async function zoteroKeyInfo(
  apiKey: string,
): Promise<{ userID?: number | string }> {
  const response = await timedFetch('https://api.zotero.org/keys/current', {
    headers: zoteroHeaders(apiKey),
  });
  if (!response.ok) {
    throw new Error(`Zotero rejected the API key with HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as unknown;
  return isRecord(payload) ? payload : {};
}

async function resolveZoteroCredentials(
  userId: string,
): Promise<{ apiKey: string } | null> {
  const connection = await prisma.userIntegration.findFirst({
    where: {
      userId,
      providerId: 'zotero',
      connectionKey: 'personal',
      enabled: true,
    },
  });
  if (!connection?.encryptedSecret) return null;
  return { apiKey: decryptSecret(parseEncryptedSecret(connection.encryptedSecret)) };
}

async function searchMendeley(
  userId: string,
  query: string,
): Promise<ReferenceManagerSearchResult> {
  const token = await resolveMendeleyAccessToken(userId);
  if (!token) throw new Error('Connect Mendeley in Integrations first.');

  const { documents, truncated } = await fetchMendeleyDocuments(
    token,
    MENDELEY_SEARCH_PAGE_SIZE,
  );
  const needle = normalizeSearch(query);
  const matching = documents.filter((document) =>
    mendeleySearchText(document).includes(needle),
  );

  return {
    records: matching
      .slice(0, 50)
      .map(mapMendeleyDocument)
      .filter((record): record is ReferenceManagerRecord => Boolean(record)),
    truncated: truncated || matching.length > 50,
  };
}

async function fetchMendeleyDocuments(
  accessToken: string,
  limit: number,
): Promise<{ documents: unknown[]; truncated: boolean }> {
  const url = new URL('https://api.mendeley.com/documents');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('sort', 'last_modified');
  url.searchParams.set('order', 'desc');

  const response = await timedFetch(url, {
    headers: {
      Accept: 'application/vnd.mendeley-document.1+json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Mendeley library request failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  return {
    documents: Array.isArray(payload) ? payload : [],
    truncated: /rel="?next"?/i.test(response.headers.get('link') ?? ''),
  };
}

async function resolveMendeleyAccessToken(
  userId: string,
): Promise<string | null> {
  const connection = await prisma.userIntegration.findFirst({
    where: {
      userId,
      providerId: 'mendeley',
      connectionKey: 'personal',
      enabled: true,
    },
  });
  if (!connection?.encryptedSecret) return null;

  const token = parseStoredMendeleyToken(
    decryptSecret(parseEncryptedSecret(connection.encryptedSecret)),
  );
  if (Date.parse(token.expiresAt) > Date.now() + 60_000) {
    return token.accessToken;
  }
  if (!mendeleyServerConfigured()) {
    throw new Error('Mendeley OAuth refresh is not configured on this server.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    redirect_uri: mendeleyRedirectUri(),
  });
  const response = await timedFetch('https://api.mendeley.com/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth(
        env.MENDELEY_CLIENT_ID!,
        env.MENDELEY_CLIENT_SECRET!,
      ),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    await prisma.userIntegration.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        lastCheckedAt: new Date(),
        lastError: `Mendeley token refresh failed with HTTP ${response.status}.`,
      },
    });
    throw new Error(`Mendeley token refresh failed with HTTP ${response.status}.`);
  }

  const refreshed = parseMendeleyTokenResponse(payload);
  await prisma.userIntegration.update({
    where: { id: connection.id },
    data: {
      encryptedSecret: JSON.stringify(
        encryptSecret(JSON.stringify(refreshed)),
      ),
      status: 'CONNECTED',
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });
  return refreshed.accessToken;
}

function mapZoteroItem(raw: unknown): ReferenceManagerRecord | undefined {
  const root = isRecord(raw) ? raw : undefined;
  const data = isRecord(root?.data) ? root.data : root;
  if (!data) return undefined;

  const itemType = text(data.itemType);
  if (!itemType || ['attachment', 'note', 'annotation'].includes(itemType)) {
    return undefined;
  }
  const title = text(data.title);
  const key = text(data.key) || text(root?.key);
  if (!title || !key) return undefined;

  const contributors = array(data.creators)
    .map((creator) => {
      const value = isRecord(creator) ? creator : undefined;
      if (!value) return undefined;
      const creatorType = text(value.creatorType) || 'author';
      return {
        role: mapCreatorRole(creatorType),
        givenName: text(value.firstName),
        familyName: text(value.lastName),
        literalName: text(value.name),
      } satisfies ReferenceManagerContributor;
    })
    .filter((value): value is ReferenceManagerContributor => Boolean(value));

  const doi = normalizeDoi(text(data.DOI));
  const identifiers = compactIdentifiers([
    { scheme: 'zotero', value: key },
    doi ? { scheme: 'doi', value: doi } : undefined,
    text(data.ISBN) ? { scheme: 'isbn', value: text(data.ISBN)! } : undefined,
    text(data.ISSN) ? { scheme: 'issn', value: text(data.ISSN)! } : undefined,
  ]);

  return compactRecord({
    provider: 'zotero',
    externalId: key,
    type: mapZoteroType(itemType),
    title,
    contributors,
    containerTitle:
      text(data.publicationTitle) ||
      text(data.bookTitle) ||
      text(data.proceedingsTitle),
    issued: extractYear(text(data.date)),
    publisher: text(data.publisher),
    place: text(data.place),
    volume: text(data.volume),
    issue: text(data.issue),
    pages: text(data.pages),
    language: text(data.language),
    identifiers,
    url: text(data.url) || (doi ? `https://doi.org/${doi}` : undefined),
    accessed: text(data.accessDate),
  });
}

function mapMendeleyDocument(raw: unknown): ReferenceManagerRecord | undefined {
  const data = isRecord(raw) ? raw : undefined;
  if (!data) return undefined;
  const id = text(data.id);
  const title = text(data.title);
  if (!id || !title) return undefined;

  const contributors = array(data.authors)
    .map((creator) => {
      const value = isRecord(creator) ? creator : undefined;
      if (!value) return undefined;
      return {
        role: 'author' as const,
        givenName: text(value.first_name),
        familyName: text(value.last_name),
      };
    })
    .filter((value): value is ReferenceManagerContributor => Boolean(value));

  const identifiersObject = isRecord(data.identifiers);
  const doi = normalizeDoi(text(identifiersObject?.doi));
  const identifiers = compactIdentifiers([
    { scheme: 'mendeley', value: id },
    doi ? { scheme: 'doi', value: doi } : undefined,
    text(identifiersObject?.isbn)
      ? { scheme: 'isbn', value: text(identifiersObject?.isbn)! }
      : undefined,
    text(identifiersObject?.issn)
      ? { scheme: 'issn', value: text(identifiersObject?.issn)! }
      : undefined,
    text(identifiersObject?.pmid)
      ? { scheme: 'pmid', value: text(identifiersObject?.pmid)! }
      : undefined,
    text(identifiersObject?.arxiv)
      ? { scheme: 'arxiv', value: text(identifiersObject?.arxiv)! }
      : undefined,
  ]);

  const websites = array(data.websites)
    .map(text)
    .filter((value): value is string => Boolean(value));

  return compactRecord({
    provider: 'mendeley',
    externalId: id,
    type: mapMendeleyType(text(data.type)),
    title,
    contributors,
    containerTitle: text(data.source),
    issued: text(data.year),
    publisher: text(data.publisher),
    place: text(data.city),
    volume: text(data.volume),
    issue: text(data.issue),
    pages: text(data.pages),
    language: text(data.language),
    identifiers,
    url: websites[0] || (doi ? `https://doi.org/${doi}` : undefined),
  });
}

function mendeleySearchText(raw: unknown): string {
  const data = isRecord(raw) ? raw : {};
  const authors = array(data.authors)
    .flatMap((author) => {
      const value = isRecord(author) ? author : {};
      return [text(value.first_name), text(value.last_name)];
    })
    .filter(Boolean);
  const identifiers = isRecord(data.identifiers)
    ? Object.values(data.identifiers).map(text).filter(Boolean)
    : [];
  return normalizeSearch(
    [
      text(data.title),
      text(data.source),
      text(data.year),
      ...authors,
      ...identifiers,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function mapZoteroType(itemType: string): ReferenceManagerRecord['type'] {
  switch (itemType) {
    case 'journalArticle': return 'journal-article';
    case 'book': return 'book';
    case 'bookSection': return 'book-chapter';
    case 'conferencePaper': return 'conference-paper';
    case 'thesis': return 'thesis';
    case 'report': return 'report';
    case 'preprint': return 'preprint';
    case 'dataset': return 'dataset';
    case 'computerProgram': return 'software';
    case 'standard': return 'standard';
    case 'manuscript': return 'manuscript';
    case 'webpage': return 'web-page';
    case 'document':
    case 'letter':
    case 'interview':
    case 'artwork':
    case 'map':
      return 'archival-source';
    default:
      return 'journal-article';
  }
}

function mapMendeleyType(type: string | undefined): ReferenceManagerRecord['type'] {
  switch (type?.toLowerCase()) {
    case 'journal': return 'journal-article';
    case 'book': return 'book';
    case 'book_section': return 'book-chapter';
    case 'conference_proceedings':
    case 'conference_proceedings_article':
    case 'conference':
      return 'conference-paper';
    case 'thesis': return 'thesis';
    case 'report': return 'report';
    case 'working_paper': return 'preprint';
    case 'dataset': return 'dataset';
    case 'computer_program': return 'software';
    case 'patent':
    case 'generic':
      return 'archival-source';
    case 'web_page': return 'web-page';
    default: return 'journal-article';
  }
}

function mapCreatorRole(
  value: string,
): ReferenceManagerContributor['role'] {
  if (value === 'editor' || value === 'seriesEditor') return 'editor';
  if (value === 'translator') return 'translator';
  if (value === 'author' || value === 'bookAuthor') return 'author';
  return 'other';
}

function parseMendeleyTokenResponse(payload: unknown): MendeleyTokenSet {
  const value = isRecord(payload) ? payload : {};
  const accessToken = text(value.access_token);
  const refreshToken = text(value.refresh_token);
  const expiresIn =
    typeof value.expires_in === 'number'
      ? value.expires_in
      : Number(text(value.expires_in));
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Mendeley returned an invalid OAuth token response.');
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    tokenType: 'bearer',
  };
}

function parseStoredMendeleyToken(value: string): MendeleyTokenSet {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Stored Mendeley credentials are invalid.');
  }
  const token = isRecord(parsed) ? parsed : {};
  const accessToken = text(token.accessToken);
  const refreshToken = text(token.refreshToken);
  const expiresAt = text(token.expiresAt);
  if (
    !accessToken ||
    !refreshToken ||
    !expiresAt ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new Error('Stored Mendeley credentials are incomplete.');
  }
  return { accessToken, refreshToken, expiresAt, tokenType: 'bearer' };
}

function parseEncryptedSecret(value: string): EncryptedSecret {
  const parsed = JSON.parse(value) as Partial<EncryptedSecret>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
    throw new Error('Stored integration secret is invalid.');
  }
  return parsed as EncryptedSecret;
}

function zoteroHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Zotero-API-Key': apiKey,
    'Zotero-API-Version': '3',
  };
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function timedFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function compactRecord<T extends ReferenceManagerRecord>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as T;
}

function compactIdentifiers(
  values: Array<{ scheme: string; value: string } | undefined>,
): Array<{ scheme: string; value: string }> {
  const seen = new Set<string>();
  return values.filter((value): value is { scheme: string; value: string } => {
    if (!value?.value?.trim()) return false;
    const key = `${value.scheme.toLowerCase()}:${value.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDoi(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .trim();
  return /^10\.\d{4,9}\/\S+$/i.test(normalized)
    ? normalized.toLowerCase()
    : undefined;
}

function extractYear(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.match(/\b(?:1[5-9]|20|21)\d{2}\b/)?.[0] || value;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
