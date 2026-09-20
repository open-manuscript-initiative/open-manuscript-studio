import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

async function loadStudioUpdater({ nativeUpdate = null, nativeError = null } = {}) {
  const calls = [];
  const source = stripTypeScriptTypes(readFileSync('src/services/studioUpdater.ts', 'utf8'));
  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      tag_name: '0.2.0-beta.3',
      html_url: 'https://github.com/open-manuscript-initiative/open-manuscript-studio/releases/tag/v0.2.0-beta.3',
      assets: [{
        name: 'Open-Manuscript-Studio-Windows-x64-Setup.exe',
        browser_download_url: 'https://github.com/open-manuscript-initiative/open-manuscript-studio/releases/download/v0.2.0-beta.3/setup.exe',
        digest: 'sha256:' + 'b'.repeat(64),
      }],
    }),
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'Windows 11' },
  });

  const module = new SourceTextModule(source, {
    initializeImportMeta(meta) { meta.env = {}; },
  });
  const mocks = {
    '@tauri-apps/api/core': { invoke: async (...args) => calls.push(['invoke', ...args]) },
    '@tauri-apps/plugin-opener': { openUrl: async (url) => calls.push(['openUrl', url]) },
    '../mobile/platform/platform': { getStudioPlatform: () => 'desktop' },
    '../version': { BUILD_INFO: { version: '0.2.0-beta.2' } },
    './desktopUpdater': {
      checkForDesktopUpdate: async () => {
        if (nativeError) throw nativeError;
        return nativeUpdate;
      },
      installDesktopUpdate: async () => { calls.push(['installDesktopUpdate']); },
    },
    './studioVersion': {
      normalizeStudioVersion: (value) => String(value ?? '').replace(/^v/, ''),
      isNewerStudioVersion: (next, current) => next !== current,
    },
  };

  await module.link((specifier) => {
    const exports = mocks[specifier];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();

  return {
    api: module.namespace,
    calls,
    restore() {
      globalThis.fetch = originalFetch;
      if (originalNavigator === undefined) Reflect.deleteProperty(globalThis, 'navigator');
      else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    },
  };
}

test('desktop native update metadata wins and installation stays in the signed native updater path', async () => {
  const context = await loadStudioUpdater({
    nativeUpdate: {
      currentVersion: '0.2.0-beta.2',
      version: '0.2.0-beta.3',
      date: '2026-09-20T00:00:00Z',
      body: 'Release hardening update',
    },
  });
  try {
    const update = await context.api.checkForStudioUpdate();
    assert.equal(update.action, 'native-install');
    assert.equal(update.version, '0.2.0-beta.3');
    await context.api.applyStudioUpdate(update);
    assert.deepEqual(context.calls, [['installDesktopUpdate']]);
  } finally {
    context.restore();
  }
});

test('desktop falls back to the immutable public release asset when signed updater metadata is unavailable', async () => {
  const context = await loadStudioUpdater({ nativeError: new Error('updater metadata unavailable') });
  try {
    const update = await context.api.checkForStudioUpdate();
    assert.equal(update.action, 'download');
    assert.match(update.targetUrl, /setup\.exe$/);
  } finally {
    context.restore();
  }
});
