import { isTauri } from '@tauri-apps/api/core';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

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
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  const apiBase = configured
    ? configured.replace(/\/+$/, '')
    : native && !import.meta.env.DEV
      ? NATIVE_API_BASE_URL
      : '';
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
