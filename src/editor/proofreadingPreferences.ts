import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'omi:proofreading-preferences';

export interface ProofreadingPreferences {
  spellcheckEnabled: boolean;
  languageCheckEnabled: boolean;
}

const DEFAULTS: ProofreadingPreferences = {
  spellcheckEnabled: true,
  languageCheckEnabled: false,
};

let current = readPreferences();
const listeners = new Set<() => void>();

function readPreferences(): ProofreadingPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ProofreadingPreferences>;
    return {
      spellcheckEnabled: parsed.spellcheckEnabled ?? DEFAULTS.spellcheckEnabled,
      languageCheckEnabled: parsed.languageCheckEnabled ?? DEFAULTS.languageCheckEnabled,
    };
  } catch {
    return DEFAULTS;
  }
}

function emit(next: ProofreadingPreferences): void {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Preferences remain valid for the current session when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

export function setSpellcheckEnabled(enabled: boolean): void {
  emit({ ...current, spellcheckEnabled: enabled });
}

export function setLanguageCheckEnabled(enabled: boolean): void {
  emit({ ...current, languageCheckEnabled: enabled });
}

export function useProofreadingPreferences(): ProofreadingPreferences {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => DEFAULTS,
  );
}
