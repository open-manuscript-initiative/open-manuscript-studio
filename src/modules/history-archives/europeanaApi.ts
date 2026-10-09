import { getStudioApiBaseUrl } from '../../services/studioServer';
import { isTauri } from '@tauri-apps/api/core';

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

const NATIVE_SESSION_KEY = 'omi_native_session_token';

export async function searchEuropeanaRecords(
  query: string,
  cursor?: string,
): Promise<EuropeanaSearchPage> {
  const params = new URLSearchParams({ q: query, workspaceId: 'default' });
  if (cursor) params.set('cursor', cursor);

  const headers = new Headers({ Accept: 'application/json' });
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(
    `${apiBaseUrl()}/api/v1/modules/history-archives/europeana/search?${params.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
      headers,
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

function apiBaseUrl(): string {\n  return getStudioApiBaseUrl();\n}
