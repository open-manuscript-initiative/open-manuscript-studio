import { isTauri } from '@tauri-apps/api/core';

import { normalizeNextcloudWebDavUrl } from './nextcloudConnection';

export type CloudProviderType =
  | 'webdav'
  | 'nextcloud'
  | 'google-drive'
  | 'onedrive'
  | 'dropbox';
export type CloudConnectionStatus = 'connected' | 'disconnected' | 'error';
export type CloudOAuthProviderId = 'google-drive' | 'onedrive' | 'dropbox';

export interface CloudConnection {
  id: string;
  providerType: CloudProviderType;
  displayName: string;
  status: CloudConnectionStatus;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface CloudBackup {
  id: string;
  manuscriptId: string;
  userId: string;
  connectionId: string;
  providerObjectId: string;
  providerPath: string;
  packageVersion: string;
  checksum: string;
  sizeBytes: string;
  status: string;
  createdAt: string;
}

export interface CreateCloudConnectionInput {
  providerType: 'webdav' | 'nextcloud';
  displayName: string;
  baseUrl: string;
  username: string;
  password: string;
  rootPath: string;
}

export interface CloudOAuthProviderConfig {
  id: CloudOAuthProviderId;
  label: string;
  configured: boolean;
  redirectUri: string | null;
  scopes: string[];
  setupEnvironment: string[];
}

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';
const IS_TAURI = isTauri();
const IS_MOBILE_TAURI = IS_TAURI && /Android|iPhone|iPad|iPod/i.test(globalThis.navigator?.userAgent ?? '');
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL?.trim()
  || (IS_TAURI && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '')).replace(/\/$/, '');

export async function listCloudConnections(): Promise<CloudConnection[]> {
  const response = await cloudFetch('/api/cloud/connections', {
    headers: { Accept: 'application/json' },
  });
  const data = await readJson<{ connections: CloudConnection[] }>(response);
  return data.connections;
}

export async function createCloudConnection(
  input: CreateCloudConnectionInput,
): Promise<CloudConnection> {
  const normalizedInput = input.providerType === 'nextcloud'
    ? {
        ...input,
        baseUrl: normalizeNextcloudWebDavUrl(input.baseUrl, input.username),
      }
    : input;

  const response = await cloudFetch('/api/cloud/connections', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(normalizedInput),
  });
  const data = await readJson<{ connection: CloudConnection }>(response);
  return data.connection;
}

export async function listCloudOAuthProviders(): Promise<CloudOAuthProviderConfig[]> {
  const response = await cloudFetch('/api/cloud/oauth/providers', {
    headers: { Accept: 'application/json' },
  });
  const data = await readJson<{ providers: CloudOAuthProviderConfig[] }>(response);
  return data.providers;
}

