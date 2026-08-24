import { useStudioStore } from './useStudioStore';
import type { OmiManuscript } from '../types/omi';

const DB_NAME = 'omi-studio-session';
const DB_VERSION = 1;
const STORE_NAME = 'session';
const SESSION_KEY = 'last-session';
const SAVE_DELAY_MS = 250;

export interface PersistedDesktopTabSession {
  id: string;
  manuscriptId: string;
  title: string;
  manuscript: OmiManuscript;
}

export interface PersistedDesktopSession {
  tabs: PersistedDesktopTabSession[];
  activeTabId: string;
}

interface PersistedStudioSessionV1 {
  version: 1;
  manuscript: OmiManuscript;
  selectedSectionId: string | null;
  savedAt: string;
}

interface PersistedStudioSessionV2 {
  version: 2;
  manuscript: OmiManuscript;
  selectedSectionId: string | null;
  desktopSession: PersistedDesktopSession | null;
  savedAt: string;
}

type PersistedStudioSession = PersistedStudioSessionV1 | PersistedStudioSessionV2;

let databasePromise: Promise<IDBDatabase> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistenceStarted = false;
let restoredDesktopSession: PersistedDesktopSession | null = null;
let currentDesktopSession: PersistedDesktopSession | null = null;

export async function initializeLastSessionPersistence(): Promise<void> {
  if (persistenceStarted || typeof indexedDB === 'undefined') return;
  persistenceStarted = true;

  const restored = await readLastSession().catch(() => null);
  if (restored?.manuscript) {
    const desktopSession = restored.version === 2
      ? normalizeDesktopSession(restored.desktopSession)
      : null;

    restoredDesktopSession = desktopSession;
    currentDesktopSession = desktopSession;

    const activeDesktopManuscript = desktopSession
      ? desktopSession.tabs.find((tab) => tab.id === desktopSession.activeTabId)?.manuscript
      : undefined;
    const manuscript = activeDesktopManuscript ?? restored.manuscript;

    const store = useStudioStore.getState();
    store.loadManuscript(manuscript);

    if (
      restored.selectedSectionId &&
      manuscript.sections.some(
        (section) => section.id === restored.selectedSectionId,
      )
    ) {
      useStudioStore.getState().selectSection(restored.selectedSectionId);
    }
  }

  useStudioStore.subscribe((state, previousState) => {
    if (
      state.manuscript === previousState.manuscript &&
      state.selectedSectionId === previousState.selectedSectionId
    ) {
      return;
    }

    if (currentDesktopSession) {
      currentDesktopSession = {
        ...currentDesktopSession,
        tabs: currentDesktopSession.tabs.map((tab) =>
          tab.id === currentDesktopSession?.activeTabId
            ? {
                ...tab,
                manuscriptId: state.manuscript.id,
                title: state.manuscript.title?.trim() || 'Untitled manuscript',
                manuscript: state.manuscript,
              }
            : tab,
        ),
      };
    }

    scheduleSave();
  });

  window.addEventListener('pagehide', saveCurrentSession);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentSession();
  });

  scheduleSave();
}

export function getRestoredDesktopSession(): PersistedDesktopSession | null {
  return restoredDesktopSession
    ? structuredClone(restoredDesktopSession)
    : null;
}

export function updateDesktopSessionPersistence(
  session: PersistedDesktopSession | null,
): void {
  currentDesktopSession = normalizeDesktopSession(session);
  scheduleSave();
}

function normalizeDesktopSession(
  session: PersistedDesktopSession | null | undefined,
): PersistedDesktopSession | null {
  if (!session || session.tabs.length === 0) return null;

  const tabs = session.tabs.filter(
    (tab) => Boolean(tab?.id && tab?.manuscript?.id),
  );
  if (tabs.length === 0) return null;

  const activeTabId = tabs.some((tab) => tab.id === session.activeTabId)
    ? session.activeTabId
    : tabs[0]?.id;
  if (!activeTabId) return null;

  return {
    tabs,
    activeTabId,
  };
}

function scheduleSave(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveCurrentSession();
  }, SAVE_DELAY_MS);
}

function saveCurrentSession(): void {
  const state = useStudioStore.getState();
  const session: PersistedStudioSessionV2 = {
    version: 2,
    manuscript: state.manuscript,
    selectedSectionId: state.selectedSectionId,
    desktopSession: currentDesktopSession,
    savedAt: new Date().toISOString(),
  };

  void writeLastSession(session).catch((error) => {
    console.warn('Unable to persist the last Studio session.', error);
  });
}

async function readLastSession(): Promise<PersistedStudioSession | null> {
  const database = await openDatabase();

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(SESSION_KEY);

    request.onsuccess = () => {
      const value = request.result as PersistedStudioSession | undefined;
      resolve(value?.version === 1 || value?.version === 2 ? value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function writeLastSession(session: PersistedStudioSessionV2): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(session, SESSION_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}