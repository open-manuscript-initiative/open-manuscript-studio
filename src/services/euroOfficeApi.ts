import { studioApiFetch as apiFetch } from '../platform/studioApiTransport';
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
  const response = await apiFetch('/api/v1/eurooffice/status');
  const data = await readJson<{ enabled: boolean }>(response);
  return data.enabled;
}

export async function listPlainDocuments(): Promise<PlainDocumentSummary[]> {
  const response = await apiFetch('/api/v1/eurooffice/documents');
  const data = await readJson<{ documents: PlainDocumentSummary[] }>(response);
  return data.documents;
}

export async function createPlainDocument(title: string): Promise<PlainDocumentSummary> {
  const response = await apiFetch('/api/v1/eurooffice/documents', {
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
  // A hung session request previously left native Android on an unbounded
  // loading overlay. Keep this timeout separate from DocsAPI readiness.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await apiFetch(
      `/api/v1/eurooffice/documents/${encodeURIComponent(documentId)}/session?type=${editorType}`,
      { signal: controller.signal },
    );
    return await readJson<EuroOfficeLaunch>(response);
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error('EuroOffice session request timed out.');
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export function requestPlainDocumentWorkspace(documentId: string | null): void {
  window.dispatchEvent(new CustomEvent('omi-open-plain-document', { detail: { documentId } }));
}

export interface EuroOfficeSaveSummary { id: string; status: number; applied: boolean; contentHash: string; createdAt: string }
export async function listEuroOfficeSaves(documentId: string): Promise<EuroOfficeSaveSummary[]> {
  const data = await readJson<{ saves: EuroOfficeSaveSummary[] }>(await apiFetch(`/api/v1/eurooffice/documents/${encodeURIComponent(documentId)}/saves`));
  return data.saves;
}
export async function downloadEuroOfficeSave(documentId: string, saveId: string): Promise<Blob> {
  const response = await apiFetch(`/api/v1/eurooffice/documents/${encodeURIComponent(documentId)}/saves/${encodeURIComponent(saveId)}`);
  if (!response.ok) throw new Error('Recovery download failed.');
  return response.blob();
}