export async function startCloudOAuthConnection(input: {
  provider: CloudOAuthProviderId;
  accountType: 'personal' | 'business';
  displayName: string;
}): Promise<void> {
  const returnOrigin = IS_TAURI
    ? IS_MOBILE_TAURI
      ? 'https://app.openmanuscript.org/auth/orcid'
      : 'openmanuscript://auth'
    : undefined;
  const response = await cloudFetch(`/api/cloud/oauth/${encodeURIComponent(input.provider)}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      accountType: input.accountType,
      displayName: input.displayName,
      returnPath: globalThis.location?.pathname || '/',
      ...(returnOrigin ? { returnOrigin } : {}),
    }),
  });
  const data = await readJson<{ authorizationUrl: string; expiresAt: string }>(response);

  if (IS_TAURI) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    if (IS_MOBILE_TAURI) {
      try {
        await openUrl(data.authorizationUrl, 'inAppBrowser');
      } catch {
        await openUrl(data.authorizationUrl);
      }
    } else {
      await openUrl(data.authorizationUrl);
    }
    return;
  }

  globalThis.location?.assign(data.authorizationUrl);
}

export async function listenForCloudOAuthReturn(
  handler: (result: { status: 'connected' | 'error'; provider?: string; error?: string }) => void,
): Promise<() => void> {
  if (!IS_TAURI) return () => undefined;
  const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
  return onOpenUrl((urls) => {
    for (const value of urls) {
      const result = readCloudOAuthResult(value);
      if (result) handler(result);
    }
  });
}

export function consumeCloudOAuthResultFromLocation(): {
  status: 'connected' | 'error';
  provider?: string;
  error?: string;
} | null {
  const location = globalThis.location;
  if (!location) return null;
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const status = query.get('cloudOAuth') ?? hash.get('cloudOAuth');
  if (status !== 'connected' && status !== 'error') return null;
  const provider = query.get('provider') ?? hash.get('provider') ?? undefined;
  const error = query.get('cloudOAuthError') ?? hash.get('cloudOAuthError') ?? undefined;
  query.delete('cloudOAuth');
  query.delete('provider');
  query.delete('cloudOAuthError');
  hash.delete('cloudOAuth');
  hash.delete('provider');
  hash.delete('cloudOAuthError');
  const next = `${location.pathname}${query.toString() ? `?${query.toString()}` : ''}${hash.toString() ? `#${hash.toString()}` : ''}`;
  globalThis.history?.replaceState(globalThis.history.state, '', next);
  return {
    status,
    ...(provider ? { provider } : {}),
    ...(error ? { error } : {}),
  };
}

export async function testCloudConnection(
  connectionId: string,
): Promise<CloudConnection> {
  const response = await cloudFetch(
    `/api/cloud/connections/${encodeURIComponent(connectionId)}/test`,
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
    },
  );
  const data = await readJson<{ connection: CloudConnection }>(response);
  return data.connection;
}

export async function deleteCloudConnection(
  connectionId: string,
): Promise<void> {
  const response = await cloudFetch(
    `/api/cloud/connections/${encodeURIComponent(connectionId)}`,
    { method: 'DELETE' },
  );
  await ensureSuccess(response);
}

export async function uploadCloudBackup(input: {
  manuscriptId: string;
  connectionId: string;
  packageVersion: string;
  bytes: Uint8Array;
}): Promise<CloudBackup> {
  const payload = new Uint8Array(input.bytes.byteLength);
  payload.set(input.bytes);

  const response = await cloudFetch(
    `/api/manuscripts/${encodeURIComponent(input.manuscriptId)}/backups?connectionId=${encodeURIComponent(input.connectionId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.openmanuscript.package+zip',
        Accept: 'application/json',
        'X-OMI-Package-Version': input.packageVersion,
      },
      body: payload.buffer,
    },
  );
  const data = await readJson<{ backup: CloudBackup }>(response);
  return data.backup;
}

export async function listCloudBackups(
  manuscriptId: string,
): Promise<CloudBackup[]> {
  const response = await cloudFetch(
    `/api/manuscripts/${encodeURIComponent(manuscriptId)}/backups`,
    { headers: { Accept: 'application/json' } },
  );
  const data = await readJson<{ backups: CloudBackup[] }>(response);
  return data.backups;
}

export async function downloadCloudBackup(backupId: string): Promise<Uint8Array> {
  const response = await cloudFetch(
    `/api/backups/${encodeURIComponent(backupId)}/content`,
    { headers: { Accept: 'application/vnd.openmanuscript.package+zip' } },
  );
  await ensureSuccess(response);
  return new Uint8Array(await response.arrayBuffer());
}

export async function deleteCloudBackup(backupId: string): Promise<void> {
  const response = await cloudFetch(`/api/backups/${encodeURIComponent(backupId)}`, {
    method: 'DELETE',
  });
  await ensureSuccess(response);
}

async function cloudFetch(path: string, init: RequestInit = {}): Promise<Response> {
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

function readCloudOAuthResult(value: string): {
  status: 'connected' | 'error';
  provider?: string;
  error?: string;
} | null {
  try {
    const url = new URL(value);
    const params = new URLSearchParams(url.hash.replace(/^#/, ''));
    const status = params.get('cloudOAuth');
    if (status !== 'connected' && status !== 'error') return null;
    const provider = params.get('provider') ?? undefined;
    const error = params.get('cloudOAuthError') ?? undefined;
    return {
      status,
      ...(provider ? { provider } : {}),
      ...(error ? { error } : {}),
    };
  } catch {
    return null;
  }
}

async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) return;
  throw await responseError(response);
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as unknown;
  if (!response.ok) throw responseErrorFromData(response, data);
  return data as T;
}

async function responseError(response: Response): Promise<Error> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return new Error(`Request failed with HTTP ${response.status}.`);
  }
  return responseErrorFromData(response, data);
}

function responseErrorFromData(response: Response, data: unknown): Error {
  const record = data && typeof data === 'object'
    ? data as Record<string, unknown>
    : {};
  const error = record.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : {};
  return new Error(
    typeof error.message === 'string'
      ? error.message
      : `Request failed with HTTP ${response.status}.`,
  );
}
