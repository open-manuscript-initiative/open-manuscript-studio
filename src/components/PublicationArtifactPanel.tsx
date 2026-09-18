import { useEffect, useMemo, useState } from 'react';

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
  preparePublicationArtifact,
  publicationArtifactFormatAvailableForDocument,
  type PreparedPublicationArtifact,
  type PublicationArtifactFormat,
  type PublicationArtifactProvider,
  type PublicationArtifactReceipt,
  type PublicationArtifactTarget,
} from '../services/publicationArtifact';
import type { OmiManuscript } from '../types/omi';
import './DirectSubmissionPanel.css';

const commonText = {
  hu: {
    title: 'Publikációs változat átadása OJS/OMP rendszerbe',
    choose: 'Válassz…',
    format: 'Publikációs formátum',
    locale: 'Változat nyelve',
    genre: 'Fájltípus',
    prepare: 'Validált artifact elkészítése',
    preparing: 'Artifact készítése és validálása…',
    busy: 'Feldolgozás…',
    changed:
      'A kézirat az artifact elkészítése óta megváltozott. Készíts új artifactot.',
    publication: 'Publikációváltozat',
    build: 'OMI build',
    digest: 'SHA-256',
    file: 'Fájl',
    size: 'Méret',
    preview: 'HTML-előnézet',
    xmlPreview: 'JATS XML előnézet',
    unavailable: 'Nem elérhető ezen a telepítésen',
    documentUnavailable:
      'Ehhez a dokumentumtípushoz jelenleg csak PDF artifact használható.',
    formats: {
      html: 'HTML',
      jats: 'JATS XML',
      'pdf-print': 'PDF / nyomtatási',
      'pdf-interactive': 'PDF / interaktív',
    },
  },
  en: {
    title: 'Transfer publication artifact to OJS/OMP',
    choose: 'Choose…',
    format: 'Publication format',
    locale: 'Artifact language',
    genre: 'File genre',
    prepare: 'Build validated artifact',
    preparing: 'Building and validating artifact…',
    busy: 'Processing…',
    changed:
      'The manuscript changed after the artifact was prepared. Build it again.',
    publication: 'Publication version',
    build: 'OMI build',
    digest: 'SHA-256',
    file: 'File',
    size: 'Size',
    preview: 'HTML preview',
    xmlPreview: 'JATS XML preview',
    unavailable: 'Unavailable on this installation',
    documentUnavailable:
      'Only PDF artifacts are currently available for this document type.',
    formats: {
      html: 'HTML',
      jats: 'JATS XML',
      'pdf-print': 'PDF / print',
      'pdf-interactive': 'PDF / interactive',
    },
  },
} as const;

function platformText(
  locale: string,
  provider: PublicationArtifactProvider | undefined,
) {
  const hu = locale === 'hu';
  const platform = provider === 'omp' ? 'OMP' : 'OJS';
  const isOmp = provider === 'omp';

  return {
    platform,
    connection: hu ? `${platform}-kapcsolat` : `${platform} connection`,
    key: hu
      ? `A személyes profilban mentett ${platform} szerkesztői API-kulcsot használjuk.`
      : `The saved personal ${platform} editorial API key is used.`,
    id: hu
      ? `Az ${platform}-beküldés azonosítója`
      : `${platform} submission ID`,
    inspect: hu
      ? 'Cél és támogatott kimenetek ellenőrzése'
      : 'Inspect destination and supported outputs',
    intro: hu
      ? isOmp
        ? 'Validált HTML-, JATS- vagy PDF-kimenet átadása egy meglévő, még nem publikált OMP-előállítási változatba. Az OMP szerkesztői jóváhagyása és közzététele külön lépés marad.'
        : 'Validált HTML-, JATS- vagy PDF-kimenet átadása egy meglévő, még nem publikált OJS-cikk előállítási szakaszába. Az OJS szerkesztője ellenőrzi és teszi közzé a változatot.'
      : isOmp
        ? 'Transfer validated HTML, JATS or PDF output to an existing unpublished OMP Production version. Native OMP approval and publication remain separate editorial steps.'
        : 'Transfer validated HTML, JATS or PDF output to an existing unpublished OJS article in Production. The OJS editor remains responsible for review and publication.',
    confirm: hu
      ? isOmp
        ? 'Ellenőriztem a célkiadványt és az artifact provenance-adatait. Átadom az OMP-nek; ettől a formátum nem lesz jóváhagyott, elérhető vagy publikált.'
        : 'Ellenőriztem a célcikket és az artifact provenance-adatait. Átadom az OJS-nek; ettől a cikk még nem lesz publikálva.'
      : isOmp
        ? 'I checked the target publication and artifact provenance. Transfer it to OMP; this does not approve, expose, or publish the format.'
        : 'I checked the destination and artifact provenance. Transfer it to OJS; this does not publish the article.',
    transfer: hu ? 'Artifact átadása' : 'Transfer artifact',
    success: hu
      ? isOmp
        ? 'Az artifact OMP proofként bekerült, alapból nem jóváhagyott, nem elérhető és nem látható. Közzététel nem történt.'
        : 'A publikációs artifact az OJS-ben van, szerkesztői ellenőrzésre vár. Közzététel nem történt.'
      : isOmp
        ? 'The artifact is stored as an OMP proof and is unapproved, unavailable, and non-viewable by default. Nothing has been published.'
        : 'The publication artifact is in OJS and awaits editorial review. Nothing has been published.',
    unchanged: hu
      ? `Ez a pontos artifact már az ${platform} rendszerben van; nem készült új példány.`
      : `This exact artifact is already in ${platform}; no duplicate was created.`,
    noConnections: hu
      ? `Először állíts be ${platform}-kapcsolatot az Integrációk menüben.`
      : `First configure an ${platform} connection in Integrations.`,
    help: hu
      ? isOmp
        ? 'OMP 3.5 és Studio Integration 1.4.0.0 vagy újabb szükséges. Az OMP a provenance-t és az artifact SHA-256 lenyomatát újra ellenőrzi, majd natív Publication Format + proof objektumként tárolja.'
        : 'OJS 3.5 és Studio Integration 1.5.0.0 vagy újabb szükséges. Az OJS az omi-publication-build provenance-t és az artifact SHA-256 lenyomatát átvétel előtt újra ellenőrzi.'
      : isOmp
        ? 'Requires OMP 3.5 and Studio Integration 1.4.0.0 or newer. OMP independently verifies provenance and SHA-256, then stores the output as a native Publication Format + proof.'
        : 'Requires OJS 3.5 and Studio Integration 1.5.0.0 or newer. OJS independently verifies the omi-publication-build provenance and artifact SHA-256 before persistence.',
  };
}

