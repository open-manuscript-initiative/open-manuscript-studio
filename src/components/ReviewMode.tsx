import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  RotateCcw,
} from 'lucide-react';

import {
  getEditorCapabilities,
  type EditorCapabilities,
  type EditorRole,
} from '../editor/editorCapabilities';
import {
  classifyProofingTextChange,
  createProofingTextDiff,
  type ProofingSelection,
} from '../model/proofing';
import {
  acceptAssignedReview,
  addAssignedReviewFeedback,
  declineAssignedReview,
  getAssignedReview,
  getAssignedReviewManuscript,
  getAssignedReviewRevision,
  listAssignedReviews,
  saveAssignedReviewRevision,
  submitAssignedReview,
  type ReviewerAssignment,
  type ReviewManuscriptBlock,
  type ReviewManuscriptSnapshot,
} from '../services/peerReviewApi';
import { OjsReviewFormCard } from './OjsReviewFormCard';
import { ProofingColorLegend } from './ProofingColorLegend';
import { ReviewerRichTextEditor } from './ReviewerRichTextEditor';
import { isReviewTextBlock, ReviewStructuredBlock } from './ReviewStructuredBlock';
import './ReviewMode.css';

type ReviewLocale = 'en' | 'hu' | 'de';

type ReviewCopy = {
  title: string;
  intro: string;
  back: string;
  tasks: string;
  noTasks: string;
  noSelection: string;
  manuscript: string;
  round: string;
  identityNotice: string;
  loading: string;
  unattached: string;
  invitation: string;
  invitationText: string;
  accept: string;
  decline: string;
  declined: string;
  authorComments: string;
  authorCommentsHelp: string;
  authorPlaceholder: string;
  saveComment: string;
  editorComments: string;
  editorCommentsHelp: string;
  editorPlaceholder: string;
  saveConfidential: string;
  recommendation: string;
  complete: string;
  noRecommendation: string;
  saveBeforeSubmit: string;
  submitReview: string;
  submitAssignment: string;
  savedNotes: string;
  confidential: string;
  visibleToAuthor: string;
  submitted: string;
  yourRecommendation: string;
  submittedToEditor: string;
  revision: string;
  revisionHelp: string;
  unsaved: string;
  revisionSaved: string;
  saveRevision: string;
  structuredPreserved: string;
  revised: string;
  showOriginal: string;
  abstract: string;
  keywords: string;
  heading: string;
  numberedList: string;
  bulletList: string;
  table: string;
  image: string;
  chart: string;
  assignmentLabels: Record<ReviewerAssignment['assignmentType'], string>;
  recommendationLabels: Record<'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT', string>;
};

