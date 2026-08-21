import type { OmpLaunchClaims } from './launchVerifier.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';

interface OmpMetadataResponse {
  protocol?: string;
  profile?: string;
  submission?: Record<string, unknown>;
}

interface OmpContributorsResponse {
  contributors?: Array<Record<string, unknown>>;
}

interface OmpFilesResponse {
  files?: Array<Record<string, unknown>>;
}

export interface OmpLaunchData {
  submission: Record<string, unknown> | null;
  contributors: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
}

function endpoint(baseUrl: string, operation: string): string {
  let normalized = baseUrl;
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return `${normalized}/${operation}`;
}

function isRedirect(status: number): boolean {
  return status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308;
}

async function fetchWithSameOriginRedirects(
  initialUrl: URL,
  payload: string,
  signature: string,
): Promise<Response> {
  const trustedOrigin = initialUrl.origin;
  const visited = new Set<string>();
  let currentUrl = new URL(initialUrl.toString());

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    currentUrl.searchParams.set('payload', payload);
    currentUrl.searchParams.set('signature', signature);

    const currentKey = currentUrl.toString();
    if (visited.has(currentKey)) {
      throw new Error('OMP request entered a redirect loop.');
    }
    visited.add(currentKey);

    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });

    if (!isRedirect(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`OMP endpoint returned HTTP ${response.status} without a Location header.`);
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.origin !== trustedOrigin) {
      throw new Error('OMP endpoint attempted a cross-origin redirect.');
    }
    currentUrl = nextUrl;
  }

  throw new Error('OMP endpoint exceeded the allowed redirect count.');
}

async function readJson<T>(
  url: string,
  payload: string,
  signature: string,
): Promise<T> {
  const target = new URL(url);
  const response = await fetchWithSameOriginRedirects(target, payload, signature);

  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: { message?: string }; message?: string }
      | null;
    throw new Error(
      body?.error?.message ||
      body?.message ||
      `OMP request failed with HTTP ${response.status}.`,
    );
  }

  return await response.json() as T;
}

export async function loadOmpLaunchData(
  claims: OmpLaunchClaims,
  payload: string,
  signature: string,
): Promise<OmpLaunchData> {
  const scopes = new Set(claims.scope ?? []);
  const apiBaseUrl = claims.apiBaseUrl?.trim();

  if (!apiBaseUrl) {
    return {
      submission: claims.submission
        ? { ...claims.submission }
        : null,
      contributors: [],
      files: [],
    };
  }

  const externalBaseUrl = claims.externalBaseUrl?.trim();
  if (!externalBaseUrl) {
    throw new Error('The OMP launch assertion does not include externalBaseUrl.');
  }

  const trustedApiBaseUrl = await assertTrustedIntegrationUrl(
    apiBaseUrl,
    externalBaseUrl,
  );
  const trustedApiBaseUrlString = trustedApiBaseUrl.toString().replace(/\/$/, '');

  const metadataPromise = scopes.has('metadata.read')
    ? readJson<OmpMetadataResponse>(endpoint(trustedApiBaseUrlString, 'metadata'), payload, signature)
    : Promise.resolve<OmpMetadataResponse>({});
  const contributorsPromise = scopes.has('contributors.read')
    ? readJson<OmpContributorsResponse>(endpoint(trustedApiBaseUrlString, 'contributors'), payload, signature)
    : Promise.resolve<OmpContributorsResponse>({});
  const filesPromise = scopes.has('files.read')
    ? readJson<OmpFilesResponse>(endpoint(trustedApiBaseUrlString, 'files'), payload, signature)
    : Promise.resolve<OmpFilesResponse>({});

  const [metadata, contributors, files] = await Promise.all([
    metadataPromise,
    contributorsPromise,
    filesPromise,
  ]);

  if (
    metadata.protocol && metadata.protocol !== 'omi-integration/1' ||
    metadata.profile && metadata.profile !== 'omi-integration/1/omp'
  ) {
    throw new Error('OMP metadata endpoint returned an incompatible integration profile.');
  }

  return {
    submission: metadata.submission ?? (claims.submission ? { ...claims.submission } : null),
    contributors: contributors.contributors ?? [],
    files: files.files ?? [],
  };
}