import { getStudioApiBaseUrl } from './studioServer';
import { isTauri } from '@tauri-apps/api/core';

const NATIVE_SESSION_KEY = 'omi_native_session_token';

export interface VivliostylePdfRenderResult {
  blob: Blob;
  renderer: string;
  rendererVersion: string;
}

export async function renderPdfArtifact(
  html: string,
  fileName: string,
): Promise<VivliostylePdfRenderResult> {
  const native = isTauri();
  const apiBase = getStudioApiBaseUrl();
  const headers = new Headers({
    Accept: 'application/pdf',
    'Content-Type': 'application/json',
  });

  if (native) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}/api/publication/render/pdf`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ html, fileName }),
  });

  if (!response.ok) {
    throw await pdfRenderError(response);
  }

  return {
    blob: await response.blob(),
    renderer: response.headers.get('x-omi-pdf-renderer') ?? 'vivliostyle-cli',
    rendererVersion:
      response.headers.get('x-omi-pdf-renderer-version') ?? 'unknown',
  };
}

async function pdfRenderError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as {
      error?: { message?: string };
    };
    if (payload.error?.message) return new Error(payload.error.message);
  } catch {
    // Use the stable fallback below.
  }
  return new Error(`PDF rendering failed with HTTP ${response.status}.`);
}


/** Copy physical pages of an already rendered issue; never re-render the study. */
export async function sliceRenderedIssuePdf(
  pdf: Blob, firstPage: number, lastPage: number,
): Promise<Blob> {
  if (!Number.isSafeInteger(firstPage) || !Number.isSafeInteger(lastPage) ||
      firstPage < 1 || lastPage < firstPage || lastPage > 2000 ||
      !pdf.size || pdf.size > 96 * 1024 * 1024) throw new Error('Invalid rendered issue or physical page range.');
  const headers = new Headers({ Accept: 'application/pdf', 'Content-Type': 'application/pdf' });
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const query = new URLSearchParams({ firstPage: String(firstPage), lastPage: String(lastPage) });
  const response = await fetch(`${getStudioApiBaseUrl()}/api/publication/slice/pdf?${query}`, {
    method: 'POST', credentials: 'include', cache: 'no-store', headers, body: pdf,
  });
  if (!response.ok) throw await pdfRenderError(response);
  const artifact = await response.blob();
  if (artifact.type.split(';')[0] !== 'application/pdf' || await artifact.slice(0, 5).text() !== '%PDF-') {
    throw new Error('The extraction service returned an invalid PDF.');
  }
  return artifact;
}
