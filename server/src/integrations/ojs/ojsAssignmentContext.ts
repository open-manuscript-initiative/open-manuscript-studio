import type { LaunchClaims } from './launchVerifier.js';

export interface OjsAssignmentCandidate {
  externalId: string;
  email: string;
  fullName: string;
}

export interface OjsAssignmentContextData {
  actorEmail?: string;
  actorFullName?: string;
  candidates: OjsAssignmentCandidate[];
}

export async function loadOjsAssignmentContext(
  claims: LaunchClaims,
  payload: string,
  signature: string,
): Promise<OjsAssignmentContextData> {
  if (!claims.apiBaseUrl || !['editor', 'author'].includes(claims.actorMode ?? '')) {
    return { candidates: [] };
  }

  const authorization = `OMI ${payload}.${signature}`;
  const baseUrl = getTrustedApiBaseUrl(claims.apiBaseUrl);
  const submissionUrl = new URL('submission', baseUrl);
  const submission = await readJson(submissionUrl, authorization);
  const actor = asRecord(submission.actor);
  const actorEmail = cleanEmail(actor.email);
  const actorFullName = cleanText(actor.fullName, 200);

  if (claims.actorMode !== 'editor' || !claims.scope?.includes('contributors.read')) {
    return {
      ...(actorEmail ? { actorEmail } : {}),
      ...(actorFullName ? { actorFullName } : {}),
      candidates: [],
    };
  }

  const reviewersUrl = new URL('reviewers', baseUrl);
  const reviewerResponse = await readJson(reviewersUrl, authorization);
  const rawReviewers = Array.isArray(reviewerResponse.reviewers)
    ? reviewerResponse.reviewers
    : [];
  const candidates: OjsAssignmentCandidate[] = [];
  const seen = new Set<string>();

  for (const item of rawReviewers) {
    const record = asRecord(item);
    const email = cleanEmail(record.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    candidates.push({
      externalId: cleanText(record.externalId, 128) ?? email,
      email,
      fullName: cleanText(record.fullName, 200) ?? email,
    });
  }

  candidates.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    ...(actorEmail ? { actorEmail } : {}),
    ...(actorFullName ? { actorFullName } : {}),
    candidates,
  };
}

function isRedirect(status: number): boolean {
  return status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308;
}

function getTrustedApiBaseUrl(apiBaseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    throw new Error('Invalid OJS API base URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('OJS API base URL must use HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('OJS API base URL must not include credentials.');
  }

  parsed.pathname = parsed.pathname.replace(/\/?$/, '/');
  parsed.search = '';
  parsed.hash = '';
  return parsed;
}

async function readJson(url: URL, authorization: string): Promise<Record<string, unknown>> {
  const initialUrl = new URL(url.toString());
  const trustedOrigin = initialUrl.origin;
  const visited = new Set<string>();
  let currentUrl = initialUrl;
  let response: Response | undefined;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const currentKey = currentUrl.toString();
    if (visited.has(currentKey)) {
      throw new Error('OJS assignment context request entered a redirect loop.');
    }
    visited.add(currentKey);

    response = await fetch(currentUrl, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authorization },
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });

    if (!isRedirect(response.status)) break;

    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`OJS assignment context returned HTTP ${response.status} without a Location header.`);
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.origin !== trustedOrigin) {
      throw new Error('OJS assignment context attempted a cross-origin redirect.');
    }
    currentUrl = nextUrl;
    response = undefined;
  }

  if (!response) {
    throw new Error('OJS assignment context exceeded the allowed redirect count.');
  }

  const data = await response.json() as unknown;
  if (!response.ok || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`OJS assignment context request failed with HTTP ${response.status}.`);
  }
  return data as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized.slice(0, 320) : undefined;
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}