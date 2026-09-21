import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parsePo } from './po-utils.mjs';
import {
  loadTranslationOverlay,
  resolveReviewedTranslation,
} from './translation-overlays.mjs';
import {
  buildPlayTranslationResourceCatalog,
  playTranslationResourceName,
} from './generate-play-translation-resources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PLAY_UNAVAILABLE_STUDIO_LOCALES = new Set(['en', 'ga', 'mt']);

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function findAapt2() {
  const explicit = readArg('--aapt2');
  if (explicit) return path.resolve(explicit);

  const androidHome = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!androidHome) {
    throw new Error(
      'ANDROID_HOME or ANDROID_SDK_ROOT is required unless --aapt2 is provided.',
    );
  }

  const buildTools = path.join(androidHome, 'build-tools');
  const versions = readdirSync(buildTools, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) =>
      right.localeCompare(left, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );

  for (const version of versions) {
    const candidate = path.join(buildTools, version, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2');
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`aapt2 was not found under ${buildTools}.`);
}

function decodeAaptString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value
      .replaceAll('\\n', '\n')
      .replaceAll('\\r', '\r')
      .replaceAll('\\t', '\t')
      .replaceAll("\\'", "'")
      .replaceAll('\\"', '"')
      .replaceAll('\\\\', '\\');
  }
}

function parseLocaleQualifier(config) {
  if (!config || config === '') return null;

  const bare = config
    .replace(/-(?:v|night|notnight|land|port|ldrtl|ldltr|sw\d+dp|w\d+dp|h\d+dp|dpi|mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi).*$/i, '')
    .trim();

  if (bare.startsWith('b+')) {
    const parts = bare.slice(2).split('+');
    const language = parts[0]?.toLowerCase();
    let script = null;
    let region = null;
    for (const part of parts.slice(1)) {
      if (/^[A-Za-z]{4}$/.test(part)) script = part;
      else if (/^(?:[A-Za-z]{2}|\d{3})$/.test(part)) region = part.toUpperCase();
    }
    return language ? { language, script, region } : null;
  }

  const match = bare.match(/^([a-z]{2,3})(?:-r([A-Za-z]{2}|\d{3}))?/i);
  if (!match) return null;
  return {
    language: match[1].toLowerCase(),
    script: null,
    region: match[2]?.toUpperCase() ?? null,
  };
}

function canonicalStudioLocale(config) {
  const parsed = parseLocaleQualifier(config);
  if (!parsed) return null;
  let { language, script, region } = parsed;
  if (language === 'iw') language = 'he';
  if (language === 'in') language = 'id';

  if (language === 'zh') {
    if (region === 'HK' || region === 'MO') return 'zh-HK';
    if (region === 'TW') return 'zh-TW';
    if (script?.toLowerCase() === 'hant') return 'zh-TW';
    return 'zh-CN';
  }

  if (language === 'en') return 'en';
  return language;
}

function localePreferenceScore(config, locale) {
  const parsed = parseLocaleQualifier(config);
  if (!parsed) return 0;
  const region = parsed.region;

  if (locale === 'es') return region === 'ES' ? 100 : region === '419' ? 80 : 60;
  if (locale === 'fr') return region === 'FR' ? 100 : region === 'CA' ? 80 : 60;
  if (locale === 'pt') return region === 'PT' ? 100 : region === 'BR' ? 80 : 60;
  if (locale === 'zh-HK') return region === 'HK' ? 100 : 70;
  if (locale === 'zh-TW') return region === 'TW' ? 100 : 70;
  if (locale === 'zh-CN') return region === 'CN' ? 100 : 70;
  return region ? 80 : 100;
}

export function parseAapt2StudioTranslations(dump, reference) {
  const catalog = buildPlayTranslationResourceCatalog(reference);
  const sourceByResource = new Map(
    catalog.map((entry) => [entry.resource, entry.source]),
  );
  const byLocale = new Map();
  let activeResource = null;

  for (const rawLine of dump.split(/\r?\n/)) {
    const resourceMatch = rawLine.match(
      /^\s*resource\s+\S+\s+string\/(omi_i18n_[a-f0-9]+)\s*$/,
    );
    if (resourceMatch) {
      activeResource = sourceByResource.has(resourceMatch[1])
        ? resourceMatch[1]
        : null;
      continue;
    }
    if (!activeResource) continue;

    const valueMatch = rawLine.match(/^\s*\(([^)]*)\)\s+"(.*)"\s*$/);
    if (!valueMatch) continue;

    const config = valueMatch[1];
    if (!config) continue;
    const locale = canonicalStudioLocale(config);
    if (!locale || locale === 'en') continue;

    const source = sourceByResource.get(activeResource);
    const translation = decodeAaptString(valueMatch[2]);
    const score = localePreferenceScore(config, locale);

    let localeMap = byLocale.get(locale);
    if (!localeMap) {
      localeMap = new Map();
      byLocale.set(locale, localeMap);
    }

    const existing = localeMap.get(source);
    if (!existing || score > existing.score) {
      localeMap.set(source, { value: translation, score, config });
    }
  }

  return new Map(
    [...byLocale].map(([locale, sourceMap]) => [
      locale,
      new Map(
        [...sourceMap].map(([source, payload]) => [source, payload.value]),
      ),
    ]),
  );
}

