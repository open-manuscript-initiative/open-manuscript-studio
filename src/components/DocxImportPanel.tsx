import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  LoaderCircle,
} from 'lucide-react';
import {
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { applyDocxImportPlan } from '../app/docxImportActions';
import { useTranslation } from '../i18n';
import { getDocxImportCopy } from '../i18n/docxImport';
import { getSectionDepth } from '../model/sectionStructure';
import { parseDocxManuscriptWithInlineSemantics } from '../services/docxInlineSemanticsImport';
import type { DocxManuscriptImportPlan } from '../services/docxManuscriptImport';

export function DocxImportPanel() {
  const { locale } = useTranslation();
  const copy = getDocxImportCopy(locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<DocxManuscriptImportPlan | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importAuthors, setImportAuthors] = useState(true);
  const [imported, setImported] = useState(false);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setParsing(true);
    setError(null);
    setImported(false);

    try {
      const nextPlan = await parseDocxManuscriptWithInlineSemantics(file);
      setPlan(nextPlan);
      setImportAuthors(nextPlan.authors.length > 0);
    } catch (cause) {
      setPlan(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function applyImport(): void {
    if (!plan) return;
    if (!window.confirm(copy.confirmReplace)) return;

    applyDocxImportPlan(plan, {
      importDetectedAuthors: importAuthors,
    });
    setImported(true);
  }

  const stats = plan
    ? [
        ['sections', plan.stats.sections],
        ['paragraphs', plan.stats.paragraphs],
        ['lists', plan.stats.lists],
        ['notes', plan.stats.notes],
        ['images', plan.stats.images],
        ['tables', plan.stats.tables],
        ['equations', plan.stats.equations],
        ['citations', plan.stats.citations],
        ['references', plan.stats.references],
      ] as const
    : [];

  return (
    <section className="docx-import-card" aria-labelledby="docx-import-title">
      <div className="docx-import-card-header">
        <div>
          <h4 id="docx-import-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <FileUp size={22} aria-hidden="true" />
      </div>

      <input
        ref={inputRef}
        className="docx-import-file-input"
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      <button
        type="button"
        className="studio-menu-secondary-action"
        disabled={parsing}
        onClick={() => inputRef.current?.click()}
      >
        {parsing ? (
          <LoaderCircle className="docx-import-spinner" size={16} aria-hidden="true" />
        ) : (
          <FileUp size={16} aria-hidden="true" />
        )}
        {parsing ? copy.parsing : plan ? copy.replaceFile : copy.chooseFile}
      </button>

      {error ? (
        <div className="docx-import-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {imported ? (
        <div className="docx-import-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{copy.imported}</span>
        </div>
      ) : null}

      {plan ? (
        <div className="docx-import-preview">
          <header className="docx-import-preview-header">
            <div>
              <h5>{copy.previewTitle}</h5>
              <p>{copy.previewDescription}</p>
            </div>
            <code>{plan.fileName}</code>
          </header>

          <div className="docx-import-stats" aria-label={copy.previewTitle}>
            {stats.map(([key, value]) => (
              <div className="docx-import-stat" key={key}>
                <strong>{value}</strong>
                <span>{copy.stats[key]}</span>
              </div>
            ))}
          </div>

          <section className="docx-import-preview-section">
            <h6>{copy.detectedMetadata}</h6>
            <dl className="docx-import-metadata">
              <div>
                <dt>{copy.manuscriptTitle}</dt>
                <dd>{plan.title}</dd>
              </div>
              <div>
                <dt>{copy.titleSource}</dt>
                <dd>{formatTitleSource(plan.titleSource, copy)}</dd>
              </div>
              <div>
                <dt>{copy.language}</dt>
                <dd>{plan.locale ?? '—'}</dd>
              </div>
            </dl>
          </section>

          {plan.authors.length ? (
            <section className="docx-import-preview-section">
              <div className="docx-import-section-heading">
                <h6>{copy.authors}</h6>
                <label className="docx-import-author-toggle">
                  <input
                    type="checkbox"
                    checked={importAuthors}
                    onChange={(event) => setImportAuthors(event.target.checked)}
                  />
                  <span>{copy.importAuthors}</span>
                </label>
              </div>
              <p className="docx-import-hint">{copy.importAuthorsHint}</p>
              <ul className="docx-import-author-list">
                {plan.authors.map((author) => (
                  <li key={`${author.source}:${author.displayName}`}>
                    <strong>{author.displayName}</strong>
                    <small>
                      {author.source === 'core-properties'
                        ? copy.coreAuthorSource
                        : copy.styleAuthorSource}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="docx-import-preview-section">
            <h6>{copy.outline}</h6>
            <ol className="docx-import-outline">
              {plan.sections.slice(0, 50).map((section) => {
                const depth = getSectionDepth(plan.sections, section.id);
                return (
                  <li
                    key={section.id}
                    style={{ '--docx-outline-depth': depth } as CSSProperties}
                  >
                    <span>{section.title || '—'}</span>
                    <small>{section.blocks.length}</small>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="docx-import-preview-section">
            <h6>{copy.warnings}</h6>
            {plan.warnings.length ? (
              <ul className="docx-import-warning-list">
                {plan.warnings.map((item) => (
                  <li key={`${item.code}:${item.sourcePart ?? ''}`}>
                    <AlertTriangle size={15} aria-hidden="true" />
                    <span>{copy.warningText[item.code] ?? item.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="docx-import-no-warning">
                <CheckCircle2 size={15} aria-hidden="true" />
                {copy.noWarnings}
              </p>
            )}
          </section>

          <div className="docx-import-commit">
            <p>{copy.currentWorkspaceWarning}</p>
            <button
              type="button"
              className="studio-menu-primary-action"
              onClick={applyImport}
            >
              <FileUp size={16} aria-hidden="true" />
              {copy.importButton}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatTitleSource(
  source: DocxManuscriptImportPlan['titleSource'],
  copy: ReturnType<typeof getDocxImportCopy>,
): string {
  if (source === 'core-properties') return copy.sourceCore;
  if (source === 'title-style') return copy.sourceStyle;
  return copy.sourceFilename;
}
