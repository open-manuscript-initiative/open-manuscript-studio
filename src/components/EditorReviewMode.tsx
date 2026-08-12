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
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load editorial reviews.'));
  }, [initialReviews]);

  const selected = reviews.find((item) => item.id === selectedId) ?? reviews[0];

  return (
    <main className="review-mode">
      <header className="review-mode__header">
        <div>
          <div className="review-mode__eyebrow">Open Manuscript Studio</div>
          <h1>Editorial Peer Review</h1>
          <p>Editor-only view. Author and reviewer identities are visible here but remain hidden across the double-blind boundary.</p>
        </div>
        <a className="review-mode__back" href="/">Back to Studio</a>
      </header>

      {error ? <div className="review-mode__error" role="alert">{error}</div> : null}

      <div className="review-mode__layout">
        <aside className="review-mode__list" aria-label="Editorial reviews">
          <h2>Review assignments</h2>
          {reviews.map((review) => (
            <button
              key={review.id}
              type="button"
              className={`review-mode__assignment${selected?.id === review.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(review.id)}
            >
              <strong>Manuscript {review.manuscriptId}</strong>
              <span>{review.reviewerAlias} · Round {review.reviewRound}</span>
              <span>{review.status.replaceAll('_', ' ')}</span>
            </button>
          ))}
          {!reviews.length ? <p className="review-mode__empty">No editorial review assignments.</p> : null}
        </aside>

        <section className="review-mode__content">
          {selected ? (
            <>
              <section className="review-mode__card review-mode__summary">
                <div>
                  <div className="review-mode__eyebrow">Manuscript {selected.manuscriptId}</div>
                  <h2>Review round {selected.reviewRound}</h2>
                  <p>{selected.anonymityMode.replaceAll('_', ' ')} · {selected.status.replaceAll('_', ' ')}</p>
                </div>
                <span className="review-mode__status">{selected.recommendation?.replaceAll('_', ' ') ?? 'No recommendation yet'}</span>
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
                <h2>Reviewer identity</h2>
                <article className="review-mode__feedback">
                  <strong>{selected.reviewer.fullName}</strong>
                  <p>{selected.reviewer.email}</p>
                  {selected.reviewer.affiliation ? <p>Affiliation: {selected.reviewer.affiliation}</p> : null}
                  {selected.reviewer.orcid ? <p>ORCID: {selected.reviewer.orcid}</p> : null}
                  <p>Author-facing alias: <strong>{selected.reviewerAlias}</strong></p>
                </article>
              </section>

              <section className="review-mode__card">
                <h2>Review feedback</h2>
                {selected.feedback.length ? selected.feedback.map((feedback) => (
                  <article key={feedback.id} className="review-mode__feedback">
                    <strong>{feedback.visibility === 'editor_only' ? 'Confidential to editor' : 'Visible to author'}</strong>
                    <p>{feedback.body}</p>
                  </article>
                )) : <p>No review feedback yet.</p>}
              </section>
            </>
          ) : <section className="review-mode__card"><p>No editorial review selected.</p></section>}
        </section>
      </div>
    </main>
  );
}
