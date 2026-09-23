import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '../i18n';
import { createAccountHolderApprovedAssurance } from '../integrations/webPublicationContract';
import { getWebPublicationAssuranceEvidence } from '../services/integrationApi';
import {
  acceptNativeSubmission,
  assignNativeReviewer,
  claimNativeSubmission,
  completeNativeReview,
  listNativeEditorialInbox,
  rejectNativeSubmission,
  requestNativeRevision,
  type NativeSubmission,
} from '../services/nativeEditorialWorkflowApi';
import { prepareWebPublicationArtifact } from '../services/webPublicationArtifact';
import { loadEditorReviewOverview } from './EditorReviewMode';

const COPY = {
  en: {
    title: 'Studio-native editorial inbox',
    intro: 'DNS-verified venues without OJS/OMP. OJS/OMP submissions remain authoritative in their external platform.',
    empty: 'No Studio-native submissions are waiting for this editor.',
    claim: 'Take editorial responsibility',
    reviewerEmail: 'Reviewer Studio e-mail',
    assignReviewer: 'Assign scientific reviewer',
    complete: 'Close submitted review',
    requestRevision: 'Request revision',
    reject: 'Reject manuscript',
    accept: 'Accept exact revision',
    note: 'Message to author',
    noDecision: 'Editorial acceptance requires a completed scientific review round.',
    busy: 'Working…',
    author: 'Author',
    editor: 'Editor',
    assignedElsewhere: 'This submission is assigned to another editor. You can inspect it, but only the assigned editor can change its workflow.',
    round: 'Round',
  },
  hu: {
    title: 'Studio-native szerkesztői beérkezések',
    intro: 'DNS-sel hitelesített, OJS/OMP nélküli publikációs helyek. OJS/OMP esetén továbbra is a külső rendszer authoritative.',
    empty: 'Ehhez a szerkesztőhöz jelenleg nincs Studio-native beérkezés.',
    claim: 'Szerkesztői felelősség átvétele',
    reviewerEmail: 'Lektor Studio e-mail-címe',
    assignReviewer: 'Tudományos lektor kijelölése',
    complete: 'Beadott lektorálás lezárása',
    requestRevision: 'Javítás kérése',
    reject: 'Kézirat elutasítása',
    accept: 'Pontos revízió elfogadása',
    note: 'Üzenet a szerzőnek',
    noDecision: 'A szerkesztői elfogadáshoz lezárt tudományos lektori forduló szükséges.',
    busy: 'Folyamatban…',
    author: 'Szerző',
    editor: 'Szerkesztő',
    assignedElsewhere: 'Ezt a kéziratot másik szerkesztő vette át. Megtekintheted, de a workflow-t csak a kijelölt szerkesztő módosíthatja.',
    round: 'Forduló',
  },
  de: {
    title: 'Studio-native Redaktionseingang',
    intro: 'DNS-verifizierte Publikationsstellen ohne OJS/OMP. Bei OJS/OMP bleibt das externe System maßgeblich.',
    empty: 'Für diese Redaktion liegen derzeit keine Studio-nativen Einreichungen vor.',
    claim: 'Redaktionelle Verantwortung übernehmen',
    reviewerEmail: 'Studio-E-Mail der Gutachterin/des Gutachters',
    assignReviewer: 'Wissenschaftliche Begutachtung zuweisen',
    complete: 'Eingereichtes Gutachten abschließen',
    requestRevision: 'Überarbeitung anfordern',
    reject: 'Manuskript ablehnen',
    accept: 'Exakte Revision annehmen',
    note: 'Mitteilung an die Autorin/den Autor',
    noDecision: 'Für die Annahme ist eine abgeschlossene wissenschaftliche Begutachtungsrunde erforderlich.',
    busy: 'Wird verarbeitet…',
    author: 'Autor/in',
    editor: 'Redaktion',
    assignedElsewhere: 'Diese Einreichung ist einer anderen Redaktion zugewiesen. Sie kann eingesehen, aber nur von der zugewiesenen Redaktion bearbeitet werden.',
    round: 'Runde',
  },
} as const;

type EditorReview = Awaited<ReturnType<typeof loadEditorReviewOverview>>[number];

