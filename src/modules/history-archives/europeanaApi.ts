export class EuropeanaSearchError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'EuropeanaSearchError';
  }
}

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

export async function searchEuropeanaRecords(
  query: string,
  cursor?: string,
): Promise<EuropeanaSearchPage> {
  const params = new URLSearchParams({ q: query });
  if (cursor) params.set('cursor', cursor);

  const response = await fetch(
    `/api/modules/history-archives/europeana/search?${params.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );

  const payload = await response.json().catch(() => null) as
    | EuropeanaSearchPage
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new EuropeanaSearchError(
      payload && 'error' in payload && typeof payload.error?.code === 'string'
        ? payload.error.code
        : 'EUROPEANA_SEARCH_FAILED',
      payload && 'error' in payload && payload.error?.message
        ? payload.error.message
        : `Europeana search failed (HTTP ${response.status}).`,
    );
  }

  if (!payload || !('items' in payload) || !Array.isArray(payload.items)) {
    throw new Error('Europeana search returned an invalid response.');
  }

  return payload as EuropeanaSearchPage;
}
