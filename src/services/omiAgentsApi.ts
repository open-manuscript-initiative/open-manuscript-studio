import { isTauri } from '@tauri-apps/api/core';

import type {
  AgentRunRequest,
  AgentRunResult,
} from './integrationExecutionApi';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org/api';
const IS_TAURI = detectTauriRuntime();
const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ??
    (IS_TAURI && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '/api'),
);

export async function runOmiAgent(request: AgentRunRequest): Promise<AgentRunResult> {
  const response = await fetch(`${API_BASE_URL}/integrations/agents/run`, {
    method: 'POST',
    credentials: 'include',
    headers: nativeHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Agent execution failed with HTTP ${response.status}.`));
  }

  return parseJsonResponse<AgentRunResult>(response);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return fallback;

  const body = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  return body?.error?.message ?? fallback;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).trim().slice(0, 120);
    throw new Error(
      `OMI Agents API returned ${contentType || 'an unknown content type'} instead of JSON${preview ? `: ${preview}` : '.'}`,
    );
  }
  return await response.json() as T;
}

function nativeHeaders(input: HeadersInit = {}): Headers {
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
