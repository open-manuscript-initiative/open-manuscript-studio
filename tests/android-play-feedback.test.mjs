import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const url = 'https://play.google.com/store/apps/details?id=org.openmanuscript.studio';

async function loadLauncher(platform = 'android', nativeFailure = false) {
  const invoked = [];
  const opened = [];
  const module = new SourceTextModule(
    stripTypeScriptTypes(read('src/services/googlePlayFeedback.ts')),
  );
  const mocks = {
    '@tauri-apps/api/core': {
      invoke: async (command) => {
        invoked.push(command);
        if (nativeFailure) throw new Error('Native command unavailable');
      },
    },
    '@tauri-apps/plugin-opener': {
      openUrl: async (target) => { opened.push(target); },
    },
    '../mobile/platform/platform': { getStudioPlatform: () => platform },
  };
  await module.link((specifier) => {
    const exports = mocks[specifier];
    assert.ok(exports, `Unexpected import: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { api: module.namespace, invoked, opened };
}

test('Android menu opens the native Play listing without submitting any feedback', async () => {
  const context = await loadLauncher();
  await context.api.openStudioGooglePlay();
  assert.deepEqual(context.invoked, ['plugin:android-updater|open_play_store']);
  assert.deepEqual(context.opened, []);
  assert.equal(context.api.STUDIO_PLAY_STORE_URL, url);
});

test('Older Android clients without the native command retain an HTTPS fallback', async () => {
  const context = await loadLauncher('android', true);
  await context.api.openStudioGooglePlay();
  assert.deepEqual(context.invoked, ['plugin:android-updater|open_play_store']);
  assert.deepEqual(context.opened, [url]);
});

test('Non-Android platforms cannot invoke the Play feedback command', async () => {
  for (const platform of ['ios', 'desktop', 'web']) {
    const context = await loadLauncher(platform);
    await assert.rejects(context.api.openStudioGooglePlay(), /only available in the Android app/);
    assert.deepEqual(context.invoked, []);
    assert.deepEqual(context.opened, []);
  }
});

test('native Android intent prefers Play, falls back to browser and cannot open arbitrary URL', () => {
  const kotlin = read('src-tauri/plugins/android-updater/android/src/main/java/org/openmanuscript/studio/updater/AndroidUpdaterPlugin.kt');
  assert.match(kotlin, /fun openPlayStore\(invoke: Invoke\)/);
  assert.match(kotlin, /"https:\/\/play\.google\.com\/store\/apps\/details\?id=\$\{activity\.packageName\}"/);
  assert.match(kotlin, /setPackage\("com\.android\.vending"\)/);
  assert.match(kotlin, /catch \(_: ActivityNotFoundException\)/);
  assert.match(kotlin, /activity\.startActivity\(Intent\(Intent\.ACTION_VIEW, listing\)\)/);
  assert.doesNotMatch(kotlin, /fun openPlayStore\(invoke: Invoke, (?:url|uri):/);
});

test('Tauri command registration, permission and Android-only navigation are explicit', () => {
  const build = read('src-tauri/plugins/android-updater/build.rs');
  const rustPlugin = read('src-tauri/plugins/android-updater/src/lib.rs');
  const rustBridge = read('src-tauri/plugins/android-updater/src/mobile.rs');
  const capabilities = JSON.parse(read('src-tauri/capabilities/android-updater.json'));
  const menu = read('src/components/StudioMenuWithHelp.tsx');
  const translations = read('src/i18n/googlePlayFeedbackTranslations.ts');
  assert.match(build, /"open_play_store"/);
  assert.match(rustPlugin, /commands::open_play_store/);
  assert.match(rustBridge, /run_mobile_plugin_async\("openPlayStore", \(\)\)/);
  assert.ok(capabilities.platforms.includes('android'));
  assert.ok(capabilities.permissions.includes('android-updater:allow-open-play-store'));
  assert.match(menu, /platform === 'android' \? \(/);
  assert.match(menu, /data-google-play-feedback="true"/);
  assert.match(menu, /openStudioGooglePlay\(\)/);
  for (const language of ['hu', 'en', 'de', 'fr', 'it', 'es', 'nl', 'pl']) {
    assert.match(translations, new RegExp('\\b' + language + ': \\{'));
  }
});
