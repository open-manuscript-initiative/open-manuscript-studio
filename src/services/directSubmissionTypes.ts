export interface SubmissionAuthor { agentId?: string; givenName: string; familyName: string; email: string }
export interface SubmissionOptions {
  protocol: 'omi-direct-submission/1'; platform: 'ojs' | 'omp'; name: string;
  acceptingSubmissions: boolean; locales: string[];
  sections: Array<{ id: number; label: string }>;
  genres: Array<{ id: number; label: string }>;
  requirements: unknown; copyrightNotice: unknown; privacyStatement: unknown;
}
export interface SubmissionReceipt {
  id: string; status: string; externalId: number | null; digest: string; url: string | null;
}
export interface SubmissionSnapshot {
  manuscriptId: string; locale: string; title: string; abstract: string; keywords: string[];
  authors: SubmissionAuthor[]; sectionId: number | null; genreId: number; docx: string; omi: string;
}
export interface DirectSubmissionRequest {
  action: 'options' | 'status' | 'prepare' | 'submit'; manuscriptId: string; apiKey?: string;
  input?: SubmissionSnapshot; digest?: string; confirmed?: true;
}
export interface DirectSubmissionResponse {
  receipt?: SubmissionReceipt | null; options?: SubmissionOptions;
  error?: { message: string };
}
