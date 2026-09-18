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
  OMI_JATS_RENDERER_VERSION,
  OMI_JATS_TAGSET,
  OMI_JATS_VERSION,
  renderJatsArticle,
} from '../services/exportJats';
import { savePublicationArtifactWithBuildSidecar } from '../services/publicationBuildSidecar';
import {
  validateJatsSchema,
  type JatsSchemaValidationResult,
} from '../services/jatsValidationApi';

interface SchemaValidationState {
  xml: string;
  result: JatsSchemaValidationResult;
}

interface SchemaValidationErrorState {
  xml: string;
  message: string;
}

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
  const [schemaState, setSchemaState] = useState<SchemaValidationState | null>(null);
  const [schemaError, setSchemaError] = useState<SchemaValidationErrorState | null>(null);
  const [schemaBusy, setSchemaBusy] = useState(false);
  const errors = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const warnings = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning',
  );
  const currentSchemaValidation =
    schemaState?.xml === result.xml ? schemaState.result : null;
  const currentSchemaError =
    schemaError?.xml === result.xml ? schemaError.message : '';

  async function validateXml(
    xml: string,
  ): Promise<JatsSchemaValidationResult | null> {
    setSchemaBusy(true);
    setSchemaError(null);
    try {
      const validation = await validateJatsSchema(xml);
      setSchemaState({ xml, result: validation });
      return validation;
    } catch (error) {
      setSchemaState(null);
      setSchemaError({
        xml,
        message: error instanceof Error ? error.message : copy.schemaUnavailable,
      });
      return null;
    } finally {
      setSchemaBusy(false);
    }
  }

  async function validateWorkingJats(): Promise<void> {
    if (!supported || errors.length) return;
    await validateXml(result.xml);
  }

  async function downloadJats(): Promise<void> {
    if (!supported || errors.length || schemaBusy) return;

    checkpoint('export');
    const committedManuscript = useStudioStore.getState().manuscript;
    const committedProfile = resolvePublicationProfile(committedManuscript);
    const committedResult = renderJatsArticle(
      committedManuscript,
      committedProfile,
    );
    const committedErrors = committedResult.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    if (committedErrors.length) return;

    const validation = await validateXml(committedResult.xml);
    if (!validation?.valid) return;

    const fileName = jatsFileName(committedManuscript);
    await savePublicationArtifactWithBuildSidecar({
      manuscript: committedManuscript,
      profile: committedProfile,
      artifact: new Blob([committedResult.xml], {
        type: 'application/xml;charset=utf-8',
      }),
      fileName,
      format: 'jats',
      mediaType: 'application/xml',
      renderer: 'open-manuscript-studio-jats',
      rendererVersion: OMI_JATS_RENDERER_VERSION,
    });
  }

  const schemaStatus = schemaBusy
    ? copy.validatingSchema
    : currentSchemaError
      ? currentSchemaError
      : currentSchemaValidation?.valid
        ? copy.schemaValid
        : currentSchemaValidation
          ? copy.schemaInvalid
          : copy.schemaNotChecked;

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
        <div>
          <dt>{copy.schemaValidation}</dt>
          <dd>
            {currentSchemaValidation?.valid ? (
              <CheckCircle2 size={14} aria-hidden="true" />
            ) : currentSchemaValidation || currentSchemaError ? (
              <AlertTriangle size={14} aria-hidden="true" />
            ) : null}
            {' '}
            {schemaStatus}
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

      {currentSchemaValidation && !currentSchemaValidation.valid ? (
        <div>
          <p className="jats-export-schema-note">
            <strong>{copy.schemaDiagnostics}</strong>
          </p>
          <ul className="jats-export-diagnostics">
            {currentSchemaValidation.diagnostics.slice(0, 30).map((diagnostic, index) => (
              <li
                className="jats-export-diagnostic jats-export-diagnostic--error"
                key={`${diagnostic.code}:${diagnostic.line ?? ''}:${index}`}
              >
                <AlertTriangle size={14} aria-hidden="true" />
                <span>
                  {diagnostic.line ? `${copy.line} ${diagnostic.line}: ` : ''}
                  {diagnostic.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
          className="studio-menu-secondary-action"
          disabled={!supported || Boolean(errors.length) || schemaBusy}
          onClick={() => void validateWorkingJats()}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {schemaBusy ? copy.validatingSchema : copy.validateSchema}
        </button>

        <button
          type="button"
          className="studio-menu-primary-action"
          disabled={!supported || Boolean(errors.length) || schemaBusy}
          onClick={() => void downloadJats()}
        >
          <Download size={16} aria-hidden="true" />
          {schemaBusy ? copy.validatingSchema : copy.download}
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
