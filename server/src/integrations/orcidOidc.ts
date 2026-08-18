import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

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
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
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
  const origin = new URL(baseUrl).origin;
  let cached = discoveryCache.get(origin);
  if (!cached) {
    cached = fetchDiscovery(origin);
    discoveryCache.set(origin, cached);
  }
  return cached;
}

async function fetchDiscovery(origin: string): Promise<DiscoveryDocument> {
  const response = await fetch(`${origin}/.well-known/openid-configuration`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`ORCID OpenID discovery failed with HTTP ${response.status}.`);
  }

  const payload = await response.json() as Partial<DiscoveryDocument>;
  const issuer = payload.issuer;
  const jwksUri = payload.jwks_uri;

  if (typeof issuer !== 'string' || issuer.length === 0 || typeof jwksUri !== 'string' || jwksUri.length === 0) {
    throw new Error('ORCID OpenID discovery response is incomplete.');
  }

  const discovery: DiscoveryDocument = {
    issuer,
    jwks_uri: jwksUri,
  };

  if (typeof payload.userinfo_endpoint === 'string' && payload.userinfo_endpoint.length > 0) {
    discovery.userinfo_endpoint = payload.userinfo_endpoint;
  }

  return discovery;
}
