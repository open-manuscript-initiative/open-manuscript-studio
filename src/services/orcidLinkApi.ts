const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';
const NATIVE_MOBILE_RETURN_URL = 'https://app.openmanuscript.org/auth/orcid';

export async function startOrcidIdentityLink(): Promise<void> {
  const native = isNativeRuntime();
  const mobile = native && /Android|iPhone|iPad|iPod/i.test(globalThis.navigator?.userAgent ?? '');
  const token = native ? globalThis.localStorage?.getItem(NATIVE_SESSION_KEY) : null;
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  if (native) {
    headers.set('X-OMI-Native-Client', '1');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const returnOrigin = mobile
    ? NATIVE_MOBILE_RETURN_URL
    : native
      ? getDesktopNativeReturnOrigin()
      : undefined;
  const baseUrl = native && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '';
  const response = await fetch(`${baseUrl}/api/auth/orcid/link/start`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(returnOrigin ? { returnOrigin } : {}),
  });
  const payload = await response.json().catch(() => null) as
    | { url?: string; error?: { message?: string } }
    | null;
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error?.message || `ORCID linking failed with HTTP ${response.status}.`);
  }

  if (native) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    if (mobile) {
      try {
        await openUrl(payload.url, 'inAppBrowser');
        return;
      } catch {
        // Fall back to the system browser when an in-app browser is unavailable.
      }
    }
    await openUrl(payload.url);
    return;
  }

  globalThis.location?.assign(payload.url);
}

function isNativeRuntime(): boolean {
  const location = globalThis.location;
  if (!location) return false;
  return location.protocol === 'tauri:' || location.hostname === 'tauri.localhost';
}

function getDesktopNativeReturnOrigin(): string | undefined {
  const location = globalThis.location;
  if (!location) return undefined;
  if (location.hostname === 'tauri.localhost') return `${location.protocol}//${location.host}`;
  if (location.protocol === 'tauri:') return 'tauri://localhost';
  return undefined;
}
