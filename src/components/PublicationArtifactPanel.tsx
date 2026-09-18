import { useEffect, useState } from 'react';

import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getDocumentStructureProfile } from '../model/documentProfile';
import {
  getIntegrationCatalog,
  requestPublicationArtifact,
  type IntegrationConnection,
} from '../services/integrationApi';
import {
  prepareOjsPublicationArtifact,
  type OjsPublicationArtifactFormat,
  type OjsPublicationArtifactReceipt,
  type OjsPublicationArtifactTarget,
  type PreparedOjsPublicationArtifact,
} from '../services/ojsPublicationArtifact';
import type { OmiManuscript } from '../types/omi';
import './DirectSubmissionPanel.css';

const text = {
  hu: {
    title: 'Publikációs változat átadása az OJS-nek',
    intro:
      'Validált HTML-, JATS- vagy PDF-kimenet átadása egy meglévő, még nem publikált OJS-cikk előállítási szakaszába. Az OJS szerkesztője ellenőrzi és teszi közzé a változatot.',
    connection: 'OJS-kapcsolat',
    choose: 'Válassz…',
    key: 'A személyes profilban mentett OJS szerkesztői API-kulcsot használjuk.',
    id: 'Az OJS-beküldés azonosítója',
    inspect: 'Célcikk és támogatott kimenetek ellenőrzése',
    format: 'Publikációs formátum',
    locale: 'Változat nyelve',
    genre: 'Cikkfájl típusa',
    prepare: 'Validált artifact elkészítése',
    preparing: 'Artifact készítése és validálása…',
    confirm:
      'Ellenőriztem a célcikket és az elkészített artifact adatait. Átadom az OJS-nek; ettől a cikk még nem lesz publikálva.',
    transfer: 'Artifact átadása',
    busy: 'Feldolgozás…',
    success:
      'A publikációs artifact az OJS-ben van, szerkesztői ellenőrzésre vár. Közzététel nem történt.',
    unchanged:
      'Ez a pontos artifact már az OJS-ben van; nem készült új példány.',
    study: 'Nyiss meg egy önálló tanulmányt.',
    noConnections:
      'Először állíts be OJS-kapcsolatot az Integrációk menüben.',
    changed:
      'A kézirat az artifact elkészítése óta megváltozott. Készíts új artifactot.',
    publication: 'Publikációváltozat',
    galley: 'OJS-változat azonosítója',
    build: 'OMI build',
    digest: 'SHA-256',
    file: 'Fájl',
    size: 'Méret',
    preview: 'HTML-előnézet',
    xmlPreview: 'JATS XML előnézet',
    unavailable: 'Nem elérhető ezen az OJS-telepítésen',
    help:
      'OJS 3.5 és Studio Integration 1.5.0.0 vagy újabb szükséges. Az OJS az omi-publication-build provenance-t és az artifact SHA-256 lenyomatát átvétel előtt újra ellenőrzi.',
    formats: {
      html: 'HTML',
      jats: 'JATS XML',
      'pdf-print': 'PDF / nyomtatási',
      'pdf-interactive': 'PDF / interaktív',
    },
  },
  en: {
    title: 'Transfer publication artifact to OJS',
    intro:
      'Transfer validated HTML, JATS or PDF output to an existing unpublished OJS article in Production. The OJS editor remains responsible for review and publication.',
    connection: 'OJS connection',
    choose: 'Choose…',
    key: 'The saved personal OJS editorial API key is used.',
    id: 'OJS submission ID',
    inspect: 'Inspect destination and supported outputs',
    format: 'Publication format',
    locale: 'Artifact language',
    genre: 'Article file genre',
    prepare: 'Build validated artifact',
    preparing: 'Building and validating artifact…',
    confirm:
      'I checked the destination and artifact provenance. Transfer it to OJS; this does not publish the article.',
    transfer: 'Transfer artifact',
    busy: 'Processing…',
    success:
      'The publication artifact is in OJS and awaits editorial review. Nothing has been published.',
    unchanged:
      'This exact artifact is already in OJS; no duplicate was created.',
    study: 'Open a standalone study.',
    noConnections: 'First configure an OJS connection in Integrations.',
    changed:
      'The manuscript changed after the artifact was prepared. Build it again.',
    publication: 'Publication version',
    galley: 'OJS galley ID',
    build: 'OMI build',
    digest: 'SHA-256',
    file: 'File',
    size: 'Size',
    preview: 'HTML preview',
    xmlPreview: 'JATS XML preview',
    unavailable: 'Unavailable on this OJS installation',
    help:
      'Requires OJS 3.5 and Studio Integration 1.5.0.0 or newer. OJS independently verifies the omi-publication-build provenance and artifact SHA-256 before persistence.',
    formats: {
      html: 'HTML',
      jats: 'JATS XML',
      'pdf-print': 'PDF / print',
      'pdf-interactive': 'PDF / interactive',
    },
  },
};

