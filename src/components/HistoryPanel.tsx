import { useEffect } from 'react';
import {
  History,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getStateDigestCopy } from '../i18n/stateDigest';
import type { TranslationKey } from '../i18n/types';
import { getPreferredNameForm } from '../model/identity';
import {
  inspectRevisionHistoryIntegrity,
  type OmiRevisionIntegrityResult,
} from '../model/revisionIntegrity';
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
  const { t, locale } = useTranslation();
  const integrityCopy = getStateDigestCopy(locale);
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
  const integrity = inspectRevisionHistoryIntegrity(
    manuscript.revisionHistory,
  );
  const integrityByRevision = new Map(
    integrity.results.map((result) => [result.revisionId, result]),
  );
  const integrityIsValid =
    integrity.summary.mismatch === 0 &&
    integrity.summary.unsupported === 0;

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

      <div
        className={`history-integrity-summary history-integrity-summary--${
          integrityIsValid ? 'verified' : 'invalid'
        }`}
        role="status"
      >
        {integrityIsValid ? (
          <ShieldCheck size={18} aria-hidden="true" />
        ) : (
          <ShieldAlert size={18} aria-hidden="true" />
        )}
        <div>
          <strong>{integrityCopy.integrity}</strong>
          <p>{integrityCopy.summary}</p>
        </div>
        <span className="history-integrity-count">
          {integrity.summary.verified}/{integrity.summary.total}
        </span>
      </div>

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
            const revisionIntegrity = integrityByRevision.get(revision.id);

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

                  {revisionIntegrity ? (
                    <RevisionIntegrityBadge
                      result={revisionIntegrity}
                      copy={integrityCopy}
                    />
                  ) : null}
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

function RevisionIntegrityBadge({
  result,
  copy,
}: {
  result: OmiRevisionIntegrityResult;
  copy: ReturnType<typeof getStateDigestCopy>;
}) {
  const label =
    result.status === 'verified'
      ? copy.verified
      : result.status === 'missing'
        ? copy.missing
        : result.status === 'mismatch'
          ? copy.mismatch
          : copy.unsupported;
  const value = result.digest?.value;

  return (
    <div
      className={`history-state-digest history-state-digest--${result.status}`}
      title={value ? `${copy.digest}: ${value}` : label}
    >
      {result.status === 'verified' ? (
        <ShieldCheck size={14} aria-hidden="true" />
      ) : (
        <ShieldAlert size={14} aria-hidden="true" />
      )}
      <span>{label}</span>
      {value ? <code>{shortDigest(value)}</code> : null}
    </div>
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

function shortDigest(value: string): string {
  return `${value.slice(0, 12)}…`;
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
