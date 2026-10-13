import { readFile } from 'node:fs/promises';

import { translations } from '../src/i18n/config.ts';
import type { TranslationDictionary } from '../src/i18n/types.ts';

const primaryLocales = ['de', 'hu'] as const;

export async function loadPrimaryLocaleDictionariesForTest(): Promise<void> {
  for (const locale of primaryLocales) {
    const source = await readFile(
      new URL(`../src/i18n/locales/${locale}/studio.json`, import.meta.url),
      'utf8',
    );
    translations[locale] = JSON.parse(source) as TranslationDictionary;
  }
}
