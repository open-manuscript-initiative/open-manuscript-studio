import {
  createGraphWorkspace,
  GraphError,
  isGraphWorkspace,
  type GraphWorkspace,
} from './model';

export interface GraphStorage {
  read(key: string): Promise<unknown>;
  write(key: string, workspace: GraphWorkspace): Promise<void>;
}
export interface GraphSnapshot {
  workspace: GraphWorkspace;
  status: 'loading' | 'saving' | 'saved' | 'error';
  canUndo: boolean;
}
/** One store per user/workspace, so both open module views edit the same data. */
export function createGraphStore(storage: GraphStorage) {
  const entries = new Map<
    string,
    {
      snapshot: GraphSnapshot;
      listeners: Set<() => void>;
      history: GraphWorkspace[];
      loaded?: Promise<void>;
      saves: Promise<void>;
      revision: number;
    }
  >();
  const entry = (key: string) => {
    let e = entries.get(key);
    if (!e) {
      e = {
        snapshot: {
          workspace: createGraphWorkspace(),
          status: 'loading',
          canUndo: false,
        },
        listeners: new Set(),
        history: [],
        saves: Promise.resolve(),
        revision: 0,
      };
      entries.set(key, e);
    }
    return e;
  };
  const emit = (key: string) =>
    entry(key).listeners.forEach((listener) => listener());
  const persist = (key: string) => {
    const e = entry(key),
      revision = ++e.revision,
      workspace = e.snapshot.workspace;
    e.snapshot = {
      ...e.snapshot,
      status: 'saving',
      canUndo: e.history.length > 0,
    };
    emit(key);
    e.saves = e.saves
      .catch(() => undefined)
      .then(() => storage.write(key, workspace))
      .then(
        () => {
          if (e.revision === revision) {
            e.snapshot = { ...e.snapshot, status: 'saved' };
            emit(key);
          }
        },
        () => {
          if (e.revision === revision) {
            e.snapshot = { ...e.snapshot, status: 'error' };
            emit(key);
          }
        },
      );
  };
  return {
    snapshot: (key: string): GraphSnapshot => entry(key).snapshot,
    subscribe(key: string, listener: () => void) {
      const e = entry(key);
      e.listeners.add(listener);
      return () => {
        e.listeners.delete(listener);
      };
    },
    load(key: string): Promise<void> {
      const e = entry(key);
      return (e.loaded ??= (async () => {
        try {
          const value = await storage.read(key);
          if (value !== undefined && value !== null && !isGraphWorkspace(value))
            throw new GraphError('invalid');
          e.snapshot = {
            workspace: value
              ? (value as GraphWorkspace)
              : createGraphWorkspace(),
            status: 'saved',
            canUndo: false,
          };
        } catch {
          e.snapshot = { ...e.snapshot, status: 'error' };
        }
        emit(key);
      })());
    },
    update(
      key: string,
      change: GraphWorkspace | ((current: GraphWorkspace) => GraphWorkspace),
    ) {
      const e = entry(key);
      if (e.snapshot.status === 'loading') return;
      const next =
        typeof change === 'function' ? change(e.snapshot.workspace) : change;
      if (!isGraphWorkspace(next)) throw new GraphError('invalid');
      e.history.push(e.snapshot.workspace);
      if (e.history.length > 30) e.history.shift();
      e.snapshot = { ...e.snapshot, workspace: next };
      persist(key);
    },
    undo(key: string) {
      const e = entry(key),
        previous = e.history.pop();
      if (previous) {
        e.snapshot = { ...e.snapshot, workspace: previous };
        persist(key);
      }
    },
    flush: (key: string) => entry(key).saves,
  };
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open('omi-research-graphs', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('workspaces');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database blocked'));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction(
  key: string,
  workspace?: GraphWorkspace,
): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      'workspaces',
      workspace ? 'readwrite' : 'readonly',
    );
    const store = tx.objectStore('workspaces');
    const request = workspace ? store.put(workspace, key) : store.get(key);
    let value: unknown;
    request.onsuccess = () => {
      value = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export const graphStore = createGraphStore({
  read: (key) => transaction(key),
  write: async (key, workspace) => {
    await transaction(key, workspace);
  },
});
