import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getJatsExportCopy } from '../i18n/jatsExport';
import {
  profileSupportsOutput,
  resolvePublicationProfile,
} from '../model/publicationProfile';
import {
  jatsFileName,
  OMI_JATS_TAGSET,
  OMI_JATS_VERSION,
  renderJatsArticle,
} from '../services/exportJats';

export function JatsExportPanel() {
  const { locale } = useTranslation();
  const copy = getJatsExportCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const profile = resolvePublicationProfile(manuscript);
  const supported = profileSupportsOutput(profile, 'jats');
  const result = useMemo(
    () => renderJatsArticle(manuscript, profile),
    [manuscript, profile],
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const errors = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const warnings = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning',
  );

  function downloadJats(): void {
    if (!supported) return;

    checkpoint('export');
    const committedManuscript = useStudioStore.getState().manuscript;
    const committedProfile = resolvePublicationProfile(committedManuscript);
    const committedResult = renderJatsArticle(
      committedManuscript,
      committedProfile,
    );
    const blob = new Blob([committedResult.xml], {
      type: 'application/xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = jatsFileName(committedManuscript);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="jats-export-panel" aria-labelledby="jats-export-title">
      <div className="jats-export-header">
        <div>
          <span className="jats-export-eyebrow">
            <Code2 size={15} aria-hidden="true" />
            {copy.standard}
          </span>
          <h4 id="jats-export-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <code>
          JATS {OMI_JATS_VERSION} · {OMI_JATS_TAGSET}
        </code>
      </div>

      {!supported ? (
        <div className="jats-export-status jats-export-status--error">
          <AlertTriangle size={16} aria-hidden="true" />
          {copy.unsupportedProfile}
        </div>
      ) : (
        <div
          className={`jats-export-status ${
            errors.length
              ? 'jats-export-status--error'
              : 'jats-export-status--ready'
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

      <dl className="jats-export-facts">
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
      </dl>

      <p className="jats-export-hint">{copy.workingPreview}</p>

      {result.diagnostics.length ? (
        <ul className="jats-export-diagnostics">
          {result.diagnostics.slice(0, 30).map((diagnostic, index) => (
            <li
              className={`jats-export-diagnostic jats-export-diagnostic--${diagnostic.severity}`}
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
        <p className="jats-export-no-diagnostics">
          <CheckCircle2 size={15} aria-hidden="true" />
          {copy.noDiagnostics}
        </p>
      )}

      <div className="jats-export-actions">
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
          disabled={!supported}
          onClick={downloadJats}
        >
          <Download size={16} aria-hidden="true" />
          {copy.download}
        </button>
      </div>

      {previewOpen ? (
        <pre className="jats-export-preview" aria-label={copy.preview}>
          <code>{result.xml}</code>
        </pre>
      ) : null}

      <p className="jats-export-schema-note">{copy.schemaNote}</p>
    </section>
  );
}
