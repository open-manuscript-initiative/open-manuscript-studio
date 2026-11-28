import { getStudioApiBaseUrl } from './studioServer';
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

export type ReviewRecommendationStorage = 'native' | 'legacy' | 'unavailable';

export interface ReviewRecommendationOption {
  externalId: string;
  label: string;
}

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

export interface ReviewWriteback { status: 'synced' | 'not_applicable' | 'failed' | 'pending'; message?: string; }

export interface ReviewerAssignment {
  publicationLanguages?: string[];
  documentTranslationRequired?: boolean;
  externalWriteback?: ReviewWriteback;
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
  recommendationStorage?: ReviewRecommendationStorage;
  recommendationOptions?: ReviewRecommendationOption[];
  recommendationExternalId?: string;
  feedback: ReviewerFeedback[];
  invitedAt: string;
  acceptedAt?: string;
  submittedAt?: string;
  completedAt?: string;
}

export type ReviewFormElementType =
  | 'small_text'
  | 'text'
  | 'textarea'
  | 'checkboxes'
  | 'radio'
  | 'dropdown';

export interface ReviewFormOption {
  value: string;
  label: string;
}

export interface ReviewFormElement {
  externalId: string;
  type: ReviewFormElementType;
  question: string;
  description: string;
  required: boolean;
  authorVisible: boolean;
  options: ReviewFormOption[];
  value: string | string[] | null;
}

export interface ReviewFormDefinition {
  externalId: string;
  elements: ReviewFormElement[];
}

export interface ReviewFormResponseValue {
  elementExternalId: string;
  value: string | string[] | null;
}

export interface ReviewFormContext {
  definition: ReviewFormDefinition | null;
  responses: ReviewFormResponseValue[];
}

export type ReviewInlineSemantic =
  | 'strong'
  | 'emphasis'
  | 'strike'
  | 'underline'
  | 'small-caps'
  | 'superscript'
  | 'subscript'
  | 'code';

export interface ReviewCitationReference {
  sourceTags: string[];
  label: string;
}

export interface ReviewInlineSpan {
  text: string;
  semantics?: ReviewInlineSemantic[];
  language?: string;
  href?: string;
  citation?: ReviewCitationReference;
}

export interface ReviewBibliographicContributor {
  role: 'author' | 'editor' | 'translator' | 'contributor';
  givenName?: string;
  familyName?: string;
  literalName?: string;
}

export interface ReviewBibliographicRecord {
  sourceTag: string;
  type: string;
  title: string;
  subtitle?: string;
  contributors: ReviewBibliographicContributor[];
  containerTitle?: string;
  issued?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  identifiers: Array<{ scheme: string; value: string }>;
  url?: string;
}

export type ReviewChartType = 'bar' | 'horizontal-bar' | 'stacked-bar' | 'stacked-100' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'radar';

export type ReviewManuscriptBlock = (
  | { type: 'heading'; text: string; level?: number; richText?: ReviewInlineSpan[] }
  | { type: 'paragraph'; text: string; richText?: ReviewInlineSpan[] }
  | { type: 'note'; text: string; richText?: ReviewInlineSpan[] }
  | { type: 'list'; text: string; ordered: boolean; listLevel: number; ordinal?: number; richText?: ReviewInlineSpan[] }
  | { type: 'table'; cells: string[][]; headerRows: number }
  | { type: 'image'; src: string; mediaType: string; alt?: string }
  | { type: 'chart'; cells: string[][]; chartType: ReviewChartType; title?: string }) & { id?: string };

export interface ReviewAnnotation {
  id: string;
  type: 'comment';
  targetBlockId: string;
  targetText: string;
  targetStart?: number;
  body: string;
  visibility: 'author_and_editor' | 'editor_only';
  status: 'open' | 'resolved';
  anchorStatus?: 'resolved' | 'unresolved';
  replyToCommentId?: string;
  authorName?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface AssignmentTranslation {
  sourceLanguage: string; targetLanguage: string; title: string; abstract: string; keywords: string[]; documentCompleted: boolean;
}
export interface ReviewManuscriptSnapshot {
  translation?: AssignmentTranslation;
  documentKind: 'article';
  authorIdentity: 'hidden' | 'visible';
  authors?: Array<{ name: string }>;
  annotations?: ReviewAnnotation[];
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  blocks: ReviewManuscriptBlock[];
  bibliographicRecords: ReviewBibliographicRecord[];
}


interface ReviewResponse { review: ReviewerAssignment; externalWriteback?: ReviewWriteback; ojsWriteback?: ReviewWriteback; }
interface ReviewListResponse { reviews: ReviewerAssignment[]; }
interface ManuscriptResponse { manuscript: ReviewManuscriptSnapshot | null; }
interface OjsReviewLaunchResponse { assignmentId: string; }
interface ReviewFormContextResponse { reviewForm: ReviewFormContext | null; }

interface ErrorResponse {
  error?: { code?: string; message?: string; };
}

const API_BASE_URL = getStudioApiBaseUrl();

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

export async function getAssignedReview(id: string): Promise<ReviewerAssignment> {
  return (await request<ReviewResponse>(
    `/api/reviews/assigned/${encodeURIComponent(id)}`,
  )).review;
}

export async function getAssignedReviewForm(id: string): Promise<ReviewFormContext | null> {
  return (await request<ReviewFormContextResponse>(
    `/api/reviews/assigned/${encodeURIComponent(id)}/review-form`,
  )).reviewForm;
}

export async function saveAssignedReviewForm(
  id: string,
  responses: ReviewFormResponseValue[],
): Promise<ReviewFormContext | null> {
  return (await request<ReviewFormContextResponse>(
    `/api/reviews/assigned/${encodeURIComponent(id)}/review-form`,
    { method: 'PUT', body: JSON.stringify({ responses }) },
  )).reviewForm;
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
  recommendationExternalId?: string,
): Promise<ReviewerAssignment> {
  const body = {
    ...(recommendation ? { recommendation } : {}),
    ...(recommendationExternalId ? { recommendationExternalId } : {}),
  };
  const response = await request<ReviewResponse>(`/api/reviews/assigned/${encodeURIComponent(id)}/submit`, { method: 'POST', body: JSON.stringify(body) });
  return { ...response.review, ...(response.externalWriteback ? { externalWriteback: response.externalWriteback } : {}) };
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
    return Object.assign(new Error(payload.error?.message || `Editorial assignment request failed with HTTP ${response.status}.`), { code: (payload.error as { code?: string } | undefined)?.code, status: response.status });
  } catch {
    return new Error(`Editorial assignment request failed with HTTP ${response.status}.`);
  }
}

export async function getAssignedReviewWriteback(id: string): Promise<ReviewWriteback> {
  return (await request<{ externalWriteback: ReviewWriteback }>(`/api/reviews/assigned/${encodeURIComponent(id)}/writeback`)).externalWriteback;
}
export async function retryAssignedReviewWriteback(id: string): Promise<ReviewerAssignment> {
  const result = await request<ReviewResponse>(`/api/reviews/assigned/${encodeURIComponent(id)}/writeback`, { method: 'POST', body: '{}' });
  return { ...result.review, ...(result.externalWriteback ? { externalWriteback: result.externalWriteback } : {}) };
}

export async function getAssignedTranslationProfile(): Promise<{ pairs: Array<{ sourceLanguage: string; targetLanguage: string }>; setupRequired: boolean }> {
  return request('/api/reviews/translation-profile');
}
