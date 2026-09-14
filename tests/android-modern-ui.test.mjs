import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ANDROID_KOTLIN_VERSION,
  ANDROID_UI_DEPENDENCIES,
  configureAndroidModernUi,
  patchAndroidActivity,
  patchAndroidDependencies,
  patchAndroidKotlinVersion,
  patchAndroidTheme,
} from '../scripts/configure-android-modern-ui.mjs';

const generatedBuildGradle = `dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
}
`;

const generatedRootBuildGradle = `buildscript {
    dependencies {
        classpath("com.android.tools.build:gradle:8.11.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
}
`;
const generatedActivity = `package org.openmanuscript.studio

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
`;
const generatedTheme = `<resources>
    <style name="Theme.omi_studio" parent="Theme.MaterialComponents.DayNight.NoActionBar">
    </style>
</resources>
`;

test('Android dependency patch pins Android 15-compatible stable UI libraries', () => {
  const patched = patchAndroidDependencies(generatedBuildGradle);
  for (const [coordinate, version] of Object.entries(ANDROID_UI_DEPENDENCIES)) {
    assert.match(patched, new RegExp(`${coordinate.replaceAll('.', '\\.')}[: ]?${version.replaceAll('.', '\\.')}`));
  }
  assert.doesNotMatch(patched, /appcompat:1\.7\.1/);
  assert.doesNotMatch(patched, /activity-ktx:1\.10\.1/);
  assert.doesNotMatch(patched, /material:1\.12\.0/);
  assert.doesNotMatch(patched, /com\.google\.android\.material:material/);
  assert.equal(patchAndroidDependencies(patched), patched);
});

test('Android Activity patch uses non-deprecated edge-to-edge APIs', () => {
  const patched = patchAndroidActivity(generatedActivity);
  assert.match(patched, /androidx\.core\.view\.WindowCompat/);
  assert.match(patched, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS/);
  assert.doesNotMatch(patched, /androidx\.activity\.enableEdgeToEdge/);
  assert.doesNotMatch(patched, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES/);
  assert.doesNotMatch(patched, /enableEdgeToEdge\(\)/);
  assert.equal(patchAndroidActivity(patched), patched);
});
test('Kotlin compiler patch aligns the generated template with modern AndroidX metadata', () => {
  const patched = patchAndroidKotlinVersion(generatedRootBuildGradle);
  assert.match(
    patched,
    new RegExp(`kotlin-gradle-plugin:${ANDROID_KOTLIN_VERSION.replaceAll('.', '\\.')}`),
  );
  assert.doesNotMatch(patched, /kotlin-gradle-plugin:1\.9\.25/);
  assert.equal(patchAndroidKotlinVersion(patched), patched);

  const newerTemplate = generatedRootBuildGradle.replace('1.9.25', '2.2.10');
  assert.equal(patchAndroidKotlinVersion(newerTemplate), newerTemplate);
});
test('Android theme patch migrates generated Tauri theme to AppCompat', () => {
  const patched = patchAndroidTheme(generatedTheme);
  assert.match(patched, /Theme\.AppCompat\.DayNight\.NoActionBar/);
  assert.doesNotMatch(patched, /Theme\.MaterialComponents\.DayNight\.NoActionBar/);
  assert.equal(patchAndroidTheme(patched), patched);
});

test('Android modern UI configuration patches a generated project idempotently', () => {
  const root = mkdtempSync(join(tmpdir(), 'omi-android-modern-ui-'));
  try {
    const app = join(root, 'app');
    const day = join(app, 'src/main/res/values');
    const night = join(app, 'src/main/res/values-night');
    mkdirSync(day, { recursive: true });
    mkdirSync(night, { recursive: true });
    writeFileSync(join(root, 'build.gradle.kts'), generatedRootBuildGradle);
    writeFileSync(join(root, 'app/src/main/MainActivity.kt'), generatedActivity);
    writeFileSync(join(app, 'build.gradle.kts'), generatedBuildGradle);
    writeFileSync(join(day, 'themes.xml'), generatedTheme);
    writeFileSync(join(night, 'themes.xml'), generatedTheme);

    configureAndroidModernUi(root);
    const rootOnce = readFileSync(join(root, 'build.gradle.kts'), 'utf8');
    const activityOnce = readFileSync(join(root, 'app/src/main/MainActivity.kt'), 'utf8');
    const once = readFileSync(join(app, 'build.gradle.kts'), 'utf8');
    const dayOnce = readFileSync(join(day, 'themes.xml'), 'utf8');
    configureAndroidModernUi(root);

    assert.equal(readFileSync(join(root, 'build.gradle.kts'), 'utf8'), rootOnce);
    assert.equal(readFileSync(join(root, 'app/src/main/MainActivity.kt'), 'utf8'), activityOnce);
    assert.match(activityOnce, /WindowCompat\.setDecorFitsSystemWindows/);
    assert.doesNotMatch(activityOnce, /enableEdgeToEdge\(\)/);
    assert.match(rootOnce, /kotlin-gradle-plugin:2\.1\.20/);
    assert.equal(readFileSync(join(app, 'build.gradle.kts'), 'utf8'), once);
    assert.equal(readFileSync(join(day, 'themes.xml'), 'utf8'), dayOnce);
    assert.match(dayOnce, /Theme\.AppCompat\.DayNight\.NoActionBar/);
    assert.match(readFileSync(join(night, 'themes.xml'), 'utf8'), /Theme\.AppCompat\.DayNight\.NoActionBar/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Android activity patch fails closed when the Tauri template changes unexpectedly', () => {
  assert.throws(
    () => patchAndroidActivity(generatedActivity.replace('enableEdgeToEdge()', 'legacyFullscreenSetup()')),
    /Expected generated Tauri edge-to-edge Activity is missing/,
  );
});

test('Android dependency patch fails closed when the Tauri template changes unexpectedly', () => {
  assert.throws(
    () => patchAndroidDependencies('dependencies { implementation("androidx.appcompat:appcompat:1.7.1") }'),
    /Expected generated Android dependency is missing/,
  );
});
