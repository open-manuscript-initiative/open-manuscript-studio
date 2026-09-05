import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return true;
  }

  const a = octets[0];
  const b = octets[1];
  if (a === undefined || b === undefined) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  );
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

function isDevelopmentLocalhost(url: URL): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1')
  );
}

function isExplicitTestHost(url: URL): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  const allowed = (process.env.INTEGRATION_TEST_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(url.hostname.toLowerCase());
}

function normalizedBasePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function canonicalizePathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return '';

      let decoded: string;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        throw new Error('Integration API URL contains invalid path encoding.');
      }

      if (decoded === '.' || decoded === '..') {
        throw new Error('Integration API URL must not contain path traversal segments.');
      }

      // encodeURIComponent is intentionally the final transformation of every
      // request-controlled path segment. It prevents a segment from changing
      // the trusted scheme/host/path structure used by the server-side fetch.
      return encodeURIComponent(decoded);
    })
    .join('/');
}

async function assertPublicHost(url: URL): Promise<void> {
  if (isDevelopmentLocalhost(url) || isExplicitTestHost(url)) return;

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Integration URL resolves to a private or reserved network address.');
  }
}

/**
 * Validate a launch-provided integration API URL against the installation URL
 * stored by the Studio administrator. The returned URL is rebuilt from the
 * trusted installation origin and a canonicalized path so request-controlled
 * input cannot replace the scheme, host, credentials, port, or path structure
 * used by server-side fetches.
 */
export async function assertTrustedIntegrationUrl(
  rawUrl: string,
  installationBaseUrl: string,
): Promise<URL> {
  let candidate: URL;
  let installation: URL;

  try {
    candidate = new URL(rawUrl);
    installation = new URL(installationBaseUrl);
  } catch {
    throw new Error('Integration API URL is invalid.');
  }

  if (
    candidate.username ||
    candidate.password ||
    installation.username ||
    installation.password
  ) {
    throw new Error('Integration URLs must not contain embedded credentials.');
  }

  const allowDevelopmentHttp =
    (
      isDevelopmentLocalhost(candidate) &&
      isDevelopmentLocalhost(installation)
    ) || (
      isExplicitTestHost(candidate) &&
      isExplicitTestHost(installation)
    );

  if (
    candidate.protocol !== installation.protocol ||
    (candidate.protocol !== 'https:' && !allowDevelopmentHttp)
  ) {
    throw new Error('Integration API URL must use the trusted HTTPS installation origin.');
  }

  if (candidate.origin !== installation.origin) {
    throw new Error('Integration API URL origin does not match the registered installation.');
  }

  const basePath = normalizedBasePath(installation.pathname);
  if (
    basePath !== '/' &&
    candidate.pathname !== basePath &&
    !candidate.pathname.startsWith(`${basePath}/`)
  ) {
    throw new Error('Integration API URL is outside the registered installation path.');
  }

  if (candidate.search) {
    throw new Error('Integration API base URL must not contain a query string.');
  }

  if (candidate.hash) {
    throw new Error('Integration API URL must not contain a fragment.');
  }

  await assertPublicHost(installation);
  await assertPublicHost(candidate);

  const trusted = new URL(installation.origin);
  trusted.pathname = canonicalizePathname(candidate.pathname);
  return trusted;
}
