export interface EuropeanaSearchRecord {
  id: string;
  title: string;
  description: string | null;
  creator: string | null;
  date: string | null;
  provider: string | null;
  thumbnailUrl: string | null;
  rights: string | null;
  recordUrl: string;
  sourceUrl: string | null;
}

export interface EuropeanaSearchPage {
  totalResults: number;
  items: EuropeanaSearchRecord[];
  nextCursor: string | null;
}

interface EuropeanaSearchOptions {
  query: string;
  apiKey: string;
  cursor?: string;
  fetchImpl?: typeof fetch;
}

const SEARCH_ENDPOINT = 'https://api.europeana.eu/record/v2/search.json';
const PAGE_SIZE = 12;

export async function searchEuropeana({
  query,
  apiKey,
  cursor,
  fetchImpl = fetch,
}: EuropeanaSearchOptions): Promise<EuropeanaSearchPage> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('rows', String(PAGE_SIZE));
  url.searchParams.set('profile', 'rich');
  url.searchParams.set('cursor', cursor ?? '*');

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error('Europeana Search API returned an unsuccessful response.');
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.success === false) {
    throw new Error('Europeana Search API returned an invalid response.');
  }

  const items = Array.isArray(payload.items)
    ? payload.items.flatMap((item) => {
        const mapped = mapRecord(item);
        return mapped ? [mapped] : [];
      })
    : [];

  const totalResults = Number(payload.totalResults);
  const nextCursor = typeof payload.nextCursor === 'string'
    && payload.nextCursor.length <= 4096
    ? payload.nextCursor
    : null;

  return {
    totalResults: Number.isFinite(totalResults) && totalResults >= 0
      ? totalResults
      : items.length,
    items,
    nextCursor,
  };
}

function mapRecord(value: unknown): EuropeanaSearchRecord | null {
  if (!isRecord(value)) return null;

  const id = firstText(value.id);
  if (!id || !id.startsWith('/') || id.startsWith('//')) return null;

  return {
    id,
    title: firstText(value.title)
      ?? firstText(value.dcTitle)
      ?? firstText(value.dcTitleLangAware)
      ?? id,
    description: firstText(value.dcDescription)
      ?? firstText(value.dcDescriptionLangAware),
    creator: firstText(value.dcCreator)
      ?? firstText(value.dcCreatorLangAware),
    date: firstText(value.year)
      ?? firstText(value.dcDate)
      ?? firstText(value.yearCreated),
    provider: firstText(value.dataProvider)
      ?? firstText(value.provider),
    thumbnailUrl: safeHttpsUrl(firstText(value.edmPreview)),
    rights: firstText(value.rights)
      ?? firstText(value.edmRights),
    recordUrl: safeEuropeanaRecordUrl(firstText(value.guid), id),
    sourceUrl: safeHttpsUrl(firstText(value.edmIsShownAt)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = firstText(item);
      if (normalized) return normalized;
    }
    return null;
  }

  if (isRecord(value)) {
    const preferred = ['en', 'eng', 'und'];
    for (const key of preferred) {
      const normalized = firstText(value[key]);
      if (normalized) return normalized;
    }
    for (const item of Object.values(value)) {
      const normalized = firstText(item);
      if (normalized) return normalized;
    }
  }

  return null;
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeEuropeanaRecordUrl(value: string | null, id: string): string {
  if (value) {
    try {
      const url = new URL(value);
      if (
        url.protocol === 'https:'
        && (url.hostname === 'europeana.eu' || url.hostname.endsWith('.europeana.eu'))
      ) {
        return url.toString();
      }
    } catch {
      // Fall back to the canonical Europeana item route below.
    }
  }

  return `https://www.europeana.eu/item${encodeURI(id)}`;
}
