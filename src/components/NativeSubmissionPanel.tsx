import { useEffect, useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { calculateManuscriptStateDigestValue } from '../model/stateDigest';
import { extractManuscriptState } from '../model/versioning';
import {
  createNativeSubmission,
  listMyNativeSubmissions,
  submitNativeRevision,
  type NativeSubmission,
} from '../services/nativeEditorialWorkflowApi';
import {
  listAuthorReviews,
  type ReviewerAssignment,
} from '../services/peerReviewApi';

const COPY = {
  en: {
    title: 'Submit to verified publication venue',
    intro: 'Use this Studio-native workflow only for DNS-verified journals or presses that do not use OJS/OMP.',
    unavailable: 'Select a DNS-verified journal or press in Extended metadata first.',
    external: 'This publication venue uses OJS/OMP. Submission and editorial workflow remain authoritative there.',
    submit: 'Submit manuscript',
    resubmit: 'Submit revised manuscript',
    busy: 'Working…',
    status: 'Submission status',
    editor: 'Assigned editor',
    note: 'Editorial note',
    submitted: 'The exact committed manuscript revision was submitted to the publication venue.',
    revised: 'The revised committed manuscript was returned to the editor.',
    openEditorial: 'Open editorial workspace',
    reviews: 'Review feedback',
    recommendation: 'Recommendation',
    noReviews: 'No author-visible review feedback is available yet.',
  },
  hu: {
    title: 'Beküldés hitelesített folyóirathoz / kiadóhoz',
    intro: 'Ez a Studio-native folyamat a DNS-sel hitelesített, OJS/OMP rendszert nem használó folyóiratokhoz és kiadókhoz készült.',
    unavailable: 'Előbb válassz DNS-sel hitelesített folyóiratot vagy kiadót a Kibővített metaadatok között.',
    external: 'Ez a publikációs hely OJS/OMP rendszert használ. A beküldési és szerkesztőségi workflow ott authoritative.',
    submit: 'Kézirat beküldése',
    resubmit: 'Javított kézirat beküldése',
    busy: 'Folyamatban…',
    status: 'Beküldés állapota',
    editor: 'Kijelölt szerkesztő',
    note: 'Szerkesztői üzenet',
    submitted: 'A pontos, rögzített kéziratrevíziót a Studio beküldte a publikációs helyhez.',
    revised: 'A javított, rögzített kéziratrevízió visszakerült a szerkesztőhöz.',
    openEditorial: 'Szerkesztőségi munkatér megnyitása',
    reviews: 'Lektori visszajelzés',
    recommendation: 'Javaslat',
    noReviews: 'Még nincs a szerző számára látható lektori visszajelzés.',
  },
  de: {
    title: 'Bei verifizierter Publikationsstelle einreichen',
    intro: 'Dieser Studio-native Workflow ist für DNS-verifizierte Zeitschriften und Verlage ohne OJS/OMP bestimmt.',
    unavailable: 'Wählen Sie zuerst unter Erweiterte Metadaten eine DNS-verifizierte Zeitschrift oder einen Verlag.',
    external: 'Diese Publikationsstelle verwendet OJS/OMP. Einreichung und redaktioneller Workflow bleiben dort maßgeblich.',
    submit: 'Manuskript einreichen',
    resubmit: 'Überarbeitete Fassung einreichen',
    busy: 'Wird verarbeitet…',
    status: 'Einreichungsstatus',
    editor: 'Zugewiesene Redaktion',
    note: 'Redaktionelle Mitteilung',
    submitted: 'Die exakte festgeschriebene Manuskriptrevision wurde eingereicht.',
    revised: 'Die überarbeitete festgeschriebene Revision wurde an die Redaktion zurückgesendet.',
    openEditorial: 'Redaktionellen Arbeitsbereich öffnen',
    reviews: 'Gutachterliche Rückmeldung',
    recommendation: 'Empfehlung',
    noReviews: 'Noch keine für die Autorin/den Autor sichtbare Rückmeldung verfügbar.',
  },
} as const;

export function NativeSubmissionPanel() {
  const { locale } = useTranslation();
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.en;
  const manuscript = useStudioStore((state) => state.manuscript);
  const venue = manuscript.metadata?.publicationVenue;
  const [submission, setSubmission] = useState<NativeSubmission | null>(null);
  const [authorReviews, setAuthorReviews] = useState<ReviewerAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const dnsNative = Boolean(
    venue?.authority?.method === 'DNS_TXT' &&
    venue.authority.status === 'VERIFIED' &&
    venue.integrationStatus !== 'VERIFIED',
  );

  useEffect(() => {
    let active = true;
    setSubmission(null);
    setError('');
    if (!venue?.id || !dnsNative) return;
    void listMyNativeSubmissions()
      .then(async (items) => {
        if (!active) return;
        const nextSubmission = items.find((item) =>
          item.manuscriptId === manuscript.id &&
          item.publicationVenueId === venue.id
        ) ?? null;
        setSubmission(nextSubmission);
        if (nextSubmission) {
          const reviews = await listAuthorReviews(nextSubmission.workspaceId);
          if (active) setAuthorReviews(reviews);
        } else {
          setAuthorReviews([]);
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { active = false; };
  }, [dnsNative, manuscript.id, venue?.id]);

  const canSubmit = dnsNative && !submission;
  const canResubmit = submission?.status === 'REVISION_REQUESTED';

  async function submit(revision: boolean) {
    if (!venue?.id || (!canSubmit && !canResubmit)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      useStudioStore.getState().checkpoint('manual');
      const committed = useStudioStore.getState().manuscript;
      const stateDigest = calculateManuscriptStateDigestValue(
        extractManuscriptState(committed),
      );
      const next = revision && submission
        ? await submitNativeRevision(submission.id, {
            title: committed.title,
            revisionId: committed.headRevisionId,
            stateDigest,
            manuscriptSnapshot: committed,
          })
        : await createNativeSubmission({
            publicationVenueId: venue.id,
            manuscriptId: committed.id,
            title: committed.title,
            revisionId: committed.headRevisionId,
            stateDigest,
            manuscriptSnapshot: committed,
          });
      setSubmission(next);
      setMessage(revision ? copy.revised : copy.submitted);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  const statusText = useMemo(
    () => submission?.status.replaceAll('_', ' ') ?? '',
    [submission?.status],
  );

  return (
    <section className="publication-profile-selector" aria-labelledby="native-submission-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="native-submission-title">{copy.title}</h4>
          <p>{copy.intro}</p>
        </div>
      </div>

      {!venue ? <p>{copy.unavailable}</p> : null}
      {venue && venue.integrationStatus === 'VERIFIED' ? <p>{copy.external}</p> : null}
      {venue && !dnsNative && venue.integrationStatus !== 'VERIFIED' ? <p>{copy.unavailable}</p> : null}

      {dnsNative ? (
        <>
          <p><strong>{venue.name}</strong>{venue.authority?.domain ? ` · ${venue.authority.domain}` : ''}</p>
          {submission ? (
            <div className="publication-profile-status">
              <p><strong>{copy.status}:</strong> {statusText}</p>
              {submission.editor ? (
                <p><strong>{copy.editor}:</strong> {submission.editor.fullName}</p>
              ) : null}
              {submission.latestEditorialNote ? (
                <p><strong>{copy.note}:</strong> {submission.latestEditorialNote}</p>
              ) : null}
              <div>
                <strong>{copy.reviews}</strong>
                {authorReviews.length ? (
                  <ul>
                    {authorReviews.map((review) => (
                      <li key={review.id}>
                        <strong>{review.reviewerAlias}</strong>
                        {review.recommendation
                          ? ` · ${copy.recommendation}: ${review.recommendation.replaceAll('_', ' ')}`
                          : ''}
                        {review.feedback.map((feedback) => (
                          <p key={feedback.id}>{feedback.body}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : <p>{copy.noReviews}</p>}
              </div>
            </div>
          ) : null}

          {canSubmit ? (
            <button
              type="button"
              className="studio-menu-primary-action"
              disabled={busy}
              onClick={() => void submit(false)}
            >
              {busy ? copy.busy : copy.submit}
            </button>
          ) : null}

          {canResubmit ? (
            <button
              type="button"
              className="studio-menu-primary-action"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              {busy ? copy.busy : copy.resubmit}
            </button>
          ) : null}

          <p>
            <a href="/?review=1">{copy.openEditorial}</a>
          </p>
        </>
      ) : null}

      {message ? <p className="publication-profile-status" role="status">{message}</p> : null}
      {error ? <p className="publication-profile-error" role="alert">{error}</p> : null}
    </section>
  );
}
