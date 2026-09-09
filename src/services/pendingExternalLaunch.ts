export type PendingExternalLaunchPlatform = 'ojs' | 'omp';

export interface PendingExternalLaunch {
  platform: PendingExternalLaunchPlatform;
  token: string;
  savedAt: number;
}

const STORAGE_KEY = 'omi:pending-external-launch';
const MAX_AGE_MS = 10 * 60_000;
const MAX_TOKEN_LENGTH = 2048;

export function getPendingExternalLaunchFromLocation(): PendingExternalLaunch | null {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const ojsToken = normalizeToken(url.searchParams.get('omiOjsLaunch'));
  if (ojsToken) {
    return { platform: 'ojs', token: ojsToken, savedAt: Date.now() };
  }

  const ompToken = normalizeToken(url.searchParams.get('omiOmpLaunch'));
  if (ompToken) {
    return { platform: 'omp', token: ompToken, savedAt: Date.now() };
  }

  return null;
}

export function rememberPendingExternalLaunchFromLocation(): PendingExternalLaunch | null {
  const launch = getPendingExternalLaunchFromLocation();
  if (!launch || typeof window === 'undefined') return launch;

  try {
    const existing = readStoredLaunch();
    if (
      existing &&
      existing.platform === launch.platform &&
      existing.token === launch.token
    ) {
      return existing;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(launch));
  } catch {
    // The launch remains in the URL when sessionStorage is unavailable.
  }

  return launch;
}

export function restorePendingExternalLaunchToLocation(): PendingExternalLaunch | null {
  if (typeof window === 'undefined') return null;

  const current = getPendingExternalLaunchFromLocation();
  if (current) return current;

  const stored = readStoredLaunch();
  if (!stored) return null;

  const url = new URL(window.location.href);
  url.searchParams.set(
    stored.platform === 'ojs' ? 'omiOjsLaunch' : 'omiOmpLaunch',
    stored.token,
  );
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
  clearPendingExternalLaunchStorage();
  return stored;
}

export function clearPendingExternalLaunchStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage restrictions in privacy-focused browsers.
  }
}

export function clearPendingExternalLaunchStorageIfLocationMatches(): void {
  const current = getPendingExternalLaunchFromLocation();
  if (!current) return;

  const stored = readStoredLaunch();
  if (
    stored &&
    stored.platform === current.platform &&
    stored.token === current.token
  ) {
    clearPendingExternalLaunchStorage();
  }
}

function readStoredLaunch(): PendingExternalLaunch | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingExternalLaunch>;
    const token = normalizeToken(value.token);
    if (
      (value.platform !== 'ojs' && value.platform !== 'omp') ||
      !token ||
      typeof value.savedAt !== 'number' ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt + MAX_AGE_MS <= Date.now()
    ) {
      clearPendingExternalLaunchStorage();
      return null;
    }
    return {
      platform: value.platform,
      token,
      savedAt: value.savedAt,
    };
  } catch {
    clearPendingExternalLaunchStorage();
    return null;
  }
}

function normalizeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  return token;
}
