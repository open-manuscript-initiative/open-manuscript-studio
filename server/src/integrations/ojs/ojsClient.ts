import type { LaunchClaims } from './launchVerifier.js';

export interface OjsLaunchData {
  submission: unknown;
  contributors: unknown[];
  files: unknown[];
}

interface OjsJsonResponse {
  data: Record<string, unknown>;
  finalUrl: URL;
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

function siblingOperationUrl(
  finalUrl: URL,
  currentOperation: string,
  nextOperation: string,
): URL {
  const suffix = `/${currentOperation}`;

  if (!finalUrl.pathname.endsWith(suffix)) {
    throw new Error(
      `OJS ${currentOperation} resolved to an unexpected URL: ${finalUrl.toString()}`,
    );
  }

  const nextUrl = new URL(finalUrl.toString());
  nextUrl.pathname = `${finalUrl.pathname.slice(0, -suffix.length)}/${nextOperation}`;
  nextUrl.search = '';
  nextUrl.hash = '';
  return nextUrl;
}

function isRedirect(status: number): boolean {
  return status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308;
}

async function fetchWithExplicitRedirects(
  operation: string,
  initialUrl: URL,
  authorization: string,
): Promise<Response> {
  const originalOrigin = initialUrl.origin;
  const visited = new Set<string>();
  let currentUrl = new URL(initialUrl.toString());

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const currentKey = currentUrl.toString();
    if (visited.has(currentKey)) {
      throw new Error(
        `OJS ${operation} entered a redirect loop at ${currentKey}.`,
      );
    }
    visited.add(currentKey);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: authorization,
        },
        redirect: 'manual',
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
        }. URL: ${currentKey}`,
      );
    }

    if (!isRedirect(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error(
        `OJS ${operation} returned HTTP ${response.status} without a Location header. URL: ${currentKey}`,
      );
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.origin !== originalOrigin) {
      throw new Error(
        `OJS ${operation} attempted a cross-origin redirect from ${currentKey} to ${nextUrl.toString()}.`,
      );
    }

    currentUrl = nextUrl;
  }

  throw new Error(
    `OJS ${operation} exceeded the allowed redirect count. Last URL: ${currentUrl.toString()}`,
  );
}

async function readJson(
  operation: string,
  url: URL,
  authorization: string,
): Promise<OjsJsonResponse> {
  const response = await fetchWithExplicitRedirects(
    operation,
    url,
    authorization,
  );

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

  return {
    data: data as Record<string, unknown>,
    finalUrl: new URL(response.url),
  };
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

  const submissionResult = await readJson(
    'submission',
    apiUrl(claims, 'submission'),
    authorization,
  );

  const contributorsUrl = siblingOperationUrl(
    submissionResult.finalUrl,
    'submission',
    'contributors',
  );
  const filesUrl = siblingOperationUrl(
    submissionResult.finalUrl,
    'submission',
    'files',
  );

  const [contributorsResult, filesResult] =
    await Promise.all([
      readJson(
        'contributors',
        contributorsUrl,
        authorization,
      ),
      readJson(
        'files',
        filesUrl,
        authorization,
      ),
    ]);

  return {
    submission:
      submissionResult.data.submission ?? null,
    contributors: Array.isArray(
      contributorsResult.data.contributors,
    )
      ? contributorsResult.data.contributors
      : [],
    files: Array.isArray(filesResult.data.files)
      ? filesResult.data.files
      : [],
  };
}
