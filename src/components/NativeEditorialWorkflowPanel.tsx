import { CheckCircle2, FileCheck2, Inbox, RefreshCw, RotateCcw, Send, UserPlus, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  acceptNativeEditorialSubmission,
  assignNativeEditorialReviewer,
  completeNativeEditorialReview,
  getNativeEditorialSubmission,
  listMyNativeEditorialSubmissions,
  listNativeEditorialInbox,
  rejectNativeEditorialSubmission,
  requestNativeEditorialRevision,
  submitNativeEditorialManuscript,
  submitNativeEditorialRevision,
  type NativeEditorialSubmissionDetailResponse,
  type NativeEditorialSubmissionSummary,
} from '../services/nativeEditorialWorkflowApi';
import {
  prepareNativeEditorialRevision,
  restoreNativeEditorialManuscript,
} from '../services/nativeEditorialSnapshot';

export function NativeEditorialWorkflowPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const loadManuscript = useStudioStore((state) => state.loadManuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const [mine, setMine] = useState<NativeEditorialSubmissionSummary[]>([]);
  const [inbox, setInbox] = useState<NativeEditorialSubmissionSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<NativeEditorialSubmissionDetailResponse | null>(null);
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [editorialNote, setEditorialNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const venue = manuscript.metadata?.publicationVenue;
  const nativeVenue = Boolean(
    venue?.id &&
    venue.authority?.method === 'DNS_TXT' &&
    venue.authority.status === 'VERIFIED' &&
    !(venue.integrationStatus === 'VERIFIED' &&
      (venue.integrationProvider === 'OJS' || venue.integrationProvider === 'OMP')),
  );
  const currentSubmission = mine[0] ?? null;

  useEffect(() => {
    void refresh();
  }, [manuscript.id]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    void getNativeEditorialSubmission(selectedId)
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  async function refresh(preferredId?: string): Promise<void> {
    setError('');
    try {
      const [nextMine, nextInbox] = await Promise.all([
        listMyNativeEditorialSubmissions(manuscript.id),
        listNativeEditorialInbox(),
      ]);
      setMine(nextMine);
      setInbox(nextInbox);
      const nextSelected =
        preferredId && nextInbox.some((item) => item.id === preferredId)
          ? preferredId
          : selectedId && nextInbox.some((item) => item.id === selectedId)
            ? selectedId
            : nextInbox[0]?.id ?? '';
      setSelectedId(nextSelected);
      setDetail(nextSelected ? await getNativeEditorialSubmission(nextSelected) : null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function prepareCurrentRevision() {
    await externalizeActiveManuscriptAssets();
    checkpoint('export');
    return prepareNativeEditorialRevision(useStudioStore.getState().manuscript);
  }

  async function submitToVenue(): Promise<void> {
    if (!venue?.id || !nativeVenue) return;
    await run(async () => {
      const submission = await submitNativeEditorialManuscript(
        venue.id,
        await prepareCurrentRevision(),
      );
      setMessage(copy.submitted);
      await refresh(submission.id);
    });
  }

  async function submitRevision(): Promise<void> {
    if (!currentSubmission) return;
    await run(async () => {
      const submission = await submitNativeEditorialRevision(
        currentSubmission.id,
        await prepareCurrentRevision(),
      );
      setMessage(copy.revisionSubmitted);
      await refresh(submission.id);
    });
  }

  async function assignReviewer(): Promise<void> {
    if (!selectedId || !reviewerEmail.trim()) return;
    await run(async () => {
      await assignNativeEditorialReviewer(selectedId, reviewerEmail.trim());
      setReviewerEmail('');
      setMessage(copy.reviewerAssigned);
      await refresh(selectedId);
    });
  }

  async function completeReview(assignmentId: string): Promise<void> {
    if (!selectedId) return;
    await run(async () => {
      await completeNativeEditorialReview(selectedId, assignmentId);
      setMessage(copy.reviewCompleted);
      await refresh(selectedId);
    });
  }

  async function requestRevision(): Promise<void> {
    if (!selectedId || !editorialNote.trim()) return;
    await run(async () => {
      await requestNativeEditorialRevision(selectedId, editorialNote.trim());
      setEditorialNote('');
      setMessage(copy.revisionRequested);
      await refresh(selectedId);
    });
  }

  async function acceptSubmission(): Promise<void> {
    if (!selectedId) return;
    await run(async () => {
      await acceptNativeEditorialSubmission(selectedId);
      setMessage(copy.accepted);
      await refresh(selectedId);
    });
  }

  async function rejectSubmission(): Promise<void> {
    if (!selectedId) return;
    await run(async () => {
      await rejectNativeEditorialSubmission(selectedId, editorialNote.trim());
      setEditorialNote('');
      setMessage(copy.rejected);
      await refresh(selectedId);
    });
  }

  async function openSubmittedRevision(): Promise<void> {
    if (!detail || detail.actorMode !== 'editor' || !window.confirm(copy.openConfirm)) return;
    await run(async () => {
      const restored = await restoreNativeEditorialManuscript({
        revisionId: detail.submission.revisionId,
        manuscriptStateSnapshot: detail.submission.manuscriptStateSnapshot,
        assets: detail.submission.assets,
      });
      loadManuscript(restored);
      setMessage(copy.opened);
    });
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError('');
    setMessage('');
    try { await action(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return (
    <section className="studio-menu-view" aria-labelledby="native-editorial-workflow-title">
      <div className="studio-menu-view-header">
        <div>
          <h3 id="native-editorial-workflow-title">{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <Inbox size={22} aria-hidden="true" />
      </div>

      <section className="studio-settings-card">
        <div className="studio-settings-card-header">
          <div><h4>{copy.authorSubmission}</h4><p>{copy.authorSubmissionHelp}</p></div>
        </div>
        {!venue ? <p>{copy.chooseVenue}</p> : !nativeVenue ? (
          <p>{venue.integrationStatus === 'VERIFIED' ? copy.externalWorkflow : copy.dnsRequired}</p>
        ) : currentSubmission ? (
          <div className="publication-profile-options">
            <p><strong>{currentSubmission.publicationVenueName}</strong>{' · '}{copy.status}: <strong>{statusLabel(currentSubmission.status, copy)}</strong>{' · '}{copy.round} {currentSubmission.reviewRound}</p>
            <p><small>{copy.revision}: <code>{currentSubmission.revisionId}</code></small></p>
            {currentSubmission.editorialNote ? <p><strong>{copy.editorialMessage}:</strong> {currentSubmission.editorialNote}</p> : null}
            {currentSubmission.status === 'revision_requested' ? (
              <button type="button" className="studio-menu-primary-action" disabled={busy} onClick={() => void submitRevision()}>
                <RotateCcw size={16} aria-hidden="true" />{copy.submitRevision}
              </button>
            ) : null}
            {currentSubmission.status === 'accepted' ? <p className="publication-ready"><CheckCircle2 size={16} aria-hidden="true" /> {copy.publishable}</p> : null}
          </div>
        ) : (
          <div className="publication-profile-options">
            <p><strong>{venue.name}</strong>{venue.authority?.domain ? ' · ' + venue.authority.domain : ''}</p>
            <button type="button" className="studio-menu-primary-action" disabled={busy} onClick={() => void submitToVenue()}>
              <Send size={16} aria-hidden="true" />{copy.submit}
            </button>
          </div>
        )}
      </section>

      <section className="studio-settings-card">
        <div className="studio-settings-card-header">
          <div><h4>{copy.editorInbox}</h4><p>{copy.editorInboxHelp}</p></div>
          <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void refresh(selectedId)}>
            <RefreshCw size={16} aria-hidden="true" />{copy.refresh}
          </button>
        </div>

        {inbox.length ? (
          <label>
            <span>{copy.submission}</span>
            <select value={selectedId} disabled={busy} onChange={(event) => setSelectedId(event.target.value)}>
              {inbox.map((item) => <option key={item.id} value={item.id}>{item.publicationVenueName} · {item.title} · {statusLabel(item.status, copy)}</option>)}
            </select>
          </label>
        ) : <p>{copy.emptyInbox}</p>}

        {detail?.actorMode === 'editor' ? (
          <EditorSubmission
            detail={detail}
            copy={copy}
            busy={busy}
            reviewerEmail={reviewerEmail}
            setReviewerEmail={setReviewerEmail}
            editorialNote={editorialNote}
            setEditorialNote={setEditorialNote}
            onAssign={assignReviewer}
            onComplete={completeReview}
            onRevision={requestRevision}
            onAccept={acceptSubmission}
            onReject={rejectSubmission}
            onOpen={openSubmittedRevision}
          />
        ) : null}
      </section>

      {message ? <p className="publication-profile-status" role="status">{message}</p> : null}
      {error ? <p className="publication-profile-error" role="alert">{error}</p> : null}
    </section>
  );
}

function EditorSubmission(props: {
  detail: NativeEditorialSubmissionDetailResponse;
  copy: ReturnType<typeof getCopy>;
  busy: boolean;
  reviewerEmail: string;
  setReviewerEmail: (value: string) => void;
  editorialNote: string;
  setEditorialNote: (value: string) => void;
  onAssign: () => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onRevision: () => Promise<void>;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onOpen: () => Promise<void>;
}) {
  const { detail, copy, busy } = props;
  const { submission, reviews } = detail;
  const terminal = ['accepted', 'rejected', 'published'].includes(submission.status);
  const assignable = ['submitted', 'revision_submitted', 'in_review'].includes(submission.status);
  const hasCompleted = reviews.some((review) => review.assignmentType === 'scientific_review' && review.status === 'completed');

  return (
    <div className="publication-profile-options">
      <h5>{submission.title}</h5>
      <p><strong>{submission.publicationVenueName}</strong>{' · '}{copy.status}: <strong>{statusLabel(submission.status, copy)}</strong>{' · '}{copy.round} {submission.reviewRound}</p>
      <p><strong>{copy.author}:</strong> {submission.author.fullName}{' · '}{submission.author.email}</p>
      <p><small>{copy.revision}: <code>{submission.revisionId}</code></small></p>
      <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void props.onOpen()}>
        <FileCheck2 size={16} aria-hidden="true" />{copy.openRevision}
      </button>

      {assignable ? (
        <div className="publication-profile-options">
          <label><span>{copy.reviewerEmail}</span><input type="email" value={props.reviewerEmail} onChange={(event) => props.setReviewerEmail(event.target.value)} /></label>
          <button type="button" className="studio-menu-secondary-action" disabled={busy || !props.reviewerEmail.trim()} onClick={() => void props.onAssign()}>
            <UserPlus size={16} aria-hidden="true" />{copy.assignReviewer}
          </button>
        </div>
      ) : null}

      <div className="publication-profile-options">
        <h5>{copy.reviews}</h5>
        {reviews.length ? reviews.map((review) => (
          <article key={review.id} className="review-mode__feedback">
            <strong>{review.reviewerAlias}{review.reviewer ? ' · ' + review.reviewer.fullName : ''}</strong>
            <p>{copy.round} {review.reviewRound}{' · '}{review.status.replaceAll('_', ' ')}{review.recommendation ? ' · ' + copy.recommendation + ': ' + review.recommendation.replaceAll('_', ' ') : ''}</p>
            {review.feedback.map((feedback) => <p key={feedback.id}>{feedback.body}</p>)}
            {review.status === 'submitted' ? (
              <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void props.onComplete(review.id)}>
                <CheckCircle2 size={16} aria-hidden="true" />{copy.completeReview}
              </button>
            ) : null}
          </article>
        )) : <p>{copy.noReviews}</p>}
      </div>

      {!terminal ? (
        <div className="publication-profile-options">
          <label><span>{copy.editorialMessage}</span><textarea value={props.editorialNote} onChange={(event) => props.setEditorialNote(event.target.value)} /></label>
          <div className="publication-profile-actions">
            <button type="button" className="studio-menu-secondary-action" disabled={busy || !hasCompleted || !props.editorialNote.trim()} onClick={() => void props.onRevision()}>
              <RotateCcw size={16} aria-hidden="true" />{copy.requestRevision}
            </button>
            <button type="button" className="studio-menu-primary-action" disabled={busy || !hasCompleted} onClick={() => void props.onAccept()}>
              <CheckCircle2 size={16} aria-hidden="true" />{copy.accept}
            </button>
            <button type="button" className="studio-menu-secondary-action studio-menu-danger-action" disabled={busy} onClick={() => void props.onReject()}>
              <XCircle size={16} aria-hidden="true" />{copy.reject}
            </button>
          </div>
        </div>
      ) : null}

      <details><summary>{copy.history}</summary><ul>
        {submission.events.map((event) => <li key={event.id}>{new Date(event.createdAt).toLocaleString()} · {event.type.replaceAll('_', ' ')}{event.note ? ' · ' + event.note : ''}</li>)}
      </ul></details>
    </div>
  );
}

function statusLabel(status: NativeEditorialSubmissionSummary['status'], copy: ReturnType<typeof getCopy>): string {
  return copy.statuses[status] ?? status.replaceAll('_', ' ');
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function getCopy(locale: string) {
  if (locale === 'hu') return huCopy;
  if (locale === 'de') return deCopy;
  return enCopy;
}

const enCopy = {
  title: 'Editorial workflow',
  description: 'Studio-native submission and peer review for DNS-verified journals and presses that do not use OJS/OMP.',
  authorSubmission: 'Author submission',
  authorSubmissionHelp: 'Submission sends an exact committed revision and its assets to the selected publication venue.',
  chooseVenue: 'First select a DNS-verified journal or press in Extended metadata.',
  externalWorkflow: 'OJS/OMP is authoritative for this publication venue. Submission and editorial decisions must be managed there.',
  dnsRequired: 'Studio-native editorial workflow requires a DNS TXT verified publication venue.',
  submit: 'Submit to editorial office',
  submitted: 'The manuscript was added to the editorial inbox.',
  submitRevision: 'Submit revised revision',
  revisionSubmitted: 'The revised revision was submitted.',
  editorInbox: 'Editorial inbox',
  editorInboxHelp: 'Studio-native submissions appear here when you hold EDITOR or EDITOR_IN_CHIEF authority at the publication venue.',
  emptyInbox: 'No Studio-native submissions are available.',
  refresh: 'Refresh', submission: 'Submission', status: 'Status', round: 'round', revision: 'Revision', author: 'Author',
  reviewerEmail: 'Reviewer Studio e-mail', assignReviewer: 'Assign reviewer', reviewerAssigned: 'The review assignment was created.',
  reviews: 'Review assignments', noReviews: 'No reviewer has been assigned yet.', recommendation: 'recommendation',
  completeReview: 'Complete review assignment', reviewCompleted: 'The submitted review assignment was completed.',
  editorialMessage: 'Editorial message', requestRevision: 'Request revision', revisionRequested: 'The revision request was sent to the author.',
  accept: 'Accept manuscript', accepted: 'The editorial acceptance was recorded for this exact revision.',
  reject: 'Reject', rejected: 'The manuscript was rejected.', publishable: 'This revision is editorially accepted and publishable.',
  openRevision: 'Open submitted revision', openConfirm: 'Open the submitted revision in Studio? It will replace the currently open document.',
  opened: 'The submitted revision was opened in Studio.', history: 'Workflow history',
  statuses: { submitted: 'submitted', in_review: 'in review', revision_requested: 'revision required', revision_submitted: 'revision submitted', accepted: 'accepted', rejected: 'rejected', published: 'published' } as Record<NativeEditorialSubmissionSummary['status'], string>,
};

const huCopy = {
  ...enCopy,
  title: 'Szerkesztőségi munkafolyamat',
  description: 'Studio-native beküldés és lektorálás DNS-hitelesített, OJS/OMP nélküli folyóiratok és kiadók számára.',
  authorSubmission: 'Szerzői beküldés',
  authorSubmissionHelp: 'A beküldés egy pontos, rögzített revíziót és annak eszközeit adja át a kiválasztott publikációs hely szerkesztőségének.',
  chooseVenue: 'Előbb válassz DNS-hitelesített folyóiratot vagy kiadót a Kibővített metaadatok között.',
  externalWorkflow: 'Ennél a publikációs helynél az OJS/OMP a hiteles munkafolyamat. A beküldést és a szerkesztői döntést ott kell kezelni.',
  dnsRequired: 'Studio-native szerkesztőségi workflow csak DNS TXT-vel hitelesített publikációs helyhez használható.',
  submit: 'Beküldés a szerkesztőségnek', submitted: 'A kézirat bekerült a szerkesztőségi inboxba.',
  submitRevision: 'Javított revízió beküldése', revisionSubmitted: 'A javított revízió bekerült a szerkesztőségi munkafolyamatba.',
  editorInbox: 'Szerkesztői inbox',
  editorInboxHelp: 'Azok a Studio-native beküldések jelennek meg, amelyek folyóiratánál vagy kiadójánál EDITOR vagy EDITOR_IN_CHIEF jogosultságod van.',
  emptyInbox: 'Nincs kezelhető Studio-native beküldés.', refresh: 'Frissítés', submission: 'Beküldés', status: 'Állapot', round: 'forduló',
  revision: 'Revízió', author: 'Szerző', reviewerEmail: 'Lektor Studio e-mail-címe', assignReviewer: 'Lektor kijelölése',
  reviewerAssigned: 'A lektori feladat létrejött.', reviews: 'Lektori feladatok', noReviews: 'Még nincs lektor kijelölve.',
  recommendation: 'javaslat', completeReview: 'Lektori feladat lezárása', reviewCompleted: 'A beadott lektori feladat lezárult.',
  editorialMessage: 'Szerkesztői üzenet', requestRevision: 'Javítás kérése', revisionRequested: 'A szerző megkapta a javítási kérést.',
  accept: 'Kézirat elfogadása', accepted: 'A szerkesztői elfogadó döntés rögzült ehhez a pontos revízióhoz.',
  reject: 'Elutasítás', rejected: 'A kézirat elutasított állapotba került.', publishable: 'A revízió szerkesztőileg elfogadott és publikálható.',
  openRevision: 'Beküldött revízió megnyitása', openConfirm: 'Megnyitja a beküldött revíziót a Studioban? Az aktuális dokumentum helyére kerül.',
  opened: 'A beküldött revízió megnyílt a Studioban.', history: 'Munkafolyamat előzményei',
  statuses: { submitted: 'beküldve', in_review: 'lektorálás alatt', revision_requested: 'javítás szükséges', revision_submitted: 'javított változat beérkezett', accepted: 'elfogadva', rejected: 'elutasítva', published: 'publikálva' } as Record<NativeEditorialSubmissionSummary['status'], string>,
};

const deCopy = {
  ...enCopy,
  title: 'Redaktioneller Workflow',
  description: 'Studio-nativer Einreichungs- und Begutachtungsworkflow für DNS-verifizierte Zeitschriften und Verlage ohne OJS/OMP.',
  authorSubmission: 'Einreichung durch Autor/in',
  authorSubmissionHelp: 'Die Einreichung übergibt eine exakte Revision samt Assets an die Redaktion der gewählten Publikationsstelle.',
  chooseVenue: 'Wählen Sie zuerst eine DNS-verifizierte Zeitschrift oder einen Verlag in den erweiterten Metadaten.',
  externalWorkflow: 'Für diese Publikationsstelle ist OJS/OMP das maßgebliche Workflowsystem. Einreichung und redaktionelle Entscheidung werden dort verwaltet.',
  dnsRequired: 'Der Studio-native Workflow ist nur für per DNS TXT verifizierte Publikationsstellen verfügbar.',
  submit: 'An Redaktion einreichen', submitted: 'Das Manuskript wurde in den redaktionellen Eingang übermittelt.',
  submitRevision: 'Überarbeitete Revision einreichen', revisionSubmitted: 'Die überarbeitete Revision wurde eingereicht.',
  editorInbox: 'Redaktioneller Eingang', editorInboxHelp: 'Hier erscheinen Studio-native Einreichungen von Publikationsstellen, bei denen Sie EDITOR oder EDITOR_IN_CHIEF sind.',
  emptyInbox: 'Keine Studio-nativen Einreichungen verfügbar.', refresh: 'Aktualisieren', submission: 'Einreichung', status: 'Status', round: 'Runde',
  revision: 'Revision', author: 'Autor/in', reviewerEmail: 'Studio-E-Mail des Gutachters', assignReviewer: 'Gutachter zuweisen',
  reviewerAssigned: 'Der Begutachtungsauftrag wurde erstellt.', reviews: 'Begutachtungsaufträge', noReviews: 'Noch kein Gutachter zugewiesen.',
  recommendation: 'Empfehlung', completeReview: 'Begutachtung abschließen', reviewCompleted: 'Die eingereichte Begutachtung wurde abgeschlossen.',
  editorialMessage: 'Redaktionelle Nachricht', requestRevision: 'Überarbeitung anfordern', revisionRequested: 'Die Überarbeitungsanforderung wurde an den Autor übermittelt.',
  accept: 'Manuskript annehmen', accepted: 'Die redaktionelle Annahme wurde an diese exakte Revision gebunden.',
  reject: 'Ablehnen', rejected: 'Das Manuskript wurde abgelehnt.', publishable: 'Diese Revision ist redaktionell angenommen und publizierbar.',
  openRevision: 'Eingereichte Revision öffnen', openConfirm: 'Eingereichte Revision in Studio öffnen? Sie ersetzt das aktuell geöffnete Dokument.',
  opened: 'Die eingereichte Revision wurde in Studio geöffnet.', history: 'Workflow-Verlauf',
  statuses: { submitted: 'eingereicht', in_review: 'in Begutachtung', revision_requested: 'Überarbeitung erforderlich', revision_submitted: 'Überarbeitung eingereicht', accepted: 'angenommen', rejected: 'abgelehnt', published: 'publiziert' } as Record<NativeEditorialSubmissionSummary['status'], string>,
};
