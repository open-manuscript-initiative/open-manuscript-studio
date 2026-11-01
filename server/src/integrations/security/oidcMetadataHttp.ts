import { isIP } from 'node:net';

import { createRemoteJWKSet, customFetch } from 'jose';

import { fetchPinnedPublicUrl } from '../../cloud/security/connectionPinnedHttp.js';
import { isPublicRoutableAddress } from '../../cloud/security/publicAddress.js';

const DISCOVERY_LIMIT = 64 * 1024;
const JWKS_LIMIT = 512 * 1024;
const USERINFO_LIMIT = 128 * 1024;

/**
 * Validate every URI obtained from an identity provider's discovery metadata.
 * The actual socket is separately checked and DNS-pinned by fetchPinnedPublicUrl,
 * including when the endpoint resolves to a private address after discovery.
 */
export function assertOidcRemoteUrl(raw: string, purpose = 'OIDC endpoint'): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${purpose} is not a valid URL.`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const localDevelopment = process.env.NODE_ENV !== 'production' &&
    (host === 'localhost' || host === '127.0.0.1' || host === '::1');
  if (
    (url.protocol !== 'https:' && !(localDevelopment && url.protocol === 'http:')) ||
    url.username || url.password || url.hash
  ) {
    throw new Error(`${purpose} must use HTTPS without credentials or fragments.`);
  }

  if (isIP(host) && !localDevelopment && !isPublicRoutableAddress(host)) {
    throw new Error(`${purpose} must not target a private or reserved IP address.`);
  }
  return url;
}

/**
 * Bind metadata to the configured issuer. Microsoft multitenant endpoints
 * publish a documented {tenantid} template; only that exact template is
 * permitted, and callers then discover the validated concrete tenant issuer.
 */
export function assertOidcIssuerBinding(configured: string, reported: string): void {
  const expected = assertOidcRemoteUrl(configured, 'Configured OIDC issuer').toString().replace(/\/$/, '');
  if (reported === expected) return;
  const msMultiTenant = /^https:\/\/login\.microsoftonline\.com\/(common|organizations|consumers)\/v2\.0$/i.test(expected);
  if (msMultiTenant && reported === 'https://login.microsoftonline.com/{tenantid}/v2.0') return;
  throw new Error('OIDC discovery issuer does not match the configured issuer.');
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) {
    await response.body?.cancel();
    throw new Error('OIDC provider response exceeds the permitted size.');
  }
  if (!response.body) throw new Error('OIDC provider returned an empty response.');
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('OIDC provider response exceeds the permitted size.');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((part) => Buffer.from(part))).toString('utf8');
}

export async function readOidcJson<T>(
  response: Response,
  maxBytes = DISCOVERY_LIMIT,
): Promise<T> {
  const text = await readBoundedText(response, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('OIDC provider returned invalid JSON.');
  }
}

export async function fetchOidcDiscovery(issuer: string): Promise<Record<string, unknown>> {
  const base = assertOidcRemoteUrl(issuer, 'Configured OIDC issuer');
  const endpoint = assertOidcRemoteUrl(
    `${base.toString().replace(/\/$/, '')}/.well-known/openid-configuration`,
    'OIDC discovery endpoint',
  );
  const response = await fetchPinnedPublicUrl(endpoint, {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`OIDC discovery failed with HTTP ${response.status}.`);
  }
  return readOidcJson<Record<string, unknown>>(response);
}

export async function fetchOidcUserInfo(
  endpoint: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const response = await fetchPinnedPublicUrl(
    assertOidcRemoteUrl(endpoint, 'OIDC UserInfo endpoint'),
    {
      method: 'GET',
      redirect: 'error',
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`OIDC UserInfo request failed with HTTP ${response.status}.`);
  }
  return readOidcJson<Record<string, unknown>>(response, USERINFO_LIMIT);
}

/**
 * jose 6's customFetch preserves key caching/rotation while forcing the
 * actual JWKS network request through our DNS-pinned, no-redirect client.
 */
export function createPinnedRemoteJWKSet(jwksUri: string) {
  const url = assertOidcRemoteUrl(jwksUri, 'OIDC JWKS endpoint');
  return createRemoteJWKSet(url, {
    [customFetch]: async (requestedUrl, options) => {
      const response = await fetchPinnedPublicUrl(
        assertOidcRemoteUrl(requestedUrl, 'OIDC JWKS endpoint'),
        { ...options, redirect: 'error' },
      );
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error(`OIDC JWKS request failed with HTTP ${response.status}.`);
      }
      const json = await readBoundedText(response, JWKS_LIMIT);
      return new Response(json, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
}
