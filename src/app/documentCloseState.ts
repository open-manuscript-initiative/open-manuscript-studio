const DOCUMENT_CLOSED_STORAGE_KEY = 'omi:document-closed';

export function isDocumentClosedState(): boolean {
  try {
    return window.localStorage.getItem(DOCUMENT_CLOSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markDocumentClosedState(): void {
  try {
    window.localStorage.setItem(DOCUMENT_CLOSED_STORAGE_KEY, '1');
  } catch {
    // Closing the current in-memory document should still work if storage is unavailable.
  }
}

export function clearDocumentClosedState(): void {
  try {
    window.localStorage.removeItem(DOCUMENT_CLOSED_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage and continue with the current runtime session.
  }
}