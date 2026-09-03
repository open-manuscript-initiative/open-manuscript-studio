import { create } from 'zustand';

import { createSampleManuscript } from '../document/sampleManuscript';
import {
  migrateIdentityModel,
  type LegacyOmiManuscript,
} from '../document/migrateIdentityModel';
import { migrateVersioningModel } from '../document/migrateVersioningModel';
import {
  createContribution,
  createPersonAgent,
  getExternalIdentifierValue,
  normalizeContributionRoles,
  updatePersonAgent,
  type ContributionRole,
  type ContributorEditInput,
  type OmiContribution,
} from '../model/identity';
import {
  commitManuscriptRevision,
  extractManuscriptState,
  revertManuscriptToRevision,
  type CreateChangeEventInput,
  type RevisionId,
} from '../model/versioning';
import {
  createProofingComment,
  createPublicationCorrection,
  decideProofingChange,
  normalizeProofingState,
  recordBlockTextChange,
  restoreProofingChange,
  setProofingCommentResolved,
  setProofingTracking,
  type ProofingSelection,
} from '../model/proofing';
import {
  createCheckpointDescriptor,
  stagePendingChanges,
  type CheckpointReason,
  type OmiPendingChangeSet,
} from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiBlock,
  OmiManuscript,
  OmiManuscriptState,
  OmiPublicationCorrectionKind,
} from '../types/omi';

interface ContributionEditInput {
  roles?: ContributionRole[];
  corresponding?: boolean;
}

interface StudioState {
  manuscript: OmiManuscript;
  pendingChangeSet: OmiPendingChangeSet | null;
  selectedSectionId: string | null;
  currentStudyNotesVisible: boolean;
  proofingPanelOpen: boolean;
  activeProofingChangeId: string | null;
  proofingSelection: ProofingSelection | null;
  setTitle: (title: string) => void;
  setAbstract: (abstractText: string) => void;
  selectSection: (sectionId: string) => void;
  toggleCurrentStudyNotes: () => void;
  toggleProofingPanel: () => void;
  closeProofingPanel: () => void;
  setActiveProofingChange: (changeId: string | null) => void;
  setProofingSelection: (selection: ProofingSelection | null) => void;
  setTrackChanges: (enabled: boolean) => void;
  acceptProofingChange: (changeId: string) => void;
  rejectProofingChange: (changeId: string) => void;
  acceptAllProofingChanges: () => void;
  rejectAllProofingChanges: () => void;
  addProofingComment: (
    body: string,
    visibility: 'author_and_editor' | 'editor_only',
  ) => void;
  setProofingCommentResolved: (commentId: string, resolved: boolean) => void;
  addPublicationCorrection: (
    kind: OmiPublicationCorrectionKind,
    selection: ProofingSelection,
  ) => void;
  removePublicationCorrection: (correctionId: string) => void;
  updateBlock: (blockId: string, content: string) => void;
  addSection: () => void;
  addContributor: (targetId?: string) => void;
  updateContributor: (
    agentId: string,
    input: ContributorEditInput,
  ) => void;
  updateContribution: (
    contributionId: string,
    input: ContributionEditInput,
  ) => void;
  removeContributor: (contributionId: string) => void;
  moveContributor: (
    contributionId: string,
    direction: 'up' | 'down',
  ) => void;
  checkpoint: (reason?: CheckpointReason) => void;
  discardWorkingChanges: () => void;
  revertRevision: (revisionId: RevisionId) => void;
  loadManuscript: (manuscript: LegacyOmiManuscript) => void;
  resetSample: () => void;
}

const AUTO_CHECKPOINT_DELAY_MS = 2500;
let autoCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

const initial = createSampleManuscript();

