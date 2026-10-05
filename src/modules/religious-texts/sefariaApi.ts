import { isTauri } from '@tauri-apps/api/core';

export class SefariaSearchError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SefariaSearchError';
  }
}

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

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export async function searchSefariaTexts(
  query: string,
  cursor?: string,
): Promise<SefariaSearchPage> {
  const params = new URLSearchParams({ q: query });
  if (cursor) params.set('cursor', cursor);

  const headers = new Headers({ Accept: 'application/json' });
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(
    `${apiBaseUrl()}/api/modules/religious-texts/sefaria/search?${params.toString()}`,
    { method: 'GET', credentials: 'include', headers },
  );

  const payload = await response.json().catch(() => null) as
    | SefariaSearchPage
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new SefariaSearchError(
      payload && 'error' in payload && typeof payload.error?.code === 'string'
        ? payload.error.code
        : 'SEFARIA_SEARCH_FAILED',
      payload && 'error' in payload && payload.error?.message
        ? payload.error.message
        : `Sefaria search failed (HTTP ${response.status}).`,
    );
  }

  if (!payload || !('items' in payload) || !Array.isArray(payload.items)) {
    throw new Error('Sefaria search returned an invalid response.');
  }

  return payload as SefariaSearchPage;
}

function apiBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isTauri() && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '';
}
