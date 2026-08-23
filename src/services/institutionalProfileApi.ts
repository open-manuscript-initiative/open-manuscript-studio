import { isTauri } from '@tauri-apps/api/core';

import type {
  InstitutionalProfile,
  InstitutionalProfileInput,
} from '../model/user';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export type InstitutionalProfileUpdate = Partial<
  Omit<InstitutionalProfileInput, 'isDefault'>
>;

export async function getInstitutionalProfiles(): Promise<InstitutionalProfile[]> {
  const response = await fetch(`${apiBaseUrl()}/api/auth/profiles/institutions`, {
    method: 'GET',
    credentials: 'include',
    headers: headers(),
  });
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as { profiles: InstitutionalProfile[] };
  return payload.profiles;
}

export async function createInstitutionalProfile(
  input: InstitutionalProfileInput,
): Promise<InstitutionalProfile> {
  return writeProfile('/api/auth/profiles/institutions', 'POST', input);
}

export async function updateInstitutionalProfile(
  profileId: string,
  input: InstitutionalProfileUpdate,
): Promise<InstitutionalProfile> {
  return writeProfile(
    `/api/auth/profiles/institutions/${encodeURIComponent(profileId)}`,
    'PATCH',
    input,
  );
}

export async function setDefaultInstitutionalProfile(
  profileId: string,
): Promise<InstitutionalProfile> {
  return writeProfile(
    `/api/auth/profiles/institutions/${encodeURIComponent(profileId)}/default`,
    'POST',
    {},
  );
}

export async function deleteInstitutionalProfile(profileId: string): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/api/auth/profiles/institutions/${encodeURIComponent(profileId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: headers(),
    },
  );
  if (!response.ok && response.status !== 204) throw await apiError(response);
}

async function writeProfile(
  path: string,
  method: 'POST' | 'PATCH',
  input: object,
): Promise<InstitutionalProfile> {
  const requestHeaders = headers();
  requestHeaders.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    headers: requestHeaders,
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as { profile: InstitutionalProfile };
  return payload.profile;
}

function apiBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isTauri() && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '';
}

function headers(): Headers {
  const result = new Headers({ Accept: 'application/json' });
  if (isTauri()) {
    result.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) result.set('Authorization', `Bearer ${token}`);
  }
  return result;
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new Error(payload.error?.message || `Profile request failed with HTTP ${response.status}.`);
  } catch {
    return new Error(`Profile request failed with HTTP ${response.status}.`);
  }
}
