import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const importRoot = path.join(root, 'locale', 'translation-import');
const outputDir = path.join(root, 'src', 'i18n', 'generated');
const outputFile = path.join(outputDir, 'returnedTranslationOverlays.json');

async function loadChunkedJson(prefix) {
  const names = (await fs.readdir(importRoot))
    .filter(
      (name) =>
        name.startsWith(`${prefix}.part`) &&
        name.endsWith('.json.txt'),
    )
    .sort((left, right) => left.localeCompare(right));

  if (names.length === 0) {
    throw new Error(
      `No text-safe returned translation chunks found for ${prefix}.`,
    );
  }

  const chunks = await Promise.all(
    names.map((name) => fs.readFile(path.join(importRoot, name), 'utf8')),
  );

  try {
    return JSON.parse(chunks.join('\n'));
  } catch (error) {
    throw new Error(
      `Returned translation chunks for ${prefix} do not form valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function groupSupplemental(translations) {
  const surfaces = {};
  for (const [key, value] of Object.entries(translations)) {
    const match = key.match(/^\/supplemental\/([^/]+)\/(.+)$/);
    if (!match || typeof value !== 'string' || !value.trim()) continue;
    const [, surface, relativePath] = match;
    (surfaces[surface] ??= {})[relativePath] = value;
  }
  return surfaces;
}

const [canonicalPayload, supplementalPayload] = await Promise.all([
  loadChunkedJson('0.3.0-beta.1-canonical'),
  loadChunkedJson('0.3.0-beta.1-supplemental'),
]);

if (canonicalPayload.baseline !== supplementalPayload.baseline) {
  throw new Error(
    `Returned translation baseline mismatch: ${canonicalPayload.baseline} != ${supplementalPayload.baseline}`,
  );
}

const canonical = Object.fromEntries(
  canonicalPayload.locales.map(({ locale, translations }) => [
    locale,
    Object.fromEntries(
      Object.entries(translations).filter(
        ([key, value]) =>
          key.startsWith('/') &&
          typeof value === 'string' &&
          value.trim(),
      ),
    ),
  ]),
);

const supplemental = Object.fromEntries(
  supplementalPayload.locales.map(({ locale, translations }) => [
    locale,
    groupSupplemental(translations),
  ]),
);

const stats = {
  canonicalLocales: Object.keys(canonical).length,
  canonicalEntries: Object.values(canonical).reduce(
    (total, entries) => total + Object.keys(entries).length,
    0,
  ),
  supplementalLocales: Object.keys(supplemental).length,
  supplementalEntries: Object.values(supplemental).reduce(
    (localeTotal, surfaces) =>
      localeTotal +
      Object.values(surfaces).reduce(
        (surfaceTotal, entries) => surfaceTotal + Object.keys(entries).length,
        0,
      ),
    0,
  ),
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(
  outputFile,
  `${JSON.stringify(
    {
      formatVersion: 1,
      baseline: canonicalPayload.baseline,
      precedence:
        'Existing reviewed Studio translations win; returned DeepL values fill English fallbacks only.',
      canonical,
      supplemental,
      stats,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Returned translation overlay generated: ${stats.canonicalEntries} canonical + ` +
    `${stats.supplementalEntries} supplemental values across ` +
    `${Math.max(stats.canonicalLocales, stats.supplementalLocales)} locales.`,
);
