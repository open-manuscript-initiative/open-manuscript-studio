import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ANDROID_UI_DEPENDENCIES = Object.freeze({
  'androidx.appcompat:appcompat': '1.8.0',
  'androidx.activity:activity-ktx': '1.13.0',
  'com.google.android.material:material': '1.14.0',
});

export const ANDROID_KOTLIN_VERSION = '2.1.20';

const LEGACY_THEME = 'Theme.MaterialComponents.DayNight.NoActionBar';
const MODERN_THEME = 'Theme.Material3.DayNight.NoActionBar';

function escapeRegExp(value) {
  return value.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
}

function compareVersions(left, right) {
  const parse = (value) =>
    value
      .split(/[.-]/, 3)
      .map((part) => Number.parseInt(part, 10) || 0);

  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((leftParts[index] ?? 0) !== (rightParts[index] ?? 0)) {
      return (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    }
  }
  return 0;
}

export function patchAndroidKotlinVersion(source) {
  const pattern =
    /(classpath\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin:)([^"']+)(["']\s*\))/;
  const match = source.match(pattern);

  if (!match) {
    throw new Error('Expected generated Kotlin Gradle plugin declaration is missing.');
  }

  if (compareVersions(match[2], ANDROID_KOTLIN_VERSION) >= 0) {
    return source;
  }

  return source.replace(pattern, `$1${ANDROID_KOTLIN_VERSION}$3`);
}

export function patchAndroidDependencies(source) {
  let result = source;
  for (const [coordinate, version] of Object.entries(ANDROID_UI_DEPENDENCIES)) {
    const pattern = new RegExp(
      'implementation\\("' + escapeRegExp(coordinate) + ':[^"]+\\)"',
    );
    if (!pattern.test(result)) {
      throw new Error(`Expected generated Android dependency is missing: ${coordinate}`);
    }
    result = result.replace(
      pattern,
      'implementation("' + coordinate + ':' + version + '")',
    );
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
  const rootBuildGradle = resolve(root, 'build.gradle.kts');
  if (updateFile(rootBuildGradle, patchAndroidKotlinVersion)) changes.push('build.gradle.kts');

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
      ? `Android UI compatibility updated (${changes.join(', ')}): Kotlin Gradle plugin ${ANDROID_KOTLIN_VERSION}; ${dependencySummary}; ${MODERN_THEME}`
      : `Android UI compatibility already current: Kotlin Gradle plugin ${ANDROID_KOTLIN_VERSION}; ${dependencySummary}; ${MODERN_THEME}`,
  );
}

const executedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (executedDirectly) configureAndroidModernUi();
