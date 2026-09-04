import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Trash2,
  X,
} from 'lucide-react';

import {
  stageRemoveCitation,
  stageRemoveCitationCluster,
  stageReorderCitationCluster,
  stageUpdateCitation,
} from '../app/citationActions';
import { useStudioStore } from '../app/useStudioStore';
import { type AppTranslationKey, useTranslation } from '../i18n';
import { getCslRenderingCopy } from '../i18n/cslRendering';
import {
  CITATION_LOCATOR_TYPES,
  formatBibliographyEntry,
  getBibliographicIdentifier,
} from '../model/citations';
import type { OmiCitationLocatorType } from '../types/omi';

interface CitationClusterEditorCardProps {
  clusterId: string;
  onClose?: () => void;
}

export function CitationClusterEditorCard({
  clusterId,
  onClose,
}: CitationClusterEditorCardProps) {
  const { t, locale } = useTranslation();
  const copy = getCslRenderingCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const cluster = (manuscript.citationClusters ?? []).find(
    (candidate) => candidate.id === clusterId,
  );
  const records = manuscript.bibliographicRecords ?? [];

  if (!cluster) return null;

  const activeClusterId = cluster.id;
  const activeClusterCitationIds = cluster.citationIds;
  const citations = activeClusterCitationIds
    .map((citationId) =>
      manuscript.citations.find((citation) => citation.id === citationId),
    )
    .filter((citation): citation is NonNullable<typeof citation> => Boolean(citation));

  if (citations.length === 0) return null;

  function move(citationId: string, direction: -1 | 1): void {
    const currentIndex = activeClusterCitationIds.indexOf(citationId);
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= activeClusterCitationIds.length
    ) {
      return;
    }

    const nextOrder = [...activeClusterCitationIds];
    const [moved] = nextOrder.splice(currentIndex, 1);
    if (!moved) return;
    nextOrder.splice(nextIndex, 0, moved);
    stageReorderCitationCluster(activeClusterId, nextOrder);
  }

  return (
    <section className="omi-citation-editor-card omi-citation-cluster-editor">
      <header className="omi-citation-editor-header">
        <div>
          <strong>{copy.clusterTitle}</strong>
          <p>{copy.clusterDescription}</p>
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

      <div className="omi-citation-cluster-items">
        {citations.map((citation, index) => {
          const record = records.find((candidate) => candidate.id === citation.target);
          const locatorType = citation.locator?.type ?? 'page';
          const locatorValue = citation.locator?.value ?? '';
          const doi = record ? getBibliographicIdentifier(record, 'doi') : undefined;
          const onlineUrl = record
            ? record.url || (doi ? `https://doi.org/${doi}` : undefined)
            : undefined;

          return (
            <article className="omi-citation-cluster-item" key={citation.id}>
              <div className="omi-citation-cluster-item-heading">
                <span>{index + 1}</span>
                <div>
                  <strong>
                    {record?.title || t('citations.unresolvedReference')}
                  </strong>
                  {record ? <p>{formatBibliographyEntry(record)}</p> : null}
                </div>
                <div className="omi-citation-cluster-order-actions">
                  <button
                    type="button"
                    className="omi-citation-icon-button"
                    disabled={index === 0}
                    onClick={() => move(citation.id, -1)}
                    title={copy.moveUp}
                    aria-label={copy.moveUp}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="omi-citation-icon-button"
                    disabled={index === citations.length - 1}
                    onClick={() => move(citation.id, 1)}
                    title={copy.moveDown}
                    aria-label={copy.moveDown}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

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
                        {t(`citations.locators.${type}` as AppTranslationKey)}
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

              <div className="omi-citation-cluster-item-actions">
                {onlineUrl ? (
                  <a
                    className="studio-menu-secondary-action"
                    href={onlineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    {t('citations.openSource')}
                  </a>
                ) : <span />}

                <button
                  type="button"
                  className="studio-menu-secondary-action studio-menu-danger-action"
                  onClick={() => stageRemoveCitation(citation.id)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {copy.removeFromCluster}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="omi-citation-editor-actions">
        <span />
        <button
          type="button"
          className="studio-menu-secondary-action studio-menu-danger-action"
          onClick={() => {
            if (window.confirm(copy.confirmDeleteCluster)) {
              stageRemoveCitationCluster(activeClusterId);
              onClose?.();
            }
          }}
        >
          <Trash2 size={15} aria-hidden="true" />
          {copy.deleteCluster}
        </button>
      </footer>
    </section>
  );
}
