import { getStudioApiBaseUrl } from '../services/studioServer';
import { isTauri } from '@tauri-apps/api/core';

import type { StudioModuleId } from './types';

const NATIVE_SESSION_KEY = 'omi_native_session_token';

export interface ServerModulePolicy {
  workspaceId: string;
  revision: number;
  enabledModuleIds: StudioModuleId[];
  activeModuleIds: StudioModuleId[];
}

export async function getServerModulePolicy(workspaceId: string): Promise<ServerModulePolicy> {
  const params = new URLSearchParams({ workspaceId });
  const response = await fetch(
    `${apiBaseUrl()}/api/v1/modules/policy?${params.toString()}`,
    { method: 'GET', credentials: 'include', headers: requestHeaders() },
  );
  return readResponse<ServerModulePolicy>(response);
}

export async function saveServerModulePreferences(input: {
  workspaceId: string;
  revision: number;
  activeModuleIds: StudioModuleId[];
}): Promise<ServerModulePolicy> {
  const headers = requestHeaders();
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl()}/api/v1/modules/preferences`, {
    method: 'PUT',
    credentials: 'include',
    headers,
    body: JSON.stringify(input),
  });
  return readResponse<ServerModulePolicy>(response);
}

function requestHeaders(): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function apiBaseUrl(): string {
  return getStudioApiBaseUrl();
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = payload?.error;
    throw new Error(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : `Module settings failed (HTTP ${response.status}).`);
  }
  if (!payload) throw new Error('Module settings returned an invalid response.');
  return payload as T;
}
