import { isTauri } from '@tauri-apps/api/core';

import type {
  IntegrationAuthenticationMode,
  IntegrationProviderStatus,
} from '../integrations/contracts';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org/api';
const IS_TAURI = detectTauriRuntime();
const USE_DIRECT_NATIVE_API = IS_TAURI && !import.meta.env.DEV;
const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ??
    (USE_DIRECT_NATIVE_API ? NATIVE_API_BASE_URL : '/api'),
);

export interface IntegrationConnection {
  id: string;
  providerId: string;
  connectionKey: string;
  displayName: string | null;
  authenticationMode: IntegrationAuthenticationMode;
  enabled: boolean;
  status: string;
  config: Record<string, unknown> | null;
  hasSecret: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationCatalogProvider {
  id: string;
  kind: string;
  displayName: string;
  description: string;
  authenticationModes: IntegrationAuthenticationMode[];
  preferredAuthenticationMode: IntegrationAuthenticationMode;
  supportsPerUserAuthentication: boolean;
  supportsMultipleConnections: boolean;
  configurable: boolean;
  server: {
    enabled: boolean;
    configured: boolean;
    status: string;
    lastCheckedAt: string | null;
    lastError: string | null;
  };
  connections: IntegrationConnection[];
}

export interface PublishingConnectionCredentials {
  installationId: string;
  sharedSecret: string;
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  const body = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  return body?.error?.message;
}

export async function getIntegrationStatus(
  providerId: string,
): Promise<IntegrationProviderStatus> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/status`,
    {
      method: 'GET',
      credentials: 'include',
      headers: integrationHeaders({ Accept: 'application/json' }),
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      return {
        providerId,
        enabled: false,
        configured: false,
        healthy: false,
        message: 'Integration endpoint is not configured on this Studio server.',
      };
    }
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration status request failed with HTTP ${response.status}.`,
    );
  }

  return parseJsonResponse<IntegrationProviderStatus>(response);
}

export async function getIntegrationCatalog(): Promise<IntegrationCatalogProvider[]> {
  const response = await fetch(`${API_BASE_URL}/integrations/catalog`, {
    credentials: 'include',
    headers: integrationHeaders({ Accept: 'application/json' }),
  });
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration catalog request failed with HTTP ${response.status}.`,
    );
  }
  const payload = await parseJsonResponse<{ providers: IntegrationCatalogProvider[] }>(response);
  return payload.providers;
}

export async function saveIntegrationConnection(
  providerId: string,
  input: {
    connectionKey?: string;
    displayName?: string;
    authenticationMode: IntegrationAuthenticationMode;
    secret?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
  },
): Promise<IntegrationConnection> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/connections`,
    {
      method: 'POST',
      credentials: 'include',
      headers: integrationHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration configuration failed with HTTP ${response.status}.`,
    );
  }
  const payload = await parseJsonResponse<{ connection: IntegrationConnection }>(response);
  return payload.connection;
}

export async function createPublishingConnection(
  providerId: string,
  input: { displayName: string; baseUrl: string },
): Promise<{
  connection: IntegrationConnection;
  credentials: PublishingConnectionCredentials;
}> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/publishing-connections`,
    {
      method: 'POST',
      credentials: 'include',
      headers: integrationHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Publishing connection registration failed with HTTP ${response.status}.`,
    );
  }
  return parseJsonResponse<{
    connection: IntegrationConnection;
    credentials: PublishingConnectionCredentials;
  }>(response);
}

export async function updatePublishingConnection(
  connectionId: string,
  input: { displayName: string; baseUrl: string },
): Promise<IntegrationConnection> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/connections/${encodeURIComponent(connectionId)}/publishing`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: integrationHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Publishing connection update failed with HTTP ${response.status}.`,
    );
  }
  const payload = await parseJsonResponse<{ connection: IntegrationConnection }>(response);
  return payload.connection;
}

export async function testIntegrationConnection(
  providerId: string,
): Promise<IntegrationProviderStatus> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/test`,
    {
      method: 'POST',
      credentials: 'include',
      headers: integrationHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: '{}',
    },
  );

  if (!response.ok && response.status !== 409) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration connection test failed with HTTP ${response.status}.`,
    );
  }

  const payload = await parseJsonResponse<{
    status?: { healthy: boolean; configured: boolean; message: string };
    providerId?: string;
    enabled?: boolean;
    configured?: boolean;
    healthy?: boolean;
    message?: string;
  }>(response);

  if (payload.status) {
    return {
      providerId,
      enabled: true,
      configured: payload.status.configured,
      healthy: payload.status.healthy,
      message: payload.status.message,
    };
  }
  return payload as IntegrationProviderStatus;
}

export async function testIntegrationConnectionById(
  connectionId: string,
): Promise<IntegrationConnection> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/connections/${encodeURIComponent(connectionId)}/test`,
    {
      method: 'POST',
      credentials: 'include',
      headers: integrationHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: '{}',
    },
  );
  if (!response.ok && response.status !== 409) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration connection test failed with HTTP ${response.status}.`,
    );
  }
  const payload = await parseJsonResponse<{ connection: IntegrationConnection }>(response);
  return payload.connection;
}

export async function deleteIntegrationConnection(connectionId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/connections/${encodeURIComponent(connectionId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: integrationHeaders({ Accept: 'application/json' }),
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration deletion failed with HTTP ${response.status}.`,
    );
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).trim().slice(0, 120);
    throw new Error(
      `Integration API returned ${contentType || 'an unknown content type'} from ${response.url || 'the requested endpoint'} instead of JSON${preview ? `: ${preview}` : '.'}`,
    );
  }

  return (await response.json()) as T;
}

function integrationHeaders(input: HeadersInit = {}): Headers {
  const headers = new Headers(input);
  if (!IS_TAURI) return headers;

  headers.set('X-OMI-Native-Client', '1');
  const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

function detectTauriRuntime(): boolean {
  if (isTauri()) return true;

  const location = globalThis.location;
  if (!location) return false;

  return location.protocol === 'tauri:' || location.hostname === 'tauri.localhost';
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}
