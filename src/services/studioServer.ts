import {
  clearNativeServerOverride,
  isNativeStudioRuntime,
  persistNativeServerSelection,
  readNativeServerSelection,
} from '../platform/nativeServerSelection';
export { isNativeStudioRuntime, NATIVE_SESSION_STORAGE_KEY } from '../platform/nativeServerSelection';
import { normalizeIntegrationApiBaseUrl } from './integrationApiBaseUrl';

export const DEFAULT_STUDIO_API_ORIGIN = 'https://studio.openmanuscript.org';
/** Return the selected native endpoint, or the build default for this platform. */
export function getNativeStudioServerOrigin(): string {
  if (isNativeStudioRuntime()) {
    const saved = readSavedNativeStudioServerOrigin();
    if (saved) return saved;
  }

  const configured = normalizeConfiguredOrigin(import.meta.env?.VITE_API_BASE_URL);
  if (configured) return configured;
  return import.meta.env?.DEV ? '' : DEFAULT_STUDIO_API_ORIGIN;
}

/** Root URL for Studio API routes. Web builds keep their existing Vite configuration. */
export function getStudioApiBaseUrl(): string {
  if (isNativeStudioRuntime()) return getNativeStudioServerOrigin();
  return normalizeConfiguredOrigin(import.meta.env?.VITE_API_BASE_URL);
}

/** Base URL for integration routes, which are mounted under /api on native clients. */
export function getStudioIntegrationApiBaseUrl(): string {
  if (isNativeStudioRuntime()) {
    const root = getNativeStudioServerOrigin();
    return root ? `${root}/api` : normalizeConfiguredOrigin(import.meta.env?.VITE_API_BASE_URL) || '/api';
  }
  return normalizeIntegrationApiBaseUrl(
    import.meta.env?.VITE_API_BASE_URL ?? '/api',
  );
}

export function getSavedNativeStudioServerOrigin(): string | null {
  return readSavedNativeStudioServerOrigin();
}

export function normalizeNativeStudioServerOrigin(value: string): string {
  const input = value.trim();
  if (!input) throw new Error('Enter a server address.');

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Enter a complete URL, for example https://studio.example.org.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('The server address must not contain a username or password.');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname))) {
    throw new Error('Use HTTPS for server addresses. HTTP is allowed only for localhost testing.');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Enter the server origin only, without a path, query, or fragment.');
  }
  if (!parsed.hostname) throw new Error('Enter a server hostname.');

  return parsed.origin;
}

/**
 * Save a selected API origin. Switching origins clears the native bearer token
 * before the caller reloads the app, so credentials cannot be sent to another server.
 */
export function saveNativeStudioServerOrigin(value: string | null): boolean {
  if (!isNativeStudioRuntime()) {
    throw new Error('Server selection is available in the native Studio app.');
  }

  const next = value === null
    ? null
    : normalizeNativeStudioServerOrigin(value);
  const current = getNativeStudioServerOrigin();
  const resolvedNext = next ?? configuredOrDefaultOrigin();
  if (current === resolvedNext) {
    if (next === null) {
      clearNativeServerOverride();
    }
    return false;
  }

  persistNativeServerSelection(next);
  return true;
}

function readSavedNativeStudioServerOrigin(): string | null {
  try {
    const value = readNativeServerSelection()?.trim();
    return value ? normalizeNativeStudioServerOrigin(value) : null;
  } catch {
    return null;
  }
}

function configuredOrDefaultOrigin(): string {
  return normalizeConfiguredOrigin(import.meta.env?.VITE_API_BASE_URL)
    || (import.meta.env?.DEV ? '' : DEFAULT_STUDIO_API_ORIGIN);
}

function normalizeConfiguredOrigin(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}


function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '::1' || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host);
}
