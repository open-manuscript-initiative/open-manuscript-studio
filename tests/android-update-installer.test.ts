import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pluginRoot = new URL(
  '../src-tauri/plugins/android-updater/android/src/main/',
  import.meta.url,
);

test('Android updater uses an isolated FileProvider manifest component', () => {
  const manifest = readFileSync(new URL('AndroidManifest.xml', pluginRoot), 'utf8');
  const provider = readFileSync(
    new URL(
      'java/org/openmanuscript/studio/updater/OmiUpdateFileProvider.kt',
      pluginRoot,
    ),
    'utf8',
  );

  assert.match(
    manifest,
    /android:name="org\.openmanuscript\.studio\.updater\.OmiUpdateFileProvider"/,
  );
  assert.match(manifest, /android:authorities="\$\{applicationId\}\.omi_updates"/);
  assert.match(manifest, /android:resource="@xml\/omi_update_paths"/);
  assert.match(provider, /class OmiUpdateFileProvider\s*:\s*FileProvider\(\)/);
  assert.doesNotMatch(
    manifest,
    /<provider\s[^>]*android:name="androidx\.core\.content\.FileProvider"/s,
  );
});
