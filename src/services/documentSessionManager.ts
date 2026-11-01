import type { OmiManuscript } from '../types/omi';
import type { OmiPendingChangeSet } from '../model/workingState';
import type { ProofingSelection } from '../model/proofing';

/** Runtime/recovery state only. Never added to the portable manuscript. */
export interface DocumentWorkingSession {
  manuscript: OmiManuscript;
  pendingChangeSet: OmiPendingChangeSet | null;
  selectedSectionId: string | null;
  currentStudyNotesVisible: boolean;
  proofingPanelOpen: boolean;
  activeProofingChangeId: string | null;
  proofingSelection: ProofingSelection | null;
}
export interface DocumentSession extends DocumentWorkingSession {
  id: string;
  manuscriptId: string;
  title: string;
}
export interface DocumentSessions { tabs: DocumentSession[]; activeTabId: string }
export interface DocumentSessionPort {
  read(): DocumentWorkingSession & { hasOpenDocument: boolean };
  restore(session: DocumentWorkingSession): void;
  checkpoint(): void;
  subscribe(listener: (state: ReturnType<DocumentSessionPort['read']>, previous: ReturnType<DocumentSessionPort['read']>) => void): () => void;
  newId(): string;
  persist?(snapshot: DocumentSessions): void;
}
export function workingSession(state: DocumentWorkingSession): DocumentWorkingSession {
  const { manuscript, pendingChangeSet, selectedSectionId, currentStudyNotesVisible,
    proofingPanelOpen, activeProofingChangeId, proofingSelection } = state;
  return { manuscript, pendingChangeSet, selectedSectionId, currentStudyNotesVisible,
    proofingPanelOpen, activeProofingChangeId, proofingSelection };
}
export function restoredWorkingSession(manuscript: OmiManuscript, state: Partial<DocumentWorkingSession> = {}): DocumentWorkingSession {
  return { manuscript, pendingChangeSet: null, selectedSectionId: manuscript.sections[0]?.id ?? null,
    currentStudyNotesVisible: false, proofingPanelOpen: false, activeProofingChangeId: null,
    proofingSelection: null, ...state };
}

/** Application ownership, synchronous even when React batches several opens. */
export function createDocumentSessionManager(port: DocumentSessionPort, restored?: {
  tabs: Array<{ id: string; manuscript: OmiManuscript } & Partial<DocumentWorkingSession>>;
  activeTabId: string;
} | null) {
  const entry = (id: string, state: DocumentWorkingSession): DocumentSession => ({
    ...workingSession(state), id, manuscriptId: state.manuscript.id,
    title: state.manuscript.title?.trim() || 'Untitled manuscript',
  });
  let snapshot: DocumentSessions = {
    tabs: restored?.tabs.map(tab => entry(tab.id, restoredWorkingSession(tab.manuscript, tab))) ?? [],
    activeTabId: restored?.activeTabId ?? '',
  };
  const listeners = new Set<() => void>();
  let transitioning = false;
  const publish = () => {
    port.persist?.(snapshot); // recovery must not wait for a React render/effect
    for (const listener of listeners) listener();
  };
  const capture = (state: DocumentWorkingSession) => {
    const existing = snapshot.tabs.find(tab => tab.manuscriptId === state.manuscript.id);
    const next = entry(existing?.id ?? port.newId(), state);
    snapshot = { tabs: existing ? snapshot.tabs.map(tab => tab.id === next.id ? next : tab) : [...snapshot.tabs, next], activeTabId: next.id };
  };
  if (port.read().hasOpenDocument) capture(port.read());
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect() {
      port.persist?.(snapshot);
      return port.subscribe((state, previous) => {
        if (transitioning || !state.hasOpenDocument) return;
        // A new open resets the singleton store: capture the outgoing pending
        // batch before replacing its projection, even if no checkpoint ran.
        if (previous.hasOpenDocument && previous.manuscript.id !== state.manuscript.id) capture(previous);
        capture(state);
        publish();
      });
    },
    activate(id: string) {
      if (id === snapshot.activeTabId) return;
      if (!snapshot.tabs.some(tab => tab.id === id)) return;
      port.checkpoint(); // existing immutable revision semantics
      capture(port.read());
      const target = snapshot.tabs.find(tab => tab.id === id)!;
      transitioning = true;
      try { port.restore(target); } finally { transitioning = false; }
      snapshot = { ...snapshot, activeTabId: id };
      publish();
    },
    close(id: string) {
      if (snapshot.tabs.length <= 1 || !snapshot.tabs.some(tab => tab.id === id)) return;
      if (id === snapshot.activeTabId) {
        port.checkpoint();
        const index = snapshot.tabs.findIndex(tab => tab.id === id);
        const tabs = snapshot.tabs.filter(tab => tab.id !== id);
        const next = tabs[Math.min(index, tabs.length - 1)]!;
        transitioning = true;
        try { port.restore(next); } finally { transitioning = false; }
        snapshot = { tabs, activeTabId: next.id };
      } else snapshot = { ...snapshot, tabs: snapshot.tabs.filter(tab => tab.id !== id) };
      publish();
    },
  };
}
