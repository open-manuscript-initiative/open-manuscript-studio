import { useStudioStore } from './useStudioStore';
import {
  collectCitationAnchors,
  normalizeBibliographicRecord,
  removeCitationAnchorFromSections,
  synchronizeCitationLabels,
} from '../model/citations';
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

  if (changed) {
    scheduleCitationCheckpoint();
  }

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

    if (!previous) {
      return state;
    }

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
    const synchronizedSections = synchronizeCitationLabels(
      state.manuscript.sections,
      state.manuscript.citations,
      nextRecords,
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

  if (changed) {
    scheduleCitationCheckpoint();
  }

  return changed;
}

export function stageCreateCitation(citation: OmiCitation): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    if (state.manuscript.citations.some((item) => item.id === citation.id)) {
      return state;
    }

    const records = state.manuscript.bibliographicRecords ?? [];

    if (!records.some((record) => record.id === citation.target)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextCitation: OmiCitation = {
      ...citation,
      createdAt: citation.createdAt ?? timestamp,
      modifiedAt: timestamp,
    };
    const nextCitations = [...state.manuscript.citations, nextCitation];
    const synchronizedSections = synchronizeCitationLabels(
      state.manuscript.sections,
      nextCitations,
      records,
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

  if (changed) {
    scheduleCitationCheckpoint();
  }

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

    if (!previous) {
      return state;
    }

    const records = state.manuscript.bibliographicRecords ?? [];
    const target = input.target ?? previous.target;

    if (!records.some((record) => record.id === target)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextCitation: OmiCitation = {
      ...previous,
      ...input,
      target,
      modifiedAt: timestamp,
    };

    if (JSON.stringify(previous) === JSON.stringify(nextCitation)) {
      return state;
    }

    const nextCitations = state.manuscript.citations.map((citation) =>
      citation.id === citationId ? nextCitation : citation,
    );
    const synchronizedSections = synchronizeCitationLabels(
      state.manuscript.sections,
      nextCitations,
      records,
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
        ...nextState,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleCitationCheckpoint();
  }

  return changed;
}

export function stageRemoveCitation(citationId: string): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.citations.find(
      (citation) => citation.id === citationId,
    );

    if (!previous) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextSections = removeCitationAnchorFromSections(
      state.manuscript.sections,
      citationId,
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const nextState: OmiManuscriptState = {
      ...extractManuscriptState(state.manuscript),
      citations: state.manuscript.citations.filter(
        (citation) => citation.id !== citationId,
      ),
      sections: nextSections,
    };
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

  if (changed) {
    scheduleCitationCheckpoint();
  }

  return changed;
}

/**
 * Runs after a normal Tiptap block edit. Deleting an inline citation marker
 * removes only that citation occurrence; the shared bibliographic record is
 * retained in the manuscript reference library for reuse.
 */
export function reconcileCitationsAfterBlockEdit(): void {
  let changed = false;

  useStudioStore.setState((state) => {
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
          citation.targetBlockId === anchor.targetBlockId
        ) {
          return citation;
        }

        const next = {
          ...citation,
          anchorId: anchor.anchorId,
          targetBlockId: anchor.targetBlockId,
          modifiedAt: new Date().toISOString(),
        };
        updated.push({ previous: citation, next });
        return next;
      });
    const synchronizedSections = synchronizeCitationLabels(
      state.manuscript.sections,
      nextCitations,
      state.manuscript.bibliographicRecords ?? [],
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
      ...blockEvents,
    ];

    if (semanticEvents.length === 0) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary:
          removed.length > 0
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
        sections: synchronizedSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleCitationCheckpoint();
  }
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

      if (!previous || previous.content === block.content) {
        return [];
      }

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

  if (!currentUser) {
    return undefined;
  }

  if (
    currentUser.agentId &&
    manuscript.agents.some((agent) => agent.id === currentUser.agentId)
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(currentUser.profile.orcid);

  if (!accountOrcid) {
    return undefined;
  }

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
