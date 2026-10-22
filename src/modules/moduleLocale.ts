export const MODULE_LOCALES = ['en', 'hu', 'de', 'fr', 'it', 'es', 'nl', 'pl'] as const;

export type ModuleLocale = (typeof MODULE_LOCALES)[number];

/** Resolve language tags consistently and keep English as the fallback. */
export function normalizeModuleLocale(locale: string | null | undefined): ModuleLocale {
  const language = locale?.trim().toLowerCase().split(/[-_]/, 1)[0];
  return MODULE_LOCALES.find((candidate) => candidate === language) ?? 'en';
}
