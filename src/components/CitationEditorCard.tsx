import { ExternalLink, Trash2, X } from 'lucide-react';

import {
  stageRemoveCitation,
  stageUpdateCitation,
} from '../app/citationActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  CITATION_LOCATOR_TYPES,
  formatBibliographyEntry,
  getBibliographicIdentifier,
} from '../model/citations';
import type { OmiCitationLocatorType } from '../types/omi';

interface CitationEditorCardProps {
  citationId: string;
  onClose?: () => void;
}

export function CitationEditorCard({
  citationId,
  onClose,
}: CitationEditorCardProps) {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const citation = manuscript.citations.find((item) => item.id === citationId);
  const records = manuscript.bibliographicRecords ?? [];

  if (!citation) {
    return null;
  }

  const record = records.find((item) => item.id === citation.target);
  const locatorType = citation.locator?.type ?? 'page';
  const locatorValue = citation.locator?.value ?? '';
  const onlineUrl = record
    ? record.url ||
      (getBibliographicIdentifier(record, 'doi')
        ? `https://doi.org/${getBibliographicIdentifier(record, 'doi')}`
        : undefined)
    : undefined;

  return (
    <section className="omi-citation-editor-card">
      <header className="omi-citation-editor-header">
        <div>
          <strong>{t('citations.citation')}</strong>
          <p>
            {record
              ? formatBibliographyEntry(record)
              : t('citations.unresolvedReference')}
          </p>
        </div>

        {onClose ? (
          <button
            type="button"
            className="omi-citation-icon-button"
            onClick={onClose}
            aria-label={t('citations.closeEditor')}
            title={t('citations.closeEditor')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className="omi-citation-editor-grid">
        <label className="omi-citation-field omi-citation-field--wide">
          <span>{t('citations.reference')}</span>
          <select
            value={citation.target}
            onChange={(event) =>
              stageUpdateCitation(citation.id, {
                target: event.target.value,
              })
            }
          >
            {records.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title || t('citations.untitledReference')}
              </option>
            ))}
          </select>
        </label>

        <label className="omi-citation-field">
          <span>{t('citations.locatorType')}</span>
          <select
            value={locatorType}
            onChange={(event) =>
              stageUpdateCitation(citation.id, {
                locator: locatorValue.trim()
                  ? {
                      type: event.target.value as OmiCitationLocatorType,
                      value: locatorValue,
                    }
                  : undefined,
              })
            }
          >
            {CITATION_LOCATOR_TYPES.map((type) => (
              <option value={type} key={type}>
                {locatorTypeLabel(type, t)}
              </option>
            ))}
          </select>
        </label>

        <label className="omi-citation-field">
          <span>{t('citations.locator')}</span>
          <input
            value={locatorValue}
            onChange={(event) =>
              stageUpdateCitation(citation.id, {
                locator: event.target.value.trim()
                  ? {
                      type: locatorType,
                      value: event.target.value,
                    }
                  : undefined,
              })
            }
            placeholder={t('citations.locatorPlaceholder')}
          />
        </label>

        <label className="omi-citation-field">
          <span>{t('citations.prefix')}</span>
          <input
            value={citation.prefix ?? ''}
            onChange={(event) =>
              stageUpdateCitation(citation.id, {
                prefix: event.target.value,
              })
            }
            placeholder={t('citations.prefixPlaceholder')}
          />
        </label>

        <label className="omi-citation-field">
          <span>{t('citations.suffix')}</span>
          <input
            value={citation.suffix ?? ''}
            onChange={(event) =>
              stageUpdateCitation(citation.id, {
                suffix: event.target.value,
              })
            }
            placeholder={t('citations.suffixPlaceholder')}
          />
        </label>
      </div>

      <footer className="omi-citation-editor-actions">
        {onlineUrl ? (
          <a
            className="studio-menu-secondary-action"
            href={onlineUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} aria-hidden="true" />
            {t('citations.openSource')}
          </a>
        ) : <span />}

        <button
          type="button"
          className="studio-menu-secondary-action studio-menu-danger-action"
          onClick={() => {
            if (window.confirm(t('citations.confirmDeleteCitation'))) {
              stageRemoveCitation(citation.id);
              onClose?.();
            }
          }}
        >
          <Trash2 size={15} aria-hidden="true" />
          {t('citations.deleteCitation')}
        </button>
      </footer>
    </section>
  );
}

function locatorTypeLabel(
  type: OmiCitationLocatorType,
  t: (key: any) => string,
): string {
  return t(`citations.locators.${type}`);
}
