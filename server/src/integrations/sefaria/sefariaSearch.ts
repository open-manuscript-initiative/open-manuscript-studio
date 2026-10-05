export interface SefariaSearchRecord {
  id: string;
  reference: string;
  title: string;
  excerpt: string;
  language: string | null;
  edition: string | null;
  categories: string[];
  sourceUrl: string;
}

export interface SefariaSearchPage {
  totalResults: number;
  items: SefariaSearchRecord[];
  nextCursor: string | null;
}

interface SefariaSearchOptions {
  query: string;
  cursor?: string;
  fetchImpl?: typeof fetch;
}

const SEARCH_ENDPOINT = 'https://www.sefaria.org/api/search/text/_search';
const PAGE_SIZE = 12;
const MAX_OFFSET = 1200;

export async function searchSefaria({
  query,
  cursor,
  fetchImpl = fetch,
}: SefariaSearchOptions): Promise<SefariaSearchPage> {
  const offset = cursor === undefined ? 0 : Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new Error('Sefaria search cursor is invalid.');
  }

  const response = await fetchImpl(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: offset,
      size: PAGE_SIZE,
      query: {
        match_phrase: {
          naive_lemmatizer: {
            query,
            slop: 10,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error('Sefaria Search API returned an unsuccessful response.');
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.hits)) {
    throw new Error('Sefaria Search API returned an invalid response.');
  }

  const rawHits = Array.isArray(payload.hits.hits) ? payload.hits.hits : [];
  const items = rawHits.flatMap((hit) => {
    const mapped = mapRecord(hit);
    return mapped ? [mapped] : [];
  });
  const rawTotal = payload.hits.total;
  const totalValue = isRecord(rawTotal) ? rawTotal.value : rawTotal;
  const parsedTotal = Number(totalValue);
  const totalResults = Number.isFinite(parsedTotal) && parsedTotal >= 0
    ? parsedTotal
    : items.length;
  const nextOffset = offset + rawHits.length;
  const nextCursor = rawHits.length === PAGE_SIZE
    && nextOffset < totalResults
    && nextOffset <= MAX_OFFSET
    ? String(nextOffset)
    : null;

  return { totalResults, items, nextCursor };
}

function mapRecord(value: unknown): SefariaSearchRecord | null {
  if (!isRecord(value) || !isRecord(value._source)) return null;

  const source = value._source;
  const reference = firstText(source.ref) ?? firstText(source.heRef);
  if (!reference || reference.length > 300) return null;

  const edition = firstText(source.version);
  const language = firstText(source.lang);
  const categories = Array.isArray(source.categories)
    ? source.categories.flatMap((category) => typeof category === 'string' ? [category] : [])
      .slice(0, 8)
    : [];
  const excerpt = firstText(source.exact)
    ?? firstText(source.naive_lemmatizer)
    ?? '';

  return {
    id: [reference, edition, language].filter(Boolean).join(':'),
    reference,
    title: firstText(source.title) ?? reference,
    excerpt: excerpt.slice(0, 320),
    language,
    edition,
    categories,
    sourceUrl: `https://www.sefaria.org/${encodeURIComponent(reference)}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}
