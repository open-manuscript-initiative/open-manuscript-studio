import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { stageSetCrossReferenceNumbering } from '../app/crossReferenceActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCrossReferenceCopy } from '../i18n/crossReferences';
import {
  collectCrossReferenceTargets,
  validateCrossReferences,
} from '../model/crossReferences';
import type { OmiCrossReferenceNumbering } from '../types/omi';
import { NamedAnchorsPanel } from './NamedAnchorsPanel';

export function CrossReferencePanel() {
  const { locale } = useTranslation();
  const copy = getCrossReferenceCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const numbering = manuscript.crossReferenceNumbering ?? 'document';
  const issues = validateCrossReferences(manuscript);
  const targets = collectCrossReferenceTargets(manuscript);
  const references = manuscript.crossReferences ?? [];

  return (
    <>
      <NamedAnchorsPanel />
      <section className="omi-xref-status-panel">
        <header>
          <div>
            <h4>{copy.statusTitle}</h4>
            <p>{copy.statusDescription}</p>
          </div>
          <span className="omi-xref-count">{references.length}</span>
        </header>

        <label className="omi-xref-numbering-control">
          <span>
            <strong>{copy.numbering}</strong>
            <small>{copy.numberingDescription}</small>
          </span>
          <select
            value={numbering}
            onChange={(event) =>
              stageSetCrossReferenceNumbering(
                event.target.value as OmiCrossReferenceNumbering,
              )
            }
          >
            <option value="document">{copy.numberingDocument}</option>
            <option value="section">{copy.numberingSection}</option>
          </select>
        </label>

        <div className="omi-xref-target-summary">
          {(['section', 'figure', 'table', 'chart', 'equation'] as const).map(
            (kind) => (
              <span key={kind}>
                {kindLabel(kind, copy)}{' '}
                <strong>{targets.filter((target) => target.kind === kind).length}</strong>
              </span>
            ),
          )}
        </div>

        {issues.length === 0 ? (
          <div className="omi-xref-validation omi-xref-validation--ok">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{copy.statusHealthy}</span>
          </div>
        ) : (
          <div className="omi-xref-validation omi-xref-validation--issues">
            <div className="omi-xref-validation-title">
              <AlertTriangle size={16} aria-hidden="true" />
              <strong>{copy.statusIssues}: {issues.length}</strong>
            </div>
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.crossReferenceId}:${issue.type}:${index}`}>
                  {issue.type === 'missing-target' ? copy.missingTarget : copy.missingAnchor}
                  <code>{shortId(issue.targetId)}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

function kindLabel(
  kind: 'section' | 'figure' | 'table' | 'chart' | 'equation',
  copy: ReturnType<typeof getCrossReferenceCopy>,
): string {
  switch (kind) {
    case 'section': return copy.section;
    case 'figure': return copy.figure;
    case 'table': return copy.table;
    case 'chart': return copy.chart;
    case 'equation': return copy.equation;
  }
}

function shortId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}
