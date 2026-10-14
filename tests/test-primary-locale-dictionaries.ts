import germanDictionaryJson from '../src/i18n/locales/de/studio.json' with { type: 'json' };
import hungarianDictionaryJson from '../src/i18n/locales/hu/studio.json' with { type: 'json' };
import {
  loadTranslationDictionary,
  registerTranslationDictionaryLoaders,
} from '../src/i18n/config.ts';
import type { TranslationDictionary } from '../src/i18n/types.ts';

const primaryLocales = ['de', 'hu'] as const;

export async function loadPrimaryLocaleDictionariesForTest(): Promise<void> {
  registerTranslationDictionaryLoaders({
    './locales/de/studio.json': async () =>
      germanDictionaryJson as TranslationDictionary,
    './locales/hu/studio.json': async () =>
      hungarianDictionaryJson as TranslationDictionary,
  });

  for (const locale of primaryLocales) {
    await loadTranslationDictionary(locale);
  }
}
