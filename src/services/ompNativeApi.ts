import { buildDocxExport } from './exportDocx';
import type { OmiManuscript } from '../types/omi';

interface ErrorResponse {
  error?: { message?: string };
}

export async function sendAuthorRevisionToOmp(
  contextId: string,
  manuscript: OmiManuscript,
  summaryOfChanges?: string,
): Promise<{ written: boolean; file?: Record<string, unknown> }> {
  const exported = buildDocxExport(manuscript);
  const response = await fetch(
    `/integrations/omp/native/author/${encodeURIComponent(contextId)}/revision`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: exported.fileName,
        mediaType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        contentBase64: bytesToBase64(exported.bytes),
        ...(summaryOfChanges?.trim()
          ? { summaryOfChanges: summaryOfChanges.trim() }
          : {}),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null) as ErrorResponse | null;
    throw new Error(
      body?.error?.message ||
        `OMP author revision upload failed with HTTP ${response.status}.`,
    );
  }

  return await response.json() as {
    written: boolean;
    file?: Record<string, unknown>;
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