export function NativeEditorialInbox({
  initialSubmissions,
}: {
  initialSubmissions?: NativeSubmission[];
}) {
  const { locale } = useTranslation();
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.en;
  const [submissions, setSubmissions] = useState<NativeSubmission[]>(initialSubmissions ?? []);
  const [reviews, setReviews] = useState<EditorReview[]>([]);
  const [selectedId, setSelectedId] = useState(initialSubmissions?.[0]?.id ?? '');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const [nextSubmissions, nextReviews] = await Promise.all([
      listNativeEditorialInbox(),
      loadEditorReviewOverview(),
    ]);
    setSubmissions(nextSubmissions);
    setReviews(nextReviews);
    setSelectedId((current) =>
      current && nextSubmissions.some((item) => item.id === current)
        ? current
        : nextSubmissions[0]?.id ?? '',
    );
  }

  useEffect(() => {
    void refresh().catch((reason) =>
      setError(reason instanceof Error ? reason.message : String(reason))
    );
  }, []);

  const selected = submissions.find((item) => item.id === selectedId) ?? submissions[0] ?? null;
  const selectedReviews = useMemo(
    () => selected
      ? reviews.filter((review) => review.workspaceId === selected.workspaceId)
      : [],
    [reviews, selected],
  );

  async function run(action: () => Promise<unknown>, success = '') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await refresh();
      if (success) setMessage(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function acceptExactRevision() {
    if (!selected) return;
    await run(async () => {
      const evidence = await getWebPublicationAssuranceEvidence({
        manuscriptId: selected.manuscriptId,
        revisionId: selected.revisionId,
        stateDigest: selected.stateDigest,
      });
      const round = evidence.eligibleReviewRounds.find(
        (item) =>
          item.workspaceId === selected.workspaceId &&
          item.reviewRound === selected.reviewRound,
      );
      if (!round) throw new Error(copy.noDecision);
      const artifact = await prepareWebPublicationArtifact(
        selected.manuscriptSnapshot,
        createAccountHolderApprovedAssurance('scholarly-article'),
      );
      await acceptNativeSubmission(selected.id, {
        publicationContentDigest: artifact.publicationContentDigest,
        basisAssignmentIds: round.basisAssignmentIds,
      });
    });
  }

  return (
    <main className="review-mode">
      <header className="review-mode__header">
        <div>
          <div className="review-mode__eyebrow">Open Manuscript Studio</div>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
      </header>

      {error ? <div className="review-mode__error" role="alert">{error}</div> : null}
      {message ? <div className="review-mode__card" role="status"><p>{message}</p></div> : null}

      {!submissions.length ? (
        <section className="review-mode__card"><p>{copy.empty}</p></section>
      ) : (
        <div className="review-mode__layout">
          <aside className="review-mode__list" aria-label={copy.title}>
            {submissions.map((submission) => (
              <button
                type="button"
                key={submission.id}
                className={`review-mode__assignment${selected?.id === submission.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(submission.id)}
              >
                <strong>{submission.title}</strong>
                <span>{submission.status.replaceAll('_', ' ')}</span>
                <span>{copy.author}: {submission.author.fullName}</span>
              </button>
            ))}
          </aside>

          <section className="review-mode__content">
            {selected ? (
              <>
                <section className="review-mode__card review-mode__summary">
                  <div>
                    <div className="review-mode__eyebrow">{selected.manuscriptId}</div>
                    <h2>{selected.title}</h2>
                    <p>
                      {copy.author}: {selected.author.fullName} · {copy.round} {selected.reviewRound}
                    </p>
                    <p>
                      {copy.editor}: {selected.editor?.fullName ?? '—'} · {selected.status.replaceAll('_', ' ')}
                    </p>
                  </div>
                </section>

                {!selected.editor ? (
                  <section className="review-mode__card">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => claimNativeSubmission(selected.id))}
                    >
                      {busy ? copy.busy : copy.claim}
                    </button>
                  </section>
                ) : !selected.viewerIsAssignedEditor ? (
                  <section className="review-mode__card">
                    <p>{copy.assignedElsewhere}</p>
                  </section>
                ) : (
                  <>
                    <section className="review-mode__card">
                      <label>
                        <span>{copy.reviewerEmail}</span>
                        <input
                          type="email"
                          value={reviewerEmail}
                          onChange={(event) => setReviewerEmail(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy || !reviewerEmail.trim()}
                        onClick={() => void run(async () => {
                          await assignNativeReviewer(selected.id, {
                            reviewerEmail: reviewerEmail.trim(),
                            anonymityMode: 'DOUBLE_BLIND',
                          });
                          setReviewerEmail('');
                        })}
                      >
                        {copy.assignReviewer}
                      </button>
                    </section>

                    {selectedReviews.length ? (
                      <section className="review-mode__card">
                        {selectedReviews.map((review) => (
                          <article className="review-mode__feedback" key={review.id}>
                            <strong>{review.reviewerAlias} · {copy.round} {review.reviewRound}</strong>
                            <p>
                              {review.status.replaceAll('_', ' ')}
                              {review.recommendation
                                ? ` · ${review.recommendation.replaceAll('_', ' ')}`
                                : ''}
                            </p>
                            {review.feedback.map((feedback) => (
                              <div key={feedback.id}>
                                <strong>
                                  {feedback.visibility === 'editor_only'
                                    ? 'Editor only'
                                    : 'Author and editor'}
                                </strong>
                                <p>{feedback.body}</p>
                              </div>
                            ))}
                            {review.status === 'submitted' ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void run(() =>
                                  completeNativeReview(selected.id, review.id)
                                )}
                              >
                                {copy.complete}
                              </button>
                            ) : null}
                          </article>
                        ))}
                      </section>
                    ) : null}

                    <section className="review-mode__card">
                      <label>
                        <span>{copy.note}</span>
                        <textarea
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                        />
                      </label>
                      <div className="publication-profile-actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() =>
                            requestNativeRevision(selected.id, note)
                          )}
                        >
                          {copy.requestRevision}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() =>
                            rejectNativeSubmission(selected.id, note)
                          )}
                        >
                          {copy.reject}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void acceptExactRevision()}
                        >
                          {copy.accept}
                        </button>
                      </div>
                    </section>
                  </>
                )}
              </>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
