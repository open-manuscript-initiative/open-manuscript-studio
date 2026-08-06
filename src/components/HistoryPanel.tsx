import {
  History,
  RotateCcw,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/types';
import { getPreferredNameForm } from '../model/identity';
import type {
  OmiChangeOperation,
  OmiRevision,
} from '../model/versioning';

const OPERATION_LABELS: Partial<
  Record<OmiChangeOperation, TranslationKey>
> = {
  'manuscript.snapshot.create': 'history.operations.snapshotCreated',
  'manuscript.title.set': 'history.operations.titleChanged',
  'manuscript.abstract.set': 'history.operations.abstractChanged',
  'section.create': 'history.operations.sectionCreated',
  'block.content.set': 'history.operations.blockChanged',
  'agent.create': 'history.operations.contributorAdded',
  'agent.update': 'history.operations.contributorChanged',
  'agent.remove': 'history.operations.contributorRemoved',
  'contribution.update': 'history.operations.contributionChanged',
  'contribution.remove': 'history.operations.contributorRemoved',
  'contribution.reorder': 'history.operations.contributorsReordered',
  'revision.revert': 'history.operations.reverted',
};

export function HistoryPanel() {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const revertRevision = useStudioStore(
    (state) => state.revertRevision,
  );
  const revisions = [...manuscript.revisionHistory.revisions].reverse();
  const completenessKey: TranslationKey =
    manuscript.revisionHistory.completeness === 'complete'
      ? 'history.completeHistory'
      : 'history.shallowHistory';

  return (
    <section
      className="omi-history-panel"
      aria-labelledby="omi-history-title"
    >
      <header className="omi-history-header">
        <div>
          <h2 id="omi-history-title">
            <History size={18} aria-hidden="true" />
            {t('history.title')}
          </h2>
          <p>{t('history.description')}</p>
        </div>

        <span
          className={`history-completeness history-completeness--${manuscript.revisionHistory.completeness}`}
        >
          {t(completenessKey)}
        </span>
      </header>

      {revisions.length === 0 ? (
        <p className="history-empty">{t('history.empty')}</p>
      ) : (
        <ol className="history-list">
          {revisions.map((revision) => {
            const isCurrent = revision.id === manuscript.headRevisionId;
            const actorName = resolveActorName(revision);
            const operation = revision.changeSet.events[0]?.operation;
            const operationKey = operation
              ? OPERATION_LABELS[operation]
              : undefined;
            const summary = operationKey
              ? t(operationKey)
              : revision.summary;

            return (
              <li
                className={`history-item${isCurrent ? ' history-item--current' : ''}`}
                key={revision.id}
              >
                <div className="history-item-main">
                  <div className="history-item-summary-row">
                    <strong>{summary}</strong>
                    {isCurrent ? (
                      <span className="history-current-badge">
                        {t('history.current')}
                      </span>
                    ) : null}
                  </div>

                  <div className="history-item-metadata">
                    <span>{formatTimestamp(revision.createdAt)}</span>
                    <span aria-hidden="true">•</span>
                    <span>{actorName ?? t('history.unknownActor')}</span>
                    <span aria-hidden="true">•</span>
                    <span>
                      {revision.changeSet.events.length}{' '}
                      {t('history.events')}
                    </span>
                  </div>

                  <code className="history-revision-id">
                    {t('history.revision')} {shortRevisionId(revision.id)}
                  </code>
                </div>

                <button
                  type="button"
                  className="history-revert-button"
                  disabled={isCurrent}
                  onClick={() => {
                    if (window.confirm(t('history.confirmRevert'))) {
                      revertRevision(revision.id);
                    }
                  }}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  {t('history.revert')}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function resolveActorName(revision: OmiRevision): string | undefined {
  if (!revision.actorAgentId) {
    return undefined;
  }

  const actor = revision.snapshot.state.agents.find(
    (agent) => agent.id === revision.actorAgentId,
  );

  return actor
    ? getPreferredNameForm(actor)?.value
    : revision.actorAgentId;
}

function shortRevisionId(revisionId: string): string {
  return revisionId.slice(0, 8);
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
