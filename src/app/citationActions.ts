import { useStudioStore } from './useStudioStore';
import {
  collectCitationAnchors,
  removeCitationClusterFromSections,
  removeCitationFromSections,
  synchronizeCitationLabels,
  type CitationClusterCreation,
} from '../model/citationClusters.ts';
import {
  normalizeBibliographicRecord,
} from '../model/citations';
import {
  DEFAULT_CITATION_STYLE,
} from '../model/cslRendering.ts';
import { getExternalIdentifierValue } from '../model/identity';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiBibliographicRecord,
  OmiCitation,
  OmiCitationCluster,
  OmiCitationStyleId,
  OmiManuscript,
  OmiManuscriptState,
  OmiSection,
} from '../types/omi';

const CITATION_CHECKPOINT_DELAY_MS = 2500;
let citationCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageAddBibliographicRecord(
  record: OmiBibliographicRecord,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const records = state.manuscript.bibliographicRecords ?? [];

    if (records.some((candidate) => candidate.id === record.id)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const normalized = normalizeBibliographicRecord({
      ...record,
      createdAt: record.createdAt ?? timestamp,
      modifiedAt: timestamp,
    });
    const nextState: OmiManuscriptState = {
      ...extractManuscriptState(state.manuscript),
      bibliographicRecords: [...records, normalized],
    };
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Added bibliographic record',
        events: [
          {
            operation: 'bibliographic.record.create' as never,
            targetId: normalized.id,
            path: '/bibliographicRecords/-',
            nextValue: normalized,
          },
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;

    return {
      manuscript: {
        ...state.manuscript,
        ...nextState,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

export function stageUpdateBibliographicRecord(
  recordId: string,
  nextRecord: OmiBibliographicRecord,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const records = state.manuscript.bibliographicRecords ?? [];
    const previous = records.find((record) => record.id === recordId);

    if (!previous) return state;

    const timestamp = new Date().toISOString();
    const normalized = normalizeBibliographicRecord({
      ...nextRecord,
      id: recordId,
      createdAt: previous.createdAt,
      modifiedAt: timestamp,
    });

    if (JSON.stringify(previous) === JSON.stringify(normalized)) {
      return state;
    }

    const nextRecords = records.map((record) =>
      record.id === recordId ? normalized : record,
    );
    const synchronizedSections = synchronizeForManuscript(
      state.manuscript,
      state.manuscript.citations,
      nextRecords,
      state.manuscript.citationClusters ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      synchronizedSections,
    );
    const nextState: OmiManuscriptState = {
      ...extractManuscriptState(state.manuscript),
      bibliographicRecords: nextRecords,
      sections: synchronizedSections,
    };
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed bibliographic record',
        events: [
          {
            operation: 'bibliographic.record.update' as never,
            targetId: recordId,
            path: `/bibliographicRecords/${recordId}`,
            previousValue: previous,
            nextValue: normalized,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;

    return {
      manuscript: {
        ...state.manuscript,
        ...nextState,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

/**
 * Backward-compatible single-occurrence staging path.
 * New editor insertions use stageCreateCitationCluster, even for one member.
 */
export function stageCreateCitation(citation: OmiCitation): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    if (state.manuscript.citations.some((item) => item.id === citation.id)) {
      return state;
    }

    const records = state.manuscript.bibliographicRecords ?? [];
    if (!records.some((record) => record.id === citation.target)) return state;

    const timestamp = new Date().toISOString();
    const nextCitation: OmiCitation = {
      ...citation,
      createdAt: citation.createdAt ?? timestamp,
      modifiedAt: timestamp,
    };
    const nextCitations = [...state.manuscript.citations, nextCitation];
    const synchronizedSections = synchronizeForManuscript(
      state.manuscript,
      nextCitations,
      records,
      state.manuscript.citationClusters ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      synchronizedSections,
    );
    const nextState: OmiManuscriptState = {
      ...extractManuscriptState(state.manuscript),
      citations: nextCitations,
      sections: synchronizedSections,
    };
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Added manuscript citation',
        events: [
          {
            operation: 'citation.create' as never,
            targetId: nextCitation.id,
            path: '/citations/-',
            nextValue: nextCitation,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...nextState,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

export function stageCreateCitationCluster(
  creation: CitationClusterCreation,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const existingClusters = state.manuscript.citationClusters ?? [];
    const records = state.manuscript.bibliographicRecords ?? [];

    if (
      existingClusters.some((cluster) => cluster.id === creation.cluster.id) ||
      creation.citations.some((citation) =>
        state.manuscript.citations.some((existing) => existing.id === citation.id),
      )
    ) {
      return state;
    }

    if (
      creation.citations.length === 0 ||
      creation.citations.some(
        (citation) =>
          citation.clusterId !== creation.cluster.id ||
          citation.anchorId !== creation.cluster.anchorId ||
          citation.targetBlockId !== creation.cluster.targetBlockId ||
          !records.some((record) => record.id === citation.target),
      )
    ) {
      return state;
    }

    const citationIds = creation.citations.map((citation) => citation.id);
    if (JSON.stringify(citationIds) !== JSON.stringify(creation.cluster.citationIds)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextCluster: OmiCitationCluster = {
      ...creation.cluster,
      createdAt: creation.cluster.createdAt ?? timestamp,
      modifiedAt: timestamp,
    };
    const nextClusterCitations = creation.citations.map((citation) => ({
      ...citation,
      clusterId: nextCluster.id,
      anchorId: nextCluster.anchorId,
      targetBlockId: nextCluster.targetBlockId,
      createdAt: citation.createdAt ?? timestamp,
      modifiedAt: timestamp,
    }));
    const nextCitations = [
      ...state.manuscript.citations,
      ...nextClusterCitations,
    ];
    const nextClusters = [...existingClusters, nextCluster];
    const synchronizedSections = synchronizeForManuscript(
      state.manuscript,
      nextCitations,
      records,
      nextClusters,
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      synchronizedSections,
    );
    const events = [
      {
        operation: 'citation.cluster.create' as never,
        targetId: nextCluster.id,
        path: '/citationClusters/-',
        nextValue: nextCluster,
      },
      ...nextClusterCitations.map((citation) => ({
        operation: 'citation.create' as never,
        targetId: citation.id,
        path: '/citations/-',
        nextValue: citation,
      })),
      ...blockEvents,
    ];
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary:
          nextClusterCitations.length > 1
            ? 'Added citation cluster'
            : 'Added manuscript citation',
        events,
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        citations: nextCitations,
        citationClusters: nextClusters,
        sections: synchronizedSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

export function stageSetCitationStyle(style: OmiCitationStyleId): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.citationStyle ?? DEFAULT_CITATION_STYLE;
    if (previous === style) return state;

    const timestamp = new Date().toISOString();
    const nextSections = synchronizeCitationLabels(
      state.manuscript.sections,
      state.manuscript.citations,
      state.manuscript.bibliographicRecords ?? [],
      state.manuscript.citationClusters ?? [],
      style,
      state.manuscript.locale,
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed citation presentation style',
        events: [
          {
            operation: 'citation.style.set' as never,
            targetId: state.manuscript.id,
            path: '/citationStyle',
            previousValue: previous,
            nextValue: style,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        citationStyle: style,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

export function stageUpdateCitation(
  citationId: string,
  input: Partial<
    Pick<OmiCitation, 'target' | 'locator' | 'prefix' | 'suffix' | 'mode' | 'intent'>
  >,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.citations.find(
      (citation) => citation.id === citationId,
    );
    if (!previous) return state;

    const records = state.manuscript.bibliographicRecords ?? [];
    const target = input.target ?? previous.target;
    if (!records.some((record) => record.id === target)) return state;

    const timestamp = new Date().toISOString();
    const nextCitation: OmiCitation = {
      ...previous,
      ...input,
      target,
      modifiedAt: timestamp,
    };
    if (JSON.stringify(previous) === JSON.stringify(nextCitation)) return state;

    const nextCitations = state.manuscript.citations.map((citation) =>
      citation.id === citationId ? nextCitation : citation,
    );
    const synchronizedSections = synchronizeForManuscript(
      state.manuscript,
      nextCitations,
      records,
      state.manuscript.citationClusters ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      synchronizedSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed manuscript citation',
        events: [
          {
            operation: 'citation.update' as never,
            targetId: citationId,
            path: `/citations/${citationId}`,
            previousValue: previous,
            nextValue: nextCitation,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        citations: nextCitations,
        sections: synchronizedSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

export function stageReorderCitationCluster(
  clusterId: string,
  citationIds: readonly string[],
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const clusters = state.manuscript.citationClusters ?? [];
    const previous = clusters.find((cluster) => cluster.id === clusterId);
    if (!previous) return state;

    if (
      citationIds.length !== previous.citationIds.length ||
      [...citationIds].sort().join('|') !== [...previous.citationIds].sort().join('|')
    ) {
      return state;
    }

    if (JSON.stringify(citationIds) === JSON.stringify(previous.citationIds)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextCluster: OmiCitationCluster = {
      ...previous,
      citationIds: [...citationIds],
      modifiedAt: timestamp,
    };
    const nextClusters = clusters.map((cluster) =>
      cluster.id === clusterId ? nextCluster : cluster,
    );
    const synchronizedSections = synchronizeForManuscript(
      state.manuscript,
      state.manuscript.citations,
      state.manuscript.bibliographicRecords ?? [],
      nextClusters,
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      synchronizedSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Reordered citation cluster',
        events: [
          {
            operation: 'citation.cluster.update' as never,
            targetId: clusterId,
            path: `/citationClusters/${clusterId}/citationIds`,
            previousValue: previous.citationIds,
            nextValue: [...citationIds],
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        citationClusters: nextClusters,
        sections: synchronizedSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

export function stageRemoveCitation(citationId: string): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.citations.find(
      (citation) => citation.id === citationId,
    );
    if (!previous) return state;

    const timestamp = new Date().toISOString();
    const clusters = state.manuscript.citationClusters ?? [];
    const previousCluster = previous.clusterId
      ? clusters.find((cluster) => cluster.id === previous.clusterId)
      : undefined;
    const nextCitations = state.manuscript.citations.filter(
      (citation) => citation.id !== citationId,
    );
    let nextClusters = clusters;
    const clusterEvents: Array<Record<string, unknown>> = [];

    if (previousCluster) {
      const remainingIds = previousCluster.citationIds.filter(
        (candidate) => candidate !== citationId,
      );

      if (remainingIds.length === 0) {
        nextClusters = clusters.filter((cluster) => cluster.id !== previousCluster.id);
        clusterEvents.push({
          operation: 'citation.cluster.remove' as never,
          targetId: previousCluster.id,
          path: `/citationClusters/${previousCluster.id}`,
          previousValue: previousCluster,
        });
      } else {
        const nextCluster: OmiCitationCluster = {
          ...previousCluster,
          citationIds: remainingIds,
          modifiedAt: timestamp,
        };
        nextClusters = clusters.map((cluster) =>
          cluster.id === previousCluster.id ? nextCluster : cluster,
        );
        clusterEvents.push({
          operation: 'citation.cluster.update' as never,
          targetId: previousCluster.id,
          path: `/citationClusters/${previousCluster.id}/citationIds`,
          previousValue: previousCluster.citationIds,
          nextValue: remainingIds,
        });
      }
    }

    const removedSections = removeCitationFromSections(
      state.manuscript.sections,
      citationId,
    );
    const nextSections = synchronizeCitationLabels(
      removedSections,
      nextCitations,
      state.manuscript.bibliographicRecords ?? [],
      nextClusters,
      state.manuscript.citationStyle ?? DEFAULT_CITATION_STYLE,
      state.manuscript.locale,
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Removed manuscript citation',
        events: [
          {
            operation: 'citation.remove',
            targetId: citationId,
            path: `/citations/${citationId}`,
            previousValue: previous,
          },
          ...clusterEvents,
          ...blockEvents,
        ] as never,
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        citations: nextCitations,
        citationClusters: nextClusters,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

export function stageRemoveCitationCluster(clusterId: string): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const clusters = state.manuscript.citationClusters ?? [];
    const cluster = clusters.find((candidate) => candidate.id === clusterId);
    if (!cluster) return state;

    const removedSet = new Set(cluster.citationIds);
    const removedCitations = state.manuscript.citations.filter((citation) =>
      removedSet.has(citation.id),
    );
    const nextCitations = state.manuscript.citations.filter(
      (citation) => !removedSet.has(citation.id),
    );
    const nextClusters = clusters.filter((candidate) => candidate.id !== clusterId);
    const removedSections = removeCitationClusterFromSections(
      state.manuscript.sections,
      clusterId,
    );
    const nextSections = synchronizeCitationLabels(
      removedSections,
      nextCitations,
      state.manuscript.bibliographicRecords ?? [],
      nextClusters,
      state.manuscript.citationStyle ?? DEFAULT_CITATION_STYLE,
      state.manuscript.locale,
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Removed citation cluster',
        events: [
          ...removedCitations.map((citation) => ({
            operation: 'citation.remove' as const,
            targetId: citation.id,
            path: `/citations/${citation.id}`,
            previousValue: citation,
          })),
          {
            operation: 'citation.cluster.remove' as never,
            targetId: cluster.id,
            path: `/citationClusters/${cluster.id}`,
            previousValue: cluster,
          },
          ...blockEvents,
        ] as never,
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        citations: nextCitations,
        citationClusters: nextClusters,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
  return changed;
}

/**
 * Runs after a normal Tiptap block edit. Removing a cluster marker removes all
 * citation occurrences attached to that marker while shared bibliographic
 * records remain reusable in the manuscript reference library.
 */
export function reconcileCitationsAfterBlockEdit(): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const timestamp = new Date().toISOString();
    const anchors = collectCitationAnchors(state.manuscript.sections);
    const anchorMap = new Map(anchors.map((anchor) => [anchor.citationId, anchor]));
    const removed = state.manuscript.citations.filter(
      (citation) => !anchorMap.has(citation.id),
    );
    const updated: Array<{ previous: OmiCitation; next: OmiCitation }> = [];
    const nextCitations = state.manuscript.citations
      .filter((citation) => anchorMap.has(citation.id))
      .map((citation) => {
        const anchor = anchorMap.get(citation.id)!;

        if (
          citation.anchorId === anchor.anchorId &&
          citation.targetBlockId === anchor.targetBlockId &&
          citation.clusterId === anchor.clusterId
        ) {
          return citation;
        }

        const next: OmiCitation = {
          ...citation,
          anchorId: anchor.anchorId,
          targetBlockId: anchor.targetBlockId,
          clusterId: anchor.clusterId,
          modifiedAt: timestamp,
        };
        updated.push({ previous: citation, next });
        return next;
      });

    const removedClusters: OmiCitationCluster[] = [];
    const updatedClusters: Array<{ previous: OmiCitationCluster; next: OmiCitationCluster }> = [];
    const nextClusters = (state.manuscript.citationClusters ?? []).flatMap((cluster) => {
      const survivingIds = cluster.citationIds.filter((citationId) => anchorMap.has(citationId));

      if (survivingIds.length === 0) {
        removedClusters.push(cluster);
        return [];
      }

      const firstAnchor = anchorMap.get(survivingIds[0]!)!;
      const nextCluster: OmiCitationCluster = {
        ...cluster,
        citationIds: survivingIds,
        anchorId: firstAnchor.anchorId,
        targetBlockId: firstAnchor.targetBlockId,
        modifiedAt: timestamp,
      };

      if (JSON.stringify(cluster) !== JSON.stringify(nextCluster)) {
        updatedClusters.push({ previous: cluster, next: nextCluster });
      }

      return [nextCluster];
    });

    const synchronizedSections = synchronizeForManuscript(
      state.manuscript,
      nextCitations,
      state.manuscript.bibliographicRecords ?? [],
      nextClusters,
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      synchronizedSections,
    );
    const semanticEvents = [
      ...removed.map((citation) => ({
        operation: 'citation.remove' as const,
        targetId: citation.id,
        path: `/citations/${citation.id}`,
        previousValue: citation,
      })),
      ...updated.map(({ previous, next }) => ({
        operation: 'citation.update' as never,
        targetId: next.id,
        path: `/citations/${next.id}`,
        previousValue: previous,
        nextValue: next,
      })),
      ...removedClusters.map((cluster) => ({
        operation: 'citation.cluster.remove' as never,
        targetId: cluster.id,
        path: `/citationClusters/${cluster.id}`,
        previousValue: cluster,
      })),
      ...updatedClusters.map(({ previous, next }) => ({
        operation: 'citation.cluster.update' as never,
        targetId: next.id,
        path: `/citationClusters/${next.id}`,
        previousValue: previous,
        nextValue: next,
      })),
      ...blockEvents,
    ];

    if (semanticEvents.length === 0) return state;

    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary:
          removed.length > 0 || removedClusters.length > 0
            ? 'Removed citation anchor and occurrence'
            : 'Synchronized manuscript citation anchors',
        events: semanticEvents,
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        citations: nextCitations,
        citationClusters: nextClusters,
        sections: synchronizedSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCitationCheckpoint();
}

function synchronizeForManuscript(
  manuscript: OmiManuscript,
  citations: readonly OmiCitation[],
  records: readonly OmiBibliographicRecord[],
  clusters: readonly OmiCitationCluster[],
): OmiSection[] {
  return synchronizeCitationLabels(
    manuscript.sections,
    citations,
    records,
    clusters,
    manuscript.citationStyle ?? DEFAULT_CITATION_STYLE,
    manuscript.locale,
  );
}

function collectBlockContentChanges(
  previousSections: readonly OmiSection[],
  nextSections: readonly OmiSection[],
) {
  const previousBlocks = new Map(
    previousSections.flatMap((section) => section.blocks).map((block) => [block.id, block]),
  );

  return nextSections
    .flatMap((section) => section.blocks)
    .flatMap((block) => {
      const previous = previousBlocks.get(block.id);
      if (!previous || previous.content === block.content) return [];

      return [
        {
          operation: 'block.content.set' as const,
          targetId: block.id,
          path: `/blocks/${block.id}/content`,
          previousValue: previous.content,
          nextValue: block.content,
        },
      ];
    });
}

function scheduleCitationCheckpoint(): void {
  if (citationCheckpointTimer !== null) {
    clearTimeout(citationCheckpointTimer);
  }

  citationCheckpointTimer = setTimeout(() => {
    citationCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, CITATION_CHECKPOINT_DELAY_MS);
}

function resolveCurrentActorAgentId(
  manuscript: OmiManuscript,
): string | undefined {
  const currentUser = getCurrentUser(useAuthStore.getState());
  if (!currentUser) return undefined;

  if (
    currentUser.agentId &&
    manuscript.agents.some((agent) => agent.id === currentUser.agentId)
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(currentUser.profile.orcid);
  if (!accountOrcid) return undefined;

  const matches = manuscript.agents.filter(
    (agent) =>
      normalizeOrcidForComparison(
        getExternalIdentifierValue(agent, 'orcid'),
      ) === accountOrcid,
  );

  return matches.length === 1 ? matches[0]?.id : undefined;
}

function normalizeOrcidForComparison(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}
