import type { OmiLocale } from './omi';

/**
 * Multilingual manuscript metadata extension.
 *
 * `abstract` and `keywords` remain the compatibility projection for the
 * manuscript's primary `locale`. The localized maps are authoritative when
 * present and preserve all imported language variants.
 */
declare module './omi' {
  interface OmiManuscriptState {
    abstracts?: Partial<Record<OmiLocale, string>>;
    keywordsByLocale?: Partial<Record<OmiLocale, string[]>>;
  }
}

export {};
