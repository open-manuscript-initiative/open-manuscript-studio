import { createGraphWorkspace, GraphError, isGraphWorkspace, type GraphWorkspace } from './model';
import { createResearchProjectFile, researchProjectGraph, validateResearchProject, type ResearchProjectFile } from './projectFile';

export interface GraphStorage {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}
export interface GraphSnapshot {
  workspace: GraphWorkspace;
  project: ResearchProjectFile;
  status: 'loading' | 'saving' | 'saved' | 'error';
  canUndo: boolean;
}
const bindingKey = (key: string) => `${key}:project-binding-v1`;
const projectKey = (key: string, projectId: string) => `${key}:project-v1:${encodeURIComponent(projectId)}`;
/** Account/workspace scopes access to a selected project; project-ID keys own cached package data. */
export function createGraphStore(storage: GraphStorage) {
  const entries = new Map<string, { snapshot: GraphSnapshot; listeners: Set<() => void>;
    history: GraphSnapshot[]; loaded?: Promise<void>; saves: Promise<void>; revision: number }>();
  const entry = (key: string) => {
    let e = entries.get(key);
    if (!e) {
      const workspace = createGraphWorkspace();
      e = { snapshot: { workspace, project: createResearchProjectFile(workspace), status: 'loading', canUndo: false },
        listeners: new Set(), history: [], saves: Promise.resolve(), revision: 0 };
      entries.set(key, e);
    }
    return e;
  };
  const emit = (key: string) => entry(key).listeners.forEach(listener => listener());
  const persist = (key: string) => {
    const e = entry(key), revision = ++e.revision, project = structuredClone(e.snapshot.project);
    e.snapshot = { ...e.snapshot, status: 'saving', canUndo: e.history.length > 0 }; emit(key);
    e.saves = e.saves.catch(() => undefined).then(async () => {
      // Keep the old binding until the complete project cache write succeeds.
      await storage.write(projectKey(key, project.projectId), project);
      await storage.write(bindingKey(key), { format: 'studio-research-project-binding', version: 1, projectId: project.projectId });
    }).then(() => {
      if (e.revision === revision) { e.snapshot = { ...e.snapshot, status: 'saved' }; emit(key); }
    }, () => {
      if (e.revision === revision) { e.snapshot = { ...e.snapshot, status: 'error' }; emit(key); }
    });
  };
  function setProject(key: string, project: ResearchProjectFile) {
    const e = entry(key);
    if (e.snapshot.status === 'loading') return;
    const workspace = researchProjectGraph(project);
    e.history.push(e.snapshot); if (e.history.length > 30) e.history.shift();
    e.snapshot = { ...e.snapshot, workspace, project: structuredClone(project) }; persist(key);
  }
  return {
    snapshot: (key: string): GraphSnapshot => entry(key).snapshot,
    subscribe(key: string, listener: () => void) { const e = entry(key); e.listeners.add(listener); return () => { e.listeners.delete(listener); }; },
    load(key: string): Promise<void> {
      const e = entry(key);
      return (e.loaded ??= (async () => {
        try {
          const binding = await storage.read(bindingKey(key));
          let project: ResearchProjectFile;
          if (binding !== undefined && binding !== null) {
            if (typeof binding !== 'object' || !('format' in binding) || binding.format !== 'studio-research-project-binding'
              || !('version' in binding) || binding.version !== 1 || !('projectId' in binding) || typeof binding.projectId !== 'string'
              || !binding.projectId || binding.projectId.length > 256) throw new GraphError('invalid');
            const value = await storage.read(projectKey(key, binding.projectId));
            validateResearchProject(value);
            if (value.projectId !== binding.projectId) throw new GraphError('invalid');
            project = value;
          } else {
            const value = await storage.read(key);
            if (value !== undefined && value !== null && !isGraphWorkspace(value)) throw new GraphError('invalid');
            // Reading never overwrites legacy storage. A subsequent confirmed edit/open writes separate project keys.
            project = createResearchProjectFile(value ? value as GraphWorkspace : e.snapshot.workspace);
          }
          e.snapshot = { workspace: researchProjectGraph(project), project: structuredClone(project), status: 'saved', canUndo: false };
        } catch { e.snapshot = { ...e.snapshot, status: 'error' }; }
        emit(key);
      })());
    },
    update(key: string, change: GraphWorkspace | ((current: GraphWorkspace) => GraphWorkspace)) {
      const e = entry(key); if (e.snapshot.status === 'loading') return;
      const next = typeof change === 'function' ? change(e.snapshot.workspace) : change;
      if (!isGraphWorkspace(next)) throw new GraphError('invalid');
      setProject(key, createResearchProjectFile(next, new Date().toISOString(), e.snapshot.project));
    },
    openProject: setProject,
    undo(key: string) {
      const e = entry(key), previous = e.history.pop();
      if (previous) { e.snapshot = { ...previous, canUndo: e.history.length > 0 }; persist(key); }
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
  workspace?: unknown,
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
