import { isTauri } from '@tauri-apps/api/core';
import { getStudioApiBaseUrl } from './studioServer';

const API_BASE_URL = getStudioApiBaseUrl();
const NATIVE_SESSION_KEY = 'omi_native_session_token';
const IS_TAURI = isTauri();

export interface PlainDocumentSummary {
  id: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface EuroOfficeLaunch {
  apiScriptUrl: string;
  config: Record<string, unknown> & { token: string };
  expiresAt: string;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
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

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as T & {
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(data?.error?.message || `EuroOffice request failed (HTTP ${response.status}).`);
  }
  if (!data) throw new Error('EuroOffice returned an empty response.');
  return data;
}

export async function euroOfficeEnabled(): Promise<boolean> {
  const response = await apiFetch('/api/eurooffice/status');
  const data = await readJson<{ enabled: boolean }>(response);
  return data.enabled;
}

export async function listPlainDocuments(): Promise<PlainDocumentSummary[]> {
  const response = await apiFetch('/api/eurooffice/documents');
  const data = await readJson<{ documents: PlainDocumentSummary[] }>(response);
  return data.documents;
}

export async function createPlainDocument(title: string): Promise<PlainDocumentSummary> {
  const response = await apiFetch('/api/eurooffice/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await readJson<{ document: PlainDocumentSummary }>(response);
  return data.document;
}

export type EuroOfficeEditorType = 'desktop' | 'mobile';

export async function createEuroOfficeSession(
  documentId: string,
  editorType: EuroOfficeEditorType = 'desktop',
): Promise<EuroOfficeLaunch> {
  const response = await apiFetch(
    `/api/eurooffice/documents/${encodeURIComponent(documentId)}/session?type=${editorType}`,
  );
  return readJson<EuroOfficeLaunch>(response);
}

export function requestPlainDocumentWorkspace(documentId: string | null): void {
  window.dispatchEvent(new CustomEvent('omi-open-plain-document', { detail: { documentId } }));
}
