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
): URL {
  if (!claims.apiBaseUrl) {
    throw new Error(
      'The OJS launch assertion does not include apiBaseUrl.',
    );
  }

  return new URL(
    `${claims.apiBaseUrl.replace(/\/$/, '')}/${operation}`,
  );
}

async function readJson(
  operation: string,
  url: URL,
  authorization: string,
): Promise<Record<string, unknown>> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const cause =
      error && typeof error === 'object' && 'cause' in error
        ? (error as { cause?: unknown }).cause
        : undefined;

    const causeMessage =
      cause instanceof Error
        ? cause.message
        : cause && typeof cause === 'object' && 'code' in cause
          ? String((cause as { code?: unknown }).code)
          : '';

    throw new Error(
      `OJS ${operation} request failed before an HTTP response${
        causeMessage ? `: ${causeMessage}` : ''
      }.`,
    );
  }

  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `OJS ${operation} returned a non-JSON response (${response.status}, ${response.url}).`,
    );
  }

  if (!response.ok) {
    const record =
      data && typeof data === 'object'
        ? (data as Record<string, unknown>)
        : {};
    const nestedError =
      record.error && typeof record.error === 'object'
        ? (record.error as Record<string, unknown>)
        : {};
    const message =
      typeof nestedError.message === 'string'
        ? nestedError.message
        : typeof record.message === 'string'
          ? record.message
          : `OJS ${operation} request failed with HTTP ${response.status}.`;

    throw new Error(
      `${message} Final URL: ${response.url}`,
    );
  }

  if (!data || typeof data !== 'object') {
    throw new Error(
      `OJS ${operation} returned an invalid integration response.`,
    );
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

  const authorization = `OMI ${payload}.${signature}`;

  const [submissionResponse, contributorsResponse, filesResponse] =
    await Promise.all([
      readJson(
        'submission',
        apiUrl(claims, 'submission'),
        authorization,
      ),
      readJson(
        'contributors',
        apiUrl(claims, 'contributors'),
        authorization,
      ),
      readJson(
        'files',
        apiUrl(claims, 'files'),
        authorization,
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
