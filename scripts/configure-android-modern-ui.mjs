import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ANDROID_UI_DEPENDENCIES = Object.freeze({
  'androidx.appcompat:appcompat': '1.8.0',
  'androidx.activity:activity-ktx': '1.13.0',
});

export const ANDROID_KOTLIN_VERSION = '2.1.20';

export const ANDROID_REMOVED_UI_DEPENDENCIES = Object.freeze([
  'com.google.android.material:material',
]);

const LEGACY_THEME = 'Theme.MaterialComponents.DayNight.NoActionBar';
const MODERN_THEME = 'Theme.AppCompat.DayNight.NoActionBar';
const LEGACY_ACTIVITY_IMPORT = 'import androidx.activity.enableEdgeToEdge';
const MODERN_ACTIVITY_IMPORT = `import android.os.Build
import android.view.WindowManager
import androidx.core.view.WindowCompat`;
const LEGACY_ACTIVITY_CALL = '    enableEdgeToEdge()';
const MODERN_ACTIVITY_CALL = `    WindowCompat.setDecorFitsSystemWindows(window, false)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val attributes = window.attributes
      attributes.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      window.attributes = attributes
    }`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

export function patchAndroidActivity(source) {
  if (
    source.includes(MODERN_ACTIVITY_IMPORT) &&
    source.includes(MODERN_ACTIVITY_CALL)
  ) {
    return source;
  }
  if (
    !source.includes(LEGACY_ACTIVITY_IMPORT) ||
    !source.includes(LEGACY_ACTIVITY_CALL)
  ) {
    throw new Error('Expected generated Tauri edge-to-edge Activity is missing.');
  }
  return source
    .replace(LEGACY_ACTIVITY_IMPORT, MODERN_ACTIVITY_IMPORT)
    .replace(LEGACY_ACTIVITY_CALL, MODERN_ACTIVITY_CALL);
}

export function patchAndroidDependencies(source) {
  let result = source;
  for (const [coordinate, version] of Object.entries(ANDROID_UI_DEPENDENCIES)) {
    const pattern = new RegExp(
      'implementation\\("' + escapeRegExp(coordinate) + ':[^"]+"\\)',
    );
    if (!pattern.test(result)) {
      throw new Error(`Expected generated Android dependency is missing: ${coordinate}`);
    }
    result = result.replace(
      pattern,
      'implementation("' + coordinate + ':' + version + '")',
    );
  }
  for (const coordinate of ANDROID_REMOVED_UI_DEPENDENCIES) {
    result = result
      .split('\n')
      .filter((line) => !line.trim().startsWith('implementation("' + coordinate + ':'))
      .join('\n');
  }
  return result;
}

export function patchAndroidNativeDebugSymbols(source) {
  if (/debugSymbolLevel\s*=\s*["']FULL["']/.test(source)) return source;

  const releasePattern = /(getByName\(["']release["']\)\s*\{)/;
  if (!releasePattern.test(source)) {
    throw new Error('Expected generated Android release build type is missing.');
  }

  return source.replace(
    releasePattern,
    `$1\n            ndk {\n                debugSymbolLevel = "FULL"\n            }`,
  );
}

export function patchAndroidTheme(source) {
  if (source.includes(MODERN_THEME)) return source;
  if (!source.includes(LEGACY_THEME)) {
    throw new Error('Expected generated Material Components application theme is missing.');
  }
  return source.replaceAll(LEGACY_THEME, MODERN_THEME);
}

function findGeneratedMainActivity(root) {
  const directPath = resolve(root, 'app/src/main/MainActivity.kt');
  if (existsSync(directPath)) return directPath;

  const matches = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'build' || entry.name === '.gradle') continue;
        visit(resolve(directory, entry.name));
      } else if (entry.isFile() && entry.name === 'MainActivity.kt') {
        matches.push(resolve(directory, entry.name));
      }
    }
  };
  visit(root);

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one generated Tauri MainActivity.kt, found ${matches.length}.`);
  }
  return matches[0];
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

  const activity = findGeneratedMainActivity(root);
  if (updateFile(activity, patchAndroidActivity)) changes.push('MainActivity.kt');

  const buildGradle = resolve(root, 'app/build.gradle.kts');
  if (
    updateFile(buildGradle, (source) =>
      patchAndroidNativeDebugSymbols(patchAndroidDependencies(source)),
    )
  ) {
    changes.push('app/build.gradle.kts');
  }

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
      ? `Android compatibility updated (${changes.join(', ')}): Kotlin Gradle plugin ${ANDROID_KOTLIN_VERSION}; ${dependencySummary}; removed ${ANDROID_REMOVED_UI_DEPENDENCIES.join(', ')}; ${MODERN_THEME}; release native debug symbols FULL`
      : `Android compatibility already current: Kotlin Gradle plugin ${ANDROID_KOTLIN_VERSION}; ${dependencySummary}; removed ${ANDROID_REMOVED_UI_DEPENDENCIES.join(', ')}; ${MODERN_THEME}; release native debug symbols FULL`,
  );
}

const executedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (executedDirectly) configureAndroidModernUi();
