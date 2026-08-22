const NONCE_PREFIX = 'oidc-nonce:';
const NATIVE_RETURN_PREFIX = 'native-return:';

const ALLOWED_NATIVE_RETURN_ORIGINS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'openmanuscript://auth',
  'https://app.openmanuscript.org/auth/orcid',
]);

export interface OrcidStateReturnMetadata {
  expectedNonceHash: string;
  nativeReturnOrigin?: string;
}

export function normalizeNativeReturnOrigin(
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim().replace(/\/$/, '');
  if (!normalized || !ALLOWED_NATIVE_RETURN_ORIGINS.has(normalized)) {
    return undefined;
  }
  return normalized;
}

export function encodeOrcidStateReturnPath(
  expectedNonceHash: string,
  nativeReturnOrigin?: string,
): string {
  const base = `${NONCE_PREFIX}${expectedNonceHash}`;
  const normalizedOrigin = normalizeNativeReturnOrigin(nativeReturnOrigin);
  if (!normalizedOrigin) return base;

  return `${base}|${NATIVE_RETURN_PREFIX}${encodeURIComponent(normalizedOrigin)}`;
}

export function decodeOrcidStateReturnPath(
  value: string | null | undefined,
): OrcidStateReturnMetadata {
  if (!value?.startsWith(NONCE_PREFIX)) {
    return { expectedNonceHash: '' };
  }

  const [noncePart = '', ...metadata] = value.split('|');
  const expectedNonceHash = noncePart.slice(NONCE_PREFIX.length);
  if (!/^[0-9a-f]{64}$/i.test(expectedNonceHash)) {
    return { expectedNonceHash: '' };
  }

  const nativePart = metadata.find((part) => part.startsWith(NATIVE_RETURN_PREFIX));
  if (!nativePart) return { expectedNonceHash };

  try {
    const decoded = decodeURIComponent(nativePart.slice(NATIVE_RETURN_PREFIX.length));
    const nativeReturnOrigin = normalizeNativeReturnOrigin(decoded);
    return nativeReturnOrigin
      ? { expectedNonceHash, nativeReturnOrigin }
      : { expectedNonceHash };
  } catch {
    return { expectedNonceHash };
  }
}

export function buildNativeAuthReturnUrl(
  nativeReturnOrigin: string,
  input: { handoffCode?: string; errorCode?: string },
): string {
  const normalizedOrigin = normalizeNativeReturnOrigin(nativeReturnOrigin);
  if (!normalizedOrigin) {
    throw new Error('Unsupported native authentication return origin.');
  }

  const url = new URL(`${normalizedOrigin}/`);
  const fragment = new URLSearchParams();
  if (input.handoffCode) fragment.set('nativeAuthCode', input.handoffCode);
  if (input.errorCode) fragment.set('authError', input.errorCode);
  url.hash = fragment.toString();
  return url.toString();
}
