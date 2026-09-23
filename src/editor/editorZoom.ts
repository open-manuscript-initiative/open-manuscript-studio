export const EDITOR_ZOOM_STORAGE_KEY = 'omi:editor-zoom';
export const EDITOR_ZOOM_EVENT = 'omi:editor-zoom-change';
export const MIN_EDITOR_ZOOM = 50;
export const MAX_EDITOR_ZOOM = 200;
export const EDITOR_ZOOM_STEP = 10;

export function clampEditorZoom(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(
    MAX_EDITOR_ZOOM,
    Math.max(
      MIN_EDITOR_ZOOM,
      Math.round(value / EDITOR_ZOOM_STEP) * EDITOR_ZOOM_STEP,
    ),
  );
}

export function readStoredEditorZoom(): number {
  if (typeof window === 'undefined') return 100;
  try {
    return clampEditorZoom(
      Number(window.localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY) ?? 100),
    );
  } catch {
    return 100;
  }
}

export function editorZoomScale(percent: number): number {
  return clampEditorZoom(percent) / 100;
}

export function dispatchEditorZoomChange(percent: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<number>(EDITOR_ZOOM_EVENT, {
    detail: clampEditorZoom(percent),
  }));
}

export function editorZoomFromEvent(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null;
  const value = Number(event.detail);
  return Number.isFinite(value) ? clampEditorZoom(value) : null;
}
