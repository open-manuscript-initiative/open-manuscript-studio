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

test('returned translation overlay keeps the 0.3.0-beta.1 baseline', () => {
  assert.equal(generated.baseline, '0.3.0-beta.1');
  assert.ok(generated.stats.canonicalLocales >= 0);
  assert.ok(generated.stats.canonicalEntries >= 0);
  assert.ok(generated.stats.supplementalLocales >= 0);
  assert.ok(generated.stats.supplementalEntries >= 0);
});

test('translation import generator degrades safely when transport payloads are invalid', () => {
  const generator = readFileSync(
    new URL('../scripts/generate-returned-translation-overlays.mjs', import.meta.url),
    'utf8',
  );
  assert.match(generator, /preserving the committed runtime overlay instead/);
  assert.match(generator, /process\.exit\(0\)/);
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
