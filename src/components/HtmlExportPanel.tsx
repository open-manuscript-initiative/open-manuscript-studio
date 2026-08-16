import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileCode2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getHtmlExportCopy } from '../i18n/htmlExport';
import {
  profileSupportsOutput,
  resolvePublicationProfile,
} from '../model/publicationProfile';
import {
  OMI_HTML_PROFILE,
  type HtmlDiagnostic,
} from '../services/exportHtml';
import {
  buildPublisherHtmlPackage,
  renderPublisherHtmlArticle,
} from '../services/exportPublisherHtmlPackage';

export function HtmlExportPanel() {
  const { locale } = useTranslation();
  const copy = getHtmlExportCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const profile = resolvePublicationProfile(manuscript);
  const supported = profileSupportsOutput(profile, 'html');
  const result = useMemo(
    () => renderPublisherHtmlArticle(manuscript, profile),
    [manuscript, profile],
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [packageDiagnostics, setPackageDiagnostics] = useState<HtmlDiagnostic[]>([]);
  const diagnostics = packageDiagnostics.length
    ? [...result.diagnostics, ...packageDiagnostics]
    : result.diagnostics;
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const warnings = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning',
  );

  async function downloadHtmlPackage(): Promise<void> {
    if (!supported || busy) return;
    setBusy(true);
    setPackageDiagnostics([]);

    try {
      await externalizeActiveManuscriptAssets();
      checkpoint('export');
      const committedManuscript = useStudioStore.getState().manuscript;
      const committedProfile = resolvePublicationProfile(committedManuscript);
      const packageResult = await buildPublisherHtmlPackage(
        committedManuscript,
        committedProfile,
      );
      const packageOnlyDiagnostics = packageResult.diagnostics.filter(
        (diagnostic) =>
          !packageResult.html.diagnostics.some(
            (renderDiagnostic) =>
              renderDiagnostic.code === diagnostic.code &&
              renderDiagnostic.targetId === diagnostic.targetId,
          ),
      );
      setPackageDiagnostics(packageOnlyDiagnostics);
      if (!packageResult.validForExport) return;

      const url = URL.createObjectURL(packageResult.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = packageResult.fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="html-export-panel" aria-labelledby="html-export-title">
      <div className="html-export-header">
        <div>
          <span className="html-export-eyebrow">
            <FileCode2 size={15} aria-hidden="true" />
            {copy.standard}
          </span>
          <h4 id="html-export-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <code>HTML5 · {OMI_HTML_PROFILE}</code>
      </div>

      {!supported ? (
        <div className="html-export-status html-export-status--error">
          <AlertTriangle size={16} aria-hidden="true" />
          {copy.unsupportedProfile}
        </div>
      ) : (
        <div
          className={`html-export-status ${
            errors.length
              ? 'html-export-status--error'
              : 'html-export-status--ready'
          }`}
        >
          {errors.length ? (
            <AlertTriangle size={16} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
          <span>
            {errors.length ? copy.exportHasErrors : copy.exportReady}
          </span>
        </div>
      )}

      <dl className="html-export-facts">
        <div>
          <dt>{copy.renderingContext}</dt>
          <dd>{result.context.model}</dd>
        </div>
        <div>
          <dt>{copy.currentRevision}</dt>
          <dd><code>{result.context.headRevisionId}</code></dd>
        </div>
        <div>
          <dt>{copy.diagnostics}</dt>
          <dd>
            {errors.length} {copy.errors} · {warnings.length} {copy.warnings}
          </dd>
        </div>
        {profile.exportStylesheet ? (
          <div>
            <dt>CSS</dt>
            <dd><code>{profile.exportStylesheet.fileName}</code></dd>
          </div>
        ) : null}
      </dl>

      <p className="html-export-hint">{copy.workingPreview}</p>

      {diagnostics.length ? (
        <ul className="html-export-diagnostics">
          {diagnostics.slice(0, 30).map((diagnostic, index) => (
            <li
              className={`html-export-diagnostic html-export-diagnostic--${diagnostic.severity}`}
              key={`${diagnostic.code}:${diagnostic.targetId ?? ''}:${index}`}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              <span>
                <strong>{diagnostic.code}</strong>
                {' — '}
                {diagnostic.message}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="html-export-no-diagnostics">
          <CheckCircle2 size={15} aria-hidden="true" />
          {copy.noDiagnostics}
        </p>
      )}

      <div className="html-export-actions">
        <button
          type="button"
          className="studio-menu-secondary-action"
          onClick={() => setPreviewOpen((value) => !value)}
        >
          {previewOpen ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
          {previewOpen ? copy.hidePreview : copy.preview}
        </button>

        <button
          type="button"
          className="studio-menu-primary-action"
          disabled={!supported || busy}
          onClick={() => void downloadHtmlPackage()}
        >
          <Download size={16} aria-hidden="true" />
          {busy ? copy.preparingPackage : copy.downloadPackage}
        </button>
      </div>

      {previewOpen ? (
        <pre className="html-export-preview" aria-label={copy.preview}>
          <code>{result.html}</code>
        </pre>
      ) : null}

      <p className="html-export-schema-note">{copy.packageNote}</p>
      <p className="html-export-schema-note">{copy.accessibilityNote}</p>
    </section>
  );
}
