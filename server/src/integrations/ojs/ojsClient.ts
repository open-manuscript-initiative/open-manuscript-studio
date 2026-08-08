import type { LaunchClaims } from './launchVerifier.js';

export interface OjsLaunchData {
  submission: unknown;
  contributors: unknown[];
  files: unknown[];
}

function requireScope(
  claims: LaunchClaims,
  scope: string,
): void {
  if (!claims.scope?.includes(scope)) {
    throw new Error(
      `The launch assertion does not grant ${scope}.`,
    );
  }
}

function apiUrl(
  claims: LaunchClaims,
  operation: string,
  payload: string,
  signature: string,
): URL {
  if (!claims.apiBaseUrl) {
    throw new Error(
      'The OJS launch assertion does not include apiBaseUrl.',
    );
  }

  const url = new URL(
    `${claims.apiBaseUrl.replace(/\/$/, '')}/${operation}`,
  );

  url.searchParams.set('payload', payload);
  url.searchParams.set('signature', signature);

  return url;
}

async function readJson(
  url: URL,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `OJS returned a non-JSON response (${response.status}).`,
    );
  }

  if (!response.ok) {
    const record =
      data && typeof data === 'object'
        ? (data as Record<string, unknown>)
        : {};
    const message =
      typeof record.message === 'string'
        ? record.message
        : `OJS integration request failed with HTTP ${response.status}.`;

    throw new Error(message);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('OJS returned an invalid integration response.');
  }

  return data as Record<string, unknown>;
}

export async function loadOjsLaunchData(
  claims: LaunchClaims,
  payload: string,
  signature: string,
): Promise<OjsLaunchData> {
  requireScope(claims, 'metadata.read');
  requireScope(claims, 'contributors.read');
  requireScope(claims, 'files.read');

  const [submissionResponse, contributorsResponse, filesResponse] =
    await Promise.all([
      readJson(
        apiUrl(
          claims,
          'submission',
          payload,
          signature,
        ),
      ),
      readJson(
        apiUrl(
          claims,
          'contributors',
          payload,
          signature,
        ),
      ),
      readJson(
        apiUrl(
          claims,
          'files',
          payload,
          signature,
        ),
      ),
    ]);

  return {
    submission:
      submissionResponse.submission ?? null,
    contributors: Array.isArray(
      contributorsResponse.contributors,
    )
      ? contributorsResponse.contributors
      : [],
    files: Array.isArray(filesResponse.files)
      ? filesResponse.files
      : [],
  };
}