interface PreparedState {
  artifact: PreparedPublicationArtifact;
  source: OmiManuscript;
}

export function PublicationArtifactPanel() {
  const manuscript = useStudioStore((state) => state.manuscript);
  return (
    <PublicationArtifactForm key={manuscript.id} manuscript={manuscript} />
  );
}

function PublicationArtifactForm({
  manuscript,
}: {
  manuscript: OmiManuscript;
}) {
  const { locale: uiLocale } = useTranslation();
  const copy = uiLocale === 'hu' ? commonText.hu : commonText.en;
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const documentKind = getDocumentStructureProfile(manuscript).kind;
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [target, setTarget] = useState<PublicationArtifactTarget>();
  const [format, setFormat] = useState<PublicationArtifactFormat>('html');
  const [locale, setLocale] = useState('');
  const [genreId, setGenreId] = useState('');
  const [prepared, setPrepared] = useState<PreparedState>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<
    'inspect' | 'prepare' | 'transfer' | null
  >(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<PublicationArtifactReceipt>();

  useEffect(() => {
    let active = true;
    void getIntegrationCatalog()
      .then((catalog) => {
        if (!active) return;
        setConnections(
          catalog
            .filter(
              (provider) =>
                provider.id === 'ojs' || provider.id === 'omp',
            )
            .flatMap((provider) => provider.connections)
            .filter(
              (connection) =>
                connection.enabled &&
                (documentKind === 'study' || connection.providerId === 'omp'),
            ),
        );
      })
      .catch((cause: unknown) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, [documentKind]);

  const selectedConnection = useMemo(
    () => connections.find((item) => item.id === connectionId),
    [connections, connectionId],
  );
  const provider =
    selectedConnection?.providerId === 'omp'
      ? 'omp'
      : selectedConnection?.providerId === 'ojs'
        ? 'ojs'
        : undefined;
  const platform = platformText(uiLocale, provider);
  const selectedCapability = target?.formats.find(
    (item) => item.id === format,
  );
  const formatAllowed =
    selectedCapability?.available === true &&
    publicationArtifactFormatAvailableForDocument(manuscript, format);

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
    if (!provider) return;
    invalidateTarget();
    setBusy('inspect');
    try {
      const result = await requestPublicationArtifact(connectionId, {
        action: 'inspect',
        manuscriptId: manuscript.id,
        submissionId: Number(submissionId),
      });
      if (!result.target) {
        throw new Error(
          `${platform.platform} returned no publication artifact destination.`,
        );
      }
      if (
        result.target.provenance.model !== 'omi-publication-build' ||
        result.target.provenance.version !== '0.1.0' ||
        result.target.provenance.digest !== 'sha256'
      ) {
        throw new Error(
          `The ${platform.platform} plugin advertises an incompatible publication provenance model.`,
        );
      }
      if (
        provider === 'omp' &&
        (
          result.target.authority?.representation !== 'publicationFormat' ||
          result.target.authority?.formatApprovedByDefault !== false ||
          result.target.authority?.formatAvailableByDefault !== false ||
          result.target.authority?.proofViewableByDefault !== false
        )
      ) {
        throw new Error(
          'The OMP plugin does not advertise the required native publication-authority boundary.',
        );
      }
      setTarget(result.target);
      setLocale(
        result.target.locales.includes(manuscript.locale)
          ? manuscript.locale
          : result.target.locales[0] ?? '',
      );
      setGenreId(String(result.target.genres[0]?.id ?? ''));

      const available = result.target.formats.filter(
        (item) =>
          item.available &&
          publicationArtifactFormatAvailableForDocument(
            manuscript,
            item.id,
          ),
      );
      const preferred =
        available.find((item) =>
          documentKind === 'study'
            ? item.id === 'html'
            : item.id === 'pdf-print',
        ) ?? available[0];
      if (preferred) setFormat(preferred.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function prepare(): Promise<void> {
    if (!target || !formatAllowed || busy) return;
    invalidatePrepared();
    setBusy('prepare');

    try {
      await externalizeActiveManuscriptAssets();
      checkpoint('export');
      const committed = useStudioStore.getState().manuscript;
      const artifact = await preparePublicationArtifact(committed, format);
      if (
        selectedCapability &&
        artifact.bytes.byteLength > selectedCapability.maxBytes
      ) {
        throw new Error(
          `${copy.formats[format]} exceeds the ${platform.platform} transfer limit (${formatBytes(
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
      !provider ||
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
      if (!result.receipt) {
        throw new Error(
          `${platform.platform} returned no transfer receipt.`,
        );
      }
      if (
        provider === 'omp' &&
        !result.receipt.unchanged &&
        (
          result.receipt.formatApproved !== false ||
          result.receipt.formatAvailable !== false ||
          result.receipt.proofViewable !== false
        )
      ) {
        throw new Error(
          'OMP returned a receipt that violates the expected unapproved/non-viewable authority boundary.',
        );
      }
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
      <p>{platform.intro}</p>
      {provider ? <p>{platform.help}</p> : null}

      {!connections.length ? (
        <p>
          {uiLocale === 'hu'
            ? 'Először állíts be OJS- vagy OMP-kapcsolatot az Integrációk menüben.'
            : 'First configure an OJS or OMP connection in Integrations.'}
        </p>
      ) : null}

      <fieldset disabled={busy !== null}>
        <label>
          {provider ? platform.connection : uiLocale === 'hu' ? 'Publikációs kapcsolat' : 'Publishing connection'}
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
                {connection.providerId.toUpperCase()} ·{' '}
                {connection.displayName ?? connection.connectionKey}
              </option>
            ))}
          </select>
        </label>

        {provider ? (
          <>
            <label>
              {platform.id}
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

            <p>{platform.key}</p>
            <button
              type="button"
              disabled={!validSubmissionId}
              onClick={() => void inspect()}
            >
              {platform.inspect}
            </button>
          </>
        ) : null}

        {target && provider ? (
          <>
            <p>
              <strong>{target.title}</strong> · {platform.platform} #
              {target.submissionId}
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
                    event.target.value as PublicationArtifactFormat,
                  );
                }}
              >
                {target.formats.map((item) => {
                  const allowed =
                    item.available &&
                    publicationArtifactFormatAvailableForDocument(
                      manuscript,
                      item.id,
                    );
                  return (
                    <option
                      key={item.id}
                      value={item.id}
                      disabled={!allowed}
                    >
                      {copy.formats[item.id]}
                      {!item.available
                        ? ` — ${copy.unavailable}`
                        : !allowed
                          ? ` — ${copy.documentUnavailable}`
                          : ''}
                    </option>
                  );
                })}
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
              disabled={!formatAllowed || !locale || !genreId}
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
                    <dd>
                      {formatBytes(prepared.artifact.bytes.byteLength)}
                    </dd>
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
                  {platform.confirm}
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
                  {platform.transfer}
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </fieldset>

      {busy && busy !== 'prepare' ? (
        <p role="status">{copy.busy}</p>
      ) : null}
      {receipt && provider ? (
        <div role="status">
          <p>{receipt.unchanged ? platform.unchanged : platform.success}</p>
          {provider === 'ojs' && receipt.galleyId ? (
            <p>OJS galley: {receipt.galleyId}</p>
          ) : null}
          {provider === 'omp' && receipt.publicationFormatId ? (
            <p>
              OMP Publication Format: {receipt.publicationFormatId} · proof:{' '}
              {receipt.submissionFileId}
            </p>
          ) : null}
        </div>
      ) : null}

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