async function readLocaleCodes() {
  const localeRoot = path.join(root, 'locale');
  const localeCodes = [];
  for (const entry of await fs.readdir(localeRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.access(path.join(localeRoot, entry.name, 'studio.po'));
      localeCodes.push(entry.name);
    } catch {
      // non-locale working directory
    }
  }
  return localeCodes.sort();
}

async function buildOverlayPlan(playTranslations, reference) {
  const localeCodes = await readLocaleCodes();
  const referenceByPointer = new Map(
    buildPlayTranslationResourceCatalog(reference).flatMap((entry) =>
      entry.pointers.map((pointer) => [pointer, entry.source]),
    ),
  );

  const plans = [];
  const unresolvedByLocale = new Map();

  for (const locale of localeCodes) {
    if (locale === 'en') continue;

    const poPath = path.join(root, 'locale', locale, 'studio.po');
    const entries = parsePo(await fs.readFile(poPath, 'utf8'));
    const overlay = await loadTranslationOverlay(root, locale);
    const playLocale = playTranslations.get(locale);
    const additions = {};
    const unresolved = [];

    for (const entry of entries) {
      const expectedSource = referenceByPointer.get(entry.pointer);
      if (expectedSource !== entry.source) {
        throw new Error(
          `${locale}: stale source at ${entry.pointer}; run PO parity repair first.`,
        );
      }

      const existing = resolveReviewedTranslation({
        locale,
        pointer: entry.pointer,
        source: entry.source,
        current: entry.translation,
        overlay,
      });
      if (existing.value !== entry.source || existing.reviewedByOverlay) continue;

      const playValue = playLocale?.get(entry.source);
      if (typeof playValue === 'string' && playValue.trim().length > 0) {
        additions[entry.source] = playValue;
      } else {
        unresolved.push(entry.pointer);
      }
    }

    plans.push({ locale, additions, unresolved });
    unresolvedByLocale.set(locale, unresolved);
  }

  return { plans, unresolvedByLocale };
}

async function writeOverlayPlan(plans) {
  const overlayRoot = path.join(root, 'locale', 'completion-overlays');
  await fs.mkdir(overlayRoot, { recursive: true });

  for (const plan of plans) {
    if (Object.keys(plan.additions).length === 0) continue;
    const payload = {
      locale: plan.locale,
      bySource: Object.fromEntries(
        Object.entries(plan.additions).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      byPointer: {},
    };
    await fs.writeFile(
      path.join(overlayRoot, `${plan.locale}.play.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    );
  }
}

async function updateCompletionStatus(unresolvedByLocale) {
  const statusPath = path.join(
    root,
    'locale',
    'completion-overlays',
    'status.json',
  );
  let status = { completeLocales: [] };
  try {
    status = JSON.parse(await fs.readFile(statusPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const completed = new Set(status.completeLocales ?? []);
  for (const [locale, unresolved] of unresolvedByLocale) {
    if (unresolved.length === 0) completed.add(locale);
  }

  status.completeLocales = [...completed].sort();
  await fs.writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

export async function importPlayTranslations({
  apkPath,
  aapt2Path = findAapt2(),
  write = false,
  requireComplete = true,
} = {}) {
  if (!apkPath) throw new Error('apkPath is required.');

  const reference = JSON.parse(
    await fs.readFile(
      path.join(root, 'src', 'i18n', 'locales', 'en', 'studio.json'),
      'utf8',
    ),
  );

  const dump = execFileSync(
    aapt2Path,
    ['dump', 'resources', path.resolve(apkPath)],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );

  const playTranslations = parseAapt2StudioTranslations(dump, reference);
  const { plans, unresolvedByLocale } = await buildOverlayPlan(
    playTranslations,
    reference,
  );

  const playRequiredFailures = plans.filter(
    (plan) =>
      !PLAY_UNAVAILABLE_STUDIO_LOCALES.has(plan.locale) &&
      plan.unresolved.length > 0,
  );

  if (requireComplete && playRequiredFailures.length > 0) {
    const summary = playRequiredFailures
      .map((plan) => `${plan.locale}: ${plan.unresolved.length}`)
      .join(', ');
    throw new Error(
      `Google Play translation payload is incomplete for Studio locales: ${summary}. ` +
        'Confirm automatic App strings translation is enabled for all configured Play languages and retry after Play processing completes.',
    );
  }

  if (write) {
    await writeOverlayPlan(plans);
    await updateCompletionStatus(unresolvedByLocale);
  }

  return {
    translatedLocales: [...playTranslations.keys()].sort(),
    plans,
    unresolvedByLocale,
  };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (import.meta.url === invokedPath) {
  try {
    const apkPath = readArg('--apk');
    const result = await importPlayTranslations({
      apkPath,
      write: process.argv.includes('--write'),
      requireComplete: !process.argv.includes('--allow-partial'),
    });

    for (const plan of result.plans) {
      const added = Object.keys(plan.additions).length;
      console.log(
        `${plan.locale}: Play additions=${added}; unresolved=${plan.unresolved.length}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
