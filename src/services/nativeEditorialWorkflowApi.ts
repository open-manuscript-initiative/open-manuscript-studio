import type { OmiManuscriptState } from '../types/omi';
import type { NativeEditorialAssetPayload, NativeReviewSnapshot } from './nativeEditorialSnapshot';

export type NativeEditorialSubmissionStatus =
  | 'submitted'
  | 'in_review'
  | 'revision_requested'
  | 'revision_submitted'
  | 'accepted'
  | 'rejected'
  | 'published';

export interface NativeEditorialSubmissionSummary {
  id: string;
  workspaceId: string;
  manuscriptId: string;
  publicationVenueId: string;
  publicationVenueName: string;
  publicationVenueDomain: string;
  authorUserId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  status: NativeEditorialSubmissionStatus;
  reviewRound: number;
  editorialNote?: string;
  submittedAt: string;
  revisionRequestedAt?: string;
  revisionSubmittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  publishedAt?: string;
  updatedAt: string;
  author?: PersonSummary;
}

export interface NativeEditorialEvent {
  id: string;
  type:
    | 'submitted'
    | 'reviewer_assigned'
    | 'review_completed'
    | 'revision_requested'
    | 'revision_submitted'
    | 'accepted'
    | 'rejected'
    | 'published';
  actorUserId: string;
  reviewRound: number;
  revisionId?: string;
  stateDigest?: string;
  note?: string;
  createdAt: string;
}

export interface PersonSummary {
  userId: string;
  email: string;
  fullName: string;
  affiliation?: string;
  orcid?: string;
}

export interface NativeEditorialSubmissionDetail extends NativeEditorialSubmissionSummary {
  manuscriptStateSnapshot: OmiManuscriptState;
  reviewSnapshot: NativeReviewSnapshot;
  author: PersonSummary;
  assets: Array<NativeEditorialAssetPayload & { size: number }>;
  events: NativeEditorialEvent[];
}

export interface NativeEditorialReview {
  id: string;
  workspaceId: string;
  manuscriptId: string;
  reviewerAlias: string;
  assignmentType: string;
  reviewRound: number;
  anonymityMode: string;
  status: string;
  requiresRecommendation: boolean;
  recommendation?: string;
  invitedAt: string;
  acceptedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  reviewer?: PersonSummary;
  feedback: Array<{
    id: string;
    visibility: string;
    body: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface NativeEditorialSubmissionDetailResponse {
  submission: NativeEditorialSubmissionDetail;
  actorMode: 'author' | 'editor';
  reviews: NativeEditorialReview[];
}

export interface NativeEditorialRevisionPayload {
  manuscriptId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  manuscriptStateSnapshot: OmiManuscriptState;
  reviewSnapshot: NativeReviewSnapshot;
  assets: NativeEditorialAssetPayload[];
}

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/\/$/, '');

export async function submitNativeEditorialManuscript(
  publicationVenueId: string,
  payload: NativeEditorialRevisionPayload,
): Promise<NativeEditorialSubmissionSummary> {
  return (await request<{ submission: NativeEditorialSubmissionSummary }>(
    '/api/native-editorial/submissions',
    {
      method: 'POST',
      body: JSON.stringify({ publicationVenueId, ...payload }),
    },
  )).submission;
}

export async function listMyNativeEditorialSubmissions(
  manuscriptId?: string,
): Promise<NativeEditorialSubmissionSummary[]> {
  const query = manuscriptId
    ? `?manuscriptId=${encodeURIComponent(manuscriptId)}`
    : '';
  return (await request<{ submissions: NativeEditorialSubmissionSummary[] }>(
    `/api/native-editorial/submissions/mine${query}`,
  )).submissions;
}

export async function listNativeEditorialInbox(): Promise<NativeEditorialSubmissionSummary[]> {
  return (await request<{ submissions: NativeEditorialSubmissionSummary[] }>(
    '/api/native-editorial/inbox',
  )).submissions;
}

export async function getNativeEditorialSubmission(
  submissionId: string,
): Promise<NativeEditorialSubmissionDetailResponse> {
  return request<NativeEditorialSubmissionDetailResponse>(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}`,
  );
}

export async function assignNativeEditorialReviewer(
  submissionId: string,
  reviewerEmail: string,
): Promise<void> {
  await request(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}/reviewers`,
    {
      method: 'POST',
      body: JSON.stringify({ reviewerEmail }),
    },
  );
}

export async function completeNativeEditorialReview(
  submissionId: string,
  assignmentId: string,
): Promise<void> {
  await request(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}/reviews/${encodeURIComponent(assignmentId)}/complete`,
    { method: 'POST' },
  );
}

export async function requestNativeEditorialRevision(
  submissionId: string,
  note: string,
): Promise<NativeEditorialSubmissionSummary> {
  return (await request<{ submission: NativeEditorialSubmissionSummary }>(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}/request-revision`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  )).submission;
}

export async function submitNativeEditorialRevision(
  submissionId: string,
  payload: NativeEditorialRevisionPayload,
): Promise<NativeEditorialSubmissionSummary> {
  return (await request<{ submission: NativeEditorialSubmissionSummary }>(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}/revision`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )).submission;
}

export async function acceptNativeEditorialSubmission(
  submissionId: string,
): Promise<NativeEditorialSubmissionSummary> {
  return (await request<{ submission: NativeEditorialSubmissionSummary }>(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}/accept`,
    { method: 'POST' },
  )).submission;
}

export async function rejectNativeEditorialSubmission(
  submissionId: string,
  note = '',
): Promise<NativeEditorialSubmissionSummary> {
  return (await request<{ submission: NativeEditorialSubmissionSummary }>(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ ...(note.trim() ? { note: note.trim() } : {}) }),
    },
  )).submission;
}

export async function markNativeEditorialPublished(
  submissionId: string,
  revisionId: string,
  note?: string,
): Promise<NativeEditorialSubmissionSummary> {
  return (await request<{ submission: NativeEditorialSubmissionSummary }>(
    `/api/native-editorial/submissions/${encodeURIComponent(submissionId)}/published`,
    {
      method: 'POST',
      body: JSON.stringify({
        revisionId,
        ...(note?.trim() ? { note: note.trim() } : {}),
      }),
    },
  )).submission;
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    let message = `Editorial workflow request failed with HTTP ${response.status}.`;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
