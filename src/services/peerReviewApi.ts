export type ReviewStatus =
  | 'invited'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'submitted'
  | 'completed';

export type ReviewAssignmentType =
  | 'scientific_review'
  | 'language_review'
  | 'translation'
  | 'editorial_revision';

export type ReviewRecommendation =
  | 'accept'
  | 'minor_revision'
  | 'major_revision'
  | 'reject';

export type ReviewFeedbackVisibility =
  | 'author_and_editor'
  | 'editor_only';

export interface ReviewerFeedback {
  id: string;
  visibility: ReviewFeedbackVisibility;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewerAssignment {
  id: string;
  workspaceId: string;
  manuscriptId: string;
  reviewerAlias: string;
  assignmentType: ReviewAssignmentType;
  sourceLanguage?: string;
  targetLanguage?: string;
  reviewRound: number;
  anonymityMode: 'double_blind' | 'single_blind' | 'open';
  status: ReviewStatus;
  requiresRecommendation: boolean;
  recommendation?: ReviewRecommendation;
  feedback: ReviewerFeedback[];
  invitedAt: string;
  acceptedAt?: string;
  submittedAt?: string;
  completedAt?: string;
}

export interface ReviewManuscriptBlock {
  type: 'heading' | 'paragraph' | 'note';
  text: string;
  level?: number;
}

export interface ReviewManuscriptSnapshot {
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  blocks: ReviewManuscriptBlock[];
}

interface ReviewResponse { review: ReviewerAssignment; }
interface ReviewListResponse { reviews: ReviewerAssignment[]; }
interface ManuscriptResponse { manuscript: ReviewManuscriptSnapshot | null; }
interface OjsReviewLaunchResponse { assignmentId: string; }

interface ErrorResponse {
  error?: { code?: string; message?: string; };
}

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/\/$/, '');

export async function claimOjsReviewLaunch(
  payload: string,
  signature: string,
): Promise<string> {
  return (await request<OjsReviewLaunchResponse>('/integrations/ojs/review/launch', {
    method: 'POST',
    body: JSON.stringify({ payload, signature }),
  })).assignmentId;
}

export async function listAssignedReviews(): Promise<ReviewerAssignment[]> {
  return (await request<ReviewListResponse>('/api/reviews/assigned')).reviews;
}

export async function getAssignedReviewManuscript(id: string): Promise<ReviewManuscriptSnapshot | null> {
  return (await request<ManuscriptResponse>(
    `/api/reviews/assigned/${encodeURIComponent(id)}/manuscript`,
  )).manuscript;
}

export async function getAssignedReviewRevision(id: string): Promise<ReviewManuscriptSnapshot | null> {
  return (await request<ManuscriptResponse>(
    `/api/reviews/assigned/${encodeURIComponent(id)}/revision`,
  )).manuscript;
}

export async function saveAssignedReviewRevision(
  id: string,
  manuscript: ReviewManuscriptSnapshot,
): Promise<ReviewManuscriptSnapshot> {
  return (await request<ManuscriptResponse>(
    `/api/reviews/assigned/${encodeURIComponent(id)}/revision`,
    { method: 'PUT', body: JSON.stringify(manuscript) },
  )).manuscript as ReviewManuscriptSnapshot;
}

export async function acceptAssignedReview(id: string): Promise<ReviewerAssignment> {
  return (await request<ReviewResponse>(`/api/reviews/assigned/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
  })).review;
}

export async function declineAssignedReview(id: string): Promise<ReviewerAssignment> {
  return (await request<ReviewResponse>(`/api/reviews/assigned/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
  })).review;
}

export async function addAssignedReviewFeedback(
  id: string,
  visibility: 'AUTHOR_AND_EDITOR' | 'EDITOR_ONLY',
  body: string,
): Promise<ReviewerAssignment> {
  return (await request<ReviewResponse>(`/api/reviews/assigned/${encodeURIComponent(id)}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ visibility, body }),
  })).review;
}

export async function submitAssignedReview(
  id: string,
  recommendation?: 'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT',
): Promise<ReviewerAssignment> {
  const body = recommendation ? { recommendation } : {};
  return (await request<ReviewResponse>(`/api/reviews/assigned/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    body: JSON.stringify(body),
  })).review;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) throw await createApiError(response);
  return (await response.json()) as T;
}

async function createApiError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as ErrorResponse;
    return new Error(payload.error?.message || `Editorial assignment request failed with HTTP ${response.status}.`);
  } catch {
    return new Error(`Editorial assignment request failed with HTTP ${response.status}.`);
  }
}
