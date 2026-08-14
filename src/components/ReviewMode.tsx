import { useEffect, useMemo, useState } from 'react';

import {
  getEditorCapabilities,
  type EditorCapabilities,
  type EditorRole,
} from '../editor/editorCapabilities';
import {
  acceptAssignedReview,
  addAssignedReviewFeedback,
  declineAssignedReview,
  getAssignedReviewManuscript,
  getAssignedReviewRevision,
  listAssignedReviews,
  saveAssignedReviewRevision,
  submitAssignedReview,
  type ReviewerAssignment,
  type ReviewManuscriptBlock,
  type ReviewManuscriptSnapshot,
} from '../services/peerReviewApi';
import { ReviewerRichTextEditor } from './ReviewerRichTextEditor';
import { isReviewTextBlock, ReviewStructuredBlock } from './ReviewStructuredBlock';
import './ReviewMode.css';

const recommendationOptions = [
  ['ACCEPT', 'Accept'],
  ['MINOR_REVISION', 'Minor revision'],
  ['MAJOR_REVISION', 'Major revision'],
  ['REJECT', 'Reject'],
] as const;

const assignmentLabels: Record<ReviewerAssignment['assignmentType'], string> = {
  scientific_review: 'Scientific peer review',
  language_review: 'Language review',
  translation: 'Translation',
  editorial_revision: 'Editorial revision',
};

const assignmentEditorRoles: Record<ReviewerAssignment['assignmentType'], EditorRole> = {
  scientific_review: 'scientific-review',
  language_review: 'language-review',
  translation: 'translation',
  editorial_revision: 'editorial-revision',
};

