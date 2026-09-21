import { Globe2, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { buildPublicationHtmlArtifact } from '../services/publicationHtmlArtifact';
import {
  getIntegrationCatalog,
  requestNewsletterPublication,
  type IntegrationConnection,
  type NewsletterPublicationReceipt,
} from '../services/integrationApi';

export function NewsletterPublishingPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [targets, setTargets] = useState<IntegrationConnection[]>([]);
  const [targetId, setTargetId] = useState('');
  const [publicationStatus, setPublicationStatus] = useState<'draft' | 'publish'>('draft');
  const [preview, setPreview] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<NewsletterPublicationReceipt | null>(null);

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
    setPreview(null);
    setApproved(false);
    setReceipt(null);
    setMessage('');
  }, [manuscript, targetId, publicationStatus]);

  async function generatePreview() {
    setBusy(true);
    setError('');
    setMessage('');
    setReceipt(null);
    setApproved(false);
    try {
      const html = await buildPublicationHtmlArtifact(manuscript);
      setPreview(html);
      setMessage(copy.previewReady);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selected || !preview || !approved) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await requestNewsletterPublication({
        connectionId: selected.id,
        manuscriptId: manuscript.id,
        title: manuscript.title?.trim() || copy.untitled,
        html: preview,
        status: publicationStatus,
        approved: true,
      });
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

          {preview ? (
            <div className="publication-web-preview">
              <iframe
                title={copy.previewFrame}
                sandbox=""
                srcDoc={preview}
                style={{ width: '100%', minHeight: '28rem', border: '1px solid currentColor', borderRadius: '0.4rem' }}
              />
              <label>
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(event) => setApproved(event.target.checked)}
                />
                <span>{copy.approval}</span>
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

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Hírlevél / webes közzététel',
      description: 'A szemantikus HTML5-változatot előnézet után közvetlenül WordPressbe vagy egy OMI-kompatibilis webes végpontra küldheted. A WordPress alapértelmezése piszkozat.',
      noTargets: 'Előbb adj hozzá WordPress- vagy webes publikálási célpontot a saját profil Integrációk részében.',
      target: 'Célpont',
      status: 'Külső állapot',
      draft: 'Piszkozat',
      publishNow: 'Azonnal közzétett',
      preview: 'HTML5 előnézet elkészítése',
      previewReady: 'Az előnézet elkészült. A küldéshez külön jóváhagyás szükséges.',
      previewFrame: 'Webes publikáció előnézete',
      approval: 'Ellenőriztem az előnézetet, és jóváhagyom a külső írást.',
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
      status: 'Externer Status',
      draft: 'Entwurf',
      publishNow: 'Sofort veröffentlichen',
      preview: 'HTML5-Vorschau erzeugen',
      previewReady: 'Die Vorschau ist bereit. Vor dem externen Schreiben ist eine ausdrückliche Bestätigung erforderlich.',
      previewFrame: 'Vorschau der Web-Publikation',
      approval: 'Ich habe die Vorschau geprüft und bestätige das externe Schreiben.',
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
    status: 'External status',
    draft: 'Draft',
    publishNow: 'Publish immediately',
    preview: 'Generate HTML5 preview',
    previewReady: 'The preview is ready. Explicit approval is required before any external write.',
    previewFrame: 'Website publication preview',
    approval: 'I reviewed the preview and approve the external write.',
    sendDraft: 'Send draft',
    publish: 'Publish',
    sentDraft: 'The external draft was created or updated.',
    published: 'The external post was created or updated and published.',
    openPublished: 'Open external post',
    working: 'Working…',
    untitled: 'Untitled manuscript',
  };
}
