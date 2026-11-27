import { cacheBudgetMiB, editorMemoryPool, MIB, type CacheMode } from '../model/derivedMemoryCache';
import { getStudioPlatform } from '../mobile/platform/platform';
const STORAGE_KEY = 'omi-editor-cache-mode';
let mode: CacheMode = 'balanced';
let ramGiB: number | undefined;
let availableMiB: number | undefined;
let mobile = false;
let hidden = false;
let initialized = false;
let refreshing = false;

function applyBudget(): void {
  editorMemoryPool.setBudget(hidden ? 0 : cacheBudgetMiB(ramGiB, mobile, mode, availableMiB) * MIB);
}
export function getEditorCacheMode(): CacheMode { return mode; }
export function setEditorCacheMode(value: CacheMode): void {
  mode = value;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* optional preference storage */ }
  applyBudget();
}
export function getEditorCacheDiagnostics() {
  return { mode, ramGiB, availableMiB, budgetMiB: editorMemoryPool.budgetBytes / MIB,
    estimatedMiB: editorMemoryPool.estimatedBytes / MIB, entries: editorMemoryPool.size,
    hits: editorMemoryPool.hits, misses: editorMemoryPool.misses };
}
async function refreshAndroidMemory(): Promise<void> {
  if (hidden || refreshing || getStudioPlatform() !== 'android') return;
  refreshing = true;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const memory = await invoke<{ total_mib: number | null; available_mib: number | null }>('editor_memory_info');
    if (memory.total_mib && memory.total_mib > 0) ramGiB = memory.total_mib / 1024;
    availableMiB = memory.available_mib ?? undefined;
    if (!hidden) applyBudget();
  } catch { /* Older native shells use conservative browser estimates. */ }
  finally { refreshing = false; }
}
export function initializeEditorMemoryPreferences(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const platform = getStudioPlatform();
  mobile = platform === 'android' || platform === 'ios' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const reported = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  ramGiB = typeof reported === 'number' && reported > 0 ? reported : undefined;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'economy' || stored === 'balanced' || stored === 'performance') mode = stored;
  } catch { /* optional preference storage */ }
  const visibility = () => {
    hidden = document.visibilityState === 'hidden';
    if (hidden) editorMemoryPool.clear();
    applyBudget();
    if (!hidden) void refreshAndroidMemory();
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', () => {
    hidden = true;
    editorMemoryPool.clear();
    applyBudget();
  });
  window.addEventListener('pageshow', visibility);
  visibility();
  if (platform === 'android') window.setInterval(() => { void refreshAndroidMemory(); }, 30000);
}
