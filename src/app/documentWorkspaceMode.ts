import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OmiEditorMode = 'scholarly' | 'simple-text';

/** Local workspace preference, deliberately outside manuscript/history/wire state. */
export const useDocumentWorkspaceMode = create(persist<{
  modes: Record<string, OmiEditorMode>;
  setMode: (documentId: string, mode: OmiEditorMode) => void;
}>((set) => ({
  modes: {},
  setMode: (documentId, mode) => set((state) => ({
    modes: { ...state.modes, [documentId]: mode },
  })),
}), { name: 'omi-document-workspace-modes' }));
