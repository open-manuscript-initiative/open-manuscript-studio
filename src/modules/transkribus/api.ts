import { isTauri } from '@tauri-apps/api/core';
import { getStudioApiBaseUrl } from '../../services/studioServer';

export interface TranskribusConnection {
  connected: boolean;
  accountLabel: string;
}

export interface TranskribusJob {
  processId: number;
  status: 'CREATED' | 'WAITING' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'CANCELLED';
  text: string;
  handle: string;
}

export class TranskribusApiError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = 'TranskribusApiError'; }
}

const jobsPath = '/modules/critical-text-edition/transkribus/jobs';

async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem('omi_native_session_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${getStudioApiBaseUrl()}/api${path}`, {
    method, headers, credentials: 'include', cache: 'no-store', signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    throw new TranskribusApiError(payload?.error?.code ?? 'TRANSKRIBUS_UNAVAILABLE');
  }
  return response;
}

export function isTranskribusJob(value: unknown): value is TranskribusJob {
  if (!value || typeof value !== 'object') return false;
  const job = value as TranskribusJob;
  return Number.isSafeInteger(job.processId) && job.processId > 0 &&
    ['CREATED', 'WAITING', 'RUNNING', 'FINISHED', 'FAILED', 'CANCELLED'].includes(job.status) &&
    typeof job.text === 'string' && job.text.length <= 1_000_000 &&
    typeof job.handle === 'string' && new RegExp(`^${job.processId}\\.[A-Za-z0-9_-]{43}$`).test(job.handle);
}

async function readJob(response: Response): Promise<TranskribusJob> {
  const job: unknown = await response.json();
  if (!isTranskribusJob(job)) throw new TranskribusApiError('TRANSKRIBUS_INVALID_RESPONSE');
  return job;
}

export async function getTranskribusConnection(signal?: AbortSignal): Promise<TranskribusConnection> {
  return (await request('/integrations/transkribus/connection', 'GET', undefined, signal)).json();
}

export async function connectTranskribus(username: string, password: string, signal?: AbortSignal): Promise<TranskribusConnection> {
  return (await request('/integrations/transkribus/connection', 'POST', { username, password }, signal)).json();
}

export async function disconnectTranskribus(signal?: AbortSignal): Promise<void> {
  await request('/integrations/transkribus/connection', 'DELETE', undefined, signal);
}

export async function submitTranskribusJob(workspaceId: string, modelId: number, imageBase64: string, signal?: AbortSignal): Promise<TranskribusJob> {
  return readJob(await request(`${jobsPath}?${new URLSearchParams({ workspaceId })}`, 'POST', { modelId, imageBase64, consent: true }, signal));
}

export async function refreshTranskribusJob(workspaceId: string, handle: string, signal?: AbortSignal): Promise<TranskribusJob> {
  return readJob(await request(`${jobsPath}/${encodeURIComponent(handle)}?${new URLSearchParams({ workspaceId })}`, 'GET', undefined, signal));
}

export async function downloadTranskribusPage(workspaceId: string, handle: string, signal?: AbortSignal): Promise<string> {
  return (await request(`${jobsPath}/${encodeURIComponent(handle)}/page?${new URLSearchParams({ workspaceId })}`, 'GET', undefined, signal)).text();
}
