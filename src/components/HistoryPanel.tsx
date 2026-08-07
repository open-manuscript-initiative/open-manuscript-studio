import { useEffect } from 'react';
import {
  History,
  RotateCcw,
  Save,
  Trash2,
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
  const pendingChangeSet = useStudioStore(
    (state) => state.pendingChangeSet,
  );
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const discardWorkingChanges = useStudioStore(
    (state) => state.discardWorkingChanges,
  );
  const revertRevision = useStudioStore(
    (state) => state.revertRevision,
  );
  const revisions = [...manuscript.revisionHistory.revisions].reverse();
  const tombstones = [...(manuscript.tombstones ?? [])].reverse();
  const completenessKey: TranslationKey =
    manuscript.revisionHistory.completeness === 'complete'
      ? 'history.completeHistory'
      : 'history.shallowHistory';

  useEffect(() => {
    const checkpointOnWindowBlur = () => checkpoint('window-blur');
    const checkpointWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        checkpoint('window-blur');
      }
    };

    window.addEventListener('blur', checkpointOnWindowBlur);
    document.addEventListener(
      'visibilitychange',
      checkpointWhenHidden,
    );

    return () => {
      window.removeEventListener('blur', checkpointOnWindowBlur);
      document.removeEventListener(
        'visibilitychange',
        checkpointWhenHidden,
      );
    };
  }, [checkpoint]);

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

      {pendingChangeSet ? (
        <div className="history-pending" role="status">
          <div className="history-pending-heading">
            <div>
              <strong>{t('history.pendingTitle')}</strong>
              <p>{t('history.pendingDescription')}</p>
            </div>

            <span className="history-pending-badge">
              {t('history.pendingBadge')}
            </span>
          </div>

          <div className="history-pending-meta">
            <span>
              {pendingChangeSet.events.length} {t('history.events')}
            </span>
            <span aria-hidden="true">•</span>
            <span>{formatTimestamp(pendingChangeSet.updatedAt)}</span>
          </div>

          <div className="history-pending-actions">
            <button
              type="button"
              className="history-checkpoint-button"
              onClick={() => checkpoint('manual')}
            >
              <Save size={15} aria-hidden="true" />
              {t('history.checkpoint')}
            </button>

            <button
              type="button"
              className="history-discard-button"
              onClick={() => {
                if (window.confirm(t('history.confirmDiscard'))) {
                  discardWorkingChanges();
                }
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('history.discard')}
            </button>
          </div>
        </div>
      ) : null}

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
            const summary =
              revision.changeSet.events.length > 1
                ? `${revision.changeSet.events.length} ${t('history.groupedChanges')}`
                : operationKey
                  ? t(operationKey)
                  : revision.summary;
            const revertIsBlocked = Boolean(pendingChangeSet);

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
                  disabled={isCurrent || revertIsBlocked}
                  title={
                    revertIsBlocked
                      ? t('history.revertBlocked')
                      : undefined
                  }
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

      {tombstones.length > 0 ? (
        <section
          className="history-tombstones"
          aria-labelledby="omi-tombstones-title"
        >
          <h3 id="omi-tombstones-title">
            <Trash2 size={16} aria-hidden="true" />
            {t('history.tombstonesTitle')}
          </h3>
          <p>{t('history.tombstonesDescription')}</p>

          <ul className="history-tombstone-list">
            {tombstones.map((tombstone) => {
              const isRestored = Boolean(tombstone.restoredByRevisionId);

              return (
                <li
                  key={`${tombstone.objectId}:${tombstone.deletionRevisionId}:${tombstone.deletingChangeEventId}`}
                >
                  <div>
                    <strong>{tombstone.objectType}</strong>{' '}
                    <code>{shortRevisionId(tombstone.objectId)}</code>
                  </div>
                  <span
                    className={`history-tombstone-status history-tombstone-status--${isRestored ? 'restored' : 'active'}`}
                  >
                    {isRestored
                      ? t('history.tombstoneRestored')
                      : t('history.tombstoneActive')}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
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
