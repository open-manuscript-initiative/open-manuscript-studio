import { jwtVerify, type JWTPayload } from 'jose';
import {
  assertOidcIssuerBinding,
  assertOidcRemoteUrl,
  createPinnedRemoteJWKSet,
  fetchOidcDiscovery,
} from './security/oidcMetadataHttp.js';

export interface OrcidOidcTokenResponse {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  name?: string;
  orcid?: string;
  id_token?: string;
}

interface DiscoveryDocument {
  issuer: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

const discoveryCache = new Map<string, Promise<DiscoveryDocument>>();

export async function validateOrcidIdToken(input: {
  baseUrl: string;
  clientId: string;
  idToken: string;
  expectedNonceHash: string;
  hash: (value: string) => string;
}): Promise<JWTPayload> {
  const discovery = await getDiscovery(input.baseUrl);
  const jwks = createPinnedRemoteJWKSet(discovery.jwks_uri);
  const { payload } = await jwtVerify(input.idToken, jwks, {
    issuer: discovery.issuer,
    audience: input.clientId,
  });

  if (typeof payload.nonce !== 'string' || input.hash(payload.nonce) !== input.expectedNonceHash) {
    throw new Error('ORCID OpenID Connect nonce validation failed.');
  }

  if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    throw new Error('ORCID OpenID Connect token did not contain a subject.');
  }

  return payload;
}

async function getDiscovery(baseUrl: string): Promise<DiscoveryDocument> {
  const origin = assertOidcRemoteUrl(baseUrl, 'ORCID issuer').origin;
  let cached = discoveryCache.get(origin);
  if (!cached) {
    cached = fetchDiscovery(origin).catch((error: unknown) => {
      discoveryCache.delete(origin);
      throw error;
    });
    discoveryCache.set(origin, cached);
  }
  return cached;
}

async function fetchDiscovery(origin: string): Promise<DiscoveryDocument> {
  const payload = await fetchOidcDiscovery(origin);
  const issuer = payload.issuer;
  const jwksUri = payload.jwks_uri;

  if (typeof issuer !== 'string' || !issuer || typeof jwksUri !== 'string' || !jwksUri) {
    throw new Error('ORCID OpenID discovery response is incomplete.');
  }
  assertOidcIssuerBinding(origin, issuer);
  assertOidcRemoteUrl(jwksUri, 'ORCID JWKS endpoint');

  const discovery: DiscoveryDocument = { issuer, jwks_uri: jwksUri };
  if (typeof payload.userinfo_endpoint === 'string' && payload.userinfo_endpoint) {
    assertOidcRemoteUrl(payload.userinfo_endpoint, 'ORCID UserInfo endpoint');
    discovery.userinfo_endpoint = payload.userinfo_endpoint;
  }
  return discovery;
}
