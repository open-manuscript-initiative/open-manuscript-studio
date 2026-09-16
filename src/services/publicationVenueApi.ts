import { isTauri } from '@tauri-apps/api/core';

import type {
  OmiPublicationVenueReference,
  OmiPublicationVenueType,
} from '../model/scholarlyMetadata';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export interface CreatePublicationVenueInput {
  type: OmiPublicationVenueType;
  name: string;
  website?: string;
  issn?: string;
  isbnPrefix?: string;
  integrationConnectionId: string;
}

export async function getPublicationVenues(
  type?: OmiPublicationVenueType,
  query?: string,
): Promise<OmiPublicationVenueReference[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (query?.trim()) params.set('q', query.trim());
  const queryString = params.toString();
  const path = '/api/auth/publication-venues'
    + (queryString ? '?' + queryString : '');
  const response = await fetch(apiBaseUrl() + path, {
    method: 'GET',
    credentials: 'include',
    headers: headers(),
  });
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as {
    venues?: OmiPublicationVenueReference[];
  };
  return payload.venues ?? [];
}

export async function createPublicationVenue(
  input: CreatePublicationVenueInput,
): Promise<OmiPublicationVenueReference> {
  const requestHeaders = headers();
  requestHeaders.set('Content-Type', 'application/json');
  const response = await fetch(apiBaseUrl() + '/api/auth/publication-venues', {
    method: 'POST',
    credentials: 'include',
    headers: requestHeaders,
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as {
    venue: OmiPublicationVenueReference;
  };
  return payload.venue;
}

function apiBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isTauri() && !import.meta.env.DEV
    ? NATIVE_API_BASE_URL
    : '';
}

function headers(): Headers {
  const result = new Headers({ Accept: 'application/json' });
  if (isTauri()) {
    result.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) result.set('Authorization', 'Bearer ' + token);
  }
  return result;
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new Error(
      payload.error?.message
        || 'Publication venue request failed with HTTP ' + response.status + '.',
    );
  } catch {
    return new Error(
      'Publication venue request failed with HTTP ' + response.status + '.',
    );
  }
}
