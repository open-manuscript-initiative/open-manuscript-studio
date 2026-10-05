export interface NaraCatalogRecord {
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

export interface NaraCatalogSearchPage {
  totalResults: number;
  items: NaraCatalogRecord[];
  nextCursor: string | null;
}

interface NaraCatalogSearchOptions {
  query: string;
  apiKey: string;
  cursor?: string;
  fetchImpl?: typeof fetch;
}

const SEARCH_ENDPOINT = 'https://catalog.archives.gov/api/v2/records/search';
const PAGE_SIZE = 12;

export async function searchNaraCatalog({
  query,
  apiKey,
  cursor,
  fetchImpl = fetch,
}: NaraCatalogSearchOptions): Promise<NaraCatalogSearchPage> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  if (cursor) url.searchParams.set('searchAfter', cursor);
  url.searchParams.set('limit', String(PAGE_SIZE));

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error('National Archives Catalog API returned an unsuccessful response.');
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error('National Archives Catalog API returned an invalid response.');
  }

  const body = asRecord(payload.body);
  const hitsBlock = asRecord(body?.hits);
  const rawHits = Array.isArray(hitsBlock?.hits) ? hitsBlock.hits : [];
  const items = rawHits.flatMap((hit) => {
    const mapped = mapRecord(hit);
    return mapped ? [mapped] : [];
  });
  const total = parseTotal(hitsBlock?.total, items.length);
  const lastHit = asRecord(rawHits.at(-1));
  const sortValues = Array.isArray(lastHit?.sort) ? lastHit.sort : [];
  const nextCursor = rawHits.length === PAGE_SIZE
    ? firstText(sortValues[0])
    : null;

  return { totalResults: total, items, nextCursor };
}

function mapRecord(value: unknown): NaraCatalogRecord | null {
  const hit = asRecord(value);
  const source = asRecord(hit?._source);
  const record = asRecord(source?.record);
  if (!hit || !record) return null;

  const id = firstText(record.naId) ?? firstText(hit._id);
  if (!id || !/^\d{1,20}$/.test(id)) return null;

  const digitalObjects = Array.isArray(record.digitalObjects)
    ? record.digitalObjects
    : [];
  const thumbnailUrl = digitalObjects
    .map((entry) => {
      const object = asRecord(entry);
      return safeHttpsUrl(
        firstText(object?.thumbnailUrl)
        ?? firstText(object?.thumbnail),
      );
    })
    .find((url): url is string => Boolean(url)) ?? null;

  const useRestriction = asRecord(record.useRestriction);

  return {
    id,
    title: firstText(record.title) ?? `National Archives record ${id}`,
    description: firstText(record.scopeAndContentNote)
      ?? firstText(record.generalNote)
      ?? firstText(record.description),
    creator: firstText(record.creators)
      ?? firstText(record.creator)
      ?? firstText(record.creatorName),
    date: firstText(record.inclusiveDates)
      ?? firstText(record.coverageStartDate)
      ?? firstText(record.productionDates),
    provider: firstText(record.recordGroupName)
      ?? firstText(record.organizationName)
      ?? firstText(record.repository),
    thumbnailUrl,
    rights: firstText(useRestriction?.status)
      ?? firstText(record.useRestriction),
    recordUrl: `https://catalog.archives.gov/id/${id}`,
    sourceUrl: null,
  };
}

function parseTotal(value: unknown, fallback: number): number {
  const totalRecord = asRecord(value);
  const candidate = totalRecord?.value ?? value;
  const total = Number(candidate);
  return Number.isSafeInteger(total) && total >= 0 ? total : fallback;
}

function firstText(value: unknown, depth = 0): string | null {
  if (depth > 4) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized ? normalized.slice(0, 1200) : null;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) {
      const normalized = firstText(item, depth + 1);
      if (normalized) return normalized;
    }
    return null;
  }
  const object = asRecord(value);
  if (!object) return null;
  for (const key of ['name', 'creatorName', 'string', 'value', 'note', 'content', 'inclusiveStartDate', 'startDate', 'productionDate', 'date', 'organizationName', 'recordGroupName']) {
    const normalized = firstText(object[key], depth + 1);
    if (normalized) return normalized;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value) !== null;
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
