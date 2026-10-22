import germanDictionaryJson from '../src/i18n/locales/de/studio.json' with { type: 'json' };
import hungarianDictionaryJson from '../src/i18n/locales/hu/studio.json' with { type: 'json' };
import frenchDictionaryJson from '../src/i18n/locales/fr/studio.json' with { type: 'json' };
import italianDictionaryJson from '../src/i18n/locales/it/studio.json' with { type: 'json' };
import spanishDictionaryJson from '../src/i18n/locales/es/studio.json' with { type: 'json' };
import dutchDictionaryJson from '../src/i18n/locales/nl/studio.json' with { type: 'json' };
import polishDictionaryJson from '../src/i18n/locales/pl/studio.json' with { type: 'json' };
import {
  loadTranslationDictionary,
  registerTranslationDictionaryLoaders,
} from '../src/i18n/config.ts';
import type { TranslationDictionary } from '../src/i18n/types.ts';

const primaryLocales = ['de', 'hu', 'fr', 'it', 'es', 'nl', 'pl'] as const;

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
    './locales/es/studio.json': async () =>
      spanishDictionaryJson as TranslationDictionary,
    './locales/nl/studio.json': async () =>
      dutchDictionaryJson as TranslationDictionary,
    './locales/pl/studio.json': async () =>
      polishDictionaryJson as TranslationDictionary,
  });

  for (const locale of primaryLocales) {
    await loadTranslationDictionary(locale);
  }
}
