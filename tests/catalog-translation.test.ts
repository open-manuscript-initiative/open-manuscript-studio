import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  interpolateCatalogTranslation,
  resolveCatalogTranslation,
} from '../src/i18n/catalogTranslation.ts';

const localeDirectory = path.join(process.cwd(), 'src', 'i18n', 'locales');
const english = JSON.parse(
  fs.readFileSync(path.join(localeDirectory, 'en', 'studio.json'), 'utf8'),
);
const german = JSON.parse(
  fs.readFileSync(path.join(localeDirectory, 'de', 'studio.json'), 'utf8'),
);
const invitationPointer =
  '/uncataloguedUi/components-continuousmanuscripteditor/studio-will-automatically-invite-email-after-saving-th-2061bd0';

test('PO-backed catalog pointers resolve and interpolate message values', () => {
  const source = resolveCatalogTranslation(english, invitationPointer);
  assert.equal(
    source,
    'Studio will automatically invite {email} after saving the manuscript to your cloud storage.',
  );
  assert.equal(
    resolveCatalogTranslation(german, invitationPointer),
    source,
  );
  assert.equal(
    interpolateCatalogTranslation(source!, { email: 'editor@example.org' }),
    'Studio will automatically invite editor@example.org after saving the manuscript to your cloud storage.',
  );
});