export function ReviewMode() {
  const [reviews, setReviews] = useState<ReviewerAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manuscript, setManuscript] = useState<ReviewManuscriptSnapshot | null>(null);
  const [revision, setRevision] = useState<ReviewManuscriptSnapshot | null>(null);
  const [manuscriptLoading, setManuscriptLoading] = useState(false);
  const [revisionDirty, setRevisionDirty] = useState(false);
  const [revisionSaved, setRevisionSaved] = useState(false);
  const [authorComment, setAuthorComment] = useState('');
  const [editorComment, setEditorComment] = useState('');
  const [recommendation, setRecommendation] = useState<(typeof recommendationOptions)[number][0]>('MINOR_REVISION');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void refresh(); }, []);

  const selected = useMemo(
    () => reviews.find((review) => review.id === selectedId) ?? reviews[0],
    [reviews, selectedId],
  );

  useEffect(() => {
    if (!selected?.id) {
      setManuscript(null);
      setRevision(null);
      return;
    }
    let active = true;
    setManuscriptLoading(true);
    setRevisionSaved(false);
    setRevisionDirty(false);
    void Promise.all([
      getAssignedReviewManuscript(selected.id),
      getAssignedReviewRevision(selected.id),
    ])
      .then(([original, working]) => {
        if (!active) return;
        setManuscript(original);
        setRevision(working ?? original);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load the assigned manuscript.');
        setManuscript(null);
        setRevision(null);
      })
      .finally(() => { if (active) setManuscriptLoading(false); });
    return () => { active = false; };
  }, [selected?.id]);

  async function refresh() {
    try {
      setError(null);
      const next = await listAssignedReviews();
      setReviews(next);
      if (!selectedId && next[0]) setSelectedId(next[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load editorial assignments.');
    }
  }

  async function run(action: () => Promise<ReviewerAssignment>) {
    try {
      setBusy(true);
      setError(null);
      const updated = await action();
      setReviews((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Editorial workflow request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRevision() {
    if (!selected || !revision) return;
    try {
      setBusy(true);
      setError(null);
      const stored = await saveAssignedReviewRevision(selected.id, revision);
      setRevision(stored);
      setRevisionDirty(false);
      setRevisionSaved(true);
      setReviews((current) => current.map((item) =>
        item.id === selected.id ? { ...item, status: 'in_progress' } : item,
      ));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the revision.');
    } finally {
      setBusy(false);
    }
  }

  function updateRevision(next: ReviewManuscriptSnapshot) {
    setRevision(next);
    setRevisionDirty(true);
    setRevisionSaved(false);
  }

  const canWrite = Boolean(selected && ['accepted', 'in_progress'].includes(selected.status));
  const submitted = Boolean(selected && ['submitted', 'completed'].includes(selected.status));
  const assignmentLabel = selected ? assignmentLabels[selected.assignmentType] : 'Editorial assignment';
  const editorCapabilities = selected
    ? getEditorCapabilities(assignmentEditorRoles[selected.assignmentType])
    : getEditorCapabilities('read-only');
  const manuscriptLanguage = selected?.assignmentType === 'translation'
    ? selected.targetLanguage ?? selected.sourceLanguage
    : selected?.sourceLanguage;
  const languagePair = selected?.assignmentType === 'translation'
    ? [selected.sourceLanguage, selected.targetLanguage].filter(Boolean).join(' → ')
    : selected?.sourceLanguage;

  return (
    <main className="review-mode">
      <header className="review-mode__header">
        <div>
          <div className="review-mode__eyebrow">Open Manuscript Studio</div>
          <h1>Editorial Assignment</h1>
          <p>Your access is limited to the assignment granted by the editor. Identity data is exposed only according to the assignment privacy policy.</p>
        </div>
        <a className="review-mode__back" href="/">Back to Studio</a>
      </header>

      {error ? <div className="review-mode__error" role="alert">{error}</div> : null}

      <div className="review-mode__layout">
        <aside className="review-mode__list" aria-label="Assigned editorial tasks">
          <h2>Assigned tasks</h2>
          {reviews.length ? reviews.map((review) => (
            <button
              key={review.id}
              type="button"
              className={`review-mode__assignment${selected?.id === review.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(review.id)}
            >
              <strong>{review.reviewerAlias}</strong>
              <span>{assignmentLabels[review.assignmentType]}</span>
              {review.assignmentType === 'translation' ? (
                <span>{review.sourceLanguage ?? '?'} → {review.targetLanguage ?? '?'}</span>
              ) : review.sourceLanguage ? <span>{review.sourceLanguage}</span> : null}
              <span>Manuscript {review.manuscriptId}</span>
              <span>Round {review.reviewRound} · {review.status.replace('_', ' ')}</span>
            </button>
          )) : <p className="review-mode__empty">No editorial assignments.</p>}
        </aside>

        <section className="review-mode__content">
          {!selected ? <div className="review-mode__card"><p>No assignment selected.</p></div> : (
            <>
              <section className="review-mode__card review-mode__summary">
                <div>
                  <div className="review-mode__eyebrow">{assignmentLabel}</div>
                  <h2>{manuscript?.title ?? `Manuscript ${selected.manuscriptId}`}</h2>
                  <p>Round {selected.reviewRound} · {selected.anonymityMode.replace('_', ' ')}{languagePair ? ` · ${languagePair}` : ''}</p>
                </div>
                <span className="review-mode__status">{selected.status.replace('_', ' ')}</span>
              </section>

              <section className="review-mode__card review-mode__manuscript" aria-busy={manuscriptLoading}>
                <div className="review-mode__identity-notice">
                  This workspace contains only the identity information permitted for this assignment. Author-facing revisions never expose your account identifiers.
                </div>
                {manuscriptLoading ? <p>Loading manuscript…</p> : manuscript ? (
                  canWrite && revision ? (
                    <RevisionEditor
                      original={manuscript}
                      revision={revision}
                      disabled={busy}
                      dirty={revisionDirty}
                      saved={revisionSaved}
                      label={assignmentLabel}
                      capabilities={editorCapabilities}
                      manuscriptLanguage={manuscriptLanguage}
                      onChange={updateRevision}
                      onSave={() => void saveRevision()}
                    />
                  ) : <ManuscriptView manuscript={revision ?? manuscript} />
                ) : <p>The manuscript has not yet been attached to this assignment.</p>}
              </section>

              {selected.status === 'invited' ? (
                <section className="review-mode__card">
                  <h2>Assignment invitation</h2>
                  <p>Accept the assignment to begin work, or decline it.</p>
                  <div className="review-mode__actions">
                    <button disabled={busy} onClick={() => void run(() => acceptAssignedReview(selected.id))}>Accept assignment</button>
                    <button className="secondary" disabled={busy} onClick={() => void run(() => declineAssignedReview(selected.id))}>Decline</button>
                  </div>
                </section>
              ) : null}

              {selected.status === 'declined' ? <section className="review-mode__card"><p>This assignment was declined.</p></section> : null}

              {canWrite ? (
                <>
                  <section className="review-mode__card">
                    <h2>Comments to author</h2>
                    <p>These comments may be shown to the author under the assignment alias, not your account identity.</p>
                    <textarea value={authorComment} onChange={(event) => setAuthorComment(event.target.value)} rows={8} placeholder="Write comments for the author…" />
                    <button disabled={busy || !authorComment.trim()} onClick={() => void run(async () => {
                      const updated = await addAssignedReviewFeedback(selected.id, 'AUTHOR_AND_EDITOR', authorComment);
                      setAuthorComment('');
                      return updated;
                    })}>Save comment</button>
                  </section>

                  <section className="review-mode__card">
                    <h2>Confidential comments to editor</h2>
                    <p>These comments are never included in the author-facing response.</p>
                    <textarea value={editorComment} onChange={(event) => setEditorComment(event.target.value)} rows={5} placeholder="Write a confidential note to the editor…" />
                    <button disabled={busy || !editorComment.trim()} onClick={() => void run(async () => {
                      const updated = await addAssignedReviewFeedback(selected.id, 'EDITOR_ONLY', editorComment);
                      setEditorComment('');
                      return updated;
                    })}>Save confidential note</button>
                  </section>

                  <section className="review-mode__card">
                    <h2>{selected.requiresRecommendation ? 'Recommendation' : 'Complete assignment'}</h2>
                    {selected.requiresRecommendation ? (
                      <select value={recommendation} onChange={(event) => setRecommendation(event.target.value as typeof recommendation)}>
                        {recommendationOptions.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </select>
                    ) : <p>Submit the completed {assignmentLabel.toLowerCase()} to the editor. No scientific accept/revise/reject recommendation is required.</p>}
                    {revisionDirty ? <p className="review-mode__warning">Save the manuscript revision before submitting the assignment.</p> : null}
                    <button
                      className="review-mode__submit"
                      disabled={busy || revisionDirty}
                      onClick={() => void run(() => submitAssignedReview(selected.id, selected.requiresRecommendation ? recommendation : undefined))}
                    >
                      {selected.requiresRecommendation ? 'Submit review' : 'Submit assignment'}
                    </button>
                  </section>
                </>
              ) : null}

              {selected.feedback.length ? (
                <section className="review-mode__card">
                  <h2>Saved notes</h2>
                  <div className="review-mode__feedback-list">
                    {selected.feedback.map((feedback) => (
                      <article key={feedback.id} className="review-mode__feedback">
                        <strong>{feedback.visibility === 'editor_only' ? 'Confidential to editor' : 'Visible to author under assignment alias'}</strong>
                        <p>{feedback.body}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {submitted ? (
                <section className="review-mode__card review-mode__submitted">
                  <h2>Assignment submitted</h2>
                  {selected.requiresRecommendation ? (
                    <p>Your recommendation: <strong>{selected.recommendation?.replace('_', ' ')}</strong>. Author-facing data remains privacy-filtered.</p>
                  ) : <p>The {assignmentLabel.toLowerCase()} has been submitted to the editor.</p>}
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function RevisionEditor({
  original,
  revision,
  disabled,
  dirty,
  saved,
  label,
  capabilities,
  manuscriptLanguage,
  onChange,
  onSave,
}: {
  original: ReviewManuscriptSnapshot;
  revision: ReviewManuscriptSnapshot;
  disabled: boolean;
  dirty: boolean;
  saved: boolean;
  label: string;
  capabilities: EditorCapabilities;
  manuscriptLanguage?: string;
  onChange: (value: ReviewManuscriptSnapshot) => void;
  onSave: () => void;
}) {
  return (
    <div className="review-mode__revision">
      <div className="review-mode__revision-toolbar">
        <div>
          <h2>{label} revision</h2>
          <p>Edit the assigned working copy. The source snapshot remains unchanged.</p>
        </div>
        <div className="review-mode__revision-actions">
          {dirty ? <span>Unsaved changes</span> : saved ? <span>Revision saved</span> : null}
          <button disabled={disabled || !dirty} onClick={onSave}>Save revision</button>
        </div>
      </div>

      {revision.blocks.map((block, index) => {
        const originalBlock = original.blocks[index];
        if (!isReviewTextBlock(block)) {
          return (
            <div key={index} className="review-mode__revision-block">
              <div className="review-mode__revision-label"><span>{blockLabel(block)}</span></div>
              <div className="review-mode__revision-structured">
                <ReviewStructuredBlock block={block} />
                <p className="review-mode__revision-structured-note">Structured element preserved in the review copy.</p>
              </div>
            </div>
          );
        }

        const originalText = originalBlock && isReviewTextBlock(originalBlock) ? originalBlock.text : '';
        const changed = block.text !== originalText || JSON.stringify(block.richText ?? []) !== JSON.stringify(
          originalBlock && isReviewTextBlock(originalBlock) ? originalBlock.richText ?? [] : [],
        );

        return (
          <div key={index} className={`review-mode__revision-block${changed ? ' is-changed' : ''}`}>
            <div className="review-mode__revision-label">
              <span>{blockLabel(block)}</span>
              {changed ? <strong>Revised</strong> : null}
            </div>
            <ReviewerRichTextEditor
              block={block}
              disabled={disabled}
              capabilities={capabilities}
              manuscriptLanguage={manuscriptLanguage}
              onChange={(updated) => {
                const blocks = revision.blocks.map((item, itemIndex) =>
                  itemIndex === index ? updated as ReviewManuscriptBlock : item,
                );
                onChange({ ...revision, blocks });
              }}
            />
            {changed ? (
              <details className="review-mode__original-text">
                <summary>Show original</summary>
                <ReviewStructuredBlock block={originalBlock && isReviewTextBlock(originalBlock) ? originalBlock : block} />
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ManuscriptView({ manuscript }: { manuscript: ReviewManuscriptSnapshot }) {
  return (
    <article className="review-mode__document">
      <h1>{manuscript.title}</h1>
      {manuscript.subtitle ? <p className="review-mode__subtitle">{manuscript.subtitle}</p> : null}
      {manuscript.abstract ? (
        <section className="review-mode__abstract"><h2>Abstract</h2><p>{manuscript.abstract}</p></section>
      ) : null}
      {manuscript.keywords.length ? <p className="review-mode__keywords"><strong>Keywords:</strong> {manuscript.keywords.join(', ')}</p> : null}
      <div className="review-mode__body" role="document">
        {manuscript.blocks.map((block, index) => <ReviewStructuredBlock key={index} block={block} />)}
      </div>
    </article>
  );
}

function blockLabel(block: ReviewManuscriptBlock): string {
  if (block.type === 'heading') return `Heading ${block.level ?? 2}`;
  if (block.type === 'list') return block.ordered ? 'Numbered list item' : 'Bullet list item';
  if (block.type === 'table') return 'Table';
  if (block.type === 'image') return 'Image';
  if (block.type === 'chart') return 'Chart';
  return block.type;
}
