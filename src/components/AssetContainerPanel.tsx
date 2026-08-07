import { Archive, CheckCircle2, Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  externalizeActiveManuscriptAssets,
} from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getAssetContainerCopy } from '../i18n/assetContainer';
import {
  buildOmiContainer,
  type OmiContainerDiagnostic,
} from '../services/omiContainer';

export function AssetContainerPanel() {
  const { locale } = useTranslation();
  const copy = getAssetContainerCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const [busy, setBusy] = useState<'prepare' | 'download' | null>(null);
  const [preparedCount, setPreparedCount] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<OmiContainerDiagnostic[]>([]);

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
      const result = await buildOmiContainer(current);
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

  const errors = diagnostics.filter((item) => item.severity === 'error');
  const warnings = diagnostics.filter((item) => item.severity === 'warning');

  return (
    <section className="omi-container-card" aria-labelledby="omi-container-title">
      <div className="omi-container-header">
        <div className="omi-container-icon" aria-hidden="true">
          <Archive size={19} />
        </div>
        <div>
          <h4 id="omi-container-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="omi-container-facts">
        <span><strong>{assets.length}</strong> {copy.assets}</span>
        <span><strong>{embeddedImageCount}</strong> {copy.embedded}</span>
        <span><ShieldCheck size={14} aria-hidden="true" /> {copy.integrity}</span>
      </div>

      <div className="omi-container-actions">
        <button
          type="button"
          className="studio-menu-secondary-action"
          disabled={busy !== null || embeddedImageCount === 0}
          onClick={() => void prepareAssets()}
        >
          <FileCheck2 size={16} aria-hidden="true" />
          {busy === 'prepare' ? copy.preparing : copy.prepare}
        </button>
        <button
          type="button"
          className="studio-menu-primary-action"
          disabled={busy !== null}
          onClick={() => void downloadPackage()}
        >
          <Download size={16} aria-hidden="true" />
          {busy === 'download' ? copy.downloading : copy.download}
        </button>
      </div>

      {preparedCount !== null ? (
        <p className="omi-container-status omi-container-status--ok">
          <CheckCircle2 size={15} aria-hidden="true" />
          {copy.prepared} {preparedCount > 0 ? `(${preparedCount})` : ''}
        </p>
      ) : null}

      <p className="omi-container-note">{copy.format}</p>
      <p className="omi-container-note">{copy.privacyNote}</p>

      {diagnostics.length ? (
        <details className="omi-container-diagnostics" open={errors.length > 0}>
          <summary>
            {copy.diagnostics} · {errors.length} / {warnings.length}
          </summary>
          <p className={errors.length ? 'omi-container-status omi-container-status--error' : 'omi-container-status omi-container-status--ok'}>
            {errors.length ? copy.blocked : copy.ready}
          </p>
          <ul>
            {diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}:${diagnostic.targetId ?? index}`} data-severity={diagnostic.severity}>
                <strong>{diagnostic.code}</strong>
                <span>{diagnostic.message}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <small className="omi-container-empty">{copy.noDiagnostics}</small>
      )}
    </section>
  );
}
