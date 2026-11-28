import { getStudioApiBaseUrl } from './studioServer';
export type OjsAssignmentType = 'scientific_review' | 'language_review' | 'translation';

export interface OjsAssignmentCandidate {
  externalId: string;
  email: string;
  fullName: string;
}

export interface OjsAssignmentSummary {
  id: string;
  assignmentType: OjsAssignmentType;
  status: string;
  reviewerAlias: string;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  invitedAt: string;
  accountStatus?: string;
  invitationSent?: boolean;
  reviewer: {
    userId: string;
    email: string;
    fullName: string;
    affiliation?: string | null;
    orcid?: string | null;
  } | null;
}

export interface OjsAssignmentLaunchContext {
  grant: string;
  candidates: OjsAssignmentCandidate[];
  manuscript: unknown;
  publicationLanguages?: string[];
}

export async function listOjsAssignments(grant: string): Promise<{
  actorMode: 'editor' | 'author';
  assignments: OjsAssignmentSummary[];
}> {
  const response = await fetch(`${getStudioApiBaseUrl()}/api/reviews/ojs/assignments?grant=${encodeURIComponent(grant)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJson(response);
}

export async function createOjsAssignment(input: {
  context: OjsAssignmentLaunchContext;
  reviewerEmail: string;
  reviewerFullName?: string;
  assignmentType: OjsAssignmentType;
  publicationLanguages?: string[];
  sourceLanguage?: string;
  targetLanguage?: string;
}): Promise<OjsAssignmentSummary> {
  const response = await fetch(`${getStudioApiBaseUrl()}/api/reviews/ojs/assignments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant: input.context.grant,
      reviewerEmail: input.reviewerEmail,
      reviewerFullName: input.reviewerFullName,
      assignmentType: input.assignmentType.toUpperCase(),
      publicationLanguages: input.publicationLanguages,
      sourceLanguage: input.sourceLanguage || undefined,
      targetLanguage: input.targetLanguage || undefined,
      manuscript: input.context.manuscript,
    }),
  });
  const data = await readJson<{ assignment: OjsAssignmentSummary }>(response);
  return data.assignment;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as unknown;
  if (!response.ok) {
    const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const error = record.error && typeof record.error === 'object'
      ? record.error as Record<string, unknown>
      : {};
    throw new Error(typeof error.message === 'string' ? error.message : `Request failed with HTTP ${response.status}.`);
  }
  return data as T;
}

export async function reconnectOjsAssignment(grant: string, assignmentId: string): Promise<void> {
  const response = await fetch(`${getStudioApiBaseUrl()}/api/reviews/ojs/assignments/${encodeURIComponent(assignmentId)}/reconnect`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant }),
  });
  await readJson(response);
}
