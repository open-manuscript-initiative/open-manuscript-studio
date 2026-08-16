import assert from 'node:assert/strict';
import test from 'node:test';

import { getExportFormatCopy } from '../src/i18n/exportFormats.ts';
import { getHelpCopy } from '../src/i18n/help.ts';
import type { SupportedLocale } from '../src/i18n/types.ts';

const newlyAddedEuLocales = [
  'bg', 'cs', 'da', 'el', 'es', 'et', 'fi', 'fr', 'ga', 'hr', 'it',
  'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
] as const;

test('legacy three-language menu copy falls back to English for new EU locales', () => {
  for (const locale of newlyAddedEuLocales) {
    const typedLocale = locale as SupportedLocale;

    assert.equal(getHelpCopy(typedLocale).navigation, 'Help');
    assert.equal(getExportFormatCopy(typedLocale).title, 'Export formats');
  }
});
