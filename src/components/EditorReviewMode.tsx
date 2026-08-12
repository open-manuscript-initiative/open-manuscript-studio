import { useEffect, useState } from 'react';

import './ReviewMode.css';

interface PersonSummary {
  userId: string;
  email: string;
  fullName: string;
  affiliation?: string | null;
  affiliationRorId?: string | null;
  orcid?: string | null;
}

interface EditorReview {
  id: string;
  workspaceId: string;
  manuscriptId: string;
  reviewerAlias: string;
  assignmentType: 'scientific_review' | 'language_review' | 'translation' | 'editorial_revision';
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  reviewRound: number;
  anonymityMode: string;
  status: string;
  recommendation?: string | null;
  reviewer: PersonSummary;
  authors: PersonSummary[];
  feedback: Array<{
    id: string;
    visibility: string;
    body: string;
    createdAt: string;
  }>;
}

interface OverviewResponse {
  reviews: EditorReview[];
}

const assignmentLabels: Record<EditorReview['assignmentType'], string> = {
  scientific_review: 'Scientific peer review',
  language_review: 'Language review',
  translation: 'Translation',
  editorial_revision: 'Editorial revision',
};

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');

export async function loadEditorReviewOverview(): Promise<EditorReview[]> {
  const response = await fetch(`${API_BASE_URL}/api/reviews/editor/overview`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const payload = await response.json() as OverviewResponse;
  return Array.isArray(payload.reviews) ? payload.reviews : [];
}

export function EditorReviewMode({ initialReviews }: { initialReviews?: EditorReview[] }) {
  const [reviews, setReviews] = useState<EditorReview[]>(initialReviews ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(initialReviews?.[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialReviews) return;
    void loadEditorReviewOverview()
      .then((next) => {
        setReviews(next);
        setSelectedId(next[0]?.id ?? null);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load editorial assignments.'));
  }, [initialReviews]);

  const selected = reviews.find((item) => item.id === selectedId) ?? reviews[0];
  const languagePair = selected?.assignmentType === 'translation'
    ? `${selected.sourceLanguage ?? '?'} → ${selected.targetLanguage ?? '?'}`
    : selected?.sourceLanguage ?? null;

  return (
    <main className="review-mode">
      <header className="review-mode__header">
        <div>
          <div className="review-mode__eyebrow">Open Manuscript Studio</div>
          <h1>Editorial Assignments</h1>
          <p>Editor-only view. Participant and author identities are available here while author-facing and participant-facing APIs apply their own privacy boundaries.</p>
        </div>
        <a className="review-mode__back" href="/">Back to Studio</a>
      </header>

      {error ? <div className="review-mode__error" role="alert">{error}</div> : null}

      <div className="review-mode__layout">
        <aside className="review-mode__list" aria-label="Editorial assignments">
          <h2>Assignments</h2>
          {reviews.map((review) => (
            <button
              key={review.id}
              type="button"
              className={`review-mode__assignment${selected?.id === review.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(review.id)}
            >
              <strong>Manuscript {review.manuscriptId}</strong>
              <span>{assignmentLabels[review.assignmentType]}</span>
              <span>{review.reviewerAlias} · Round {review.reviewRound}</span>
              {review.assignmentType === 'translation' ? <span>{review.sourceLanguage ?? '?'} → {review.targetLanguage ?? '?'}</span> : null}
              <span>{review.status.replaceAll('_', ' ')}</span>
            </button>
          ))}
          {!reviews.length ? <p className="review-mode__empty">No editorial assignments.</p> : null}
        </aside>

        <section className="review-mode__content">
          {selected ? (
            <>
              <section className="review-mode__card review-mode__summary">
                <div>
                  <div className="review-mode__eyebrow">Manuscript {selected.manuscriptId}</div>
                  <h2>{assignmentLabels[selected.assignmentType]}</h2>
                  <p>Round {selected.reviewRound} · {selected.anonymityMode.replaceAll('_', ' ')} · {selected.status.replaceAll('_', ' ')}{languagePair ? ` · ${languagePair}` : ''}</p>
                </div>
                <span className="review-mode__status">
                  {selected.assignmentType === 'scientific_review'
                    ? selected.recommendation?.replaceAll('_', ' ') ?? 'No recommendation yet'
                    : selected.status.replaceAll('_', ' ')}
                </span>
              </section>

              <section className="review-mode__card">
                <h2>Author identity</h2>
                {selected.authors.length ? selected.authors.map((author) => (
                  <article key={author.userId} className="review-mode__feedback">
                    <strong>{author.fullName}</strong>
                    <p>{author.email}</p>
                    {author.affiliation ? <p>Affiliation: {author.affiliation}</p> : null}
                    {author.orcid ? <p>ORCID: {author.orcid}</p> : null}
                  </article>
                )) : <p>No author account is linked to this manuscript workspace.</p>}
              </section>

              <section className="review-mode__card">
                <h2>Assigned participant</h2>
                <article className="review-mode__feedback">
                  <strong>{selected.reviewer.fullName}</strong>
                  <p>{selected.reviewer.email}</p>
                  {selected.reviewer.affiliation ? <p>Affiliation: {selected.reviewer.affiliation}</p> : null}
                  {selected.reviewer.orcid ? <p>ORCID: {selected.reviewer.orcid}</p> : null}
                  <p>Author-facing alias: <strong>{selected.reviewerAlias}</strong></p>
                  <p>Role: <strong>{assignmentLabels[selected.assignmentType]}</strong></p>
                </article>
              </section>

              <section className="review-mode__card">
                <h2>Assignment feedback</h2>
                {selected.feedback.length ? selected.feedback.map((feedback) => (
                  <article key={feedback.id} className="review-mode__feedback">
                    <strong>{feedback.visibility === 'editor_only' ? 'Confidential to editor' : 'Visible to author'}</strong>
                    <p>{feedback.body}</p>
                  </article>
                )) : <p>No feedback yet.</p>}
              </section>
            </>
          ) : <section className="review-mode__card"><p>No editorial assignment selected.</p></section>}
        </section>
      </div>
    </main>
  );
}
