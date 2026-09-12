import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import test from 'node:test';

const builder = resolve('scripts/build-android-distribution.mjs');
const overlay = 'src-tauri/gen/android/app/src/release/AndroidManifest.xml';

test('Play build isolates its manifest and environment; direct build retains updater; failures restore files', {
  skip: process.platform === 'win32',
}, () => {
  const root = mkdtempSync(join(tmpdir(), 'omi-distribution-'));
  try {
    mkdirSync(join(root, 'src-tauri/gen/android/app'), { recursive: true });
    writeFileSync(join(root, 'src-tauri/gen/android/app/build.gradle.kts'), '');
    mkdirSync(join(root, 'bin'));
    const stub = join(root, 'npm-stub.cjs');
    writeFileSync(stub, `
      const fs = require('node:fs');
      const manifest = ${JSON.stringify(overlay)};
      fs.writeFileSync('capture.json', JSON.stringify({
        args: process.argv.slice(2),
        channel: process.env.VITE_ANDROID_DISTRIBUTION,
        manifest: fs.existsSync(manifest) ? fs.readFileSync(manifest, 'utf8') : null,
      }));
      process.exit(Number(process.env.FAKE_EXIT || 0));
    `);
    writeFileSync(join(root, 'bin/npm'), '#!/bin/sh\nexec node "$FAKE_NPM_SCRIPT" "$@"\n', { mode: 0o755 });
    const run = (channel, code = '0') => spawnSync(process.execPath, [builder, channel], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH,
        FAKE_NPM_SCRIPT: stub, FAKE_EXIT: code, VITE_ANDROID_DISTRIBUTION: 'wrong' },
    });
    assert.equal(run('play').status, 0);
    let captured = JSON.parse(readFileSync(join(root, 'capture.json'), 'utf8'));
    assert.equal(captured.channel, 'play');
    assert.ok(captured.args.includes('--aab'));
    assert.match(captured.manifest, /REQUEST_INSTALL_PACKAGES" tools:node="remove"/);
    assert.equal(existsSync(join(root, overlay)), false);

    assert.equal(run('direct').status, 0);
    captured = JSON.parse(readFileSync(join(root, 'capture.json'), 'utf8'));
    assert.equal(captured.channel, 'direct');
    assert.ok(captured.args.includes('--apk'));
    assert.equal(captured.manifest, null);

    assert.equal(run('play', '7').status, 7);
    assert.equal(existsSync(join(root, overlay)), false);
    writeFileSync(join(root, overlay), '<developer-owned />');
    assert.notEqual(run('play').status, 0);
    assert.equal(readFileSync(join(root, overlay), 'utf8'), '<developer-owned />');
    assert.notEqual(run('unknown').status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

async function updater(channel, platform = 'android') {
  const opened = [];
  const invoked = [];
  const digest = 'sha256:' + 'a'.repeat(64);
  const source = stripTypeScriptTypes(readFileSync('src/services/studioUpdater.ts', 'utf8'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      tag_name: '0.1.0-beta.9',
      assets: [{ name: 'Studio-Android-universal.apk',
        browser_download_url: 'https://github.com/example/app.apk', digest }],
    }),
  });
  const module = new SourceTextModule(source, {
    initializeImportMeta(meta) { meta.env = { VITE_ANDROID_DISTRIBUTION: channel }; },
  });
  const mocks = {
    '@tauri-apps/api/core': { invoke: async (...args) => invoked.push(args) },
    '@tauri-apps/plugin-opener': { openUrl: async (url) => opened.push(url) },
    '../mobile/platform/platform': { getStudioPlatform: () => platform },
    '../version': { BUILD_INFO: { version: '0.1.0-beta.8' } },
    './desktopUpdater': { checkForDesktopUpdate: async () => null, installDesktopUpdate: async () => {} },
    './studioVersion': { normalizeStudioVersion: (s) => s, isNewerStudioVersion: () => true },
  };
  await module.link((specifier) => {
    const exports = mocks[specifier];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { api: module.namespace, opened, invoked, digest,
    restore() { globalThis.fetch = originalFetch; } };
}

test('Play discovery and stale APK actions always open the Play listing', async () => {
  const context = await updater('play');
  try {
    const update = await context.api.checkForStudioUpdate();
    assert.equal(update.action, 'download');
    assert.equal(update.targetUrl, 'https://play.google.com/store/apps/details?id=org.openmanuscript.studio');
    await context.api.applyStudioUpdate(update);
    await context.api.applyStudioUpdate({ ...update, action: 'android-install',
      targetUrl: 'https://github.com/example/app.apk', targetDigest: context.digest });
    assert.deepEqual(context.opened, [update.targetUrl, update.targetUrl]);
    assert.deepEqual(context.invoked, []);
  } finally { context.restore(); }
});

test('Direct APK retains native verified installation', async () => {
  const context = await updater('direct');
  try {
    const update = await context.api.checkForStudioUpdate();
    assert.equal(update.action, 'android-install');
    await context.api.applyStudioUpdate(update);
    assert.equal(context.invoked[0][0], 'plugin:android-updater|install_update');
    assert.equal(context.invoked[0][1].sha256, context.digest);
    assert.deepEqual(context.opened, []);
  } finally { context.restore(); }
});

test('Web updates still reload when a Play environment value is present', async () => {
  const context = await updater('play', 'web');
  try {
    assert.equal((await context.api.checkForStudioUpdate()).action, 'reload');
  } finally { context.restore(); }
});
