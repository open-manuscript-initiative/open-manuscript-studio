import { getStudioApiBaseUrl } from '../services/studioServer';
import { useEffect, useRef, useState } from 'react';
import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import {
  assertOjsProductionTarget,
  prepareOjsPublicationOutputs,
  transferOjsPublicationOutputs,
} from '../app/ojsPublicationActions';
import { useTranslation } from '../i18n';
import { ojsPublicationCopy } from '../i18n/ojsPublication';
import { getDocumentStructureProfile } from '../model/documentProfile';
import {
  getIntegrationCatalog,
  requestPublicationArtifact,
  type IntegrationConnection,
} from '../services/integrationApi';
import type {
  PublicationArtifactTarget,
  PublicationArtifactReceipt,
} from '../services/publicationArtifact';
import {
  loadPublicationPublisherIdentity,
  type PublicationStyle,
} from '../services/publicationStyleExport';
import {
  publicationLayoutKey,
  type StyledPublicationArtifact,
  type StyledPublicationFormat,
} from '../services/styledPublicationArtifact';
import type { OmiManuscript } from '../types/omi';
import './OjsPublicationTransferPanel.css';

interface Prepared {
  source: OmiManuscript;
  target: PublicationArtifactTarget;
  outputs: StyledPublicationArtifact[];
  contextKey: string;
}
export function OjsPublicationTransferPanel({
  style,
  active,
}: {
  style: PublicationStyle;
  active: boolean;
}) {
  const { locale: uiLocale } = useTranslation();
  const copy = ojsPublicationCopy(uiLocale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const latest = useRef({ style, manuscript });
  latest.current = { style, manuscript };
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [target, setTarget] = useState<PublicationArtifactTarget>();
  const [targetOrigin, setTargetOrigin] = useState('');
  const [language, setLanguage] = useState('');
  const [genre, setGenre] = useState('');
  const [html, setHtml] = useState(true);
  const [pdf, setPdf] = useState(true);
  const [pdfMode, setPdfMode] = useState<'pdf-print' | 'pdf-interactive'>(
    'pdf-print',
  );
  const [prepared, setPrepared] = useState<Prepared>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<'inspect' | 'prepare' | 'transfer' | null>(
    null,
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [receipts, setReceipts] = useState<PublicationArtifactReceipt[]>([]);
  const context = () => ({
    style: latest.current.style,
    identity: loadPublicationPublisherIdentity(),
  });
  const contextKey = publicationLayoutKey(context());
  const isCurrent =
    prepared?.source === manuscript &&
    prepared?.target === target &&
    prepared?.contextKey === contextKey &&
    targetOrigin === getStudioApiBaseUrl();
  const isStudy = getDocumentStructureProfile(manuscript).kind === 'study';
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    void getIntegrationCatalog()
      .then((catalog) => {
        if (!disposed)
          setConnections(
            catalog
              .filter((provider) => provider.id === 'ojs')
              .flatMap((provider) => provider.connections)
              .filter((item) => item.enabled),
          );
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause));
      });
    return () => {
      disposed = true;
    };
  }, [active]);
  function invalidate() {
    setPrepared(undefined);
    setConfirmed(false);
    setError('');
    setMessage('');
  }
  async function inspect() {
    invalidate();
    setTarget(undefined);
    setBusy('inspect');
    try {
      const origin = getStudioApiBaseUrl();
      const result = await requestPublicationArtifact(connectionId, {
        action: 'inspect',
        manuscriptId: manuscript.id,
        submissionId: Number(submissionId),
      });
      if (!result.target)
        throw new Error('OJS returned no Production destination.');
      if (origin !== getStudioApiBaseUrl()) throw new Error(copy.changed);
      assertOjsProductionTarget(result.target);
      setTarget(result.target);
      setTargetOrigin(origin);
      setPdfMode(
        result.target.formats.some(
          (item) => item.id === 'pdf-print' && item.available,
        )
          ? 'pdf-print'
          : 'pdf-interactive',
      );
      setLanguage(
        result.target.locales.includes(manuscript.locale)
          ? manuscript.locale
          : (result.target.locales[0] ?? ''),
      );
      setGenre(String(result.target.genres[0]?.id ?? ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }
  const available = (format: StyledPublicationFormat) =>
    target?.formats.some((item) => item.id === format && item.available) ===
    true;
  const formats: StyledPublicationFormat[] = [
    ...(html && available('html') ? ['html' as const] : []),
    ...(pdf && available(pdfMode) ? [pdfMode] : []),
  ];
  async function prepare() {
    if (!target || busy) return;
    invalidate();
    setBusy('prepare');
    try {
      if (targetOrigin !== getStudioApiBaseUrl()) throw new Error(copy.changed);
      await externalizeActiveManuscriptAssets();
      useStudioStore.getState().checkpoint('export');
      const source = useStudioStore.getState().manuscript;
      const snapshot = context();
      const key = publicationLayoutKey(snapshot);
      const outputs = await prepareOjsPublicationOutputs(
        source,
        snapshot,
        target,
        formats,
      );
      setPrepared({ source, target, outputs, contextKey: key });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }
  async function transfer() {
    if (!target || !prepared || !isCurrent || !confirmed || busy) return;
    setBusy('transfer');
    setError('');
    setMessage('');
    setConfirmed(false);
    try {
      const result = await transferOjsPublicationOutputs({
        source: prepared.source,
        target,
        contextKey: prepared.contextKey,
        locale: language,
        genreId: Number(genre),
        outputs: prepared.outputs,
        currentSource: () => useStudioStore.getState().manuscript,
        currentContextKey: () => publicationLayoutKey(context()),
        isDestinationCurrent: () => targetOrigin === getStudioApiBaseUrl(),
        send: (request) => requestPublicationArtifact(connectionId, request),
        onReceipt: (receipt) =>
          setReceipts((current) => [
            ...current.filter((item) => item.buildId !== receipt.buildId),
            receipt,
          ]),
      });
      if (result.failed) {
        setError(
          `${copy.partial} ${copy.failed}: ${result.failed.format}. ${result.failed.message}`,
        );
        setPrepared(undefined);
        setTarget(undefined);
      } else {
        setMessage(copy.success);
        setPrepared(undefined);
        setTarget(undefined);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      hidden={!active}
      className="ojs-live-publication"
      aria-label={copy.title}
    >
      <h4>{copy.title}</h4>
      <p>{copy.help}</p>
      <p>
        {copy.style}: <strong>{style.name}</strong>
      </p>
      {!isStudy ? (
        <p>{copy.studyOnly}</p>
      ) : (
        <>
          {!connections.length ? <p>{copy.noConnection}</p> : null}
          <fieldset disabled={busy !== null}>
            <div className="ojs-live-publication-fields">
              <label>
                {copy.connection}
                <select
                  value={connectionId}
                  onChange={(event) => {
                    invalidate();
                    setTarget(undefined);
                    setConnectionId(event.target.value);
                    setReceipts([]);
                  }}
                >
                  <option value="">{copy.choose}</option>
                  {connections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName ?? item.connectionKey}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {copy.submission}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={submissionId}
                  onChange={(event) => {
                    invalidate();
                    setTarget(undefined);
                    setSubmissionId(event.target.value);
                    setReceipts([]);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={
                !connectionId ||
                !Number.isSafeInteger(Number(submissionId)) ||
                Number(submissionId) < 1
              }
              onClick={() => void inspect()}
            >
              {copy.inspect}
            </button>
            {target ? (
              <>
                <p>
                  <strong>{target.title}</strong> · OJS #{target.submissionId} /{' '}
                  {target.publicationId}
                </p>
                <div className="ojs-live-publication-fields">
                  <label>
                    {copy.language}
                    <select
                      value={language}
                      onChange={(event) => {
                        invalidate();
                        setLanguage(event.target.value);
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
                      value={genre}
                      onChange={(event) => {
                        invalidate();
                        setGenre(event.target.value);
                      }}
                    >
                      {target.genres.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="ojs-live-publication-choices">
                  <label>
                    <input
                      type="checkbox"
                      checked={html && available('html')}
                      disabled={!available('html')}
                      onChange={(event) => {
                        invalidate();
                        setHtml(event.target.checked);
                      }}
                    />
                    {copy.html}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={pdf && available(pdfMode)}
                      disabled={!available(pdfMode)}
                      onChange={(event) => {
                        invalidate();
                        setPdf(event.target.checked);
                      }}
                    />
                    {copy.pdf}
                  </label>
                  <label>
                    {copy.pdfMode}
                    <select
                      value={pdfMode}
                      onChange={(event) => {
                        invalidate();
                        setPdfMode(event.target.value as typeof pdfMode);
                      }}
                    >
                      <option value="pdf-print">{copy.print}</option>
                      <option value="pdf-interactive">
                        {copy.interactive}
                      </option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={!formats.length || !language || !genre}
                  onClick={() => void prepare()}
                >
                  {busy === 'prepare' ? copy.preparing : copy.prepare}
                </button>
              </>
            ) : null}
            {prepared ? (
              <>
                <ul>
                  {prepared.outputs.map((output) => (
                    <li key={output.format}>
                      <strong>{output.fileName}</strong> · {copy.size}:{' '}
                      {Math.ceil(output.bytes.byteLength / 1024)} KB{' '}
                      <OutputPreview
                        output={output}
                        title={copy.preview}
                        pdfTitle={copy.pdfPreview}
                      />
                    </li>
                  ))}
                </ul>
                {!isCurrent ? <p role="status">{copy.changed}</p> : null}
                <label className="ojs-live-publication-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  {copy.confirmation}
                </label>
                <button
                  type="button"
                  disabled={!isCurrent || !confirmed}
                  onClick={() => void transfer()}
                >
                  {copy.transfer}
                </button>
              </>
            ) : null}
          </fieldset>
        </>
      )}
      {busy ? <p role="status">{copy.busy}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {receipts.length ? (
        <ul aria-label={copy.received}>
          {receipts.map((item) => (
            <li key={item.buildId}>
              {item.format.toUpperCase()} · OJS #{item.submissionId} ·{' '}
              {copy.galley} #{item.galleyId} ✓
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
function OutputPreview({
  output,
  title,
  pdfTitle,
}: {
  output: StyledPublicationArtifact;
  title: string;
  pdfTitle: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (output.format === 'html') return;
    const bytes = new Uint8Array(output.bytes);
    const objectUrl = URL.createObjectURL(
      new Blob([bytes.buffer], { type: 'application/pdf' }),
    );
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [output]);
  return output.format === 'html' ? (
    <iframe title={title} sandbox="" srcDoc={output.previewText} />
  ) : url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {pdfTitle}
    </a>
  ) : null;
}
