import { getStudioIntegrationApiBaseUrl, NATIVE_SESSION_STORAGE_KEY, isNativeStudioRuntime } from './studioServer';

const API_BASE_URL = getStudioIntegrationApiBaseUrl();

export interface OfficeDocumentSummary {
  id: string;
  title: string;
  fileName: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeEditorConfig {
  documentServerUrl: string;
  apiScriptUrl: string;
  config: Record<string, unknown>;
  author: { name: string; email: string };
}

export async function getOfficeDocumentStatus(): Promise<{ enabled: boolean; documentServerUrl: string | null }> {
  return officeRequest('/office-documents/status');
}

export async function listOfficeDocuments(): Promise<OfficeDocumentSummary[]> {
  const result = await officeRequest<{ documents: OfficeDocumentSummary[] }>('/office-documents');
  return result.documents;
}

export async function createOfficeDocument(input: {
  title: string;
  fileName: string;
  file: Blob;
  authorName: string;
  authorEmail: string;
}): Promise<OfficeDocumentSummary> {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const contentBase64 = bytesToBase64(bytes);
  const result = await officeRequest<{ document: OfficeDocumentSummary }>('/office-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      fileName: input.fileName,
      contentBase64,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
    }),
  });
  return result.document;
}

export async function uploadOfficeDocument(input: {
  title: string;
  file: File;
  authorName: string;
  authorEmail: string;
}): Promise<OfficeDocumentSummary> {
  return createOfficeDocument({ ...input, fileName: input.file.name, file: input.file });
}

export async function getOfficeEditorConfig(documentId: string, locale: string): Promise<OfficeEditorConfig> {
  return officeRequest(`/office-documents/${encodeURIComponent(documentId)}/editor-config?lang=${encodeURIComponent(locale)}`);
}

export async function deleteOfficeDocument(documentId: string): Promise<void> {
  await officeRequest(`/office-documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
}

async function officeRequest<T = { enabled: boolean; documentServerUrl: string | null }>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (isNativeStudioRuntime()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_STORAGE_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers,
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as (T & { error?: { message?: string } }) | null;
  if (!response.ok || payload === null) {
    throw new Error(payload?.error?.message ?? `Office document request failed with HTTP ${response.status}.`);
  }
  return payload;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
