const STORAGE_KEY = 'omi:formatting-toolbar:auto-show';
const DATA_ATTRIBUTE = 'formattingToolbar';
const CHANGE_EVENT = 'omi:formatting-toolbar-preference';

function readPreference(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  } catch {
    return true;
  }
}

function applyPreference(enabled: boolean): void {
  document.documentElement.dataset[DATA_ATTRIBUTE] = enabled ? 'enabled' : 'disabled';
}

export function initializeFormattingToolbarPreference(): void {
  applyPreference(readPreference());
}

export function getFormattingToolbarAutoShow(): boolean {
  return readPreference();
}

export function setFormattingToolbarAutoShow(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The preference still applies for the current session when storage is unavailable.
  }

  applyPreference(enabled);
  window.dispatchEvent(new CustomEvent<boolean>(CHANGE_EVENT, { detail: enabled }));
}

export function subscribeFormattingToolbarPreference(
  listener: (enabled: boolean) => void,
): () => void {
  const handleChange = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
      listener(event.detail);
      return;
    }
    listener(readPreference());
  };

  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}
