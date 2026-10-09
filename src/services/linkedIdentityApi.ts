import { getStudioApiBaseUrl } from './studioServer';
import { isTauri } from '@tauri-apps/api/core';

export type LinkedIdentityProviderKey =
  | 'orcid'
  | 'omi'
  | 'google'
  | 'microsoft'
  | 'oidc'
  | 'saml';

export interface LinkedIdentityRecord {
  id: string;
  provider: 'ORCID' | 'OIDC' | 'SAML';
  providerKey: LinkedIdentityProviderKey;
  label: string;
  issuer: string;
  subject: string;
  displayName: string | null;
  email: string | null;
  connectedAt: string;
  lastUsedAt: string | null;
  canUnlink: boolean;
}

export interface LinkedIdentitySettings {
  localCredential: {
    type: 'password';
    email: string;
    enabled: boolean;
  };
  identities: LinkedIdentityRecord[];
}

const NATIVE_SESSION_KEY = 'omi_native_session_token';

function apiBaseUrl(): string {
  return getStudioApiBaseUrl();
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

export async function getLinkedIdentitySettings(): Promise<LinkedIdentitySettings> {
  const response = await fetch(`${apiBaseUrl()}/api/auth/identities`, {
    method: 'GET',
    credentials: 'include',
    headers: headers(),
  });
  if (!response.ok) throw await apiError(response);
  return response.json() as Promise<LinkedIdentitySettings>;
}

export async function unlinkLinkedIdentity(identityId: string): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/api/auth/identities/${encodeURIComponent(identityId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: headers(),
    },
  );
  if (!response.ok && response.status !== 204) throw await apiError(response);
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new Error(payload.error?.message || `Identity request failed with HTTP ${response.status}.`);
  } catch {
    return new Error(`Identity request failed with HTTP ${response.status}.`);
  }
}