interface PreparedState {
  artifact: PreparedOjsPublicationArtifact;
  source: OmiManuscript;
}

export function PublicationArtifactPanel() {
  const manuscript = useStudioStore((state) => state.manuscript);
  return (
    <PublicationArtifactForm
      key={manuscript.id}
      manuscript={manuscript}
    />
  );
}

function PublicationArtifactForm({
  manuscript,
}: {
  manuscript: OmiManuscript;
}) {
  const { locale: uiLocale } = useTranslation();
  const copy = uiLocale === 'hu' ? text.hu : text.en;
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [target, setTarget] = useState<OjsPublicationArtifactTarget>();
  const [format, setFormat] = useState<OjsPublicationArtifactFormat>('html');
  const [locale, setLocale] = useState('');
  const [genreId, setGenreId] = useState('');
  const [prepared, setPrepared] = useState<PreparedState>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<
    'inspect' | 'prepare' | 'transfer' | null
  >(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] =
    useState<OjsPublicationArtifactReceipt>();

  useEffect(() => {
    let active = true;
    void getIntegrationCatalog()
      .then((catalog) => {
        if (!active) return;
        setConnections(
          catalog
            .filter((provider) => provider.id === 'ojs')
            .flatMap((provider) => provider.connections)
            .filter((connection) => connection.enabled),
        );
      })
      .catch((cause: unknown) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCapability = target?.formats.find(
    (item) => item.id === format,
  );

  function invalidatePrepared(): void {
    setPrepared(undefined);
    setConfirmed(false);
    setReceipt(undefined);
    setError('');
  }

  function invalidateTarget(): void {
    setTarget(undefined);
    invalidatePrepared();
  }

  async function inspect(): Promise<void> {
    invalidateTarget();
    setBusy('inspect');
    try {
      const result = await requestPublicationArtifact(connectionId, {
        action: 'inspect',
        manuscriptId: manuscript.id,
        submissionId: Number(submissionId),
      });
      if (!result.target) {
        throw new Error('OJS returned no publication artifact destination.');
      }
      setTarget(result.target);
      setLocale(
        result.target.locales.includes(manuscript.locale)
          ? manuscript.locale
          : result.target.locales[0] ?? '',
      );
      setGenreId(String(result.target.genres[0]?.id ?? ''));
      const preferred =
        result.target.formats.find(
          (item) => item.id === 'html' && item.available,
        ) ??
        result.target.formats.find((item) => item.available);
      if (preferred) setFormat(preferred.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function prepare(): Promise<void> {
    if (!target || !selectedCapability?.available || busy) return;
    invalidatePrepared();
    setBusy('prepare');

    try {
      await externalizeActiveManuscriptAssets();
      checkpoint('export');
      const committed = useStudioStore.getState().manuscript;
      const artifact = await prepareOjsPublicationArtifact(
        committed,
        format,
      );
      if (artifact.bytes.byteLength > selectedCapability.maxBytes) {
        throw new Error(
          `${copy.formats[format]} exceeds the OJS transfer limit (${formatBytes(
            selectedCapability.maxBytes,
          )}).`,
        );
      }
      setPrepared({ artifact, source: committed });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function transfer(): Promise<void> {
    if (
      !target ||
      !prepared ||
      prepared.source !== manuscript ||
      !confirmed ||
      busy
    ) {
      return;
    }
    setBusy('transfer');
    setError('');
    setReceipt(undefined);

    try {
      const artifact = prepared.artifact;
      const result = await requestPublicationArtifact(connectionId, {
        action: 'transfer',
        manuscriptId: manuscript.id,
        submissionId: target.submissionId,
        publicationId: target.publicationId,
        locale,
        genreId: Number(genreId),
        format: artifact.format,
        mediaType: artifact.mediaType,
        fileName: artifact.fileName,
        artifactBase64: artifact.artifactBase64,
        build: artifact.build,
        confirmed: true,
      });
      if (!result.receipt) throw new Error('OJS returned no transfer receipt.');
      setReceipt(result.receipt);
      setConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  const validSubmissionId =
    Number.isSafeInteger(Number(submissionId)) && Number(submissionId) > 0;
  const preparedIsCurrent = prepared?.source === manuscript;

  return (
    <section className="omi-direct-submission" aria-label={copy.title}>
      <h3>{copy.title}</h3>
      <p>{copy.intro}</p>
      <p>{copy.help}</p>

      {getDocumentStructureProfile(manuscript).kind !== 'study' ? (
        <p>{copy.study}</p>
      ) : (
        <>
          {!connections.length ? <p>{copy.noConnections}</p> : null}
          <fieldset disabled={busy !== null}>
            <label>
              {copy.connection}
              <select
                value={connectionId}
                onChange={(event) => {
                  invalidateTarget();
                  setConnectionId(event.target.value);
                }}
              >
                <option value="">{copy.choose}</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {copy.id}
              <input
                type="number"
                min="1"
                step="1"
                value={submissionId}
                onChange={(event) => {
                  invalidateTarget();
                  setSubmissionId(event.target.value);
                }}
              />
            </label>

            <p>{copy.key}</p>
            <button
              type="button"
              disabled={!connectionId || !validSubmissionId}
              onClick={() => void inspect()}
            >
              {copy.inspect}
            </button>

            {target ? (
              <>
                <p>
                  <strong>{target.title}</strong> · OJS #{target.submissionId}
                  {' · '}
                  {copy.publication}: {target.publicationId}
                </p>

                <label>
                  {copy.format}
                  <select
                    value={format}
                    onChange={(event) => {
                      invalidatePrepared();
                      setFormat(
                        event.target.value as OjsPublicationArtifactFormat,
                      );
                    }}
                  >
                    {target.formats.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={!item.available}
                      >
                        {copy.formats[item.id]}
                        {!item.available ? ` — ${copy.unavailable}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {copy.locale}
                  <select
                    value={locale}
                    onChange={(event) => {
                      invalidatePrepared();
                      setLocale(event.target.value);
                    }}
                  >
                    {target.locales.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {copy.genre}
                  <select
                    value={genreId}
                    onChange={(event) => {
                      invalidatePrepared();
                      setGenreId(event.target.value);
                    }}
                  >
                    {target.genres.map((genre) => (
                      <option key={genre.id} value={genre.id}>
                        {genre.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={
                    !selectedCapability?.available || !locale || !genreId
                  }
                  onClick={() => void prepare()}
                >
                  {busy === 'prepare' ? copy.preparing : copy.prepare}
                </button>

                {prepared ? (
                  <>
                    <dl className="jats-export-facts">
                      <div>
                        <dt>{copy.file}</dt>
                        <dd>{prepared.artifact.fileName}</dd>
                      </div>
                      <div>
                        <dt>{copy.size}</dt>
                        <dd>{formatBytes(prepared.artifact.bytes.byteLength)}</dd>
                      </div>
                      <div>
                        <dt>{copy.build}</dt>
                        <dd>
                          <code>{shortHash(prepared.artifact.build.id)}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>{copy.digest}</dt>
                        <dd>
                          <code>
                            {shortHash(
                              prepared.artifact.build.output.digest.value,
                            )}
                          </code>
                        </dd>
                      </div>
                    </dl>

                    {prepared.artifact.format === 'html' &&
                    prepared.artifact.previewText ? (
                      <iframe
                        title={copy.preview}
                        sandbox=""
                        srcDoc={prepared.artifact.previewText}
                        style={{
                          width: '100%',
                          height: '24rem',
                          background: 'white',
                          border: '1px solid #ccc',
                        }}
                      />
                    ) : null}

                    {prepared.artifact.format === 'jats' &&
                    prepared.artifact.previewText ? (
                      <details>
                        <summary>{copy.xmlPreview}</summary>
                        <pre className="jats-export-preview">
                          <code>{prepared.artifact.previewText}</code>
                        </pre>
                      </details>
                    ) : null}

                    {!preparedIsCurrent ? (
                      <p role="status">{copy.changed}</p>
                    ) : null}

                    <label className="omi-direct-submission-confirm">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) =>
                          setConfirmed(event.target.checked)
                        }
                      />
                      {copy.confirm}
                    </label>

                    <button
                      type="button"
                      disabled={
                        !confirmed ||
                        !locale ||
                        !genreId ||
                        !preparedIsCurrent
                      }
                      onClick={() => void transfer()}
                    >
                      {copy.transfer}
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
          </fieldset>

          {busy && busy !== 'prepare' ? (
            <p role="status">{copy.busy}</p>
          ) : null}
          {receipt ? (
            <p role="status">
              {receipt.unchanged ? copy.unchanged : copy.success}{' '}
              {copy.galley}: {receipt.galleyId}
            </p>
          ) : null}
        </>
      )}

      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function shortHash(value: string): string {
  if (value.length <= 28) return value;
  return `${value.slice(0, 18)}…${value.slice(-10)}`;
}
