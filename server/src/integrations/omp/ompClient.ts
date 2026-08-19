import type { OmpLaunchClaims } from './launchVerifier.js';

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
  return `${baseUrl.replace(/\/+$/, '')}/${operation}`;
}

async function readJson<T>(
  url: string,
  payload: string,
  signature: string,
): Promise<T> {
  const target = new URL(url);
  target.searchParams.set('payload', payload);
  target.searchParams.set('signature', signature);

  const response = await fetch(target, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });

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

  const metadataPromise = scopes.has('metadata.read')
    ? readJson<OmpMetadataResponse>(endpoint(apiBaseUrl, 'metadata'), payload, signature)
    : Promise.resolve<OmpMetadataResponse>({});
  const contributorsPromise = scopes.has('contributors.read')
    ? readJson<OmpContributorsResponse>(endpoint(apiBaseUrl, 'contributors'), payload, signature)
    : Promise.resolve<OmpContributorsResponse>({});
  const filesPromise = scopes.has('files.read')
    ? readJson<OmpFilesResponse>(endpoint(apiBaseUrl, 'files'), payload, signature)
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
