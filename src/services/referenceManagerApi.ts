import { isTauri } from '@tauri-apps/api/core';

import {
  createBibliographicRecord,
  createStableCitationId,
} from '../model/citations';
import type {
  OmiBibliographicRecord,
  OmiBibliographicResourceType,
} from '../types/omi';
import { normalizeIntegrationApiBaseUrl } from './integrationApiBaseUrl';

export type ReferenceManagerProviderId = 'zotero' | 'mendeley';

export interface ReferenceManagerRecordPayload {
  provider: ReferenceManagerProviderId;
  externalId: string;
  type: OmiBibliographicResourceType;
  title: string;
  subtitle?: string;
  contributors: Array<{
    role: 'author' | 'editor' | 'translator' | 'other';
    givenName?: string;
    familyName?: string;
    literalName?: string;
  }>;
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

export interface ReferenceManagerSearchResponse {
  provider: ReferenceManagerProviderId;
  records: ReferenceManagerRecordPayload[];
  truncated: boolean;
}

export interface ReferenceManagerOAuthResult {
  status: 'connected' | 'error';
  provider: 'mendeley';
  error?: string;
}

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org/api';
const IS_TAURI = isTauri();
const IS_MOBILE_TAURI =
  IS_TAURI &&
  /Android|iPhone|iPad|iPod/i.test(
    globalThis.navigator?.userAgent ?? '',
  );
const API_BASE_URL = normalizeIntegrationApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ??
    (IS_TAURI && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '/api'),
);

export async function searchPersonalReferenceManager(
  provider: ReferenceManagerProviderId,
  query: string,
): Promise<ReferenceManagerSearchResponse> {
  const response = await apiFetch(
    `/integrations/reference-managers/${encodeURIComponent(provider)}/search?q=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  );
  return readJson<ReferenceManagerSearchResponse>(response);
}

export async function startMendeleyOAuth(): Promise<void> {
  const returnOrigin = IS_TAURI
    ? IS_MOBILE_TAURI
      ? 'https://app.openmanuscript.org/auth/orcid'
      : 'openmanuscript://auth'
    : undefined;

  const response = await apiFetch('/integrations/mendeley/oauth/start', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      returnPath: globalThis.location?.pathname || '/',
      ...(returnOrigin ? { returnOrigin } : {}),
    }),
  });
  const payload = await readJson<{
    authorizationUrl: string;
    expiresAt: string;
  }>(response);

  if (IS_TAURI) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    if (IS_MOBILE_TAURI) {
      try {
        await openUrl(payload.authorizationUrl, 'inAppBrowser');
      } catch {
        await openUrl(payload.authorizationUrl);
      }
    } else {
      await openUrl(payload.authorizationUrl);
    }
    return;
  }

  globalThis.location?.assign(payload.authorizationUrl);
}

export async function listenForReferenceManagerOAuthReturn(
  handler: (result: ReferenceManagerOAuthResult) => void,
): Promise<() => void> {
  if (!IS_TAURI) return () => undefined;
  const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
  return onOpenUrl((urls) => {
    for (const value of urls) {
      const result = readOAuthResult(value);
      if (result) handler(result);
    }
  });
}

export function consumeReferenceManagerOAuthResultFromLocation():
  | ReferenceManagerOAuthResult
  | null {
  const location = globalThis.location;
  if (!location) return null;

  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const status =
    query.get('referenceManagerOAuth') ??
    hash.get('referenceManagerOAuth');
  const provider = query.get('provider') ?? hash.get('provider');
  if (
    (status !== 'connected' && status !== 'error') ||
    provider !== 'mendeley'
  ) {
    return null;
  }

  const error =
    query.get('referenceManagerOAuthError') ??
    hash.get('referenceManagerOAuthError') ??
    undefined;

  for (const params of [query, hash]) {
    params.delete('referenceManagerOAuth');
    params.delete('provider');
    params.delete('referenceManagerOAuthError');
  }
  const next =
    `${location.pathname}` +
    `${query.toString() ? `?${query.toString()}` : ''}` +
    `${hash.toString() ? `#${hash.toString()}` : ''}`;
  globalThis.history?.replaceState(globalThis.history.state, '', next);

  return {
    status,
    provider: 'mendeley',
    ...(error ? { error } : {}),
  };
}

export function referenceManagerRecordToOmi(
  source: ReferenceManagerRecordPayload,
): OmiBibliographicRecord {
  return {
    ...createBibliographicRecord({
      type: source.type,
      title: source.title,
      subtitle: source.subtitle,
      contributors: source.contributors.map((contributor) => ({
        id: createStableCitationId('bib'),
        role: contributor.role,
        givenName: contributor.givenName,
        familyName: contributor.familyName,
        literalName: contributor.literalName,
      })),
      containerTitle: source.containerTitle,
      issued: source.issued,
      publisher: source.publisher,
      place: source.place,
      volume: source.volume,
      issue: source.issue,
      pages: source.pages,
      language: source.language,
      identifiers: source.identifiers,
      url: source.url,
      accessed: source.accessed,
    }),
    status: 'resolved',
  };
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (IS_TAURI) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
}

function readOAuthResult(value: string): ReferenceManagerOAuthResult | null {
  try {
    const url = new URL(value);
    const params = new URLSearchParams(url.hash.replace(/^#/, ''));
    const status = params.get('referenceManagerOAuth');
    const provider = params.get('provider');
    if (
      (status !== 'connected' && status !== 'error') ||
      provider !== 'mendeley'
    ) {
      return null;
    }
    const error = params.get('referenceManagerOAuthError') ?? undefined;
    return {
      status,
      provider: 'mendeley',
      ...(error ? { error } : {}),
    };
  } catch {
    return null;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const root =
      payload && typeof payload === 'object'
        ? payload as Record<string, unknown>
        : {};
    const error =
      root.error && typeof root.error === 'object'
        ? root.error as Record<string, unknown>
        : {};
    throw new Error(
      typeof error.message === 'string'
        ? error.message
        : `Reference-manager request failed with HTTP ${response.status}.`,
    );
  }
  return payload as T;
}
