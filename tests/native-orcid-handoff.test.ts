import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildNativeAuthReturnUrl,
  decodeOrcidStateReturnPath,
  encodeOrcidStateReturnPath,
  normalizeNativeReturnOrigin,
} from '../server/src/integrations/nativeAuthHandoff.ts';

test('native ORCID handoff accepts only registered Studio return targets', () => {
  assert.equal(normalizeNativeReturnOrigin('tauri://localhost'), 'tauri://localhost');
  assert.equal(normalizeNativeReturnOrigin('http://tauri.localhost/'), 'http://tauri.localhost');
  assert.equal(normalizeNativeReturnOrigin('https://tauri.localhost'), 'https://tauri.localhost');
  assert.equal(normalizeNativeReturnOrigin('openmanuscript://auth'), 'openmanuscript://auth');
  assert.equal(
    normalizeNativeReturnOrigin('https://app.openmanuscript.org/auth/orcid/'),
    'https://app.openmanuscript.org/auth/orcid',
  );
  assert.equal(normalizeNativeReturnOrigin('https://studio.openmanuscript.org'), undefined);
  assert.equal(normalizeNativeReturnOrigin('https://app.openmanuscript.org/auth/attacker'), undefined);
  assert.equal(normalizeNativeReturnOrigin('http://tauri.localhost.evil.example'), undefined);
  assert.equal(normalizeNativeReturnOrigin('openmanuscript://attacker'), undefined);
});

test('native ORCID return metadata preserves nonce and validated app origin', () => {
  const expectedNonceHash = 'a'.repeat(64);
  const encoded = encodeOrcidStateReturnPath(
    expectedNonceHash,
    'http://tauri.localhost',
  );

  assert.deepEqual(decodeOrcidStateReturnPath(encoded), {
    expectedNonceHash,
    nativeReturnOrigin: 'http://tauri.localhost',
  });
});

test('legacy ORCID nonce-only state remains compatible', () => {
  const expectedNonceHash = 'b'.repeat(64);
  assert.deepEqual(
    decodeOrcidStateReturnPath(`oidc-nonce:${expectedNonceHash}`),
    { expectedNonceHash },
  );
});

test('invalid native return metadata cannot create an open redirect', () => {
  const expectedNonceHash = 'c'.repeat(64);
  const encoded = `oidc-nonce:${expectedNonceHash}|native-return:${encodeURIComponent('https://attacker.example')}`;
  assert.deepEqual(decodeOrcidStateReturnPath(encoded), { expectedNonceHash });
});

test('native handoff code is returned in the local app URL fragment', () => {
  const url = buildNativeAuthReturnUrl('http://tauri.localhost', {
    handoffCode: 'one-time-code',
  });
  assert.equal(url, 'http://tauri.localhost/#nativeAuthCode=one-time-code');
  assert.equal(new URL(url).search, '');
});

test('mobile handoff code is returned through the verified HTTPS app link', () => {
  const url = buildNativeAuthReturnUrl('https://app.openmanuscript.org/auth/orcid', {
    handoffCode: 'mobile-one-time-code',
  });
  assert.equal(
    url,
    'https://app.openmanuscript.org/auth/orcid/#nativeAuthCode=mobile-one-time-code',
  );
  assert.equal(new URL(url).search, '');
});

test('legacy custom-scheme mobile return remains available as fallback', () => {
  const url = buildNativeAuthReturnUrl('openmanuscript://auth', {
    handoffCode: 'fallback-code',
  });
  assert.equal(url, 'openmanuscript://auth/#nativeAuthCode=fallback-code');
});

test('native ORCID errors return to the local Tauri application', () => {
  assert.equal(
    buildNativeAuthReturnUrl('tauri://localhost', { errorCode: 'orcid_signin_failed' }),
    'tauri://localhost/#authError=orcid_signin_failed',
  );
});

test('iOS configuration uses App Store-compatible versioning and the shared bundle id', () => {
  const iosConfig = JSON.parse(
    readFileSync(new URL('../src-tauri/tauri.ios.conf.json', import.meta.url), 'utf8'),
  ) as {
    version?: string;
    bundle?: {
      iOS?: {
        minimumSystemVersion?: string;
        bundleVersion?: string;
        infoPlist?: string;
      };
    };
  };
  const baseConfig = JSON.parse(
    readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  ) as {
    identifier?: string;
    plugins?: {
      'deep-link'?: {
        mobile?: Array<{
          scheme?: string[];
          host?: string;
          pathPrefix?: string[];
          appLink?: boolean;
        }>;
      };
    };
  };

  assert.equal(baseConfig.identifier, 'org.openmanuscript.studio');
  assert.equal(iosConfig.version, '0.1.0');
  assert.equal(iosConfig.bundle?.iOS?.minimumSystemVersion, '14.0');
  assert.equal(iosConfig.bundle?.iOS?.bundleVersion, '5');
  assert.equal(iosConfig.bundle?.iOS?.infoPlist, 'Info.ios.plist');

  const mobileLinks = baseConfig.plugins?.['deep-link']?.mobile ?? [];
  assert.ok(mobileLinks.some((link) =>
    link.appLink === true
    && link.scheme?.includes('https')
    && link.host === 'app.openmanuscript.org'
    && link.pathPrefix?.includes('/auth/orcid')));
  assert.ok(mobileLinks.some((link) =>
    link.appLink === false
    && link.scheme?.includes('openmanuscript')));
});

test('iOS Info.plist supports iPad multitasking and declares encryption metadata', () => {
  const plist = readFileSync(
    new URL('../src-tauri/Info.ios.plist', import.meta.url),
    'utf8',
  );

  assert.match(plist, /<key>CFBundleDisplayName<\/key>\s*<string>OMI Studio<\/string>/);
  assert.match(plist, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  assert.match(plist, /<key>UIRequiresFullScreen<\/key>\s*<false\/>/);
  assert.match(plist, /<key>UISupportedInterfaceOrientations~ipad<\/key>/);
  assert.match(plist, /<key>UIApplicationSupportsIndirectInputEvents<\/key>\s*<true\/>/);
});