const reviewCopies: Record<ReviewLocale, ReviewCopy> = {
  en: {
    title: 'Editorial Assignment', intro: 'Your access is limited to the assignment granted by the editor. Identity data is exposed only according to the assignment privacy policy.', back: 'Back to Studio', tasks: 'Assigned tasks', noTasks: 'No editorial assignments.', noSelection: 'No assignment selected.', manuscript: 'Article', round: 'Round', identityNotice: 'This article view contains no author identity. Your account identifiers also remain hidden from author-facing revisions.', loading: 'Loading article…', unattached: 'The article has not yet been attached to this assignment.', invitation: 'Assignment invitation', invitationText: 'Accept the assignment to begin work, or decline it.', accept: 'Accept assignment', decline: 'Decline', declined: 'This assignment was declined.', authorComments: 'Comments to author', authorCommentsHelp: 'These comments may be shown to the author under the assignment alias, not your account identity.', authorPlaceholder: 'Write comments for the author…', saveComment: 'Save comment', editorComments: 'Confidential comments to editor', editorCommentsHelp: 'These comments are never included in the author-facing response.', editorPlaceholder: 'Write a confidential note to the editor…', saveConfidential: 'Save confidential note', recommendation: 'Recommendation', complete: 'Complete assignment', noRecommendation: 'Submit the completed assignment to the editor. No scientific accept/revise/reject recommendation is required.', saveBeforeSubmit: 'Save the article revision before submitting the assignment.', submitReview: 'Submit review', submitAssignment: 'Submit assignment', savedNotes: 'Saved notes', confidential: 'Confidential to editor', visibleToAuthor: 'Visible to author under assignment alias', submitted: 'Assignment submitted', yourRecommendation: 'Your recommendation', submittedToEditor: 'The assignment has been submitted to the editor.', revision: 'revision', revisionHelp: 'Edit the assigned article copy. The source snapshot remains unchanged.', unsaved: 'Unsaved changes', revisionSaved: 'Revision saved', saveRevision: 'Save revision', structuredPreserved: 'Structured element preserved in the review copy.', revised: 'Revised', showOriginal: 'Show original', abstract: 'Abstract', keywords: 'Keywords', heading: 'Heading', numberedList: 'Numbered list item', bulletList: 'Bullet list item', table: 'Table', image: 'Image', chart: 'Chart', assignmentLabels: { scientific_review: 'Scientific peer review', language_review: 'Language review', translation: 'Translation', editorial_revision: 'Editorial revision' }, recommendationLabels: { ACCEPT: 'Accept', MINOR_REVISION: 'Minor revision', MAJOR_REVISION: 'Major revision', REJECT: 'Reject' },
  },
  hu: {
    title: 'Lektori megbízás', intro: 'Hozzáférése a szerkesztő által megadott megbízásra korlátozódik. A személyazonosító adatok csak a megbízás adatvédelmi szabályai szerint jelennek meg.', back: 'Vissza a Stúdióhoz', tasks: 'Kijelölt feladatok', noTasks: 'Nincs lektori vagy szerkesztői megbízás.', noSelection: 'Nincs kiválasztott megbízás.', manuscript: 'Cikk', round: 'Forduló', identityNotice: 'Ebben a cikknézetben a szerző személyazonossága nem érhető el. A szerzőnek átadott javítások az Ön fiókazonosítóit sem fedik fel.', loading: 'Cikk betöltése…', unattached: 'Ehhez a megbízáshoz még nincs cikk csatolva.', invitation: 'Lektori felkérés', invitationText: 'A munka megkezdéséhez fogadja el a felkérést, vagy utasítsa vissza.', accept: 'Felkérés elfogadása', decline: 'Visszautasítás', declined: 'A megbízást visszautasították.', authorComments: 'Megjegyzések a szerzőnek', authorCommentsHelp: 'Ezek a megjegyzések a megbízás álnevével jelenhetnek meg a szerző számára, nem az Ön fiókazonosítójával.', authorPlaceholder: 'Írjon megjegyzést a szerzőnek…', saveComment: 'Megjegyzés mentése', editorComments: 'Bizalmas megjegyzések a szerkesztőnek', editorCommentsHelp: 'Ezek a megjegyzések nem kerülnek bele a szerzőnek küldött válaszba.', editorPlaceholder: 'Írjon bizalmas megjegyzést a szerkesztőnek…', saveConfidential: 'Bizalmas megjegyzés mentése', recommendation: 'Javaslat', complete: 'Megbízás befejezése', noRecommendation: 'Küldje be a befejezett megbízást a szerkesztőnek. Tudományos elfogadási/módosítási/elutasítási javaslat nem szükséges.', saveBeforeSubmit: 'A beküldés előtt mentse a cikk javított változatát.', submitReview: 'Lektori vélemény beküldése', submitAssignment: 'Megbízás beküldése', savedNotes: 'Mentett megjegyzések', confidential: 'Bizalmas a szerkesztőnek', visibleToAuthor: 'A szerző számára a megbízás álnevével látható', submitted: 'Megbízás beküldve', yourRecommendation: 'Az Ön javaslata', submittedToEditor: 'A megbízást beküldték a szerkesztőnek.', revision: 'javítás', revisionHelp: 'Szerkessze a kijelölt cikk munkapéldányát. A forrás-pillanatkép változatlan marad.', unsaved: 'Nem mentett változások', revisionSaved: 'Javítás mentve', saveRevision: 'Javítás mentése', structuredPreserved: 'A strukturált elem megmarad a lektori példányban.', revised: 'Módosítva', showOriginal: 'Eredeti megjelenítése', abstract: 'Absztrakt', keywords: 'Kulcsszavak', heading: 'Címsor', numberedList: 'Számozott listaelem', bulletList: 'Felsorolás elem', table: 'Táblázat', image: 'Kép', chart: 'Diagram', assignmentLabels: { scientific_review: 'Tudományos lektorálás', language_review: 'Nyelvi lektorálás', translation: 'Fordítás', editorial_revision: 'Szerkesztői javítás' }, recommendationLabels: { ACCEPT: 'Elfogadás', MINOR_REVISION: 'Kisebb javítás', MAJOR_REVISION: 'Nagyobb javítás', REJECT: 'Elutasítás' },
  },
  de: {
    title: 'Redaktioneller Auftrag', intro: 'Ihr Zugriff ist auf den von der Redaktion erteilten Auftrag beschränkt. Identitätsdaten werden nur gemäß den Datenschutzregeln des Auftrags angezeigt.', back: 'Zurück zum Studio', tasks: 'Zugewiesene Aufgaben', noTasks: 'Keine redaktionellen Aufträge.', noSelection: 'Kein Auftrag ausgewählt.', manuscript: 'Artikel', round: 'Runde', identityNotice: 'Diese Artikelansicht enthält keine Autorenidentität. Auch Ihre Kontoidentifikatoren bleiben in autorenseitigen Überarbeitungen verborgen.', loading: 'Artikel wird geladen…', unattached: 'Diesem Auftrag wurde noch kein Artikel zugeordnet.', invitation: 'Einladung zum Auftrag', invitationText: 'Nehmen Sie den Auftrag an, um mit der Arbeit zu beginnen, oder lehnen Sie ihn ab.', accept: 'Auftrag annehmen', decline: 'Ablehnen', declined: 'Dieser Auftrag wurde abgelehnt.', authorComments: 'Kommentare an die Autorin oder den Autor', authorCommentsHelp: 'Diese Kommentare können unter dem Auftragsalias angezeigt werden, nicht unter Ihrer Kontoidentität.', authorPlaceholder: 'Kommentare für die Autorin oder den Autor…', saveComment: 'Kommentar speichern', editorComments: 'Vertrauliche Kommentare an die Redaktion', editorCommentsHelp: 'Diese Kommentare werden niemals in die Antwort an die Autorin oder den Autor aufgenommen.', editorPlaceholder: 'Vertrauliche Notiz an die Redaktion…', saveConfidential: 'Vertrauliche Notiz speichern', recommendation: 'Empfehlung', complete: 'Auftrag abschließen', noRecommendation: 'Reichen Sie den abgeschlossenen Auftrag bei der Redaktion ein. Eine wissenschaftliche Annahme-/Überarbeitungs-/Ablehnungsempfehlung ist nicht erforderlich.', saveBeforeSubmit: 'Speichern Sie die Artikelüberarbeitung vor dem Einreichen.', submitReview: 'Gutachten einreichen', submitAssignment: 'Auftrag einreichen', savedNotes: 'Gespeicherte Notizen', confidential: 'Vertraulich für die Redaktion', visibleToAuthor: 'Für die Autorin oder den Autor unter dem Auftragsalias sichtbar', submitted: 'Auftrag eingereicht', yourRecommendation: 'Ihre Empfehlung', submittedToEditor: 'Der Auftrag wurde bei der Redaktion eingereicht.', revision: 'Überarbeitung', revisionHelp: 'Bearbeiten Sie die zugewiesene Artikelkopie. Der Quell-Snapshot bleibt unverändert.', unsaved: 'Nicht gespeicherte Änderungen', revisionSaved: 'Überarbeitung gespeichert', saveRevision: 'Überarbeitung speichern', structuredPreserved: 'Strukturiertes Element bleibt in der Gutachtenkopie erhalten.', revised: 'Überarbeitet', showOriginal: 'Original anzeigen', abstract: 'Zusammenfassung', keywords: 'Schlagwörter', heading: 'Überschrift', numberedList: 'Nummerierter Listeneintrag', bulletList: 'Aufzählungspunkt', table: 'Tabelle', image: 'Bild', chart: 'Diagramm', assignmentLabels: { scientific_review: 'Wissenschaftliches Gutachten', language_review: 'Sprachlektorat', translation: 'Übersetzung', editorial_revision: 'Redaktionelle Überarbeitung' }, recommendationLabels: { ACCEPT: 'Annehmen', MINOR_REVISION: 'Kleine Überarbeitung', MAJOR_REVISION: 'Große Überarbeitung', REJECT: 'Ablehnen' },
  },
};

