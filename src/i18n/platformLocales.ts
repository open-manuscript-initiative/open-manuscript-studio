/**
 * Google Play parity registry.
 *
 * Google Play exposes 49 locale entries for the Studio distribution. Several
 * of those are regional variants of one interface language (English, Spanish,
 * French and Portuguese), so the shared Studio UI canonicalizes them to one
 * language dictionary while preserving the platform locale matrix.
 *
 * Irish and Maltese remain Studio UI languages even though they are not part
 * of the 49-entry Google Play matrix.
 */
export const GOOGLE_PLAY_LOCALES = [
  'af',
  'am',
  'bg',
  'ca',
  'hr',
  'cs',
  'da',
  'de',
  'el',
  'en-US',
  'en-GB',
  'es-ES',
  'es-419',
  'et',
  'fi',
  'fil',
  'fr-CA',
  'fr-FR',
  'he',
  'hi',
  'hu',
  'is',
  'id',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'ms',
  'nl',
  'no',
  'pl',
  'pt-BR',
  'pt-PT',
  'ro',
  'ru',
  'sk',
  'sl',
  'sr',
  'sv',
  'sw',
  'th',
  'tr',
  'uk',
  'zh-CN',
  'zh-TW',
  'zh-HK',
  'zu',
  'vi',
] as const;

export type GooglePlayLocale = (typeof GOOGLE_PLAY_LOCALES)[number];

export const STUDIO_UI_LOCALES = [
  'af',
  'am',
  'bg',
  'ca',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fi',
  'fil',
  'fr',
  'ga',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'is',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'ms',
  'mt',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sr',
  'sv',
  'sw',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-CN',
  'zh-HK',
  'zh-TW',
  'zu',
] as const;

export type StudioUiLocale = (typeof STUDIO_UI_LOCALES)[number];

export const GOOGLE_PLAY_TO_STUDIO_LOCALE: Readonly<
  Record<GooglePlayLocale, StudioUiLocale>
> = Object.freeze({
  af: 'af',
  am: 'am',
  bg: 'bg',
  ca: 'ca',
  hr: 'hr',
  cs: 'cs',
  da: 'da',
  de: 'de',
  el: 'el',
  'en-US': 'en',
  'en-GB': 'en',
  'es-ES': 'es',
  'es-419': 'es',
  et: 'et',
  fi: 'fi',
  fil: 'fil',
  'fr-CA': 'fr',
  'fr-FR': 'fr',
  he: 'he',
  hi: 'hi',
  hu: 'hu',
  is: 'is',
  id: 'id',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  lt: 'lt',
  lv: 'lv',
  ms: 'ms',
  nl: 'nl',
  no: 'no',
  pl: 'pl',
  'pt-BR': 'pt',
  'pt-PT': 'pt',
  ro: 'ro',
  ru: 'ru',
  sk: 'sk',
  sl: 'sl',
  sr: 'sr',
  sv: 'sv',
  sw: 'sw',
  th: 'th',
  tr: 'tr',
  uk: 'uk',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'zh-HK': 'zh-HK',
  zu: 'zu',
  vi: 'vi',
});

export const localeLabels: Readonly<Record<StudioUiLocale, string>> = Object.freeze({
  af: 'Afrikaans',
  am: 'አማርኛ',
  bg: 'Български',
  ca: 'Català',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  es: 'Español',
  et: 'Eesti',
  fi: 'Suomi',
  fil: 'Filipino',
  fr: 'Français',
  ga: 'Gaeilge',
  he: 'עברית',
  hi: 'हिन्दी',
  hr: 'Hrvatski',
  hu: 'Magyar',
  id: 'Bahasa Indonesia',
  is: 'Íslenska',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  ms: 'Bahasa Melayu',
  mt: 'Malti',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  ro: 'Română',
  ru: 'Русский',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sr: 'Српски',
  sv: 'Svenska',
  sw: 'Kiswahili',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文（香港）',
  'zh-TW': '繁體中文（台灣）',
  zu: 'isiZulu',
});

const uiLocaleSet = new Set<string>(STUDIO_UI_LOCALES);

const platformAliases = new Map<string, StudioUiLocale>(
  Object.entries(GOOGLE_PLAY_TO_STUDIO_LOCALE).map(([platform, studio]) => [
    platform.toLowerCase(),
    studio,
  ]),
);

// Legacy Android locale identifiers still appear on some devices.
platformAliases.set('iw', 'he');
platformAliases.set('iw-il', 'he');
platformAliases.set('in', 'id');
platformAliases.set('in-id', 'id');

export function resolveStudioUiLocale(value: string | null | undefined): StudioUiLocale | null {
  const input = value?.trim().replace(/_/g, '-');
  if (!input) return null;

  if (uiLocaleSet.has(input)) return input as StudioUiLocale;

  const lower = input.toLowerCase();
  const alias = platformAliases.get(lower);
  if (alias) return alias;

  if (lower.startsWith('zh-')) {
    if (lower.includes('hk') || lower.includes('mo') || lower.includes('hant-hk')) return 'zh-HK';
    if (lower.includes('tw') || lower.includes('hant')) return 'zh-TW';
    return 'zh-CN';
  }

  const base = lower.split('-')[0];
  return uiLocaleSet.has(base) ? (base as StudioUiLocale) : null;
}

export function getStudioLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return resolveStudioUiLocale(locale) === 'he' ? 'rtl' : 'ltr';
}
