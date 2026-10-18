import { isNativeStudioRuntime, NATIVE_SESSION_STORAGE_KEY } from './nativeServerSelection';
import { getStudioApiBaseUrl } from '../services/studioServer';

/** Shared web/native transport; resolve selected origin and credentials for each call. */
export function studioApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');
  if (isNativeStudioRuntime()) {
    headers.set('X-OMI-Native-Client', '1');
    // A storage failure aborts rather than reusing a cached cross-origin credential.
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_STORAGE_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${getStudioApiBaseUrl()}${path}`, { ...init, headers, credentials: 'include', cache: 'no-store' });
}
