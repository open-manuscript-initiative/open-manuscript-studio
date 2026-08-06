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
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiManuscript,
  OmiManuscriptState,
} from '../types/omi';

interface ContributionEditInput {
  roles?: ContributionRole[];
  corresponding?: boolean;
}

interface StudioState {
  manuscript: OmiManuscript;
  selectedSectionId: string | null;
  setTitle: (title: string) => void;
  setAbstract: (abstractText: string) => void;
  selectSection: (sectionId: string) => void;
  updateBlock: (blockId: string, content: string) => void;
  addSection: () => void;
  addContributor: () => void;
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
  revertRevision: (revisionId: RevisionId) => void;
  loadManuscript: (manuscript: LegacyOmiManuscript) => void;
  resetSample: () => void;
}

const initial = createSampleManuscript();

export const useStudioStore = create<StudioState>((set) => ({
  manuscript: initial,
  selectedSectionId: initial.sections[0]?.id ?? null,

  setTitle: (title) =>
    set((state) => {
      if (state.manuscript.title === title) {
        return state;
      }

      return {
        manuscript: commitChange(
          state.manuscript,
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
        ),
      };
    }),

  setAbstract: (abstractText) =>
    set((state) => {
      if ((state.manuscript.abstract ?? '') === abstractText) {
        return state;
      }

      return {
        manuscript: commitChange(
          state.manuscript,
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
        ),
      };
    }),

  selectSection: (sectionId) => set({ selectedSectionId: sectionId }),

  updateBlock: (blockId, content) =>
    set((state) => {
      const previousBlock = state.manuscript.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.id === blockId);

      if (!previousBlock || previousBlock.content === content) {
        return state;
      }

      const nextState: OmiManuscriptState = {
        ...extractManuscriptState(state.manuscript),
        sections: state.manuscript.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) =>
            block.id === blockId
              ? {
                  ...block,
                  content,
                }
              : block,
          ),
        })),
      };

      return {
        manuscript: commitChange(
          state.manuscript,
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
          ],
        ),
      };
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
        selectedSectionId: section.id,
        manuscript: commitChange(
          state.manuscript,
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
      };
    }),

  addContributor: () =>
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
        state.manuscript.id,
        ['author'],
        state.manuscript.contributions.length + 1,
        crypto.randomUUID(),
        timestamp,
      );
      const nextState: OmiManuscriptState = {
        ...extractManuscriptState(state.manuscript),
        agents: [...state.manuscript.agents, agent],
        contributions: normalizeContributionOrder([
          ...state.manuscript.contributions,
          contribution,
        ]),
      };

      return {
        manuscript: commitChange(
          state.manuscript,
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
        ),
      };
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

      return {
        manuscript: commitChange(
          state.manuscript,
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
        ),
      };
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

      return {
        manuscript: commitChange(
          state.manuscript,
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
        ),
      };
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
        contributions: normalizeContributionOrder(contributions),
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

      return {
        manuscript: commitChange(
          state.manuscript,
          nextState,
          'Removed manuscript contributor',
          events,
        ),
      };
    }),

  moveContributor: (contributionId, direction) =>
    set((state) => {
      const contributions = normalizeContributionOrder(
        state.manuscript.contributions,
      );
      const currentIndex = contributions.findIndex(
        (contribution) => contribution.id === contributionId,
      );
      const targetIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= contributions.length
      ) {
        return state;
      }

      const nextContributions = [...contributions];
      const currentContribution = nextContributions[currentIndex];
      const targetContribution = nextContributions[targetIndex];

      if (!currentContribution || !targetContribution) {
        return state;
      }

      nextContributions[currentIndex] = targetContribution;
      nextContributions[targetIndex] = currentContribution;

      const normalizedNextContributions = normalizeContributionOrder(
        nextContributions,
      );

      return {
        manuscript: commitChange(
          state.manuscript,
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
              previousValue: contributions.map((item) => item.id),
              nextValue: normalizedNextContributions.map(
                (item) => item.id,
              ),
            },
          ],
        ),
      };
    }),

  revertRevision: (revisionId) =>
    set((state) => {
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
    const identityMigrated = migrateIdentityModel(manuscript);
    const migrated = migrateVersioningModel(identityMigrated);

    set({
      manuscript: migrated,
      selectedSectionId: migrated.sections[0]?.id ?? null,
    });
  },

  resetSample: () => {
    const sample = createSampleManuscript();

    set({
      manuscript: sample,
      selectedSectionId: sample.sections[0]?.id ?? null,
    });
  },
}));

function commitChange(
  manuscript: OmiManuscript,
  nextState: OmiManuscriptState,
  summary: string,
  events: CreateChangeEventInput[],
  timestamp?: string,
): OmiManuscript {
  return commitManuscriptRevision(
    manuscript,
    nextState,
    {
      summary,
      events,
      actorAgentId: resolveCurrentActorAgentId(manuscript),
      timestamp,
    },
  );
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

function normalizeContributionOrder(
  contributions: OmiContribution[],
): OmiContribution[] {
  return [...contributions]
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) -
        (right.order ?? Number.MAX_SAFE_INTEGER),
    )
    .map((contribution, index) => ({
      ...contribution,
      order: index + 1,
    }));
}
