import { getStudioApiBaseUrl } from '../services/studioServer';
import { useEffect, useState } from 'react';

import './ReviewMode.css';
import { tCatalog } from '../i18n';

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

const API_BASE_URL = getStudioApiBaseUrl();

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
      .catch((caught) => setError(caught instanceof Error ? caught.message : tCatalog("/uncataloguedUi/components-editorreviewmode/unable-to-load-editorial-assignments-d330d67")));
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
          <h1>{tCatalog("/uncataloguedUi/components-editorreviewmode/editorial-assignments-67c28ef")}</h1>
          <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/editor-only-view-participant-and-author-identities-are-0dd782d")}</p>
        </div>
        <a className="review-mode__back" href="/">{tCatalog("/uncataloguedUi/components-editorreviewmode/back-to-studio-b458395")}</a>
      </header>

      {error ? <div className="review-mode__error" role="alert">{error}</div> : null}

      <div className="review-mode__layout">
        <aside className="review-mode__list" aria-label={tCatalog("/uncataloguedUi/components-editorreviewmode/editorial-assignments-bd72213")}>
          <h2>{tCatalog("/uncataloguedUi/components-editorreviewmode/assignments-057d58c")}</h2>
          {reviews.map((review) => (
            <button
              key={review.id}
              type="button"
              className={`review-mode__assignment${selected?.id === review.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(review.id)}
            >
              <strong>Manuscript {review.manuscriptId}</strong>
              <span>{assignmentLabels[review.assignmentType]}</span>
              <span>{review.reviewerAlias} {tCatalog("/uncataloguedUi/components-editorreviewmode/round-988748a")} {review.reviewRound}</span>
              {review.assignmentType === 'translation' ? <span>{review.sourceLanguage ?? '?'} → {review.targetLanguage ?? '?'}</span> : null}
              <span>{review.status.replaceAll('_', ' ')}</span>
            </button>
          ))}
          {!reviews.length ? <p className="review-mode__empty">{tCatalog("/uncataloguedUi/components-editorreviewmode/no-editorial-assignments-450981b")}</p> : null}
        </aside>

        <section className="review-mode__content">
          {selected ? (
            <>
              <section className="review-mode__card review-mode__summary">
                <div>
                  <div className="review-mode__eyebrow">Manuscript {selected.manuscriptId}</div>
                  <h2>{assignmentLabels[selected.assignmentType]}</h2>
                  <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/round-ec7b598")} {selected.reviewRound} · {selected.anonymityMode.replaceAll('_', ' ')} · {selected.status.replaceAll('_', ' ')}{languagePair ? ` · ${languagePair}` : ''}</p>
                </div>
                <span className="review-mode__status">
                  {selected.assignmentType === 'scientific_review'
                    ? selected.recommendation?.replaceAll('_', ' ') ?? 'No recommendation yet'
                    : selected.status.replaceAll('_', ' ')}
                </span>
              </section>

              <section className="review-mode__card">
                <h2>{tCatalog("/uncataloguedUi/components-editorreviewmode/author-identity-f83da8a")}</h2>
                {selected.authors.length ? selected.authors.map((author) => (
                  <article key={author.userId} className="review-mode__feedback">
                    <strong>{author.fullName}</strong>
                    <p>{author.email}</p>
                    {author.affiliation ? <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/affiliation-7767fe9")} {author.affiliation}</p> : null}
                    {author.orcid ? <p>ORCID: {author.orcid}</p> : null}
                  </article>
                )) : <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/no-author-account-is-linked-to-this-manuscript-workspa-8350ffd")}</p>}
              </section>

              <section className="review-mode__card">
                <h2>{tCatalog("/uncataloguedUi/components-editorreviewmode/assigned-participant-cb46a43")}</h2>
                <article className="review-mode__feedback">
                  <strong>{selected.reviewer.fullName}</strong>
                  <p>{selected.reviewer.email}</p>
                  {selected.reviewer.affiliation ? <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/affiliation-7767fe9")} {selected.reviewer.affiliation}</p> : null}
                  {selected.reviewer.orcid ? <p>ORCID: {selected.reviewer.orcid}</p> : null}
                  <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/author-facing-alias-42afcc5")} <strong>{selected.reviewerAlias}</strong></p>
                  <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/role-61e4c27")} <strong>{assignmentLabels[selected.assignmentType]}</strong></p>
                </article>
              </section>

              <section className="review-mode__card">
                <h2>{tCatalog("/uncataloguedUi/components-editorreviewmode/assignment-feedback-ea897d6")}</h2>
                {selected.feedback.length ? selected.feedback.map((feedback) => (
                  <article key={feedback.id} className="review-mode__feedback">
                    <strong>{feedback.visibility === 'editor_only' ? tCatalog("/uncataloguedUi/components-editorreviewmode/confidential-to-editor-edfdb4f") : tCatalog("/uncataloguedUi/components-editorreviewmode/visible-to-author-6adc2c3")}</strong>
                    <p>{feedback.body}</p>
                  </article>
                )) : <p>{tCatalog("/uncataloguedUi/components-editorreviewmode/no-feedback-yet-dd9e490")}</p>}
              </section>
            </>
          ) : <section className="review-mode__card"><p>{tCatalog("/uncataloguedUi/components-editorreviewmode/no-editorial-assignment-selected-c9870be")}</p></section>}
        </section>
      </div>
    </main>
  );
}
