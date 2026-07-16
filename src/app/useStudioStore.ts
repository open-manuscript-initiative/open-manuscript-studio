import { create } from 'zustand';
import { createSampleManuscript } from '../document/sampleManuscript';
import type { OmiManuscript } from '../types/omi';

interface StudioState {
  manuscript: OmiManuscript;
  selectedSectionId: string | null;
  setTitle: (title: string) => void;
  setAbstract: (abstractText: string) => void;
  selectSection: (sectionId: string) => void;
  updateBlock: (blockId: string, content: string) => void;
  addSection: () => void;
  resetSample: () => void;
}

const initial = createSampleManuscript();

export const useStudioStore = create<StudioState>((set) => ({
  manuscript: initial,
  selectedSectionId: initial.sections[0]?.id ?? null,
  setTitle: (title) =>
    set((state) => ({ manuscript: { ...state.manuscript, title, updatedAt: new Date().toISOString() } })),
  setAbstract: (abstractText) =>
    set((state) => ({ manuscript: { ...state.manuscript, abstract: abstractText, updatedAt: new Date().toISOString() } })),
  selectSection: (sectionId) => set({ selectedSectionId: sectionId }),
  updateBlock: (blockId, content) =>
    set((state) => ({
      manuscript: {
        ...state.manuscript,
        sections: state.manuscript.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) => (block.id === blockId ? { ...block, content } : block))
        })),
        updatedAt: new Date().toISOString()
      }
    })),
  addSection: () =>
    set((state) => {
      const section = {
        id: crypto.randomUUID(),
        title: `Section ${state.manuscript.sections.length + 1}`,
        blocks: [{ id: crypto.randomUUID(), type: 'paragraph', content: 'New section content.' }]
      };
      return {
        selectedSectionId: section.id,
        manuscript: {
          ...state.manuscript,
          sections: [...state.manuscript.sections, section],
          updatedAt: new Date().toISOString()
        }
      };
    }),
  resetSample: () => {
    const sample = createSampleManuscript();
    set({ manuscript: sample, selectedSectionId: sample.sections[0]?.id ?? null });
  }
}));
