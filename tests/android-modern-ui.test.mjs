import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ANDROID_UI_DEPENDENCIES,
  configureAndroidModernUi,
  patchAndroidDependencies,
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
  assert.equal(patchAndroidDependencies(patched), patched);
});

test('Android theme patch migrates generated Tauri theme to Material 3', () => {
  const patched = patchAndroidTheme(generatedTheme);
  assert.match(patched, /Theme\.Material3\.DayNight\.NoActionBar/);
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
    writeFileSync(join(app, 'build.gradle.kts'), generatedBuildGradle);
    writeFileSync(join(day, 'themes.xml'), generatedTheme);
    writeFileSync(join(night, 'themes.xml'), generatedTheme);

    configureAndroidModernUi(root);
    const once = readFileSync(join(app, 'build.gradle.kts'), 'utf8');
    const dayOnce = readFileSync(join(day, 'themes.xml'), 'utf8');
    configureAndroidModernUi(root);

    assert.equal(readFileSync(join(app, 'build.gradle.kts'), 'utf8'), once);
    assert.equal(readFileSync(join(day, 'themes.xml'), 'utf8'), dayOnce);
    assert.match(once, /com\.google\.android\.material:material:1\.14\.0/);
    assert.match(dayOnce, /Theme\.Material3\.DayNight\.NoActionBar/);
    assert.match(readFileSync(join(night, 'themes.xml'), 'utf8'), /Theme\.Material3\.DayNight\.NoActionBar/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Android dependency patch fails closed when the Tauri template changes unexpectedly', () => {
  assert.throws(
    () => patchAndroidDependencies('dependencies { implementation("androidx.appcompat:appcompat:1.7.1") }'),
    /Expected generated Android dependency is missing/,
  );
});
