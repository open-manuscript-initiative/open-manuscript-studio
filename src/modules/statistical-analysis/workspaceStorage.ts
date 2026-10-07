import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createStatisticalWorkspace, isStatisticalWorkspace, type StatisticalWorkspace } from './model';

const DB_NAME = 'omi-statistical-analysis';
const STORE_NAME = 'workspaces';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open dataset storage'));
  });
}

function transact<T>(key: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Dataset storage request failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Dataset storage transaction aborted'));
    transaction.oncomplete = () => db.close();
  }));
}

type StoredRecord = { key: string; workspace: StatisticalWorkspace };
type PersistedMetadata = Omit<StatisticalWorkspace, 'dataset'> & { dataset: Omit<NonNullable<StatisticalWorkspace['dataset']>, 'rows'> & { rows?: never; storedInIndexedDB?: true } | null };

function readLegacy(key: string): StatisticalWorkspace {
  if (typeof window === 'undefined') return createStatisticalWorkspace();
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (isStatisticalWorkspace(parsed)) return { ...parsed, design: parsed.design ?? createStatisticalWorkspace().design };
  } catch { /* Start with an empty workspace if local metadata is malformed. */ }
  return createStatisticalWorkspace();
}

export function useIndexedStatisticalWorkspace(key: string): [StatisticalWorkspace, Dispatch<SetStateAction<StatisticalWorkspace>>, boolean, string] {
  const [workspace, setWorkspace] = useState<StatisticalWorkspace>(() => readLegacy(key));
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const legacy = readLegacy(key);
      try {
        const stored = await transact<StoredRecord | undefined>(key, 'readonly', store => store.get(key));
        if (cancelled) return;
        if (stored?.workspace) setWorkspace({ ...stored.workspace, design: stored.workspace.design ?? createStatisticalWorkspace().design });
        else if (legacy.dataset?.rows?.length) await transact<IDBValidKey>(key, 'readwrite', store => store.put({ key, workspace: legacy }));
      } catch {
        if (cancelled) return;
        if (legacy.dataset?.rows?.length) setStorageError('IndexedDB unavailable; large datasets may not persist. Export a JSON backup.');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    const save = async () => {
      try {
        await transact<IDBValidKey>(key, 'readwrite', store => store.put({ key, workspace }));
        const metadata: PersistedMetadata = {
          ...workspace,
          dataset: workspace.dataset ? { ...workspace.dataset, rows: undefined, storedInIndexedDB: true } as PersistedMetadata['dataset'] : null,
        };
        window.localStorage.setItem(key, JSON.stringify(metadata));
        setStorageError('');
      } catch {
        try { window.localStorage.setItem(key, JSON.stringify(workspace)); }
        catch { setStorageError('Dataset storage is full or unavailable. Export a JSON backup before leaving this page.'); }
      }
    };
    void save();
  }, [key, ready, workspace]);

  return [workspace, setWorkspace, ready, storageError];
}
