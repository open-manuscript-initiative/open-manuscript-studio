export type ModuleLocale = 'en' | 'hu' | 'de' | 'fr';

/** Resolve language tags consistently and keep English as the fallback. */
export function normalizeModuleLocale(locale: string | null | undefined): ModuleLocale {
  const language = locale?.trim().toLowerCase().split(/[-_]/, 1)[0];
  return language === 'hu' || language === 'de' || language === 'fr' ? language : 'en';
}