const recommendationValues = ['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT'] as const;

const assignmentEditorRoles: Record<ReviewerAssignment['assignmentType'], EditorRole> = {
  scientific_review: 'scientific-review',
  language_review: 'language-review',
  translation: 'translation',
  editorial_revision: 'editorial-revision',
};

export function ReviewMode({ assignmentId }: { assignmentId?: string }) {
  const [reviews, setReviews] = useState<ReviewerAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manuscript, setManuscript] = useState<ReviewManuscriptSnapshot | null>(null);
  const [revision, setRevision] = useState<ReviewManuscriptSnapshot | null>(null);
  const [manuscriptLoading, setManuscriptLoading] = useState(false);
  const [revisionDirty, setRevisionDirty] = useState(false);
  const [revisionSaved, setRevisionSaved] = useState(false);
  const [authorComment, setAuthorComment] = useState('');
  const [editorComment, setEditorComment] = useState('');
  const [recommendation, setRecommendation] = useState<(typeof recommendationValues)[number]>('MINOR_REVISION');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setError(null);
        const next = assignmentId
          ? [await getAssignedReview(assignmentId)]
          : await listAssignedReviews();
        if (!active) return;
        setReviews(next);
        setSelectedId(assignmentId ?? next[0]?.id ?? null);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load the review assignment.');
        setReviews([]);
        setSelectedId(null);
      }
    })();
    return () => { active = false; };
  }, [assignmentId]);

  const selected = useMemo(
    () => reviews.find((review) => review.id === selectedId) ?? reviews[0],
    [reviews, selectedId],
  );
  const locale = normalizeReviewLocale(selected?.sourceLanguage);
  const copy = reviewCopies[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
        setError(caught instanceof Error ? caught.message : copy.unattached);
        setManuscript(null);
        setRevision(null);
      })
      .finally(() => { if (active) setManuscriptLoading(false); });
    return () => { active = false; };
  }, [selected?.id, copy.unattached]);

  async function run(action: () => Promise<ReviewerAssignment>): Promise<boolean> {
    try {
      setBusy(true);
      setError(null);
      const updated = await action();
      setReviews((current) => current.map((item) => item.id === updated.id ? updated : item));
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.noTasks);
      return false;
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
      setError(caught instanceof Error ? caught.message : copy.saveRevision);
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
  const assignmentLabel = selected ? copy.assignmentLabels[selected.assignmentType] : copy.title;
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
    <main className="review-mode" lang={locale}>
      <header className="review-mode__header">
        <div>
          <div className="review-mode__eyebrow">Open Manuscript Studio</div>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <a className="review-mode__back" href="/">{copy.back}</a>
      </header>

      {error ? <div className="review-mode__error" role="alert">{error}</div> : null}

      <div className={`review-mode__layout${assignmentId ? ' review-mode__layout--single' : ''}`}>
        {!assignmentId ? <aside className="review-mode__list" aria-label={copy.tasks}>
          <h2>{copy.tasks}</h2>
          {reviews.length ? reviews.map((review) => {
            const reviewCopy = reviewCopies[normalizeReviewLocale(review.sourceLanguage)];
            return (
              <button key={review.id} type="button" className={`review-mode__assignment${selected?.id === review.id ? ' is-active' : ''}`} onClick={() => setSelectedId(review.id)}>
                <strong>{review.reviewerAlias}</strong>
                <span>{reviewCopy.assignmentLabels[review.assignmentType]}</span>
                {review.assignmentType === 'translation' ? <span>{review.sourceLanguage ?? '?'} → {review.targetLanguage ?? '?'}</span> : review.sourceLanguage ? <span>{review.sourceLanguage}</span> : null}
                <span>{reviewCopy.manuscript} {review.manuscriptId}</span>
                <span>{reviewCopy.round} {review.reviewRound} · {review.status.replace('_', ' ')}</span>
              </button>
            );
          }) : <p className="review-mode__empty">{copy.noTasks}</p>}
        </aside> : null}

        <section className="review-mode__content">
          {!selected ? <div className="review-mode__card"><p>{copy.noSelection}</p></div> : (
            <>
              <section className="review-mode__card review-mode__summary">
                <div>
                  <div className="review-mode__eyebrow">{assignmentLabel}</div>
                  <h2>{manuscript?.title ?? `${copy.manuscript} ${selected.manuscriptId}`}</h2>
                  <p>{copy.round} {selected.reviewRound} · {selected.anonymityMode.replace('_', ' ')}{languagePair ? ` · ${languagePair}` : ''}</p>
                </div>
                <span className="review-mode__status">{selected.status.replace('_', ' ')}</span>
              </section>

              <section className="review-mode__card review-mode__manuscript" aria-busy={manuscriptLoading}>
                <div className="review-mode__identity-notice">{copy.identityNotice}</div>
                {manuscriptLoading ? <p>{copy.loading}</p> : manuscript ? (
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
                      locale={locale}
                      copy={copy}
                      onChange={updateRevision}
                      onSave={() => void saveRevision()}
                      onAddFeedback={(visibility, body) => run(() =>
                        addAssignedReviewFeedback(selected.id, visibility, body)
                      )}
                    />
                  ) : <ManuscriptView manuscript={revision ?? manuscript} copy={copy} />
                ) : <p>{copy.unattached}</p>}
              </section>

              {selected.status === 'invited' ? (
                <section className="review-mode__card">
                  <h2>{copy.invitation}</h2><p>{copy.invitationText}</p>
                  <div className="review-mode__actions">
                    <button disabled={busy} onClick={() => void run(() => acceptAssignedReview(selected.id))}>{copy.accept}</button>
                    <button className="secondary" disabled={busy} onClick={() => void run(() => declineAssignedReview(selected.id))}>{copy.decline}</button>
                  </div>
                </section>
              ) : null}

              {selected.status === 'declined' ? <section className="review-mode__card"><p>{copy.declined}</p></section> : null}

              {selected.status !== 'invited' && selected.status !== 'declined' ? (
                <OjsReviewFormCard
                  assignmentId={selected.id}
                  locale={locale}
                  disabled={!canWrite || busy}
                  onError={setError}
                />
              ) : null}

              {canWrite ? (
                <>
                  <section className="review-mode__card">
                    <h2>{copy.authorComments}</h2><p>{copy.authorCommentsHelp}</p>
                    <textarea value={authorComment} onChange={(event) => setAuthorComment(event.target.value)} rows={8} placeholder={copy.authorPlaceholder} />
                    <button disabled={busy || !authorComment.trim()} onClick={() => void run(async () => { const updated = await addAssignedReviewFeedback(selected.id, 'AUTHOR_AND_EDITOR', authorComment); setAuthorComment(''); return updated; })}>{copy.saveComment}</button>
                  </section>

                  <section className="review-mode__card">
                    <h2>{copy.editorComments}</h2><p>{copy.editorCommentsHelp}</p>
                    <textarea value={editorComment} onChange={(event) => setEditorComment(event.target.value)} rows={5} placeholder={copy.editorPlaceholder} />
                    <button disabled={busy || !editorComment.trim()} onClick={() => void run(async () => { const updated = await addAssignedReviewFeedback(selected.id, 'EDITOR_ONLY', editorComment); setEditorComment(''); return updated; })}>{copy.saveConfidential}</button>
                  </section>

                  <section className="review-mode__card">
                    <h2>{selected.requiresRecommendation ? copy.recommendation : copy.complete}</h2>
                    {selected.requiresRecommendation ? (
                      <select value={recommendation} onChange={(event) => setRecommendation(event.target.value as typeof recommendation)}>
                        {recommendationValues.map((value) => <option key={value} value={value}>{copy.recommendationLabels[value]}</option>)}
                      </select>
                    ) : <p>{copy.noRecommendation}</p>}
                    {revisionDirty ? <p className="review-mode__warning">{copy.saveBeforeSubmit}</p> : null}
                    <button className="review-mode__submit" disabled={busy || revisionDirty} onClick={() => void run(() => submitAssignedReview(selected.id, selected.requiresRecommendation ? recommendation : undefined))}>{selected.requiresRecommendation ? copy.submitReview : copy.submitAssignment}</button>
                  </section>
                </>
              ) : null}

              {selected.feedback.length ? (
                <section className="review-mode__card"><h2>{copy.savedNotes}</h2><div className="review-mode__feedback-list">
                  {selected.feedback.map((feedback) => <article key={feedback.id} className="review-mode__feedback"><strong>{feedback.visibility === 'editor_only' ? copy.confidential : copy.visibleToAuthor}</strong><p>{feedback.body}</p></article>)}
                </div></section>
              ) : null}

              {submitted ? (
                <section className="review-mode__card review-mode__submitted"><h2>{copy.submitted}</h2>
                  {selected.requiresRecommendation ? <p>{copy.yourRecommendation}: <strong>{selected.recommendation ? copy.recommendationLabels[selected.recommendation.toUpperCase() as keyof ReviewCopy['recommendationLabels']] : ''}</strong>.</p> : <p>{copy.submittedToEditor}</p>}
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
  locale,
  copy,
  onChange,
  onSave,
  onAddFeedback,
}: {
  original: ReviewManuscriptSnapshot;
  revision: ReviewManuscriptSnapshot;
  disabled: boolean;
  dirty: boolean;
  saved: boolean;
  label: string;
  capabilities: EditorCapabilities;
  manuscriptLanguage?: string;
  locale: ReviewLocale;
  copy: ReviewCopy;
  onChange: (value: ReviewManuscriptSnapshot) => void;
  onSave: () => void;
  onAddFeedback: (
    visibility: 'AUTHOR_AND_EDITOR' | 'EDITOR_ONLY',
    body: string,
  ) => Promise<boolean>;
}) {
  const proofingCopy = reviewProofingCopy(locale);
  const [activeChangedIndex, setActiveChangedIndex] = useState(0);
  const [selection, setSelection] = useState<(ProofingSelection & { blockIndex: number }) | null>(null);
  const [comment, setComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'AUTHOR_AND_EDITOR' | 'EDITOR_ONLY'>(
    'AUTHOR_AND_EDITOR',
  );
  const changedIndices = revision.blocks.flatMap((block, index) =>
    reviewBlocksEqual(block, original.blocks[index]) ? [] : [index],
  );
  const normalizedActiveIndex = changedIndices.length
    ? Math.min(activeChangedIndex, changedIndices.length - 1)
    : 0;

  function navigateChanges(delta: number): void {
    if (!changedIndices.length) return;
    const nextIndex = (
      normalizedActiveIndex + delta + changedIndices.length
    ) % changedIndices.length;
    setActiveChangedIndex(nextIndex);
    document.getElementById(`review-change-${changedIndices[nextIndex]}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function restoreBlock(index: number): void {
    const source = original.blocks[index];
    if (!source) return;
    onChange({
      ...revision,
      blocks: revision.blocks.map((block, blockIndex) =>
        blockIndex === index ? structuredClone(source) : block,
      ),
    });
  }

  function restoreAll(): void {
    onChange({ ...revision, blocks: structuredClone(original.blocks) });
    setActiveChangedIndex(0);
  }

  async function submitSelectionComment(): Promise<void> {
    if (!selection?.text.trim() || !comment.trim()) return;
    const block = revision.blocks[selection.blockIndex];
    const body = `${proofingCopy.selectedExcerpt} (${block ? blockLabel(block, copy) : selection.blockIndex + 1}): “${selection.text.trim()}”\n\n${comment.trim()}`;
    if (await onAddFeedback(commentVisibility, body)) setComment('');
  }

  return (
    <div className="review-mode__revision">
      <div className="review-mode__revision-toolbar">
        <div><h2>{label} – {copy.revision}</h2><p>{copy.revisionHelp}</p></div>
        <div className="review-mode__revision-actions">
          {dirty ? <span>{copy.unsaved}</span> : saved ? <span>{copy.revisionSaved}</span> : null}
          <button disabled={disabled || !dirty} onClick={onSave}>{copy.saveRevision}</button>
        </div>
      </div>

      <div className="review-mode__proofing-toolbar" role="toolbar" aria-label={proofingCopy.proofing}>
        <strong>{proofingCopy.tracked(changedIndices.length)}</strong>
        <div className="review-mode__proofing-navigation">
          <button type="button" disabled={!changedIndices.length} onClick={() => navigateChanges(-1)} aria-label={proofingCopy.previous} title={proofingCopy.previous}><ChevronUp size={17} /></button>
          <button type="button" disabled={!changedIndices.length} onClick={() => navigateChanges(1)} aria-label={proofingCopy.next} title={proofingCopy.next}><ChevronDown size={17} /></button>
          <button type="button" disabled={!changedIndices.length || disabled} onClick={restoreAll}><RotateCcw size={16} />{proofingCopy.restoreAll}</button>
        </div>
      </div>

      <ProofingColorLegend locale={locale} mode="editor" />

      <div className="review-mode__selection-comment" data-proofing-kind="comment">
        <div className={selection?.text.trim() ? '' : 'is-empty'}>
          {selection?.text.trim() ? `“${selection.text.trim().slice(0, 180)}”` : proofingCopy.selectText}
        </div>
        <textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} disabled={disabled || !selection?.text.trim()} placeholder={proofingCopy.commentPlaceholder} />
        <div>
          <select value={commentVisibility} onChange={(event) => setCommentVisibility(event.target.value as typeof commentVisibility)} aria-label={proofingCopy.visibility}>
            <option value="AUTHOR_AND_EDITOR">{proofingCopy.authorAndEditor}</option>
            <option value="EDITOR_ONLY">{proofingCopy.editorOnly}</option>
          </select>
          <button type="button" disabled={disabled || !selection?.text.trim() || !comment.trim()} onClick={() => void submitSelectionComment()}><MessageSquarePlus size={16} />{proofingCopy.addComment}</button>
        </div>
      </div>

      {revision.blocks.map((block, index) => {
        const originalBlock = original.blocks[index];
        if (!isReviewTextBlock(block)) return <div key={index} className="review-mode__revision-block"><div className="review-mode__revision-label"><span>{blockLabel(block, copy)}</span></div><div className="review-mode__revision-structured"><ReviewStructuredBlock block={block} /><p className="review-mode__revision-structured-note">{copy.structuredPreserved}</p></div></div>;
        const originalText = originalBlock && isReviewTextBlock(originalBlock) ? originalBlock.text : '';
        const changed = !reviewBlocksEqual(block, originalBlock);
        const diff = changed ? createProofingTextDiff(originalText, block.text) : null;
        const changeKind = changed
          ? classifyProofingTextChange(originalText, block.text)
          : undefined;
        return (
          <div key={index} id={changed ? `review-change-${index}` : undefined} className={`review-mode__revision-block${changed ? ' is-changed' : ''}`} data-proofing-kind={changeKind}>
            <div className="review-mode__revision-label">
              <span>{blockLabel(block, copy)}</span>
              {changed ? <strong>{copy.revised}</strong> : null}
            </div>
            <ReviewerRichTextEditor
              block={block}
              disabled={disabled}
              capabilities={capabilities}
              manuscriptLanguage={manuscriptLanguage}
              onSelectionChange={(nextSelection) => setSelection(nextSelection
                ? { ...nextSelection, blockIndex: index }
                : null)}
              onChange={(updated) => {
                const blocks = revision.blocks.map((item, itemIndex) =>
                  itemIndex === index ? updated as ReviewManuscriptBlock : item,
                );
                onChange({ ...revision, blocks });
              }}
            />
            {changed && diff ? (
              <div className="review-mode__inline-diff omi-proofing-diff" aria-label={proofingCopy.exactChange}>
                <span>{diff.prefix}</span>
                {diff.removed ? <del>{diff.removed}</del> : null}
                {diff.inserted ? <ins>{diff.inserted}</ins> : null}
                <span>{diff.suffix}</span>
                {!diff.removed && !diff.inserted ? <em>{proofingCopy.formattingChanged}</em> : null}
              </div>
            ) : null}
            {changed ? (
              <div className="review-mode__change-actions">
                <details className="review-mode__original-text"><summary>{copy.showOriginal}</summary><ReviewStructuredBlock block={originalBlock && isReviewTextBlock(originalBlock) ? originalBlock : block} /></details>
                <button type="button" disabled={disabled} onClick={() => restoreBlock(index)}><RotateCcw size={15} />{proofingCopy.restoreChange}</button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function reviewBlocksEqual(
  block: ReviewManuscriptBlock,
  original: ReviewManuscriptBlock | undefined,
): boolean {
  return Boolean(original) && JSON.stringify(block) === JSON.stringify(original);
}

function reviewProofingCopy(locale: ReviewLocale) {
  if (locale === 'hu') return {
    proofing: 'Korrektúra és változáskövetés', tracked: (count: number) => `${count} követett változás`, previous: 'Előző változás', next: 'Következő változás', restoreChange: 'Javítás visszavonása', restoreAll: 'Összes visszavonása', selectText: 'Jelöljön ki szöveget a cikkben célzott lektori megjegyzéshez.', commentPlaceholder: 'Megjegyzés a kijelölt részhez…', visibility: 'Megjegyzés láthatósága', authorAndEditor: 'Szerzőnek és szerkesztőnek', editorOnly: 'Csak a szerkesztőnek', addComment: 'Megjegyzés', selectedExcerpt: 'Kijelölt rész', exactChange: 'Pontos szövegváltozás', formattingChanged: 'A szöveg formázása módosult.',
  };
  if (locale === 'de') return {
    proofing: 'Korrektur und Änderungsverfolgung', tracked: (count: number) => `${count} nachverfolgte Änderungen`, previous: 'Vorherige Änderung', next: 'Nächste Änderung', restoreChange: 'Änderung zurücknehmen', restoreAll: 'Alle zurücknehmen', selectText: 'Markieren Sie Text für einen gezielten Gutachterkommentar.', commentPlaceholder: 'Kommentar zur Auswahl…', visibility: 'Sichtbarkeit', authorAndEditor: 'Autor und Redaktion', editorOnly: 'Nur Redaktion', addComment: 'Kommentar', selectedExcerpt: 'Markierter Text', exactChange: 'Genaue Textänderung', formattingChanged: 'Die Textformatierung wurde geändert.',
  };
  return {
    proofing: 'Proofing and tracked changes', tracked: (count: number) => `${count} tracked changes`, previous: 'Previous change', next: 'Next change', restoreChange: 'Undo change', restoreAll: 'Undo all', selectText: 'Select text in the article for a targeted review comment.', commentPlaceholder: 'Comment on the selection…', visibility: 'Comment visibility', authorAndEditor: 'Author and editor', editorOnly: 'Editor only', addComment: 'Comment', selectedExcerpt: 'Selected excerpt', exactChange: 'Exact text change', formattingChanged: 'Text formatting changed.',
  };
}

function ManuscriptView({ manuscript, copy }: { manuscript: ReviewManuscriptSnapshot; copy: ReviewCopy }) {
  return <article className="review-mode__document" data-review-document-kind={manuscript.documentKind} data-author-identity={manuscript.authorIdentity}><h1>{manuscript.title}</h1>{manuscript.subtitle ? <p className="review-mode__subtitle">{manuscript.subtitle}</p> : null}{manuscript.abstract ? <section className="review-mode__abstract"><h2>{copy.abstract}</h2><p>{manuscript.abstract}</p></section> : null}{manuscript.keywords.length ? <p className="review-mode__keywords"><strong>{copy.keywords}:</strong> {manuscript.keywords.join(', ')}</p> : null}<div className="review-mode__body" role="document">{manuscript.blocks.map((block, index) => <ReviewStructuredBlock key={index} block={block} />)}</div></article>;
}

function blockLabel(block: ReviewManuscriptBlock, copy: ReviewCopy): string {
  if (block.type === 'heading') return `${copy.heading} ${block.level ?? 2}`;
  if (block.type === 'list') return block.ordered ? copy.numberedList : copy.bulletList;
  if (block.type === 'table') return copy.table;
  if (block.type === 'image') return copy.image;
  if (block.type === 'chart') return copy.chart;
  return block.type;
}

function normalizeReviewLocale(value?: string): ReviewLocale {
  const normalized = value?.trim().toLowerCase().replace('_', '-') ?? '';
  if (normalized === 'hu' || normalized.startsWith('hu-')) return 'hu';
  if (normalized === 'de' || normalized.startsWith('de-')) return 'de';
  return 'en';
}
