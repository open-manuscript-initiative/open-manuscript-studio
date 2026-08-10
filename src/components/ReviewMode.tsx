import { createElement, useEffect, useMemo, useState } from 'react';

import {
  acceptAssignedReview,
  addAssignedReviewFeedback,
  declineAssignedReview,
  getAssignedReviewManuscript,
  listAssignedReviews,
  submitAssignedReview,
  type ReviewerAssignment,
  type ReviewManuscriptSnapshot,
} from '../services/peerReviewApi';
import './ReviewMode.css';

const recommendationOptions = [
  ['ACCEPT', 'Accept'],
  ['MINOR_REVISION', 'Minor revision'],
  ['MAJOR_REVISION', 'Major revision'],
  ['REJECT', 'Reject'],
] as const;

export function ReviewMode() {
  const [reviews, setReviews] = useState<ReviewerAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manuscript, setManuscript] = useState<ReviewManuscriptSnapshot | null>(null);
  const [manuscriptLoading, setManuscriptLoading] = useState(false);
  const [authorComment, setAuthorComment] = useState('');
  const [editorComment, setEditorComment] = useState('');
  const [recommendation, setRecommendation] = useState<(typeof recommendationOptions)[number][0]>('MINOR_REVISION');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const selected = useMemo(
    () => reviews.find((review) => review.id === selectedId) ?? reviews[0],
    [reviews, selectedId],
  );

  useEffect(() => {
    if (!selected?.id) {
      setManuscript(null);
      return;
    }

    let active = true;
    setManuscriptLoading(true);

    void getAssignedReviewManuscript(selected.id)
      .then((next) => {
        if (active) setManuscript(next);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Unable to load the anonymous manuscript.');
          setManuscript(null);
        }
      })
      .finally(() => {
        if (active) setManuscriptLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selected?.id]);

  async function refresh() {
    try {
      setError(null);
      const next = await listAssignedReviews();
      setReviews(next);
      if (!selectedId && next[0]) setSelectedId(next[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load review assignments.');
    }
  }

  async function run(action: () => Promise<ReviewerAssignment>) {
    try {
      setBusy(true);
      setError(null);
      const updated = await action();
      setReviews((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Peer review request failed.');
    } finally {
      setBusy(false);
    }
  }

  const canWrite = selected && ['accepted', 'in_progress'].includes(selected.status);
  const submitted = selected && ['submitted', 'completed'].includes(selected.status);

  return (
    <main className="review-mode">
      <header className="review-mode__header">
        <div>
          <div className="review-mode__eyebrow">Open Manuscript Studio</div>
          <h1>Peer Review</h1>
          <p>Double-blind review mode. Author identity is not available in this view.</p>
        </div>
        <a className="review-mode__back" href="/">Back to Studio</a>
      </header>

      {error ? <div className="review-mode__error" role="alert">{error}</div> : null}

      <div className="review-mode__layout">
        <aside className="review-mode__list" aria-label="Assigned reviews">
          <h2>Assigned reviews</h2>
          {reviews.length ? reviews.map((review) => (
            <button
              key={review.id}
              type="button"
              className={`review-mode__assignment${selected?.id === review.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(review.id)}
            >
              <strong>{review.reviewerAlias}</strong>
              <span>Manuscript {review.manuscriptId}</span>
              <span>Round {review.reviewRound} · {review.status.replace('_', ' ')}</span>
            </button>
          )) : <p className="review-mode__empty">No review assignments.</p>}
        </aside>

        <section className="review-mode__content">
          {!selected ? (
            <div className="review-mode__card"><p>No review selected.</p></div>
          ) : (
            <>
              <section className="review-mode__card review-mode__summary">
                <div>
                  <div className="review-mode__eyebrow">Anonymous manuscript</div>
                  <h2>{manuscript?.title ?? `Manuscript ${selected.manuscriptId}`}</h2>
                  <p>Review round {selected.reviewRound} · {selected.anonymityMode.replace('_', ' ')}</p>
                </div>
                <span className="review-mode__status">{selected.status.replace('_', ' ')}</span>
              </section>

              <section className="review-mode__card review-mode__manuscript" aria-busy={manuscriptLoading}>
                <div className="review-mode__identity-notice">
                  Author-identifying metadata has been removed from this review copy.
                </div>
                {manuscriptLoading ? <p>Loading manuscript…</p> : manuscript ? (
                  <article className="review-mode__document">
                    <h1>{manuscript.title}</h1>
                    {manuscript.subtitle ? <p className="review-mode__subtitle">{manuscript.subtitle}</p> : null}
                    {manuscript.abstract ? (
                      <section className="review-mode__abstract">
                        <h2>Abstract</h2>
                        <p>{manuscript.abstract}</p>
                      </section>
                    ) : null}
                    {manuscript.keywords.length ? (
                      <p className="review-mode__keywords"><strong>Keywords:</strong> {manuscript.keywords.join(', ')}</p>
                    ) : null}
                    <div className="review-mode__body">
                      {manuscript.blocks.map((block, index) => {
                        if (block.type === 'heading') {
                          const headingLevel = Math.min(6, Math.max(2, block.level ?? 2));
                          return createElement(
                            `h${headingLevel}`,
                            { key: `${index}-${block.text.slice(0, 20)}` },
                            block.text,
                          );
                        }
                        if (block.type === 'note') {
                          return <aside key={`${index}-${block.text.slice(0, 20)}`} className="review-mode__note">{block.text}</aside>;
                        }
                        return <p key={`${index}-${block.text.slice(0, 20)}`}>{block.text}</p>;
                      })}
                    </div>
                  </article>
                ) : (
                  <p>The anonymized manuscript has not yet been attached to this review assignment.</p>
                )}
              </section>

              {selected.status === 'invited' ? (
                <section className="review-mode__card">
                  <h2>Review invitation</h2>
                  <p>Accept the invitation to begin the review, or decline it without revealing your identity to the author.</p>
                  <div className="review-mode__actions">
                    <button disabled={busy} onClick={() => void run(() => acceptAssignedReview(selected.id))}>Accept review</button>
                    <button className="secondary" disabled={busy} onClick={() => void run(() => declineAssignedReview(selected.id))}>Decline</button>
                  </div>
                </section>
              ) : null}

              {selected.status === 'declined' ? (
                <section className="review-mode__card"><p>This review invitation was declined.</p></section>
              ) : null}

              {canWrite ? (
                <>
                  <section className="review-mode__card">
                    <h2>Comments to author</h2>
                    <p>These comments will be visible to the author without your identity.</p>
                    <textarea value={authorComment} onChange={(event) => setAuthorComment(event.target.value)} rows={8} placeholder="Write your review comments for the author…" />
                    <button disabled={busy || !authorComment.trim()} onClick={() => void run(async () => {
                      const updated = await addAssignedReviewFeedback(selected.id, 'AUTHOR_AND_EDITOR', authorComment);
                      setAuthorComment('');
                      return updated;
                    })}>Save comment</button>
                  </section>

                  <section className="review-mode__card">
                    <h2>Confidential comments to editor</h2>
                    <p>These comments are never included in the author-facing review response.</p>
                    <textarea value={editorComment} onChange={(event) => setEditorComment(event.target.value)} rows={5} placeholder="Write a confidential note to the editor…" />
                    <button disabled={busy || !editorComment.trim()} onClick={() => void run(async () => {
                      const updated = await addAssignedReviewFeedback(selected.id, 'EDITOR_ONLY', editorComment);
                      setEditorComment('');
                      return updated;
                    })}>Save confidential note</button>
                  </section>

                  <section className="review-mode__card">
                    <h2>Recommendation</h2>
                    <select value={recommendation} onChange={(event) => setRecommendation(event.target.value as typeof recommendation)}>
                      {recommendationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button className="review-mode__submit" disabled={busy} onClick={() => void run(() => submitAssignedReview(selected.id, recommendation))}>Submit review</button>
                  </section>
                </>
              ) : null}

              {selected.feedback.length ? (
                <section className="review-mode__card">
                  <h2>Saved review notes</h2>
                  <div className="review-mode__feedback-list">
                    {selected.feedback.map((feedback) => (
                      <article key={feedback.id} className="review-mode__feedback">
                        <strong>{feedback.visibility === 'editor_only' ? 'Confidential to editor' : 'Visible to author'}</strong>
                        <p>{feedback.body}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {submitted ? (
                <section className="review-mode__card review-mode__submitted">
                  <h2>Review submitted</h2>
                  <p>Your recommendation: <strong>{selected.recommendation?.replace('_', ' ')}</strong>. The author-facing response remains anonymous.</p>
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
