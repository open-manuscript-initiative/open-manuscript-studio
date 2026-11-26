import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLICATION_SHORTCODES } from '../src/model/publicationShortcodes.ts';
import { getPublicationShortcodeHelp, appendPublicationShortcodeHelp } from '../src/i18n/helpPublicationShortcodes.ts';
import { getHelpCopy } from '../src/i18n/help.ts';

test('publication shortcode help lists every supported field and is idempotent', () => {
  for (const locale of ['bg','cs','da','de','el','en','es','et','fi','fr','ga','hr','hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv','unknown']) {
    const help = getPublicationShortcodeHelp(locale);
    assert.deepEqual(help.fields.map(field => field.key), [...PUBLICATION_SHORTCODES]);
    assert.ok(help.fields.every(field => field.label));
    for (const key of PUBLICATION_SHORTCODES) assert.ok(help.topic.tips?.some(tip => tip.includes('[omi:' + key + ']')));
    const appended = appendPublicationShortcodeHelp(locale, getHelpCopy('en'));
    assert.equal(appendPublicationShortcodeHelp(locale, appended), appended);
  }
});
