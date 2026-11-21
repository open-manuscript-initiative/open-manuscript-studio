import { studioApiFetch } from '../platform/studioApiTransport';

export type FeedbackCategory = 'bug' | 'suggestion' | 'test';
export type FeedbackArea = 'editor' | 'import' | 'export' | 'notes' | 'collaboration' | 'publishing' | 'account' | 'other';
export type FeedbackTestOutcome = 'success' | 'problem' | 'not_applicable';

export interface StudioFeedback {
  category: FeedbackCategory;
  area: FeedbackArea;
  title: string;
  description: string;
  reproductionSteps?: string;
  expectedResult?: string;
  testOutcome?: FeedbackTestOutcome;
  contactEmail?: string;
  technical?: {
    platform: 'android' | 'ios' | 'desktop' | 'web';
    appVersion: string;
    locale: string;
  };
}

export class StudioFeedbackError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'StudioFeedbackError';
  }
}

export async function sendStudioFeedback(feedback: StudioFeedback): Promise<string> {
  const response = await studioApiFetch('/api/v1/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  const payload = await response.json().catch(() => null) as
    | { id?: unknown; received?: unknown; error?: { code?: string } }
    | null;
  if (!response.ok) {
    throw new StudioFeedbackError(payload?.error?.code ?? 'FEEDBACK_REQUEST_FAILED');
  }
  if (payload?.received !== true || typeof payload.id !== 'string') {
    throw new StudioFeedbackError('FEEDBACK_INVALID_RESPONSE');
  }
  return payload.id;
}
