import { Globe2, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  createAccountHolderApprovedAssurance,
  createStudioReviewedAssurance,
  OMI_EDITORIAL_ACCEPTANCE_CONFIRMATION,
  OMI_WEB_PUBLICATION_APPROVAL_STATEMENT,
  webPublicationIdempotencyKey,
  type EligibleEditorialReviewRound,
  type PreparedWebPublicationArtifact,
  type WebPublicationIntent,
  type WebPublicationReceipt,
  type WebPublicationAssuranceEvidence,
} from '../integrations/webPublicationContract';
import {
  executeWebPublication,
  getIntegrationCatalog,
  getWebPublicationAssuranceEvidence,
  recordStudioEditorialAcceptance,
  requestWebPublicationApproval,
  type IntegrationConnection,
} from '../services/integrationApi';
import { prepareWebPublicationArtifact } from '../services/webPublicationArtifact';
import type { OmiManuscript } from '../types/omi';

interface PreparedPreview {
  artifact: PreparedWebPublicationArtifact;
  source: OmiManuscript;
}

export function NewsletterPublishingPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [targets, setTargets] = useState<IntegrationConnection[]>([]);
  const [targetId, setTargetId] = useState('');
  const [publicationStatus, setPublicationStatus] = useState<'draft' | 'publish'>('draft');
  const [intent, setIntent] = useState<WebPublicationIntent>('popular-science');
  const [prepared, setPrepared] = useState<PreparedPreview | null>(null);
  const [approved, setApproved] = useState(false);
  const [assuranceEvidence, setAssuranceEvidence] =
    useState<WebPublicationAssuranceEvidence>({
      decisions: [],
      eligibleReviewRounds: [],
    });
  const [selectedReviewRound, setSelectedReviewRound] = useState('');
  const [editorialAcceptanceConfirmed, setEditorialAcceptanceConfirmed] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<WebPublicationReceipt | null>(null);

  const selected = useMemo(
    () => targets.find((target) => target.id === targetId) ?? null,
    [targetId, targets],
  );

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void getIntegrationCatalog()
      .then((catalog) => {
        if (cancelled) return;
        const next = catalog
          .filter((provider) => provider.id === 'wordpress' || provider.id === 'web-publishing')
          .flatMap((provider) => provider.connections)
          .filter((connection) => connection.enabled);
        setTargets(next);
        setTargetId((current) =>
          current && next.some((target) => target.id === current)
            ? current
            : next[0]?.id ?? '',
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPrepared(null);
    setApproved(false);
    setAssuranceEvidence({ decisions: [], eligibleReviewRounds: [] });
    setSelectedReviewRound('');
    setEditorialAcceptanceConfirmed(false);
    setReceipt(null);
    setMessage('');
  }, [targetId, publicationStatus, intent]);

  useEffect(() => {
    setPrepared((current) => current?.source === manuscript ? current : null);
    setApproved(false);
    setAssuranceEvidence({ decisions: [], eligibleReviewRounds: [] });
    setSelectedReviewRound('');
    setEditorialAcceptanceConfirmed(false);
  }, [manuscript]);

  async function generatePreview() {
    setBusy(true);
    setError('');
    setMessage('');
    setReceipt(null);
    setApproved(false);
    try {
      await externalizeActiveManuscriptAssets();
      useStudioStore.getState().checkpoint('export');
      const committed = useStudioStore.getState().manuscript;
      const artifact = await prepareWebPublicationArtifact(
        committed,
        createAccountHolderApprovedAssurance(intent),
      );
      setPrepared({ artifact, source: committed });
      const nextEvidence = await getWebPublicationAssuranceEvidence({
        manuscriptId: committed.id,
        revisionId: artifact.build.manuscript.revisionId,
        stateDigest: artifact.build.manuscript.stateDigest.value,
      });
      setAssuranceEvidence(nextEvidence);
      setSelectedReviewRound(
        nextEvidence.eligibleReviewRounds[0]
          ? reviewRoundKey(nextEvidence.eligibleReviewRounds[0])
          : '',
      );
      setMessage(copy.previewReady);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function changeAssurance(value: string) {
    if (!prepared) return;
    setBusy(true);
    setError('');
    setMessage('');
    setApproved(false);
    try {
      const assurance = value === 'not-peer-reviewed'
        ? createAccountHolderApprovedAssurance(intent)
        : createStudioReviewedAssurance(
            intent,
            assuranceEvidence.decisions.find((decision) => decision.decisionId === value) ??
              failMissingEditorialDecision(),
          );
      const artifact = await prepareWebPublicationArtifact(prepared.source, assurance);
      setPrepared({ artifact, source: prepared.source });
      setMessage(copy.assuranceChanged);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function recordEditorialAcceptance() {
    if (!prepared || !editorialAcceptanceConfirmed) return;
    const reviewRound = assuranceEvidence.eligibleReviewRounds.find(
      (candidate) => reviewRoundKey(candidate) === selectedReviewRound,
    );
    if (!reviewRound) return;
    setBusy(true);
    setError('');
    setMessage('');
    setApproved(false);
    try {
      const evidence = await recordStudioEditorialAcceptance(
        reviewRound.workspaceId,
        {
          manuscriptId: prepared.source.id,
          revisionId: prepared.artifact.build.manuscript.revisionId,
          stateDigest: prepared.artifact.build.manuscript.stateDigest.value,
          publicationContentDigest: prepared.artifact.publicationContentDigest,
          ...(prepared.source.metadata?.publicationVenue?.authority?.method === 'DNS_TXT' &&
          prepared.source.metadata.publicationVenue.authority.status === 'VERIFIED'
            ? { publicationVenueId: prepared.source.metadata.publicationVenue.id }
            : {}),
          reviewRound: reviewRound.reviewRound,
          basisAssignmentIds: reviewRound.basisAssignmentIds,
          confirmation: OMI_EDITORIAL_ACCEPTANCE_CONFIRMATION,
        },
      );
      const artifact = await prepareWebPublicationArtifact(
        prepared.source,
        createStudioReviewedAssurance(intent, evidence),
      );
      setAssuranceEvidence((current) => ({
        ...current,
        decisions: [
          evidence,
          ...current.decisions.filter((item) => item.decisionId !== evidence.decisionId),
        ],
      }));
      setPrepared({ artifact, source: prepared.source });
      setEditorialAcceptanceConfirmed(false);
      setMessage(copy.editorialAcceptanceRecorded);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selected || !prepared || prepared.source !== manuscript || !approved) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const approval = await requestWebPublicationApproval({
        connectionId: selected.id,
        connectionVersion: selected.updatedAt,
        manuscriptId: prepared.source.id,
        title: prepared.source.title?.trim() || copy.untitled,
        status: publicationStatus,
        assurance: prepared.artifact.assurance,
        artifact: {
          html: prepared.artifact.html,
          build: prepared.artifact.build,
        },
        idempotencyKey: webPublicationIdempotencyKey({
          connectionId: selected.id,
          connectionVersion: selected.updatedAt,
          buildId: prepared.artifact.build.id,
          status: publicationStatus,
          assurance: prepared.artifact.assurance,
        }),
        confirmation: OMI_WEB_PUBLICATION_APPROVAL_STATEMENT,
      });
      const next = approval.receipt ?? await executeWebPublication(
        approval.grant.deliveryId,
        approval.grant.executionToken,
      );
      setReceipt(next);
      setMessage(
        publicationStatus === 'draft'
          ? copy.sentDraft
          : copy.published,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publication-profile-selector" aria-labelledby="newsletter-publishing-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="newsletter-publishing-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <Globe2 size={20} aria-hidden="true" />
      </div>

      {targets.length === 0 ? (
        <p className="publication-profile-status">{copy.noTargets}</p>
      ) : (
        <>
          <div className="publication-profile-options">
            <label>
              <span>{copy.target}</span>
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                {targets.map((target) => (
                  <option value={target.id} key={target.id}>
                    {target.displayName ?? target.connectionKey}
                    {target.providerId === 'wordpress' ? ' · WordPress' : ' · Web'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.intent}</span>
              <select
                value={intent}
                onChange={(event) => setIntent(event.target.value as WebPublicationIntent)}
              >
                <option value="public-interest">{copy.publicInterest}</option>
                <option value="popular-science">{copy.popularScience}</option>
                <option value="newsletter">{copy.newsletter}</option>
                <option value="scholarly-article">{copy.scholarlyArticle}</option>
                <option value="book-chapter">{copy.bookChapter}</option>
              </select>
            </label>
            <label>
              <span>{copy.status}</span>
              <select
                value={publicationStatus}
                onChange={(event) => setPublicationStatus(event.target.value as 'draft' | 'publish')}
              >
                <option value="draft">{copy.draft}</option>
                <option value="publish">{copy.publishNow}</option>
              </select>
            </label>
          </div>

          <div className="publication-profile-actions">
            <button
              type="button"
              className="studio-menu-secondary-action"
              disabled={busy || !selected}
              onClick={() => void generatePreview()}
            >
              {busy ? copy.working : copy.preview}
            </button>
          </div>

          {prepared ? (
            <div className="publication-web-preview">
              <p className="publication-profile-status">
                {copy.committedRevision}: <code>{prepared.artifact.build.manuscript.revisionId}</code>
                {' · '}{copy.assurance}:{' '}
                <strong>
                  {prepared.artifact.assurance.reviewStatus === 'peer-reviewed'
                    ? prepared.artifact.assurance.evidence.authority
                      ? copy.publisherVerified
                      : copy.peerReviewed
                    : copy.notPeerReviewed}
                </strong>
              </p>
              <label>
                <span>{copy.assurance}</span>
                <select
                  value={
                    prepared.artifact.assurance.reviewStatus === 'peer-reviewed'
                      ? prepared.artifact.assurance.evidence.decisionId
                      : 'not-peer-reviewed'
                  }
                  disabled={busy}
                  onChange={(event) => void changeAssurance(event.target.value)}
                >
                  <option value="not-peer-reviewed">{copy.notPeerReviewed}</option>
                  {assuranceEvidence.decisions.map((decision) => (
                    <option value={decision.decisionId} key={decision.decisionId}>
                      {decision.authority
                        ? `${copy.publisherVerified} · ${decision.authority.venueName}`
                        : copy.peerReviewed}
                      {' · '}{copy.round} {decision.reviewRound} ·{' '}
                      {new Date(decision.decidedAt).toLocaleDateString(locale)}
                    </option>
                  ))}
                </select>
              </label>
              {assuranceEvidence.decisions.length === 0 ? (
                <p className="publication-profile-status">{copy.noVerifiedReview}</p>
              ) : null}
              {assuranceEvidence.eligibleReviewRounds.length > 0 &&
              assuranceEvidence.decisions.length === 0 ? (
                <fieldset className="publication-profile-options">
                  <legend>{copy.editorialAcceptanceTitle}</legend>
                  <p>{copy.editorialAcceptanceHelp}</p>
                  <label>
                    <span>{copy.reviewRound}</span>
                    <select
                      value={selectedReviewRound}
                      disabled={busy}
                      onChange={(event) => {
                        setSelectedReviewRound(event.target.value);
                        setEditorialAcceptanceConfirmed(false);
                      }}
                    >
                      {assuranceEvidence.eligibleReviewRounds.map((reviewRound) => (
                        <option
                          value={reviewRoundKey(reviewRound)}
                          key={reviewRoundKey(reviewRound)}
                        >
                          {copy.round} {reviewRound.reviewRound} ·{' '}
                          {reviewRound.completedScientificReviews} {copy.completedReviews}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={editorialAcceptanceConfirmed}
                      disabled={busy}
                      onChange={(event) =>
                        setEditorialAcceptanceConfirmed(event.target.checked)}
                    />
                    <span>{copy.editorialAcceptanceConfirmation}</span>
                  </label>
                  <button
                    type="button"
                    className="studio-menu-secondary-action"
                    disabled={busy || !editorialAcceptanceConfirmed || !selectedReviewRound}
                    onClick={() => void recordEditorialAcceptance()}
                  >
                    {copy.recordEditorialAcceptance}
                  </button>
                </fieldset>
              ) : null}
              <iframe
                title={copy.previewFrame}
                sandbox=""
                srcDoc={prepared.artifact.html}
                style={{ width: '100%', minHeight: '28rem', border: '1px solid currentColor', borderRadius: '0.4rem' }}
              />
              <label>
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(event) => setApproved(event.target.checked)}
                />
                <span>
                  {prepared.artifact.assurance.reviewStatus === 'peer-reviewed'
                    ? copy.approvalReviewed
                    : copy.approvalUnreviewed}
                </span>
              </label>
              <div className="publication-profile-actions">
                <button
                  type="button"
                  className="studio-menu-primary-action"
                  disabled={busy || !approved}
                  onClick={() => void publish()}
                >
                  <Send size={16} aria-hidden="true" />
                  {busy
                    ? copy.working
                    : publicationStatus === 'draft'
                      ? copy.sendDraft
                      : copy.publish}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {message ? <p className="publication-profile-status" role="status">{message}</p> : null}
      {receipt?.externalUrl ? (
        <p>
          <a href={receipt.externalUrl} target="_blank" rel="noreferrer">
            {copy.openPublished}
          </a>
        </p>
      ) : null}
      {error ? <p className="publication-profile-error" role="alert">{error}</p> : null}
    </section>
  );
}

function reviewRoundKey(reviewRound: EligibleEditorialReviewRound): string {
  return `${reviewRound.workspaceId}\u0000${reviewRound.reviewRound}`;
}

function failMissingEditorialDecision(): never {
  throw new Error('The selected Studio editorial decision is no longer available.');
}

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Hírlevél / webes közzététel',
      description: 'A szemantikus HTML5-változatot előnézet után közvetlenül WordPressbe vagy egy OMI-kompatibilis webes végpontra küldheted. A WordPress alapértelmezése piszkozat.',
      noTargets: 'Előbb adj hozzá WordPress- vagy webes publikálási célpontot a saját profil Integrációk részében.',
      target: 'Célpont',
      intent: 'Publikációs cél',
      publicInterest: 'Közérdekű közlemény',
      popularScience: 'Ismeretterjesztő közlemény',
      newsletter: 'Hírlevél',
      scholarlyArticle: 'Tudományos tanulmány',
      bookChapter: 'Tudományos könyvfejezet',
      status: 'Külső állapot',
      draft: 'Piszkozat',
      publishNow: 'Azonnal közzétett',
      preview: 'HTML5 előnézet elkészítése',
      previewReady: 'Az előnézet commitolt revízióból, ellenőrizhető build-manifesttel elkészült.',
      previewFrame: 'Webes publikáció előnézete',
      committedRevision: 'Rögzített forrásrevízió',
      assurance: 'Közzétételi minősítés',
      notPeerReviewed: 'nem szaklektorált',
      peerReviewed: 'szaklektorált — Studio által igazolt',
      publisherVerified: 'szaklektorált — hitelesített folyóirati döntés',
      round: 'forduló',
      noVerifiedReview: 'Ehhez a pontos revízióhoz nincs Studio által igazolt szerkesztői elfogadó döntés. A publikáció csak „nem szaklektorált” jelöléssel küldhető.',
      editorialAcceptanceTitle: 'Studio-lektorálás lezárása',
      editorialAcceptanceHelp: 'A teljes Studio-natív tudományos lektori forduló elkészült. A „lektorált” pecséthez egy szerkesztőnek külön el kell fogadnia ezt a pontos, rögzített revíziót. DNS-sel hitelesített folyóirat esetén csak az adott folyóirat aktív szerkesztője rögzíthet hitelesített folyóirati döntést.',
      reviewRound: 'Lektori forduló',
      completedReviews: 'lezárt tudományos lektori vélemény',
      editorialAcceptanceConfirmation: 'Szerkesztőként ellenőriztem a lezárt lektori fordulót, és ezt a pontos revíziót publikálásra elfogadom.',
      recordEditorialAcceptance: 'Szerkesztői elfogadás rögzítése',
      editorialAcceptanceRecorded: 'A szerkesztői elfogadás ehhez a pontos revízióhoz rögzült; az előnézet igazolt „lektorált” pecsétet kapott.',
      assuranceChanged: 'A közzétételi minősítés és az előnézeti pecsét frissült.',
      approvalUnreviewed: 'Ellenőriztem az előnézetet. Jóváhagyom ennek a pontos, „nem szaklektorált” jelölésű artefaktumnak a külső közzétételét.',
      approvalReviewed: 'Ellenőriztem az előnézetet és a „lektorált” pecsétet. Jóváhagyom ennek a pontos, szerkesztői döntéssel igazolt artefaktumnak a külső közzétételét.',
      sendDraft: 'Piszkozat küldése',
      publish: 'Közzététel',
      sentDraft: 'A külső piszkozat létrejött vagy frissült.',
      published: 'A külső bejegyzés létrejött vagy frissült és közzé lett téve.',
      openPublished: 'Külső bejegyzés megnyitása',
      working: 'Folyamatban…',
      untitled: 'Névtelen kézirat',
    };
  }
  if (locale === 'de') {
    return {
      title: 'Newsletter / Web-Publikation',
      description: 'Senden Sie die semantische HTML5-Fassung nach einer Vorschau direkt an WordPress oder einen OMI-kompatiblen Web-Endpunkt. WordPress wird standardmäßig als Entwurf angelegt.',
      noTargets: 'Fügen Sie zuerst im persönlichen Profil unter Integrationen ein WordPress- oder Web-Publikationsziel hinzu.',
      target: 'Ziel',
      intent: 'Veröffentlichungszweck',
      publicInterest: 'Veröffentlichung im öffentlichen Interesse',
      popularScience: 'Populärwissenschaftliche Veröffentlichung',
      newsletter: 'Newsletter',
      scholarlyArticle: 'Wissenschaftlicher Beitrag',
      bookChapter: 'Wissenschaftliches Buchkapitel',
      status: 'Externer Status',
      draft: 'Entwurf',
      publishNow: 'Sofort veröffentlichen',
      preview: 'HTML5-Vorschau erzeugen',
      previewReady: 'Die Vorschau wurde aus einer festgeschriebenen Revision mit überprüfbarem Build-Manifest erstellt.',
      previewFrame: 'Vorschau der Web-Publikation',
      committedRevision: 'Festgeschriebene Quellrevision',
      assurance: 'Veröffentlichungseinstufung',
      notPeerReviewed: 'nicht wissenschaftlich begutachtet',
      peerReviewed: 'begutachtet — durch Studio verifiziert',
      publisherVerified: 'begutachtet — durch verifizierte Publikationsstelle bestätigt',
      round: 'Runde',
      noVerifiedReview: 'Für diese genaue Revision liegt keine durch Studio verifizierte redaktionelle Annahmeentscheidung vor. Sie kann nur als „nicht begutachtet“ versendet werden.',
      editorialAcceptanceTitle: 'Studio-Begutachtung abschließen',
      editorialAcceptanceHelp: 'Die vollständige Studio-interne wissenschaftliche Begutachtungsrunde ist abgeschlossen. Für das Begutachtungssiegel muss eine Redakteurin oder ein Redakteur diese genaue Revision ausdrücklich annehmen. Bei einer per DNS verifizierten Publikationsstelle kann nur eine aktive Redakteurin oder ein aktiver Redakteur dieser Stelle eine verifizierte Entscheidung erfassen.',
      reviewRound: 'Begutachtungsrunde',
      completedReviews: 'abgeschlossene wissenschaftliche Gutachten',
      editorialAcceptanceConfirmation: 'Ich habe als Redakteurin oder Redakteur die abgeschlossene Begutachtungsrunde geprüft und nehme diese genaue Revision zur Veröffentlichung an.',
      recordEditorialAcceptance: 'Redaktionelle Annahme festhalten',
      editorialAcceptanceRecorded: 'Die redaktionelle Annahme wurde an diese genaue Revision gebunden; die Vorschau trägt nun ein verifiziertes Begutachtungssiegel.',
      assuranceChanged: 'Veröffentlichungseinstufung und Vorschausiegel wurden aktualisiert.',
      approvalUnreviewed: 'Ich habe die Vorschau geprüft und bestätige die externe Veröffentlichung genau dieses als „nicht begutachtet“ gekennzeichneten Artefakts.',
      approvalReviewed: 'Ich habe die Vorschau und das Begutachtungssiegel geprüft und bestätige die externe Veröffentlichung genau dieses durch eine redaktionelle Entscheidung verifizierten Artefakts.',
      sendDraft: 'Entwurf senden',
      publish: 'Veröffentlichen',
      sentDraft: 'Der externe Entwurf wurde erstellt oder aktualisiert.',
      published: 'Der externe Beitrag wurde erstellt oder aktualisiert und veröffentlicht.',
      openPublished: 'Externen Beitrag öffnen',
      working: 'Wird verarbeitet…',
      untitled: 'Unbenanntes Manuskript',
    };
  }
  return {
    title: 'Newsletter / website publishing',
    description: 'After previewing the semantic HTML5 version, send it directly to WordPress or an OMI-compatible web endpoint. WordPress defaults to draft status.',
    noTargets: 'First add a WordPress or web publishing target under Integrations in your personal profile.',
    target: 'Target',
    intent: 'Publication purpose',
    publicInterest: 'Public-interest publication',
    popularScience: 'Popular-science publication',
    newsletter: 'Newsletter',
    scholarlyArticle: 'Scholarly article',
    bookChapter: 'Scholarly book chapter',
    status: 'External status',
    draft: 'Draft',
    publishNow: 'Publish immediately',
    preview: 'Generate HTML5 preview',
    previewReady: 'The preview was built from a committed revision with a verifiable build manifest.',
    previewFrame: 'Website publication preview',
    committedRevision: 'Committed source revision',
    assurance: 'Publication assurance',
    notPeerReviewed: 'not peer reviewed',
    peerReviewed: 'peer reviewed — Studio verified',
    publisherVerified: 'peer reviewed — verified publication venue decision',
    round: 'round',
    noVerifiedReview: 'No Studio-verified editorial acceptance exists for this exact revision. It can be sent only with a “not peer reviewed” disclosure.',
    editorialAcceptanceTitle: 'Complete Studio peer review',
    editorialAcceptanceHelp: 'A complete Studio-native scientific review round is available. An editor must separately accept this exact committed revision before it may carry the peer-reviewed seal. For a DNS-verified publication venue, only an active editor of that venue can record a publisher-verified decision.',
    reviewRound: 'Review round',
    completedReviews: 'completed scientific reviews',
    editorialAcceptanceConfirmation: 'As an editor, I reviewed the completed review round and accept this exact revision for publication.',
    recordEditorialAcceptance: 'Record editorial acceptance',
    editorialAcceptanceRecorded: 'Editorial acceptance was bound to this exact revision; the preview now carries a verified peer-reviewed seal.',
    assuranceChanged: 'The publication assurance and preview seal were updated.',
    approvalUnreviewed: 'I reviewed the preview and approve external delivery of this exact artifact marked “not peer reviewed”.',
    approvalReviewed: 'I reviewed the preview and its peer-reviewed seal and approve external delivery of this exact artifact verified by an editorial decision.',
    sendDraft: 'Send draft',
    publish: 'Publish',
    sentDraft: 'The external draft was created or updated.',
    published: 'The external post was created or updated and published.',
    openPublished: 'Open external post',
    working: 'Working…',
    untitled: 'Untitled manuscript',
  };
}
