import returnedOverlays from './generated/returnedTranslationOverlays.json';
import { resolveStudioUiLocale } from './platformLocales';

type UnknownRecord = Record<string, unknown>;
type SurfaceEntries = Record<string, string>;

interface ReturnedTranslationOverlayData {
  baseline?: string;
  canonical?: Record<string, Record<string, string>>;
  supplemental?: Record<string, Record<string, SurfaceEntries>>;
}

const data = returnedOverlays as ReturnedTranslationOverlayData;

function normalizedLocale(locale: string): string {
  return resolveStudioUiLocale(locale) ?? locale.trim().replace(/_/g, '-');
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)]),
    ) as T;
  }
  return value;
}

function parseStructuredPath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

function parseJsonPointer(pointer: string): string[] {
  if (!pointer.startsWith('/')) return [];
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function getPath(root: unknown, parts: readonly string[]): unknown {
  let current = root;
  for (const part of parts) {
    if (
      (Array.isArray(current) || isRecord(current)) &&
      Object.prototype.hasOwnProperty.call(current, part)
    ) {
      current = (current as UnknownRecord)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function setPath(root: unknown, parts: readonly string[], value: string): void {
  if (!parts.length || (!isRecord(root) && !Array.isArray(root))) return;

  let current = root as UnknownRecord;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const nextPart = parts[index + 1];
    const existing = current[part];

    if (isRecord(existing) || Array.isArray(existing)) {
      current = existing as UnknownRecord;
      continue;
    }

    const next = /^\d+$/.test(nextPart) ? [] : {};
    current[part] = next;
    current = next as UnknownRecord;
  }

  current[parts.at(-1)!] = value;
}

function shouldFillReturnedValue(
  current: unknown,
  english: unknown,
): boolean {
  return current === undefined || current === null || current === english;
}

export function applyReturnedCanonicalOverlay<T>(
  locale: string,
  currentDictionary: T,
  englishDictionary: T,
): T {
  const localeKey = normalizedLocale(locale);
  const translations = data.canonical?.[localeKey];
  if (!translations || localeKey === 'en') return currentDictionary;

  const result = cloneValue(currentDictionary);

  for (const [pointer, translation] of Object.entries(translations)) {
    const parts = parseJsonPointer(pointer);
    if (!parts.length) continue;

    const current = getPath(result, parts);
    const english = getPath(englishDictionary, parts);
    if (shouldFillReturnedValue(current, english)) {
      setPath(result, parts, translation);
    }
  }

  return result;
}

export function getReturnedSupplementalString(
  locale: string,
  surface: string,
  relativePath: string,
): string | undefined {
  const localeKey = normalizedLocale(locale);
  const value = data.supplemental?.[localeKey]?.[surface]?.[relativePath];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function applyReturnedSupplementalOverlay<T>(
  locale: string,
  surface: string,
  currentCopy: T,
  englishCopy: T,
): T {
  const localeKey = normalizedLocale(locale);
  const translations = data.supplemental?.[localeKey]?.[surface];
  if (!translations || localeKey === 'en') return currentCopy;

  const result = cloneValue(currentCopy);
  for (const [relativePath, translation] of Object.entries(translations)) {
    const parts = parseStructuredPath(relativePath);
    if (!parts.length) continue;

    const current = getPath(result, parts);
    const english = getPath(englishCopy, parts);
    if (shouldFillReturnedValue(current, english)) {
      setPath(result, parts, translation);
    }
  }

  return result;
}

export function applyReturnedSupplementalPathOverlay<T>(
  locale: string,
  surface: string,
  pathPrefix: string,
  currentCopy: T,
  englishCopy: T,
): T {
  const localeKey = normalizedLocale(locale);
  const translations = data.supplemental?.[localeKey]?.[surface];
  if (!translations || localeKey === 'en') return currentCopy;

  const normalizedPrefix = pathPrefix ? `${pathPrefix}.` : '';
  const result = cloneValue(currentCopy);

  for (const [relativePath, translation] of Object.entries(translations)) {
    if (
      pathPrefix &&
      relativePath !== pathPrefix &&
      !relativePath.startsWith(normalizedPrefix)
    ) {
      continue;
    }

    const localPath = pathPrefix
      ? relativePath === pathPrefix
        ? ''
        : relativePath.slice(normalizedPrefix.length)
      : relativePath;
    const parts = parseStructuredPath(localPath);
    if (!parts.length) continue;

    const current = getPath(result, parts);
    const english = getPath(englishCopy, parts);
    if (shouldFillReturnedValue(current, english)) {
      setPath(result, parts, translation);
    }
  }

  return result;
}

export const returnedTranslationBaseline = data.baseline ?? null;
