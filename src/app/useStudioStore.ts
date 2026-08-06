import { create } from 'zustand';

import { createSampleManuscript } from '../document/sampleManuscript';
import {
  migrateIdentityModel,
  type LegacyOmiManuscript,
} from '../document/migrateIdentityModel';
import {
  createContribution,
  createPersonAgent,
  normalizeContributionRoles,
  updatePersonAgent,
  type ContributionRole,
  type ContributorEditInput,
  type OmiContribution,
} from '../model/identity';
import type { OmiManuscript } from '../types/omi';

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
  loadManuscript: (manuscript: LegacyOmiManuscript) => void;
  resetSample: () => void;
}

const initial = createSampleManuscript();

export const useStudioStore = create<StudioState>((set) => ({
  manuscript: initial,
  selectedSectionId: initial.sections[0]?.id ?? null,

  setTitle: (title) =>
    set((state) => ({
      manuscript: touchManuscript({
        ...state.manuscript,
        title,
      }),
    })),

  setAbstract: (abstractText) =>
    set((state) => ({
      manuscript: touchManuscript({
        ...state.manuscript,
        abstract: abstractText,
      }),
    })),

  selectSection: (sectionId) => set({ selectedSectionId: sectionId }),

  updateBlock: (blockId, content) =>
    set((state) => ({
      manuscript: touchManuscript({
        ...state.manuscript,
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
      }),
    })),

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

      return {
        selectedSectionId: section.id,
        manuscript: touchManuscript({
          ...state.manuscript,
          sections: [...state.manuscript.sections, section],
        }),
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

      return {
        manuscript: {
          ...state.manuscript,
          agents: [...state.manuscript.agents, agent],
          contributions: normalizeContributionOrder([
            ...state.manuscript.contributions,
            contribution,
          ]),
          updatedAt: timestamp,
        },
      };
    }),

  updateContributor: (agentId, input) =>
    set((state) => ({
      manuscript: touchManuscript({
        ...state.manuscript,
        agents: state.manuscript.agents.map((agent) =>
          agent.id === agentId
            ? updatePersonAgent(agent, input)
            : agent,
        ),
      }),
    })),

  updateContribution: (contributionId, input) =>
    set((state) => {
      const timestamp = new Date().toISOString();

      return {
        manuscript: {
          ...state.manuscript,
          contributions: state.manuscript.contributions.map(
            (contribution) =>
              contribution.id === contributionId
                ? {
                    ...contribution,
                    roles:
                      input.roles !== undefined
                        ? normalizeContributionRoles(input.roles)
                        : contribution.roles,
                    corresponding:
                      input.corresponding !== undefined
                        ? input.corresponding
                        : contribution.corresponding,
                    updatedAt: timestamp,
                  }
                : contribution,
          ),
          updatedAt: timestamp,
        },
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

      return {
        manuscript: touchManuscript({
          ...state.manuscript,
          agents: agentIsStillReferenced
            ? state.manuscript.agents
            : state.manuscript.agents.filter(
                (agent) => agent.id !== removedContribution.agentId,
              ),
          contributions: normalizeContributionOrder(contributions),
        }),
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

      return {
        manuscript: touchManuscript({
          ...state.manuscript,
          contributions: normalizeContributionOrder(nextContributions),
        }),
      };
    }),

  loadManuscript: (manuscript) => {
    const migrated = migrateIdentityModel(manuscript);

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

function touchManuscript(manuscript: OmiManuscript): OmiManuscript {
  return {
    ...manuscript,
    updatedAt: new Date().toISOString(),
  };
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
