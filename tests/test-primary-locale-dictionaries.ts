import germanDictionaryJson from '../src/i18n/locales/de/studio.json' with { type: 'json' };
import hungarianDictionaryJson from '../src/i18n/locales/hu/studio.json' with { type: 'json' };
import frenchDictionaryJson from '../src/i18n/locales/fr/studio.json' with { type: 'json' };
import {
  loadTranslationDictionary,
  registerTranslationDictionaryLoaders,
} from '../src/i18n/config.ts';
import type { TranslationDictionary } from '../src/i18n/types.ts';

const primaryLocales = ['de', 'hu', 'fr'] as const;

export async function loadPrimaryLocaleDictionariesForTest(): Promise<void> {
  registerTranslationDictionaryLoaders({
    './locales/de/studio.json': async () =>
      germanDictionaryJson as TranslationDictionary,
    './locales/hu/studio.json': async () =>
      hungarianDictionaryJson as TranslationDictionary,
    './locales/fr/studio.json': async () =>
      frenchDictionaryJson as TranslationDictionary,
    './locales/it/studio.json': async () =>
      italianDictionaryJson as TranslationDictionary,
  });

  for (const locale of primaryLocales) {
    await loadTranslationDictionary(locale);
  }
}
