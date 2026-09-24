import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const generated = JSON.parse(
  readFileSync(
    new URL(
      '../src/i18n/generated/returnedTranslationOverlays.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  baseline: string;
  canonical: Record<string, Record<string, string>>;
  supplemental: Record<string, Record<string, Record<string, string>>>;
  stats: {
    canonicalLocales: number;
    canonicalEntries: number;
    supplementalLocales: number;
    supplementalEntries: number;
  };
};

test('returned translation payload is generated for the 0.3.0-beta.1 handoff', () => {
  assert.equal(generated.baseline, '0.3.0-beta.1');
  assert.equal(generated.stats.canonicalLocales, 35);
  assert.equal(generated.stats.canonicalEntries, 25_097);
  assert.equal(generated.stats.supplementalLocales, 35);
  assert.equal(generated.stats.supplementalEntries, 36_951);
});

test('generated overlay contains canonical and coded-copy translations', () => {
  assert.equal(generated.canonical.af['/common/save'], 'Spaar');
  assert.equal(generated.supplemental.af.accountPanel.title, 'Rekening');
  assert.equal(
    generated.supplemental.af.detailedHelp['labels.location'],
    'Waar is dit?',
  );
});

test('runtime overlay preserves reviewed Studio translations before DeepL fills', () => {
  const helper = readFileSync(
    new URL('../src/i18n/returnedTranslationOverlay.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    helper,
    /current === undefined \|\| current === null \|\| current === english/,
  );
});

test('direct component literals remain an explicit migration boundary', () => {
  const readme = readFileSync(
    new URL('../locale/translation-import/README.md', import.meta.url),
    'utf8',
  );
  assert.match(readme, /must first be migrated to stable i18n keys/);
});
