import { loadTranslationDictionary } from '../src/i18n/config.ts';

const primaryLocales = ['de', 'hu'] as const;

export async function loadPrimaryLocaleDictionariesForTest(): Promise<void> {
  for (const locale of primaryLocales) {
    await loadTranslationDictionary(locale);
  }
}
