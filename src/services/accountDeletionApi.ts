import { isTauri } from '@tauri-apps/api/core';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export async function deleteCurrentAccount(
  confirmationEmail: string,
): Promise<void> {
  const native = isTauri();
  const apiBase = native && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '';
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  if (native) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}/api/account`, {
    method: 'DELETE',
    credentials: 'include',
    headers,
    body: JSON.stringify({ confirmationEmail }),
  });

  if (!response.ok && response.status !== 204) {
    throw await createDeletionError(response);
  }

  globalThis.localStorage?.removeItem(NATIVE_SESSION_KEY);
}

async function createDeletionError(response: Response): Promise<Error> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json() as {
        error?: { message?: string };
      };
      if (payload.error?.message) return new Error(payload.error.message);
    } catch {
      // Fall back to the HTTP status below.
    }
  }
  return new Error(`Account deletion failed with HTTP ${response.status}.`);
}
