import {
  Archive,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSearch,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import {
  externalizeActiveManuscriptAssets,
} from '../app/assetActions';
import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getAssetContainerCopy } from '../i18n/assetContainer';
import { getStateDigestCopy } from '../i18n/stateDigest';
import {
  ensureManuscriptRevisionStateDigests,
  inspectRevisionHistoryIntegrity,
} from '../model/revisionIntegrity';
import {
  buildOmiContainer,
  type OmiContainerDiagnostic,
} from '../services/omiContainer';
import {
  inspectOmiContainer,
  MAX_OMI_IMPORT_BYTES,
  type OmiContainerImportPlan,
} from '../services/omiContainerImport';
import { LongTaskStatus } from './LongTaskStatus';

export function AssetContainerPanelContent() {
  const { locale } = useTranslation();
  const copy = getAssetContainerCopy(locale);
  const digestCopy = getStateDigestCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'prepare' | 'download' | 'inspect' | 'import' | null>(null);
  const [preparedCount, setPreparedCount] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<OmiContainerDiagnostic[]>([]);
  const [importPlan, setImportPlan] = useState<OmiContainerImportPlan | null>(null);
  const [importedTitle, setImportedTitle] = useState<string | null>(null);
  const [importReadError, setImportReadError] = useState<string | null>(null);

  const embeddedImageCount = useMemo(
    () =>
      manuscript.sections
        .flatMap((section) => section.blocks)
        .filter(
          (block) =>
            block.visual?.kind === 'image' &&
            !block.visual.assetId &&
            block.visual.src.startsWith('data:'),
        ).length,
    [manuscript.sections],
  );
  const assets = manuscript.assets ?? [];
  const currentIntegrity = inspectRevisionHistoryIntegrity(manuscript.revisionHistory);
  const importIntegrity = importPlan?.manuscript
    ? inspectRevisionHistoryIntegrity(importPlan.manuscript.revisionHistory)
    : null;
  const importHasInvalidDigest = Boolean(
    importIntegrity &&
    (importIntegrity.summary.mismatch > 0 || importIntegrity.summary.unsupported > 0),
  );
  const importCanOpen = Boolean(
    importPlan?.validForImport && importPlan.manuscript && !importHasInvalidDigest,
  );
  const busyMessage = busy === 'download'
    ? copy.downloading
    : busy === 'inspect'
      ? copy.inspecting
      : busy === 'import'
        ? copy.importing
        : busy === 'prepare'
          ? copy.preparing
          : '';

  async function prepareAssets(): Promise<number> {
    setBusy('prepare');
    try {
      const count = await externalizeActiveManuscriptAssets();
      setPreparedCount(count);
      return count;
    } finally {
      setBusy(null);
    }
  }

  async function downloadPackage(): Promise<void> {
    setBusy('download');
    setDiagnostics([]);
    try {
      await externalizeActiveManuscriptAssets();
      checkpoint('export');
      const current = useStudioStore.getState().manuscript;
      const enriched = ensureManuscriptRevisionStateDigests(current);
      if (enriched !== current) useStudioStore.setState({ manuscript: enriched });
      const result = await buildOmiContainer(enriched);
      setDiagnostics(result.diagnostics);
      if (!result.validForExport) return;
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      setBusy(null);
    }
  }

  async function inspectPackage(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('inspect');
    setImportPlan(null);
    setImportedTitle(null);
    setImportReadError(null);
    try {
      if (file.size > MAX_OMI_IMPORT_BYTES) {
        setImportReadError(`${copy.invalid} (${Math.round(file.size / 1024 / 1024)} MB > ${Math.round(MAX_OMI_IMPORT_BYTES / 1024 / 1024)} MB)`);
        return;
      }
      setImportPlan(await inspectOmiContainer(await file.arrayBuffer()));
    } catch (importError) {
      setImportReadError(importError instanceof Error ? importError.message : copy.invalid);
    } finally {
      setBusy(null);
    }
  }

  async function openVerifiedPackage(): Promise<void> {
    if (!importCanOpen || !importPlan?.manuscript) return;
    if (!window.confirm(copy.confirmImport)) return;
    setBusy('import');
    setImportReadError(null);
    try {
      const title = importPlan.manuscript.title;
      await applyOmiContainerImportPlan(importPlan);
      setImportedTitle(title);
      setImportPlan(null);
      setDiagnostics([]);
      setPreparedCount(null);
    } catch (importError) {
      setImportReadError(importError instanceof Error ? importError.message : copy.invalid);
    } finally {
      setBusy(null);
    }
  }

  const errors = diagnostics.filter((item) => item.severity === 'error');
  const warnings = diagnostics.filter((item) => item.severity === 'warning');
  const importErrors = importPlan?.diagnostics.filter((item) => item.severity === 'error') ?? [];
  const importWarnings = importPlan?.diagnostics.filter((item) => item.severity === 'warning') ?? [];

  return (
    <section className="omi-container-card" aria-labelledby="omi-container-title" aria-busy={busy !== null}>
      <div className="omi-container-header">
        <div className="omi-container-icon" aria-hidden="true"><Archive size={19} /></div>
        <div><h4 id="omi-container-title">{copy.title}</h4><p>{copy.description}</p></div>
      </div>
      {busy && busyMessage ? <LongTaskStatus message={busyMessage} /> : null}
      <div className="omi-container-facts">
        <span><strong>{assets.length}</strong> {copy.assets}</span>
        <span><strong>{embeddedImageCount}</strong> {copy.embedded}</span>
        <span><ShieldCheck size={14} aria-hidden="true" /> {copy.integrity}</span>
        <span><strong>{currentIntegrity.summary.verified}/{currentIntegrity.summary.total}</strong>{' '}{digestCopy.integrity}</span>
      </div>
      <div className="omi-container-actions">
        <button type="button" className="studio-menu-secondary-action" disabled={busy !== null || embeddedImageCount === 0} onClick={() => void prepareAssets()}><FileCheck2 size={16} aria-hidden="true" />{busy === 'prepare' ? copy.preparing : copy.prepare}</button>
        <button type="button" className="studio-menu-primary-action" disabled={busy !== null} onClick={() => void downloadPackage()}><Download size={16} aria-hidden="true" />{busy === 'download' ? copy.downloading : copy.download}</button>
      </div>
      {preparedCount !== null ? <p className="omi-container-status omi-container-status--ok"><CheckCircle2 size={15} aria-hidden="true" />{copy.prepared} {preparedCount > 0 ? `(${preparedCount})` : ''}</p> : null}
      <p className="omi-container-note">{copy.format}</p>
      <p className="omi-container-note">{copy.privacyNote}</p>
      {diagnostics.length ? <ContainerDiagnostics diagnostics={diagnostics} errors={errors.length} warnings={warnings.length} title={copy.diagnostics} ready={copy.ready} blocked={copy.blocked} /> : <small className="omi-container-empty">{copy.noDiagnostics}</small>}
      <div className="omi-container-divider" />
      <section className="omi-container-import" aria-labelledby="omi-container-import-title">
        <div className="omi-container-header">
          <div className="omi-container-icon" aria-hidden="true"><FileSearch size={19} /></div>
          <div><h4 id="omi-container-import-title">{copy.importTitle}</h4><p>{copy.importDescription}</p></div>
        </div>
        <input ref={importInputRef} className="omi-visually-hidden-input" type="file" accept=".omi,application/vnd.openmanuscript.omi+zip,application/zip" onChange={(event) => void inspectPackage(event)} />
        <div className="omi-container-actions"><button type="button" className="studio-menu-secondary-action" disabled={busy !== null} onClick={() => importInputRef.current?.click()}><Upload size={16} aria-hidden="true" />{busy === 'inspect' ? copy.inspecting : copy.choosePackage}</button></div>
        {importedTitle ? <p className="omi-container-status omi-container-status--ok" role="status"><CheckCircle2 size={15} aria-hidden="true" />{copy.imported} {importedTitle ? `— ${importedTitle}` : ''}</p> : null}
        {importReadError ? <p className="omi-container-status omi-container-status--error" role="alert">{importReadError}</p> : null}
        {importPlan ? <div className="omi-container-import-report">
          <p className={importCanOpen ? 'omi-container-status omi-container-status--ok' : 'omi-container-status omi-container-status--error'}>{importCanOpen ? copy.verified : copy.invalid}</p>
          <div className="omi-container-import-summary">
            <span><strong>{importPlan.summary.entryCount}</strong> {copy.entries}</span><span><strong>{importPlan.summary.assetCount}</strong> {copy.packageAssets}</span><span><strong>{importPlan.summary.revisionCount}</strong> {copy.revisions}</span><span><strong>{importPlan.summary.verifiedChecksums}/{importPlan.summary.declaredChecksums}</strong>{' '}{copy.checksums}</span>
          </div>
          {importIntegrity ? <div className="omi-container-integrity-report"><p>{importHasInvalidDigest ? <ShieldAlert size={15} aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}{' '}<strong>{digestCopy.integrity}:</strong>{' '}{importIntegrity.summary.verified}/{importIntegrity.summary.total}</p><p>{importHasInvalidDigest ? digestCopy.importInvalid : importIntegrity.summary.missing > 0 ? digestCopy.importLegacy : digestCopy.importVerified}</p></div> : null}
          {importPlan.summary.title ? <h5>{importPlan.summary.title}</h5> : null}
          {importPlan.summary.manuscriptId ? <dl className="omi-container-identities"><div><dt>{copy.manuscriptId}</dt><dd><code>{importPlan.summary.manuscriptId}</code></dd></div><div><dt>{copy.headRevision}</dt><dd><code>{importPlan.summary.headRevisionId}</code></dd></div></dl> : null}
          <p className="omi-container-note">{copy.replaceWarning}</p>
          {importPlan.diagnostics.length ? <ContainerDiagnostics diagnostics={importPlan.diagnostics} errors={importErrors.length} warnings={importWarnings.length} title={copy.diagnostics} ready={copy.verified} blocked={copy.invalid} /> : null}
          <div className="omi-container-actions"><button type="button" className="studio-menu-primary-action" disabled={!importCanOpen || busy !== null} onClick={() => void openVerifiedPackage()}><ShieldCheck size={16} aria-hidden="true" />{busy === 'import' ? copy.importing : copy.importPackage}</button></div>
        </div> : null}
      </section>
    </section>
  );
}

function ContainerDiagnostics({ diagnostics, errors, warnings, title, ready, blocked }: { diagnostics: OmiContainerDiagnostic[]; errors: number; warnings: number; title: string; ready: string; blocked: string }) {
  return <details className="omi-container-diagnostics" open={errors > 0}><summary>{title} · {errors} / {warnings}</summary><p className={errors ? 'omi-container-status omi-container-status--error' : 'omi-container-status omi-container-status--ok'}>{errors ? blocked : ready}</p><ul>{diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}:${diagnostic.targetId ?? index}`} data-severity={diagnostic.severity}><strong>{diagnostic.code}</strong><span>{diagnostic.message}</span></li>)}</ul></details>;
}
