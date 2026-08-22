import { createHash, randomBytes } from 'node:crypto';

import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from 'jose';

import { env } from '../config/env.js';

export type OidcProviderKey = 'google' | 'microsoft' | 'oidc';

export interface OidcProviderConfig {
  key: OidcProviderKey;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  requireVerifiedEmail: boolean;
}

interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
}

export interface OidcTokenResponse {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
}

export interface OidcProfile {
  issuer: string;
  subject: string;
  displayName?: string;
  email?: string;
  emailVerified: boolean;
  claims: JWTPayload;
}

const discoveryCache = new Map<string, Promise<DiscoveryDocument>>();

export function listOidcProviderConfigs(): OidcProviderConfig[] {
  const providers: OidcProviderConfig[] = [];

  if (env.GOOGLE_OIDC_CLIENT_ID && env.GOOGLE_OIDC_CLIENT_SECRET && env.GOOGLE_OIDC_REDIRECT_URI) {
    providers.push({
      key: 'google',
      label: 'Google',
      issuer: 'https://accounts.google.com',
      clientId: env.GOOGLE_OIDC_CLIENT_ID,
      clientSecret: env.GOOGLE_OIDC_CLIENT_SECRET,
      redirectUri: env.GOOGLE_OIDC_REDIRECT_URI,
      requireVerifiedEmail: true,
    });
  }

  if (env.MICROSOFT_OIDC_CLIENT_ID && env.MICROSOFT_OIDC_CLIENT_SECRET && env.MICROSOFT_OIDC_REDIRECT_URI) {
    const tenant = env.MICROSOFT_OIDC_TENANT || 'common';
    providers.push({
      key: 'microsoft',
      label: 'Microsoft',
      issuer: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0`,
      clientId: env.MICROSOFT_OIDC_CLIENT_ID,
      clientSecret: env.MICROSOFT_OIDC_CLIENT_SECRET,
      redirectUri: env.MICROSOFT_OIDC_REDIRECT_URI,
      requireVerifiedEmail: false,
    });
  }

  if (env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_REDIRECT_URI) {
    providers.push({
      key: 'oidc',
      label: env.OIDC_LABEL || 'Institutional sign-in',
      issuer: env.OIDC_ISSUER.replace(/\/$/, ''),
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
      redirectUri: env.OIDC_REDIRECT_URI,
      requireVerifiedEmail: true,
    });
  }

  return providers;
}

export function getOidcProviderConfig(key: string): OidcProviderConfig | undefined {
  return listOidcProviderConfigs().find((provider) => provider.key === key);
}

export async function buildOidcAuthorization(input: {
  provider: OidcProviderConfig;
  state: string;
  nonce: string;
  codeVerifier: string;
}): Promise<string> {
  const discovery = await getDiscovery(input.provider.issuer);
  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set('client_id', input.provider.clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('redirect_uri', input.provider.redirectUri);
  authorizeUrl.searchParams.set('state', input.state);
  authorizeUrl.searchParams.set('nonce', input.nonce);
  authorizeUrl.searchParams.set('code_challenge', sha256Base64Url(input.codeVerifier));
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  return authorizeUrl.toString();
}

export async function exchangeOidcCode(input: {
  provider: OidcProviderConfig;
  code: string;
  codeVerifier: string;
}): Promise<OidcTokenResponse> {
  const discovery = await getDiscovery(input.provider.issuer);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.provider.redirectUri,
    client_id: input.provider.clientId,
    code_verifier: input.codeVerifier,
  });

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const methods = discovery.token_endpoint_auth_methods_supported ?? [];
  if (methods.includes('client_secret_basic') && !methods.includes('client_secret_post')) {
    headers.Authorization = `Basic ${Buffer.from(`${input.provider.clientId}:${input.provider.clientSecret}`).toString('base64')}`;
  } else {
    body.set('client_secret', input.provider.clientSecret);
  }

  const response = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const preview = (await response.text()).slice(0, 300);
    throw new Error(`OIDC token exchange failed with HTTP ${response.status}${preview ? `: ${preview}` : ''}`);
  }
  return await response.json() as OidcTokenResponse;
}

export async function validateOidcToken(input: {
  provider: OidcProviderConfig;
  token: OidcTokenResponse;
  expectedNonceHash: string;
}): Promise<OidcProfile> {
  if (!input.token.id_token) throw new Error('The OpenID provider did not return an ID token.');

  const discovery = await getDiscovery(input.provider.issuer);
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));

  // Microsoft multitenant discovery uses an issuer template containing
  // {tenantid}. Verify signature/audience first, then perform the exact issuer
  // check below using the token's validated tenant claim.
  const usesMicrosoftIssuerTemplate = discovery.issuer.includes('{tenantid}');
  const { payload } = await jwtVerify(input.token.id_token, jwks, {
    audience: input.provider.clientId,
    ...(usesMicrosoftIssuerTemplate ? {} : { issuer: discovery.issuer }),
  });

  validateIssuer(payload, discovery.issuer);
  if (typeof payload.nonce !== 'string' || hash(payload.nonce) !== input.expectedNonceHash) {
    throw new Error('OpenID Connect nonce validation failed.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new Error('OpenID Connect token did not contain a subject.');
  }

  let claims: JWTPayload = payload;
  if (input.token.access_token && discovery.userinfo_endpoint) {
    const userInfo = await fetchUserInfo(discovery.userinfo_endpoint, input.token.access_token).catch(() => null);
    if (userInfo) {
      if (typeof userInfo.sub === 'string' && userInfo.sub !== payload.sub) {
        throw new Error('OpenID Connect UserInfo subject did not match the ID token.');
      }
      claims = { ...payload, ...userInfo, sub: payload.sub };
    }
  }

  const issuer = typeof payload.iss === 'string' ? payload.iss : discovery.issuer;
  const email = claimString(claims.email) ??
    (input.provider.key === 'microsoft' ? claimString(claims.preferred_username) : undefined);
  const emailVerified = claims.email_verified === true ||
    (input.provider.key === 'microsoft' && Boolean(email));
  const displayName = claimString(claims.name) ?? claimString(claims.preferred_username) ?? email;

  return {
    issuer,
    subject: payload.sub,
    ...(displayName ? { displayName } : {}),
    ...(email ? { email: email.trim().toLowerCase() } : {}),
    emailVerified,
    claims,
  };
}

export function createPkceVerifier(): string {
  return randomBytes(48).toString('base64url');
}

export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

async function getDiscovery(issuer: string): Promise<DiscoveryDocument> {
  const normalized = issuer.replace(/\/$/, '');
  let cached = discoveryCache.get(normalized);
  if (!cached) {
    cached = fetchDiscovery(normalized);
    discoveryCache.set(normalized, cached);
  }
  return cached;
}

async function fetchDiscovery(issuer: string): Promise<DiscoveryDocument> {
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`OpenID discovery failed with HTTP ${response.status}.`);

  const payload = await response.json() as Partial<DiscoveryDocument>;
  if (
    typeof payload.issuer !== 'string' || !payload.issuer ||
    typeof payload.authorization_endpoint !== 'string' || !payload.authorization_endpoint ||
    typeof payload.token_endpoint !== 'string' || !payload.token_endpoint ||
    typeof payload.jwks_uri !== 'string' || !payload.jwks_uri
  ) {
    throw new Error('OpenID discovery response is incomplete.');
  }

  return {
    issuer: payload.issuer,
    authorization_endpoint: payload.authorization_endpoint,
    token_endpoint: payload.token_endpoint,
    jwks_uri: payload.jwks_uri,
    ...(typeof payload.userinfo_endpoint === 'string' ? { userinfo_endpoint: payload.userinfo_endpoint } : {}),
    ...(Array.isArray(payload.token_endpoint_auth_methods_supported)
      ? { token_endpoint_auth_methods_supported: payload.token_endpoint_auth_methods_supported }
      : {}),
  };
}

async function fetchUserInfo(endpoint: string, accessToken: string): Promise<JWTPayload> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`OpenID UserInfo request failed with HTTP ${response.status}.`);
  return await response.json() as JWTPayload;
}

function validateIssuer(payload: JWTPayload, expectedIssuer: string): void {
  if (typeof payload.iss !== 'string' || !payload.iss) {
    throw new Error('OpenID Connect token did not contain an issuer.');
  }
  if (!expectedIssuer.includes('{tenantid}')) {
    if (payload.iss !== expectedIssuer) throw new Error('OpenID Connect issuer validation failed.');
    return;
  }

  const tid = claimString(payload.tid);
  if (!tid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tid)) {
    throw new Error('Microsoft OpenID token did not contain a valid tenant ID.');
  }
  const concreteIssuer = expectedIssuer.replace('{tenantid}', tid);
  if (payload.iss !== concreteIssuer) throw new Error('Microsoft OpenID issuer validation failed.');
}

function claimString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
