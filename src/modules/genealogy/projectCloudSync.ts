import { isNativeStudio } from '../../services/nativeManuscriptFile';
import { sha256Hex } from '../../model/assets';
import { graphStore } from './workspaceStore';
import { parseResearchProjectFile, type ResearchProjectFile } from './projectFile';

export type ProjectCloudSyncStatus =
  | 'disconnected'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'permission'
  | 'error';

export interface ProjectCloudSyncSnapshot {
  status: ProjectCloudSyncStatus;
  fileName: string;
  remote?: ResearchProjectFile;
  error?: string;
}

interface BrowserFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(value: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

type SyncTarget =
  | { kind: 'native'; uri: string; fileName: string }
  | { kind: 'browser'; handle: BrowserFileHandle; fileName: string };

interface StoredTarget {
  target: SyncTarget;
  baseDigest: string;
  projectId: string;
}

interface Manager {
  key: string;
  listeners: Set<() => void>;
  snapshot: ProjectCloudSyncSnapshot;
  stored?: StoredTarget;
  baseDigest: string;
  remoteDigest?: string;
  timer?: ReturnType<typeof setTimeout>;
  poll?: ReturnType<typeof setInterval>;
  refs: number;
  stopStore?: () => void;
  busy: boolean;
}

const managers = new Map<string, Manager>();
const syncTargetKey = (key: string) => `genealogy-cloud-sync:${key}`;

function manager(key: string): Manager {
  let value = managers.get(key);
  if (!value) {
    value = {
      key,
      listeners: new Set(),
      snapshot: { status: 'disconnected', fileName: '' },
      baseDigest: '',
      refs: 0,
      busy: false,
    };
    managers.set(key, value);
  }
  return value;
}

function publish(value: Manager, snapshot: ProjectCloudSyncSnapshot): void {
  value.snapshot = snapshot;
  value.listeners.forEach((listener) => listener());
}

export function getProjectCloudSyncSnapshot(key: string): ProjectCloudSyncSnapshot {
  return manager(key).snapshot;
}

export function subscribeProjectCloudSync(key: string, listener: () => void): () => void {
  const value = manager(key);
  value.listeners.add(listener);
  return () => value.listeners.delete(listener);
}

export function startProjectCloudSync(key: string): () => void {
  const value = manager(key);
  value.refs += 1;
  if (value.refs === 1) void restore(value);
  return () => {
    value.refs = Math.max(0, value.refs - 1);
    if (!value.refs) {
      if (value.timer) clearTimeout(value.timer);
      if (value.poll) clearInterval(value.poll);
      value.stopStore?.();
      value.stopStore = undefined;
    }
  };
}

export async function createSyncedProjectFile(
  key: string,
  project: ResearchProjectFile,
  confirmOverwrite?: () => boolean,
): Promise<boolean> {
  const target = await pickTarget('create');
  if (!target) return false;
  let prior = '';
  try {
    prior = await readTarget(target);
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
  if (prior.trim()) {
    // A selected existing file is never silently replaced. The caller may
    // retry after the user explicitly confirms the overwrite.
    const existing = parseResearchProjectFile(prior);
    if ((existing.projectId !== project.projectId || await digestProject(existing) !== await digestProject(project))
      && !confirmOverwrite?.()) return false;
  }
  await writeTarget(target, serialize(project));
  const verified = parseResearchProjectFile(await readTarget(target));
  const baseDigest = await digestProject(project);
  if (await digestProject(verified) !== baseDigest)
    throw new Error('The cloud file did not retain the saved project data.');
  const stored = { target, baseDigest, projectId: project.projectId };
  await saveStoredTarget(key, stored);
  attach(manager(key), stored);
  return true;
}

export async function connectSyncedProjectFile(
  key: string,
  acceptReplace?: (project: ResearchProjectFile) => boolean,
): Promise<ResearchProjectFile | null> {
  const target = await pickTarget('open');
  if (!target) return null;
  const raw = await readTarget(target);
  const project = parseResearchProjectFile(raw);
  const baseDigest = await digestProject(project);
  const local = graphStore.snapshot(key).project;
  if (await digestProject(local) !== baseDigest && acceptReplace && !acceptReplace(project))
    return null;
  const stored = { target, baseDigest, projectId: project.projectId };
  await saveStoredTarget(key, stored);
  attach(manager(key), stored);
  return project;
}

export async function resolveProjectCloudConflict(
  key: string,
  resolution: 'remote' | 'local',
): Promise<void> {
  const value = manager(key);
  if (value.snapshot.status !== 'conflict' || !value.snapshot.remote || !value.stored || !value.remoteDigest)
    return;
  value.busy = true;
  try {
    const latest = parseResearchProjectFile(await readTarget(value.stored.target));
    const latestDigest = await digestProject(latest);
    if (latestDigest !== value.remoteDigest) {
      value.remoteDigest = latestDigest;
      publish(value, { status: 'conflict', fileName: value.stored.target.fileName, remote: latest, error: 'The cloud project changed again. Review the new version before resolving this conflict.' });
      return;
    }
    if (resolution === 'remote') {
      value.baseDigest = latestDigest;
      value.stored.projectId = latest.projectId;
      await saveStoredTarget(key, { ...value.stored, baseDigest: latestDigest });
      graphStore.openProject(key, latest);
      publish(value, { status: 'synced', fileName: value.stored.target.fileName });
      return;
    }
    value.baseDigest = latestDigest;
    await writeWorkspace(value, graphStore.snapshot(key).project, true);
  } catch (error) {
    publish(value, { status: 'error', fileName: value.stored.target.fileName, error: errorText(error) });
  } finally {
    value.busy = false;
  }
}

export async function reauthorizeProjectCloudFile(key: string): Promise<void> {
  const value = manager(key);
  const target = value.stored?.target ?? (await loadStoredTarget(key))?.target;
  if (!target || target.kind !== 'browser') return;
  const permission = await target.handle.requestPermission?.({ mode: 'readwrite' });
  if (permission !== 'granted') {
    publish(value, { status: 'permission', fileName: target.fileName });
    return;
  }
  await restore(value);
}

export async function disconnectProjectCloudSync(key: string): Promise<void> {
  const value = manager(key);
  if (value.busy) throw new Error('Wait for the current cloud synchronization to finish before disconnecting.');
  if (value.timer) clearTimeout(value.timer);
  await graphStore.flush(key);
  if (value.stored && value.snapshot.status !== 'conflict') await syncLocal(value);
  if (value.snapshot.status === 'conflict') return;
  if (value.snapshot.status === 'error') throw new Error(value.snapshot.error || 'Cloud synchronization failed.');
  if (value.timer) clearTimeout(value.timer);
  if (value.poll) clearInterval(value.poll);
  value.stopStore?.();
  value.stopStore = undefined;
  value.stored = undefined;
  value.baseDigest = '';
  await removeStoredTarget(key);
  publish(value, { status: 'disconnected', fileName: '' });
}

async function restore(value: Manager): Promise<void> {
  try {
    await graphStore.load(value.key);
    const stored = await loadStoredTarget(value.key);
    if (!stored) {
      publish(value, { status: 'disconnected', fileName: '' });
      return;
    }
    if (!(await hasReadWritePermission(stored.target))) {
      value.stored = stored;
      value.baseDigest = stored.baseDigest;
      publish(value, { status: 'permission', fileName: stored.target.fileName });
      return;
    }
    attach(value, stored);
    const remote = parseResearchProjectFile(await readTarget(stored.target));
    const remoteDigest = await digestProject(remote);
    const local = graphStore.snapshot(value.key).project;
    const localDigest = await digestProject(local);
    if (remote.projectId !== stored.projectId || local.projectId !== stored.projectId) {
      value.remoteDigest = remoteDigest;
      publish(value, { status: 'conflict', fileName: stored.target.fileName, remote });
      return;
    }
    if (remoteDigest === stored.baseDigest) {
      if (localDigest !== stored.baseDigest) await writeWorkspace(value, local);
      else publish(value, { status: 'synced', fileName: stored.target.fileName });
    } else if (localDigest === stored.baseDigest || localDigest === remoteDigest) {
      value.baseDigest = remoteDigest;
      await saveStoredTarget(value.key, {
        target: stored.target,
        baseDigest: remoteDigest,
        projectId: stored.projectId,
      });
      if (localDigest !== remoteDigest) graphStore.openProject(value.key, remote);
      publish(value, { status: 'synced', fileName: stored.target.fileName });
    } else {
      value.remoteDigest = remoteDigest;
      publish(value, { status: 'conflict', fileName: stored.target.fileName, remote });
    }
  } catch (error) {
    publish(value, { status: 'error', fileName: value.stored?.target.fileName ?? '', error: errorText(error) });
  }
}

function attach(value: Manager, stored: StoredTarget): void {
  value.stored = stored;
  value.baseDigest = stored.baseDigest;
  value.remoteDigest = undefined;
  publish(value, { status: 'synced', fileName: stored.target.fileName });
  value.stopStore?.();
  value.stopStore = value.refs
    ? graphStore.subscribe(value.key, () => scheduleWrite(value))
    : undefined;
  if (value.poll) clearInterval(value.poll);
  value.poll = value.refs ? setInterval(() => void pollRemote(value), 3000) : undefined;
}

function scheduleWrite(value: Manager): void {
  if (!value.stored || value.snapshot.status === 'conflict') return;
  if (value.timer) clearTimeout(value.timer);
  value.timer = setTimeout(() => void syncLocal(value), 900);
}

async function syncLocal(value: Manager): Promise<void> {
  if (!value.stored || value.busy || value.snapshot.status === 'conflict') return;
  value.busy = true;
  try {
    await graphStore.flush(value.key);
    const project = graphStore.snapshot(value.key).project;
    const localDigest = await digestProject(project);
    if (localDigest === value.baseDigest) return;
    publish(value, { status: 'syncing', fileName: value.stored.target.fileName });
    const remote = parseResearchProjectFile(await readTarget(value.stored.target));
    const remoteDigest = await digestProject(remote);
    if (project.projectId !== value.stored.projectId || remote.projectId !== value.stored.projectId || (remoteDigest !== value.baseDigest && remoteDigest !== localDigest)) {
      value.remoteDigest = remoteDigest;
      publish(value, { status: 'conflict', fileName: value.stored.target.fileName, remote });
      return;
    }
    if (remoteDigest !== localDigest) await writeTarget(value.stored.target, serialize(project));
    const verified = parseResearchProjectFile(await readTarget(value.stored.target));
    const verifiedDigest = await digestProject(verified);
    if (verifiedDigest !== localDigest) {
      value.remoteDigest = verifiedDigest;
      publish(value, { status: 'conflict', fileName: value.stored.target.fileName, remote: verified, error: 'The cloud file changed during the save. Choose which version to keep.' });
      return;
    }
    value.baseDigest = localDigest;
    value.stored.baseDigest = localDigest;
    value.stored.projectId = project.projectId;
    await saveStoredTarget(value.key, value.stored);
    publish(value, { status: 'synced', fileName: value.stored.target.fileName });
  } catch (error) {
    publish(value, { status: 'error', fileName: value.stored?.target.fileName ?? '', error: errorText(error) });
  } finally {
    value.busy = false;
    // A local edit can arrive while a write is in progress. Its store event
    // cannot start a second writer while `busy` is true, so check once more.
    if (value.snapshot.status !== 'conflict' && value.snapshot.status !== 'error') {
      const localDigest = await digestProject(graphStore.snapshot(value.key).project);
      if (localDigest !== value.baseDigest) scheduleWrite(value);
    }
  }
}

async function pollRemote(value: Manager): Promise<void> {
  if (!value.stored || value.busy || value.snapshot.status === 'permission') return;
  value.busy = true;
  try {
    if (!(await hasReadWritePermission(value.stored.target))) {
      publish(value, { status: 'permission', fileName: value.stored.target.fileName });
      return;
    }
    const remote = parseResearchProjectFile(await readTarget(value.stored.target));
    const remoteDigest = await digestProject(remote);
    if (remote.projectId !== value.stored.projectId) {
      value.remoteDigest = remoteDigest;
      publish(value, { status: 'conflict', fileName: value.stored.target.fileName, remote });
      return;
    }
    if (remoteDigest === value.baseDigest) {
      if (value.snapshot.status === 'error')
        publish(value, { status: 'synced', fileName: value.stored.target.fileName });
      return;
    }
    const local = graphStore.snapshot(value.key).project;
    const localDigest = await digestProject(local);
    if (localDigest === value.baseDigest || localDigest === remoteDigest) {
      value.baseDigest = remoteDigest;
      value.stored.baseDigest = remoteDigest;
      await saveStoredTarget(value.key, value.stored);
      if (localDigest !== remoteDigest) graphStore.openProject(value.key, remote);
      publish(value, { status: 'synced', fileName: value.stored.target.fileName });
    } else {
      value.remoteDigest = remoteDigest;
      publish(value, { status: 'conflict', fileName: value.stored.target.fileName, remote });
    }
  } catch (error) {
    publish(value, { status: 'error', fileName: value.stored?.target.fileName ?? '', error: errorText(error) });
  } finally {
    value.busy = false;
    // A local edit can arrive during the remote poll and its store event will
    // have been ignored while busy. Start a write after the poll releases.
    if (value.snapshot.status !== 'conflict' && value.snapshot.status !== 'error') {
      const localDigest = await digestProject(graphStore.snapshot(value.key).project);
      if (localDigest !== value.baseDigest) scheduleWrite(value);
    }
  }
}

async function writeWorkspace(
  value: Manager,
  project: ResearchProjectFile,
  allowProjectReplacement = false,
): Promise<void> {
  if (!value.stored) return;
  const currentRemote = parseResearchProjectFile(await readTarget(value.stored.target));
  const currentDigest = await digestProject(currentRemote);
  const localDigest = await digestProject(project);
  if ((currentDigest !== value.baseDigest && currentDigest !== localDigest)
    || (!allowProjectReplacement && (project.projectId !== value.stored.projectId || currentRemote.projectId !== value.stored.projectId))) {
    value.remoteDigest = currentDigest;
    publish(value, { status: 'conflict', fileName: value.stored.target.fileName, remote: currentRemote });
    return;
  }
  publish(value, { status: 'syncing', fileName: value.stored.target.fileName });
  await writeTarget(value.stored.target, serialize(project));
  const remote = parseResearchProjectFile(await readTarget(value.stored.target));
  const digest = await digestProject(remote);
  if (digest !== localDigest) {
    value.remoteDigest = digest;
    publish(value, { status: 'conflict', fileName: value.stored.target.fileName, remote, error: 'The cloud file changed during the save. Choose which version to keep.' });
    return;
  }
  value.baseDigest = digest;
  value.stored.baseDigest = digest;
  value.stored.projectId = project.projectId;
  await saveStoredTarget(value.key, value.stored);
  publish(value, { status: 'synced', fileName: value.stored.target.fileName });
}

async function pickTarget(mode: 'open' | 'create'): Promise<SyncTarget | null> {
  if (isNativeStudio()) {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const filters = [{ name: 'OMI research project', extensions: isMobile() ? ['*/*'] : ['json'] }];
    const selected = mode === 'open'
      ? await dialog.open({ multiple: false, directory: false, filters, ...(isMobile() ? { pickerMode: 'document' as const } : {}) })
      : await dialog.save({ defaultPath: 'research-project.omi-research.json', filters });
    if (!selected || Array.isArray(selected)) return null;
    return { kind: 'native', uri: selected, fileName: isMobile() ? 'OMI research project' : selected.split(/[\\/]/).pop() || 'research-project.json' };
  }
  const picker = globalThis as typeof globalThis & {
    showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<BrowserFileHandle>;
  };
  const types = [{ description: 'OMI research project', accept: { 'application/json': ['.omi-research.json', '.json'] } }];
  if (mode === 'open' && picker.showOpenFilePicker) {
    const [handle] = await picker.showOpenFilePicker({ multiple: false, types });
    return handle ? { kind: 'browser', handle, fileName: handle.name } : null;
  }
  if (mode === 'create' && picker.showSaveFilePicker) {
    const handle = await picker.showSaveFilePicker({ suggestedName: 'research-project.omi-research.json', types });
    return { kind: 'browser', handle, fileName: handle.name };
  }
  throw new Error('This browser cannot keep a writable cloud-file connection. Use the installed Studio app or a browser with file-system access support.');
}

async function readTarget(target: SyncTarget): Promise<string> {
  let text: string;
  if (target.kind === 'native') {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const bytes = await readFile(target.uri);
    if (bytes.byteLength > 64 * 1024 * 1024) throw new Error('The cloud project exceeds the supported size limit.');
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } else {
    const file = await target.handle.getFile();
    if (file.size > 64 * 1024 * 1024) throw new Error('The cloud project exceeds the supported size limit.');
    text = await file.text();
  }
  return text;
}

async function writeTarget(target: SyncTarget, text: string): Promise<void> {
  if (target.kind === 'native') {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(target.uri, text);
    return;
  }
  const writable = await target.handle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function hasReadWritePermission(target: SyncTarget): Promise<boolean> {
  if (target.kind === 'native') return true;
  const state = await target.handle.queryPermission?.({ mode: 'readwrite' });
  return state === undefined || state === 'granted';
}

async function digestProject(project: ResearchProjectFile): Promise<string> {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(project)));
}

function serialize(project: ResearchProjectFile): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

async function saveStoredTarget(key: string, value: StoredTarget): Promise<void> {
  await syncTargetTransaction(syncTargetKey(key), value);
}

async function loadStoredTarget(key: string): Promise<StoredTarget | null> {
  return await syncTargetTransaction(syncTargetKey(key)) as StoredTarget | undefined ?? null;
}

async function removeStoredTarget(key: string): Promise<void> {
  await syncTargetTransaction(syncTargetKey(key), undefined, true);
}

async function syncTargetTransaction(key: string, value?: StoredTarget, remove = false): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    // Keep sync handles in their own database: graphStore opens its cache at
    // version 1, so upgrading that shared database would make older clients fail.
    const request = indexedDB.open('omi-research-project-sync', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('targets')) request.result.createObjectStore('targets');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction('targets', value || remove ? 'readwrite' : 'readonly');
    const store = tx.objectStore('targets');
    const request = remove ? store.delete(key) : value ? store.put(value, key) : store.get(key);
    let result: unknown;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(globalThis.navigator?.userAgent ?? '');
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Cloud project synchronization failed.';
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && /(?:not found|no such file|os error 2)/i.test(error.message);
}
