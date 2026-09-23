import { isTauri } from '@tauri-apps/api/core';

import type { OmiManuscript } from '../types/omi';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export type NativeSubmissionStatus =
  | 'SUBMITTED'
  | 'EDITOR_ASSIGNED'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUESTED'
  | 'REVISION_SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PUBLISHED';

export interface NativeSubmissionEvent {
  id: string;
  actorUserId: string;
  kind: string;
  detail: unknown;
  createdAt: string;
}

export interface NativeSubmission {
  id: string;
  publicationVenueId: string;
  workspaceId: string;
  manuscriptId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  manuscriptSnapshot: OmiManuscript;
  reviewRound: number;
  status: NativeSubmissionStatus;
  viewerIsAssignedEditor: boolean;
  latestEditorialNote: string | null;
  author: { id: string; email: string; fullName: string };
  editor: { id: string; email: string; fullName: string } | null;
  submittedAt: string;
  editorAssignedAt: string | null;
  revisionRequestedAt: string | null;
  revisionSubmittedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  events: NativeSubmissionEvent[];
}

export interface NativeReviewAssignment {
  id: string;
  workspaceId: string;
  manuscriptId: string;
  reviewRound: number;
  status: string;
}

export async function createNativeSubmission(input: {
  publicationVenueId: string;
  manuscriptId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  manuscriptSnapshot: OmiManuscript;
}): Promise<NativeSubmission> {
  return (await jsonRequest('', 'POST', input) as { submission: NativeSubmission }).submission;
}

export async function listMyNativeSubmissions(): Promise<NativeSubmission[]> {
  return (await jsonRequest('/mine', 'GET') as { submissions: NativeSubmission[] }).submissions;
}

export async function listNativeEditorialInbox(): Promise<NativeSubmission[]> {
  return (await jsonRequest('/editor-inbox', 'GET') as { submissions: NativeSubmission[] }).submissions;
}

export async function getNativeSubmission(id: string): Promise<NativeSubmission> {
  return (await jsonRequest('/' + encodeURIComponent(id), 'GET') as { submission: NativeSubmission }).submission;
}

export async function claimNativeSubmission(id: string): Promise<NativeSubmission> {
  return (await jsonRequest('/' + encodeURIComponent(id) + '/claim', 'POST', {}) as { submission: NativeSubmission }).submission;
}

export async function assignNativeReviewer(
  id: string,
  input: { reviewerEmail: string; anonymityMode?: 'DOUBLE_BLIND' | 'SINGLE_BLIND' | 'OPEN' },
): Promise<NativeReviewAssignment> {
  return (await jsonRequest(
    '/' + encodeURIComponent(id) + '/reviewers',
    'POST',
    input,
  ) as { review: NativeReviewAssignment }).review;
}

export async function completeNativeReview(
  id: string,
  assignmentId: string,
): Promise<NativeReviewAssignment> {
  return (await jsonRequest(
    '/' + encodeURIComponent(id) + '/reviews/' + encodeURIComponent(assignmentId) + '/complete',
    'POST',
    {},
  ) as { review: NativeReviewAssignment }).review;
}

export async function requestNativeRevision(id: string, note: string): Promise<NativeSubmission> {
  return (await jsonRequest(
    '/' + encodeURIComponent(id) + '/request-revision',
    'POST',
    { note },
  ) as { submission: NativeSubmission }).submission;
}

export async function submitNativeRevision(
  id: string,
  input: {
    title: string;
    revisionId: string;
    stateDigest: string;
    manuscriptSnapshot: OmiManuscript;
  },
): Promise<NativeSubmission> {
  return (await jsonRequest(
    '/' + encodeURIComponent(id) + '/revision',
    'POST',
    input,
  ) as { submission: NativeSubmission }).submission;
}

export async function rejectNativeSubmission(id: string, note: string): Promise<NativeSubmission> {
  return (await jsonRequest(
    '/' + encodeURIComponent(id) + '/reject',
    'POST',
    { note },
  ) as { submission: NativeSubmission }).submission;
}

export async function acceptNativeSubmission(
  id: string,
  input: {
    publicationContentDigest: string;
    basisAssignmentIds: string[];
  },
): Promise<{ submission: NativeSubmission; evidence: {
  decisionId: string;
  evidenceDigest: string;
  publicationContentDigest: string;
  reviewRound: number;
  decidedAt: string;
} }> {
  return jsonRequest('/' + encodeURIComponent(id) + '/accept', 'POST', input) as Promise<{
    submission: NativeSubmission;
    evidence: {
      decisionId: string;
      evidenceDigest: string;
      publicationContentDigest: string;
      reviewRound: number;
      decidedAt: string;
    };
  }>;
}

export async function markNativeSubmissionPublished(id: string): Promise<NativeSubmission> {
  return (await jsonRequest(
    '/' + encodeURIComponent(id) + '/published',
    'POST',
    {},
  ) as { submission: NativeSubmission }).submission;
}

async function jsonRequest(
  suffix: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(
    apiBaseUrl() + '/api/v1/native-submissions' + suffix,
    {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: headers({
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      }),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) throw await apiError(response);
  return response.json();
}

function apiBaseUrl(): string {
  return isTauri() ? NATIVE_API_BASE_URL : '';
}

function headers(input: HeadersInit = {}): Headers {
  const result = new Headers(input);
  if (!isTauri()) return result;
  result.set('X-OMI-Native-Client', '1');
  const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
  if (token) result.set('Authorization', `Bearer ${token}`);
  return result;
}

async function apiError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  return new Error(
    payload?.error?.message
      ?? `Studio-native editorial request failed with HTTP ${response.status}.`,
  );
}
