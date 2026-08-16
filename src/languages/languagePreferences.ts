import {
  useCallback,
  useEffect,
  useState,
} from 'react';

export interface ContentLanguagePreferences {
  manuscriptLanguages: string[];
  metadataLanguages: string[];
}

const DEFAULT_LANGUAGES = ['en', 'hu', 'de'] as const;
const MANUSCRIPT_LANGUAGES_KEY =
  'omi-studio-enabled-manuscript-languages';
const METADATA_LANGUAGES_KEY =
  'omi-studio-enabled-metadata-languages';
const CHANGE_EVENT = 'omi-studio-content-language-preferences-change';

function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_LANGUAGES];

  const unique = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];

  return unique.length > 0 ? unique : [...DEFAULT_LANGUAGES];
}

function readStoredLanguages(key: string): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_LANGUAGES];

  const raw = window.localStorage.getItem(key);
  if (!raw) return [...DEFAULT_LANGUAGES];

  try {
    return normalizeLanguages(JSON.parse(raw));
  } catch {
    return [...DEFAULT_LANGUAGES];
  }
}

export function loadContentLanguagePreferences(): ContentLanguagePreferences {
  return {
    manuscriptLanguages: readStoredLanguages(MANUSCRIPT_LANGUAGES_KEY),
    metadataLanguages: readStoredLanguages(METADATA_LANGUAGES_KEY),
  };
}

function writeLanguages(key: string, languages: readonly string[]): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    key,
    JSON.stringify(normalizeLanguages([...languages])),
  );
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveManuscriptLanguages(
  languages: readonly string[],
): void {
  writeLanguages(MANUSCRIPT_LANGUAGES_KEY, languages);
}

export function saveMetadataLanguages(
  languages: readonly string[],
): void {
  writeLanguages(METADATA_LANGUAGES_KEY, languages);
}

export function useContentLanguagePreferences() {
  const [preferences, setPreferences] =
    useState<ContentLanguagePreferences>(() =>
      loadContentLanguagePreferences(),
    );

  useEffect(() => {
    const refresh = () => {
      setPreferences(loadContentLanguagePreferences());
    };

    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const setManuscriptLanguages = useCallback(
    (languages: readonly string[]) => {
      saveManuscriptLanguages(languages);
    },
    [],
  );

  const setMetadataLanguages = useCallback(
    (languages: readonly string[]) => {
      saveMetadataLanguages(languages);
    },
    [],
  );

  return {
    ...preferences,
    setManuscriptLanguages,
    setMetadataLanguages,
  };
}