export const useStudioStore = create<StudioState>((set) => ({
  manuscript: initial,
  pendingChangeSet: null,
  selectedSectionId: initial.sections[0]?.id ?? null,
  currentStudyNotesVisible: false,
  proofingPanelOpen: false,
  activeProofingChangeId: null,
  proofingSelection: null,

  setTitle: (title) =>
    set((state) => {
      if (state.manuscript.title === title) {
        return state;
      }

      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          title,
        },
        'Changed manuscript title',
        [
          {
            operation: 'manuscript.title.set',
            targetId: state.manuscript.id,
            path: '/title',
            previousValue: state.manuscript.title,
            nextValue: title,
          },
        ],
      );
    }),

  setAbstract: (abstractText) =>
    set((state) => {
      if ((state.manuscript.abstract ?? '') === abstractText) {
        return state;
      }

      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          abstract: abstractText,
        },
        'Changed manuscript abstract',
        [
          {
            operation: 'manuscript.abstract.set',
            targetId: state.manuscript.id,
            path: '/abstract',
            previousValue: state.manuscript.abstract,
            nextValue: abstractText,
          },
        ],
      );
    }),

  selectSection: (sectionId) => set({ selectedSectionId: sectionId }),

  toggleCurrentStudyNotes: () =>
    set((state) => ({
      currentStudyNotesVisible: !state.currentStudyNotesVisible,
    })),

  toggleProofingPanel: () =>
    set((state) => ({ proofingPanelOpen: !state.proofingPanelOpen })),

  closeProofingPanel: () => set({ proofingPanelOpen: false }),

  setActiveProofingChange: (changeId) => set({
    activeProofingChangeId: changeId,
    ...(changeId ? { proofingPanelOpen: true } : {}),
  }),

  setProofingSelection: (selection) => set({ proofingSelection: selection }),

  setTrackChanges: (enabled) =>
    set((state) => {
      const current = normalizeProofingState(state.manuscript.proofing);
      if (current.trackChanges === enabled) return state;
      const proofing = setProofingTracking(state.manuscript.proofing, enabled);
      return stageWorkingChange(
        state,
        { ...extractManuscriptState(state.manuscript), proofing },
        enabled ? 'Enabled tracked changes' : 'Disabled tracked changes',
        [{
          operation: 'proofing.tracking.set',
          targetId: state.manuscript.id,
          path: '/proofing/trackChanges',
          previousValue: current.trackChanges,
          nextValue: enabled,
        }],
      );
    }),

  acceptProofingChange: (changeId) =>
    set((state) => decideTrackedChange(state, changeId, 'accepted')),

  rejectProofingChange: (changeId) =>
    set((state) => decideTrackedChange(state, changeId, 'rejected')),

  acceptAllProofingChanges: () =>
    set((state) => decideAllTrackedChanges(state, 'accepted')),

  rejectAllProofingChanges: () =>
    set((state) => decideAllTrackedChanges(state, 'rejected')),

  addProofingComment: (body, visibility) =>
    set((state) => {
      const selection = state.proofingSelection;
      if (!selection || !selection.text.trim() || !body.trim()) return state;
      const timestamp = new Date().toISOString();
      const comment = createProofingComment(
        selection,
        body,
        visibility,
        resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      );
      return {
        ...stageWorkingChange(
          state,
          {
            ...extractManuscriptState(state.manuscript),
            annotations: [...state.manuscript.annotations, comment],
          },
          'Added proofreading comment',
          [{
            operation: 'proofing.comment.create',
            targetId: comment.id,
            path: '/annotations/-',
            nextValue: comment,
          }],
          timestamp,
        ),
        proofingSelection: null,
      };
    }),

  setProofingCommentResolved: (commentId, resolved) =>
    set((state) => {
      const existing = state.manuscript.annotations.find(
        (annotation) => annotation.id === commentId && annotation.type === 'comment',
      );
      if (!existing || (existing.status === 'resolved') === resolved) return state;
      const timestamp = new Date().toISOString();
      const next = setProofingCommentResolved(existing, resolved, timestamp);
      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          annotations: state.manuscript.annotations.map((annotation) =>
            annotation.id === commentId ? next : annotation,
          ),
        },
        resolved ? 'Resolved proofreading comment' : 'Reopened proofreading comment',
        [{
          operation: 'proofing.comment.resolve',
          targetId: commentId,
          path: `/annotations/${commentId}/status`,
          previousValue: existing.status ?? 'open',
          nextValue: next.status,
        }],
        timestamp,
      );
    }),

  addPublicationCorrection: (kind, selection) =>
    set((state) => {
      const blockLevel = kind === 'page-break-before'
        || kind === 'keep-together'
        || kind === 'keep-with-next';
      const duplicate = (state.manuscript.publicationCorrections ?? []).some(
        (correction) => correction.targetBlockId === selection.blockId
          && correction.kind === kind
          && (blockLevel || (
            correction.from === selection.from
            && correction.to === selection.to
          )),
      );
      if (duplicate) return state;
      const timestamp = new Date().toISOString();
      const correction = createPublicationCorrection({
        targetBlockId: selection.blockId,
        kind,
        from: selection.from,
        to: selection.to,
        sourceText: selection.text,
        creatorAgentId: resolveCurrentActorAgentId(state.manuscript),
      }, timestamp);
      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          publicationCorrections: [
            ...(state.manuscript.publicationCorrections ?? []),
            correction,
          ],
        },
        'Added publication proofreading correction',
        [{
          operation: 'publication.correction.create',
          targetId: correction.id,
          path: '/publicationCorrections/-',
          nextValue: correction,
        }],
        timestamp,
      );
    }),

  removePublicationCorrection: (correctionId) =>
    set((state) => {
      const existing = (state.manuscript.publicationCorrections ?? []).find(
        (correction) => correction.id === correctionId,
      );
      if (!existing) return state;
      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          publicationCorrections: (state.manuscript.publicationCorrections ?? [])
            .filter((correction) => correction.id !== correctionId),
        },
        'Removed publication proofreading correction',
        [{
          operation: 'publication.correction.remove',
          targetId: correctionId,
          path: `/publicationCorrections/${correctionId}`,
          previousValue: existing,
        }],
      );
    }),

  updateBlock: (blockId, content) =>
    set((state) => {
      const previousBlock = findBlock(state.manuscript.sections.flatMap((section) => section.blocks), blockId);

      if (!previousBlock || previousBlock.content === content) {
        return state;
      }

      const previousProofing = normalizeProofingState(state.manuscript.proofing);
      const proofing = state.manuscript.proofing?.trackChanges
        ? {
            ...previousProofing,
            changes: recordBlockTextChange(
              previousProofing.changes,
              blockId,
              previousBlock.content,
              content,
              resolveCurrentActorAgentId(state.manuscript),
            ),
          }
        : state.manuscript.proofing;
      const nextState: OmiManuscriptState = {
        ...extractManuscriptState(state.manuscript),
        sections: state.manuscript.sections.map((section) => ({
          ...section,
          blocks: replaceBlock(section.blocks, blockId, content),
        })),
        proofing,
      };
      const proofingChanged = state.manuscript.proofing?.trackChanges
        && JSON.stringify(previousProofing.changes) !== JSON.stringify(proofing?.changes);

      return stageWorkingChange(
        state,
        nextState,
        'Changed manuscript block content',
        [
          {
            operation: 'block.content.set',
            targetId: blockId,
            path: `/blocks/${blockId}/content`,
            previousValue: previousBlock.content,
            nextValue: content,
          },
          ...(proofingChanged ? [{
            operation: 'proofing.change.record' as const,
            targetId: blockId,
            path: '/proofing/changes',
            previousValue: previousProofing.changes,
            nextValue: proofing?.changes ?? [],
          }] : []),
        ],
      );
    }),

  addSection: () =>
    set((state) => {
      const section = {
        id: crypto.randomUUID(),
        title: `Section ${state.manuscript.sections.length + 1}`,
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'paragraph',
            content: 'New section content.',
          },
        ],
      };
      const nextState: OmiManuscriptState = {
        ...extractManuscriptState(state.manuscript),
        sections: [...state.manuscript.sections, section],
      };

      return {
        ...stageWorkingChange(
          state,
          nextState,
          'Added manuscript section',
          [
            {
              operation: 'section.create',
              targetId: section.id,
              path: '/sections/-',
              nextValue: section,
            },
          ],
        ),
        selectedSectionId: section.id,
      };
    }),

  addContributor: (targetId) =>
    set((state) => {
      const timestamp = new Date().toISOString();
      const agent = createPersonAgent(
        {
          givenName: 'New',
          familyName: 'Contributor',
          language: state.manuscript.locale,
        },
        crypto.randomUUID(),
        timestamp,
      );
      const contribution = createContribution(
        agent.id,
        targetId ?? state.manuscript.id,
        ['author'],
        state.manuscript.contributions.filter(
          (candidate) =>
            candidate.targetId === (targetId ?? state.manuscript.id),
        ).length + 1,
        crypto.randomUUID(),
        timestamp,
      );
      const nextState: OmiManuscriptState = {
        ...extractManuscriptState(state.manuscript),
        agents: [...state.manuscript.agents, agent],
        contributions: normalizeContributionOrdersByTarget([
          ...state.manuscript.contributions,
          contribution,
        ]),
      };

      return stageWorkingChange(
        state,
        nextState,
        'Added manuscript contributor',
        [
          {
            operation: 'agent.create',
            targetId: agent.id,
            path: '/agents/-',
            nextValue: agent,
          },
          {
            operation: 'contribution.update',
            targetId: contribution.id,
            path: '/contributions/-',
            nextValue: contribution,
          },
        ],
        timestamp,
      );
    }),

  updateContributor: (agentId, input) =>
    set((state) => {
      const previousAgent = state.manuscript.agents.find(
        (agent) => agent.id === agentId,
      );

      if (!previousAgent) {
        return state;
      }

      const nextAgent = updatePersonAgent(previousAgent, input);

      if (JSON.stringify(previousAgent) === JSON.stringify(nextAgent)) {
        return state;
      }

      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          agents: state.manuscript.agents.map((agent) =>
            agent.id === agentId ? nextAgent : agent,
          ),
        },
        'Changed contributor identity',
        [
          {
            operation: 'agent.update',
            targetId: agentId,
            path: `/agents/${agentId}`,
            previousValue: previousAgent,
            nextValue: nextAgent,
          },
        ],
      );
    }),

  updateContribution: (contributionId, input) =>
    set((state) => {
      const previousContribution = state.manuscript.contributions.find(
        (contribution) => contribution.id === contributionId,
      );

      if (!previousContribution) {
        return state;
      }

      const timestamp = new Date().toISOString();
      const nextContribution: OmiContribution = {
        ...previousContribution,
        roles:
          input.roles !== undefined
            ? normalizeContributionRoles(input.roles)
            : previousContribution.roles,
        corresponding:
          input.corresponding !== undefined
            ? input.corresponding
            : previousContribution.corresponding,
        updatedAt: timestamp,
      };

      if (
        JSON.stringify(previousContribution.roles) ===
          JSON.stringify(nextContribution.roles) &&
        previousContribution.corresponding ===
          nextContribution.corresponding
      ) {
        return state;
      }

      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          contributions: state.manuscript.contributions.map(
            (contribution) =>
              contribution.id === contributionId
                ? nextContribution
                : contribution,
          ),
        },
        'Changed contributor role',
        [
          {
            operation: 'contribution.update',
            targetId: contributionId,
            path: `/contributions/${contributionId}`,
            previousValue: previousContribution,
            nextValue: nextContribution,
          },
        ],
        timestamp,
      );
    }),

  removeContributor: (contributionId) =>
    set((state) => {
      const removedContribution = state.manuscript.contributions.find(
        (contribution) => contribution.id === contributionId,
      );

      if (!removedContribution) {
        return state;
      }

      const contributions = state.manuscript.contributions.filter(
        (contribution) => contribution.id !== contributionId,
      );
      const agentIsStillReferenced = contributions.some(
        (contribution) =>
          contribution.agentId === removedContribution.agentId,
      );
      const removedAgent = agentIsStillReferenced
        ? undefined
        : state.manuscript.agents.find(
            (agent) => agent.id === removedContribution.agentId,
          );
      const nextState: OmiManuscriptState = {
        ...extractManuscriptState(state.manuscript),
        agents: removedAgent
          ? state.manuscript.agents.filter(
              (agent) => agent.id !== removedAgent.id,
            )
          : state.manuscript.agents,
        contributions: normalizeContributionOrdersByTarget(contributions),
      };
      const events: CreateChangeEventInput[] = [
        {
          operation: 'contribution.remove',
          targetId: contributionId,
          path: `/contributions/${contributionId}`,
          previousValue: removedContribution,
        },
      ];

      if (removedAgent) {
        events.push({
          operation: 'agent.remove',
          targetId: removedAgent.id,
          path: `/agents/${removedAgent.id}`,
          previousValue: removedAgent,
        });
      }

      return stageWorkingChange(
        state,
        nextState,
        'Removed manuscript contributor',
        events,
      );
    }),

  moveContributor: (contributionId, direction) =>
    set((state) => {
      const selected = state.manuscript.contributions.find(
        (contribution) => contribution.id === contributionId,
      );
      if (!selected) return state;

      const targetContributions = state.manuscript.contributions
        .filter((contribution) => contribution.targetId === selected.targetId)
        .sort(
          (left, right) =>
            (left.order ?? Number.MAX_SAFE_INTEGER) -
            (right.order ?? Number.MAX_SAFE_INTEGER),
        );
      const currentIndex = targetContributions.findIndex(
        (contribution) => contribution.id === contributionId,
      );
      const targetIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= targetContributions.length
      ) {
        return state;
      }

      const nextContributions = [...targetContributions];
      const currentContribution = nextContributions[currentIndex];
      const targetContribution = nextContributions[targetIndex];

      if (!currentContribution || !targetContribution) {
        return state;
      }

      nextContributions[currentIndex] = targetContribution;
      nextContributions[targetIndex] = currentContribution;

      const nextOrder = new Map(
        nextContributions.map((contribution, index) => [
          contribution.id,
          index + 1,
        ]),
      );
      const normalizedNextContributions = state.manuscript.contributions.map(
        (contribution) => {
          const order = nextOrder.get(contribution.id);
          return order === undefined ? contribution : { ...contribution, order };
        },
      );

      return stageWorkingChange(
        state,
        {
          ...extractManuscriptState(state.manuscript),
          contributions: normalizedNextContributions,
        },
        'Reordered manuscript contributors',
        [
          {
            operation: 'contribution.reorder',
            targetId: contributionId,
            path: '/contributions',
            previousValue: targetContributions.map((item) => item.id),
            nextValue: nextContributions.map((item) => item.id),
          },
        ],
      );
    }),

  checkpoint: (reason = 'manual') => {
    cancelAutomaticCheckpoint();
    void reason;

    set((state) => {
      if (!state.pendingChangeSet) {
        return state;
      }

      const descriptor = createCheckpointDescriptor(
        state.pendingChangeSet,
      );
      const manuscript = commitManuscriptRevision(
        state.manuscript,
        extractManuscriptState(state.manuscript),
        descriptor,
      );

      return {
        manuscript,
        pendingChangeSet: null,
      };
    });
  },

  discardWorkingChanges: () => {
    cancelAutomaticCheckpoint();

    set((state) => {
      if (!state.pendingChangeSet) {
        return state;
      }

      const manuscript = restoreCommittedHead(state.manuscript);
      const selectedSectionStillExists = manuscript.sections.some(
        (section) => section.id === state.selectedSectionId,
      );

      return {
        manuscript,
        pendingChangeSet: null,
        selectedSectionId: selectedSectionStillExists
          ? state.selectedSectionId
          : manuscript.sections[0]?.id ?? null,
      };
    });
  },

  revertRevision: (revisionId) =>
    set((state) => {
      if (state.pendingChangeSet) {
        return state;
      }

      const manuscript = revertManuscriptToRevision(
        state.manuscript,
        revisionId,
        {
          summary: 'Reverted manuscript to an earlier revision',
          actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        },
      );
      const selectedSectionStillExists = manuscript.sections.some(
        (section) => section.id === state.selectedSectionId,
      );

      return {
        manuscript,
        selectedSectionId: selectedSectionStillExists
          ? state.selectedSectionId
          : manuscript.sections[0]?.id ?? null,
      };
    }),

  loadManuscript: (manuscript) => {
    cancelAutomaticCheckpoint();
    const identityMigrated = migrateIdentityModel(manuscript);
    const migrated = migrateVersioningModel(identityMigrated);

    set({
      manuscript: migrated,
      pendingChangeSet: null,
      selectedSectionId: migrated.sections[0]?.id ?? null,
      proofingPanelOpen: false,
      activeProofingChangeId: null,
      proofingSelection: null,
    });
  },

  resetSample: () => {
    cancelAutomaticCheckpoint();
    const sample = createSampleManuscript();

    set({
      manuscript: sample,
      pendingChangeSet: null,
      selectedSectionId: sample.sections[0]?.id ?? null,
      proofingPanelOpen: false,
      activeProofingChangeId: null,
      proofingSelection: null,
    });
  },
}));

