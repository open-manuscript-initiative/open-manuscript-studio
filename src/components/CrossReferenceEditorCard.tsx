import { ExternalLink, Trash2, X } from 'lucide-react';

import {
  stageRemoveCrossReference,
  stageUpdateCrossReference,
} from '../app/crossReferenceActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCrossReferenceCopy } from '../i18n/crossReferences';
import {
  collectCrossReferenceTargets,
  formatCrossReferenceLabel,
  formatCrossReferenceTargetOption,
} from '../model/crossReferences';
import type { OmiCrossReferenceDisplayStyle } from '../types/omi';

interface CrossReferenceEditorCardProps {
  crossReferenceId: string;
  onClose: () => void;
}

export function CrossReferenceEditorCard({
  crossReferenceId,
  onClose,
}: CrossReferenceEditorCardProps) {
  const { locale } = useTranslation();
  const copy = getCrossReferenceCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const reference = (manuscript.crossReferences ?? []).find(
    (item) => item.id === crossReferenceId,
  );
  const targets = collectCrossReferenceTargets(manuscript);
  const target = reference
    ? targets.find((candidate) => candidate.id === reference.targetId)
    : undefined;

  if (!reference) return null;

  function goToTarget(): void {
    if (!target) return;
    selectSection(target.sectionId);
    window.setTimeout(() => {
      document
        .getElementById(`omi-target-${target.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  return (
    <section className="omi-xref-editor-card">
      <header>
        <div>
          <strong>{copy.edit}</strong>
          <p>
            {formatCrossReferenceLabel(
              reference,
              target,
              manuscript.locale,
            )}
          </p>
        </div>
        <button
          type="button"
          className="omi-xref-icon-button"
          onClick={onClose}
          aria-label={copy.cancel}
          title={copy.cancel}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      {!target ? (
        <p className="omi-xref-unresolved">{copy.unresolved}</p>
      ) : null}

      <div className="omi-xref-editor-grid">
        <label>
          <span>{copy.target}</span>
          <select
            value={target?.id ?? ''}
            onChange={(event) => {
              const nextTarget = targets.find(
                (candidate) => candidate.id === event.target.value,
              );
              if (!nextTarget) return;
              stageUpdateCrossReference(reference.id, {
                targetId: nextTarget.id,
                targetKind: nextTarget.kind,
              });
            }}
          >
            {!target ? <option value="">{copy.unresolved}</option> : null}
            {targets.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {formatCrossReferenceTargetOption(
                  candidate,
                  manuscript.locale,
                )}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{copy.display}</span>
          <select
            value={reference.displayStyle}
            onChange={(event) =>
              stageUpdateCrossReference(reference.id, {
                displayStyle:
                  event.target.value as OmiCrossReferenceDisplayStyle,
              })
            }
          >
            <option value="label-number">{copy.displayLabelNumber}</option>
            <option value="number">{copy.displayNumber}</option>
            <option value="title">{copy.displayTitle}</option>
            <option value="label-number-title">
              {copy.displayLabelNumberTitle}
            </option>
          </select>
        </label>
      </div>

      <div className="omi-xref-editor-actions">
        <button type="button" disabled={!target} onClick={goToTarget}>
          <ExternalLink size={15} aria-hidden="true" />
          {copy.goToTarget}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (!window.confirm(copy.confirmDelete)) return;
            stageRemoveCrossReference(reference.id);
            onClose();
          }}
        >
          <Trash2 size={15} aria-hidden="true" />
          {copy.deleteReference}
        </button>
      </div>
    </section>
  );
}
