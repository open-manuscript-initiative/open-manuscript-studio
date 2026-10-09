import { getStudioApiBaseUrl } from './studioServer';
import { isTauri } from '@tauri-apps/api/core';

const NATIVE_SESSION_KEY = 'omi_native_session_token';

export interface JatsSchemaDiagnostic {
  code: 'dtd-validity-error' | 'unsafe-xml' | 'invalid-request';
  severity: 'error';
  message: string;
  line?: number;
}

export interface JatsSchemaValidationResult {
  standard: 'NISO JATS';
  version: '1.4';
  tagSet: 'articleauthoring';
  schema: 'DTD';
  schemaVariant: 'MathML3';
  schemaPackage: string;
  engine: string;
  valid: boolean;
  diagnostics: JatsSchemaDiagnostic[];
}

export async function validateJatsSchema(
  xml: string,
): Promise<JatsSchemaValidationResult> {
  const native = isTauri();
  const apiBase = getStudioApiBaseUrl();
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  if (native) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}/api/publication/validate/jats`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ xml }),
  });

  if (!response.ok) {
    throw await validationError(response);
  }

  return await response.json() as JatsSchemaValidationResult;
}

async function validationError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as {
      error?: { message?: string };
    };
    if (payload.error?.message) return new Error(payload.error.message);
  } catch {
    // Use the stable fallback below.
  }
  return new Error(`JATS validation failed with HTTP ${response.status}.`);
}
