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
  const base = claims.apiBaseUrl.replace(/\/$/, '');
  const submission = await readJson(`${base}/submission`, authorization);
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

  const reviewerResponse = await readJson(`${base}/reviewers`, authorization);
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

async function readJson(url: string, authorization: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: authorization },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
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