function stageWorkingChange(
  state: StudioState,
  nextState: OmiManuscriptState,
  summary: string,
  events: CreateChangeEventInput[],
  timestamp = new Date().toISOString(),
): Partial<StudioState> {
  const pendingChangeSet = stagePendingChanges(
    state.pendingChangeSet,
    {
      baseRevisionId: state.manuscript.headRevisionId,
      summary,
      events,
      actorAgentId: resolveCurrentActorAgentId(state.manuscript),
      timestamp,
    },
  );

  scheduleAutomaticCheckpoint();

  return {
    manuscript: {
      ...state.manuscript,
      ...nextState,
      updatedAt: timestamp,
    },
    pendingChangeSet,
  };
}

function scheduleAutomaticCheckpoint(): void {
  cancelAutomaticCheckpoint();

  autoCheckpointTimer = setTimeout(() => {
    autoCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, AUTO_CHECKPOINT_DELAY_MS);
}

function cancelAutomaticCheckpoint(): void {
  if (autoCheckpointTimer === null) {
    return;
  }

  clearTimeout(autoCheckpointTimer);
  autoCheckpointTimer = null;
}

function restoreCommittedHead(
  manuscript: OmiManuscript,
): OmiManuscript {
  const headRevision = manuscript.revisionHistory.revisions.find(
    (revision) => revision.id === manuscript.headRevisionId,
  );

  if (!headRevision) {
    throw new Error('The committed head revision could not be found.');
  }

  return {
    ...structuredClone(headRevision.snapshot.state),
    versioningModelVersion: manuscript.versioningModelVersion,
    headRevisionId: manuscript.headRevisionId,
    revisionHistory: manuscript.revisionHistory,
  };
}

export function resolveCurrentActorAgentId(
  manuscript: OmiManuscript,
): string | undefined {
  const currentUser = getCurrentUser(useAuthStore.getState());

  if (!currentUser) {
    return undefined;
  }

  if (
    currentUser.agentId &&
    manuscript.agents.some(
      (agent) => agent.id === currentUser.agentId,
    )
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(
    currentUser.profile.orcid,
  );

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

function normalizeOrcidForComparison(
  value: string | undefined,
): string {
  return (value ?? '')
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}

function normalizeContributionOrdersByTarget(
  contributions: OmiContribution[],
): OmiContribution[] {
  const grouped = new Map<string, OmiContribution[]>();
  for (const contribution of contributions) {
    const target = grouped.get(contribution.targetId) ?? [];
    target.push(contribution);
    grouped.set(contribution.targetId, target);
  }

  const orderById = new Map<string, number>();
  for (const target of grouped.values()) {
    target
      .sort(
        (left, right) =>
          (left.order ?? Number.MAX_SAFE_INTEGER) -
          (right.order ?? Number.MAX_SAFE_INTEGER),
      )
      .forEach((contribution, index) => {
        orderById.set(contribution.id, index + 1);
      });
  }

  return contributions.map((contribution) => ({
    ...contribution,
    order: orderById.get(contribution.id) ?? contribution.order,
  }));
}

function decideTrackedChange(
  state: StudioState,
  changeId: string,
  decision: 'accepted' | 'rejected',
): Partial<StudioState> | StudioState {
  const proofing = normalizeProofingState(state.manuscript.proofing);
  const change = proofing.changes.find(
    (candidate) => candidate.id === changeId && candidate.status === 'pending',
  );
  if (!change) return state;

  const timestamp = new Date().toISOString();
  const nextProofing = decideProofingChange(
    proofing,
    changeId,
    decision,
    timestamp,
  );
  const sections = decision === 'rejected'
    ? restoreProofingChange(state.manuscript.sections, change)
    : state.manuscript.sections;

  return {
    ...stageWorkingChange(
      state,
      {
        ...extractManuscriptState(state.manuscript),
        sections,
        proofing: nextProofing,
      },
      decision === 'accepted'
        ? 'Accepted tracked proofreading change'
        : 'Rejected tracked proofreading change',
      [{
        operation: decision === 'accepted'
          ? 'proofing.change.accept'
          : 'proofing.change.reject',
        targetId: changeId,
        path: `/proofing/changes/${changeId}/status`,
        previousValue: 'pending',
        nextValue: decision,
      }],
      timestamp,
    ),
    activeProofingChangeId: nextPendingChangeId(nextProofing, changeId),
  };
}

function decideAllTrackedChanges(
  state: StudioState,
  decision: 'accepted' | 'rejected',
): Partial<StudioState> | StudioState {
  const proofing = normalizeProofingState(state.manuscript.proofing);
  const pending = proofing.changes.filter((change) => change.status === 'pending');
  if (!pending.length) return state;

  const timestamp = new Date().toISOString();
  const nextProofing = pending.reduce(
    (current, change) => decideProofingChange(
      current,
      change.id,
      decision,
      timestamp,
    ),
    proofing,
  );
  const sections = decision === 'rejected'
    ? pending.reduce(
        (current, change) => restoreProofingChange(current, change),
        state.manuscript.sections,
      )
    : state.manuscript.sections;

  return {
    ...stageWorkingChange(
      state,
      {
        ...extractManuscriptState(state.manuscript),
        sections,
        proofing: nextProofing,
      },
      decision === 'accepted'
        ? 'Accepted all tracked proofreading changes'
        : 'Rejected all tracked proofreading changes',
      pending.map((change) => ({
        operation: decision === 'accepted'
          ? 'proofing.change.accept' as const
          : 'proofing.change.reject' as const,
        targetId: change.id,
        path: `/proofing/changes/${change.id}/status`,
        previousValue: 'pending',
        nextValue: decision,
      })),
      timestamp,
    ),
    activeProofingChangeId: null,
  };
}

function nextPendingChangeId(
  proofing: ReturnType<typeof normalizeProofingState>,
  currentId: string,
): string | null {
  const pending = proofing.changes.filter((change) => change.status === 'pending');
  if (!pending.length) return null;
  const currentIndex = proofing.changes.findIndex((change) => change.id === currentId);
  return proofing.changes
    .slice(currentIndex + 1)
    .find((change) => change.status === 'pending')?.id
    ?? pending[0]?.id
    ?? null;
}

function findBlock(blocks: readonly OmiBlock[], blockId: string): OmiBlock | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    const nested = block.children ? findBlock(block.children, blockId) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function replaceBlock(
  blocks: readonly OmiBlock[],
  blockId: string,
  content: string,
): OmiBlock[] {
  return blocks.map((block) => ({
    ...block,
    ...(block.id === blockId ? { content } : {}),
    ...(block.children
      ? { children: replaceBlock(block.children, blockId, content) }
      : {}),
  }));
}
