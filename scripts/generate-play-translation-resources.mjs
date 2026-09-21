import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export const PLAY_TRANSLATION_RESOURCE_PREFIX = 'omi_i18n_';
export const PLAY_TRANSLATION_VALUES_FILE =
  'app/src/main/res/values/omi_play_translation_source.xml';
export const PLAY_TRANSLATION_KEEP_FILE =
  'app/src/main/res/raw/omi_play_translation_keep.xml';

function escapePointerSegment(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

export function flattenTranslationStrings(value, pointer = '') {
  const entries = [];

  const visit = (node, currentPointer) => {
    if (typeof node === 'string') {
      entries.push([currentPointer || '/', node]);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) =>
        visit(item, `${currentPointer}/${index}`),
      );
      return;
    }

    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        visit(child, `${currentPointer}/${escapePointerSegment(key)}`);
      }
    }
  };

  visit(value, pointer);
  return entries;
}

function propertyNameText(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function collectLiteralStrings(node, out) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text.trim()) out.add(node.text);
    return;
  }

  // Dynamic formatter functions are intentionally not flattened into a source
  // string because their final value depends on runtime data.
  if (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node)
  ) {
    return;
  }

  node.forEachChild((child) => collectLiteralStrings(child, out));
}

export function collectSupplementalEnglishSources(root = resolve('.')) {
  const i18nRoot = resolve(root, 'src/i18n');
  const sources = new Set();

  for (const entry of readdirSync(i18nRoot, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== '.ts') continue;
    if (entry.name === 'platformLocales.ts') continue;

    const filePath = join(i18nRoot, entry.name);
    const source = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const visit = (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        propertyNameText(node.name) === 'en' &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        collectLiteralStrings(node.initializer, sources);
      }

      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'en' &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        collectLiteralStrings(node.initializer, sources);
      }

      node.forEachChild(visit);
    };

    visit(sourceFile);
  }

  return [...sources].sort();
}

export function playTranslationResourceName(source) {
  const digest = createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 20);
  return `${PLAY_TRANSLATION_RESOURCE_PREFIX}${digest}`;
}

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function encodeAndroidStringResource(value) {
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll('\t', '\\t')
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'");
  return xmlEscape(`"${escaped}"`);
}

export function buildPlayTranslationResourceCatalog(reference, supplementalSources = []) {
  const bySource = new Map();

  for (const [pointer, source] of flattenTranslationStrings(reference)) {
    const existing = bySource.get(source);
    if (existing) {
      existing.pointers.push(pointer);
      continue;
    }

    bySource.set(source, {
      resource: playTranslationResourceName(source),
      source,
      pointers: [pointer],
    });
  }

  for (const source of supplementalSources) {
    if (!source || bySource.has(source)) continue;
    bySource.set(source, {
      resource: playTranslationResourceName(source),
      source,
      pointers: [],
    });
  }

  const entries = [...bySource.values()].sort((left, right) =>
    left.resource.localeCompare(right.resource),
  );

  const resourceNames = new Set(entries.map((entry) => entry.resource));
  if (resourceNames.size !== entries.length) {
    throw new Error('Play translation resource-name collision detected.');
  }

  return entries;
}

export function renderPlayTranslationResources(reference, supplementalSources = []) {
  const entries = buildPlayTranslationResourceCatalog(reference, supplementalSources);
  const rows = entries.map(
    ({ resource, source }) =>
      `    <string name="${resource}" formatted="false" translatable="true">${encodeAndroidStringResource(source)}</string>`,
  );

  return {
    entries,
    xml: [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<resources>',
      '    <!-- Generated from canonical Studio UI sources for Google Play Gemini translation. -->',
      ...rows,
      '</resources>',
      '',
    ].join('\n'),
  };
}

export function renderPlayTranslationKeepFile() {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<resources xmlns:tools="http://schemas.android.com/tools"',
    `    tools:keep="@string/${PLAY_TRANSLATION_RESOURCE_PREFIX}*" />`,
    '',
  ].join('\n');
}

export function writePlayTranslationResources({
  root = resolve('.'),
  androidRoot = resolve(root, 'src-tauri/gen/android'),
} = {}) {
  const referencePath = resolve(root, 'src/i18n/locales/en/studio.json');
  const reference = JSON.parse(readFileSync(referencePath, 'utf8'));
  const supplementalSources = collectSupplementalEnglishSources(root);
  const { entries, xml } = renderPlayTranslationResources(
    reference,
    supplementalSources,
  );

  const valuesPath = resolve(androidRoot, PLAY_TRANSLATION_VALUES_FILE);
  const keepPath = resolve(androidRoot, PLAY_TRANSLATION_KEEP_FILE);

  mkdirSync(dirname(valuesPath), { recursive: true });
  mkdirSync(dirname(keepPath), { recursive: true });
  writeFileSync(valuesPath, xml, 'utf8');
  writeFileSync(keepPath, renderPlayTranslationKeepFile(), 'utf8');

  return { valuesPath, keepPath, entries };
}

export function removePlayTranslationResources({
  root = resolve('.'),
  androidRoot = resolve(root, 'src-tauri/gen/android'),
} = {}) {
  for (const relativePath of [
    PLAY_TRANSLATION_VALUES_FILE,
    PLAY_TRANSLATION_KEEP_FILE,
  ]) {
    const target = resolve(androidRoot, relativePath);
    if (existsSync(target)) rmSync(target, { force: true });
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';

if (import.meta.url === invokedPath) {
  const result = writePlayTranslationResources();
  console.log(
    `Generated ${result.entries.length} unique Studio strings for Google Play translation.`,
  );
  console.log(result.valuesPath);
}
