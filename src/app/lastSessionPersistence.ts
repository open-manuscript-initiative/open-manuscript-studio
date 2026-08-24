import { useStudioStore } from './useStudioStore';
import type { OmiManuscript } from '../types/omi';

const DB_NAME = 'omi-studio-session';
const DB_VERSION = 1;
const STORE_NAME = 'session';
const SESSION_KEY = 'last-session';
const SAVE_DELAY_MS = 250;

interface PersistedStudioSession {
  version: 1;
  manuscript: OmiManuscript;
  selectedSectionId: string | null;
  savedAt: string;
}

let databasePromise: Promise<IDBDatabase> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistenceStarted = false;

export async function initializeLastSessionPersistence(): Promise<void> {
  if (persistenceStarted || typeof indexedDB === 'undefined') return;
  persistenceStarted = true;

  const restored = await readLastSession().catch(() => null);
  if (restored?.manuscript) {
    const store = useStudioStore.getState();
    store.loadManuscript(restored.manuscript);

    if (
      restored.selectedSectionId &&
      restored.manuscript.sections.some(
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

    scheduleSave();
  });

  window.addEventListener('pagehide', saveCurrentSession);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentSession();
  });

  scheduleSave();
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
  const session: PersistedStudioSession = {
    version: 1,
    manuscript: state.manuscript,
    selectedSectionId: state.selectedSectionId,
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
      resolve(value?.version === 1 ? value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function writeLastSession(session: PersistedStudioSession): Promise<void> {
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
