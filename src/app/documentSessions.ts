import { createDocumentSessionManager, type DocumentWorkingSession } from '../services/documentSessionManager';
import { useStudioStore } from './useStudioStore';
import { updateDesktopSessionPersistence, type PersistedDesktopSession } from './lastSessionPersistence';

/** Zustand is only the active-session compatibility adapter. */
export function createStudioDocumentSessions(restored: PersistedDesktopSession | null) {
  return createDocumentSessionManager({
    read: useStudioStore.getState,
    subscribe: useStudioStore.subscribe,
    restore: (session: DocumentWorkingSession) => useStudioStore.getState().resumeDocumentSession(session),
    checkpoint: () => useStudioStore.getState().checkpoint('manual'),
    newId: () => crypto.randomUUID(),
    persist: updateDesktopSessionPersistence,
  }, restored);
}
