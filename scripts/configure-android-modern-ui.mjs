import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ANDROID_UI_DEPENDENCIES = Object.freeze({
  'androidx.appcompat:appcompat': '1.8.0',
  'androidx.activity:activity-ktx': '1.13.0',
  'com.google.android.material:material': '1.14.0',
});

const LEGACY_THEME = 'Theme.MaterialComponents.DayNight.NoActionBar';
const MODERN_THEME = 'Theme.Material3.DayNight.NoActionBar';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function patchAndroidDependencies(source) {
  let result = source;
  for (const [coordinate, version] of Object.entries(ANDROID_UI_DEPENDENCIES)) {
    const pattern = new RegExp(`implementation\\("${escapeRegExp(coordinate)}:[^"]+"\\)`);
    if (!pattern.test(result)) {
      throw new Error(`Expected generated Android dependency is missing: ${coordinate}`);
    }
    result = result.replace(pattern, `implementation("${coordinate}:${version}")`);
  }
  return result;
}

export function patchAndroidTheme(source) {
  if (source.includes(MODERN_THEME)) return source;
  if (!source.includes(LEGACY_THEME)) {
    throw new Error('Expected generated Material Components application theme is missing.');
  }
  return source.replaceAll(LEGACY_THEME, MODERN_THEME);
}

function updateFile(path, transform) {
  if (!existsSync(path)) throw new Error(`Generated Android file is missing: ${path}`);
  const source = readFileSync(path, 'utf8');
  const next = transform(source);
  if (next !== source) {
    writeFileSync(path, next);
    return true;
  }
  return false;
}

export function configureAndroidModernUi(root = resolve('src-tauri/gen/android')) {
  const changes = [];
  const buildGradle = resolve(root, 'app/build.gradle.kts');
  if (updateFile(buildGradle, patchAndroidDependencies)) changes.push('app/build.gradle.kts');

  for (const relative of [
    'app/src/main/res/values/themes.xml',
    'app/src/main/res/values-night/themes.xml',
  ]) {
    if (updateFile(resolve(root, relative), patchAndroidTheme)) changes.push(relative);
  }

  const dependencySummary = Object.entries(ANDROID_UI_DEPENDENCIES)
    .map(([name, version]) => `${name}:${version}`)
    .join(', ');
  console.log(
    changes.length > 0
      ? `Android UI compatibility updated (${changes.join(', ')}): ${dependencySummary}; ${MODERN_THEME}`
      : `Android UI compatibility already current: ${dependencySummary}; ${MODERN_THEME}`,
  );
}

const executedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (executedDirectly) configureAndroidModernUi();
