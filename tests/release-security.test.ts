import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import './session-cookie-security.test.ts';
import './translation-public-export.test.ts';
import './pdf-worker-environment-security.test.ts';

// Keep the OJS/OMP address checks in the existing release-security gate.
import './integration-ip-security.test.ts';

import { assertPortableOmiManuscript, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { createReferenceManuscript } from './referenceManuscriptFixture.ts';

test('portable OMI rejects embedded credentials at any nesting depth', () => {
  const portable = structuredClone(toPortableOmiManuscript(createReferenceManuscript())) as Record<string, unknown>;
  portable.extensions = {
    ...(portable.extensions as Record<string, unknown> | undefined),
    'urn:org.openmanuscript.security-test': {
      nested: {
        clientSecret: 'must-never-leave-the-account-boundary',
      },
    },
  };

  assert.throws(
    () => assertPortableOmiManuscript(portable),
    /clientSecret|credential|secret/i,
  );
});

test('desktop updater requires an explicit public key and a fixed HTTPS release endpoint', () => {
  const source = readFileSync(
    new URL('../src-tauri/src/updater.rs', import.meta.url),
    'utf8',
  );

  assert.match(source, /option_env!\("OMI_UPDATER_PUBLIC_KEY"\)/);
  assert.match(
    source,
    /https:\/\/github\.com\/open-manuscript-initiative\/open-manuscript-studio\/releases\/latest\/download\/latest\.json/,
  );
  assert.match(source, /\.pubkey\(pubkey\)/);
  assert.match(source, /download_and_install/);
  assert.doesNotMatch(source, /http:\/\//);
});

test('trusted integration URLs keep the production SSRF exception test-only', () => {
  const source = readFileSync(
    new URL('../server/src/integrations/security/trustedRemoteUrl.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /process\.env\.NODE_ENV !== 'test'/);
  assert.match(source, /INTEGRATION_TEST_ALLOWED_HOSTS/);
  assert.match(source, /url\.hostname\.toLowerCase\(\)/);
});

test('Rust Tauri updater lock excludes the vulnerable ZIP crate versions', () => {
  const cargoLock = readFileSync(
    new URL('../src-tauri/Cargo.lock', import.meta.url),
    'utf8',
  );
  const entries = cargoLock.split('[[package]]').slice(1);
  const findVersions = (name: string): string[] => entries
    .filter((block) => block.includes('\nname = "' + name + '"\n'))
    .map((block) => block.match(/\nversion = "([^"]+)"/)?.[1])
    .filter((value): value is string => Boolean(value));

  const zipVersions = findVersions('zip');
  assert.equal(zipVersions.length, 1, 'An older ZIP release must not coexist with zip 9');
  assert.ok(
    zipVersions.every((version) => {
      const parts = version.split('.').map(Number);
      return (parts[0] ?? 0) > 9 || ((parts[0] ?? 0) === 9 && ((parts[1] ?? 0) > 0 || ((parts[1] ?? 0) === 0 && (parts[2] ?? 0) >= 5)));
    }),
    'ZIP must be 9.0.5 or newer: ' + zipVersions.join(', '),
  );
  assert.deepEqual(findVersions('tauri-plugin-updater'), ['2.14.1']);
});

function assertSafeLockedRustVersions(
  name: string,
  isSafe: (major: number, minor: number, patch: number) => boolean,
  advisory: string,
): void {
  const cargoLock = readFileSync(new URL('../src-tauri/Cargo.lock', import.meta.url), 'utf8');
  const versions = cargoLock.split('[[package]]').slice(1)
    .filter((block) => block.includes('\nname = "' + name + '"\n'))
    .map((block) => block.match(/\nversion = "([^"]+)"/)?.[1]);
  assert.ok(versions.length > 0, name + ' must remain covered by the native security gate');
  for (const version of versions) {
    const match = version?.match(/^(\d+)\.(\d+)\.(\d+)$/);
    assert.ok(match, name + ': review prereleases or malformed versions explicitly');
    assert.ok(isSafe(Number(match[1]), Number(match[2]), Number(match[3])),
      name + ' ' + version + ' is affected by ' + advisory);
  }
}

test('locked TLS dependencies exclude releases affected by emSign certificate distrust', () => {
  // RUSTSEC-2026-0382 / CVE-2026-111943: stable webpki fixes start at 0.103.16.
  assertSafeLockedRustVersions('rustls-webpki', (major, minor, patch) => (
    major > 0 || minor > 103 || (minor === 103 && patch >= 16)
  ), 'RUSTSEC-2026-0382');
  // RUSTSEC-2026-0383: 0.26.11 is only a wrapper; also check its 1.x root set.
  assertSafeLockedRustVersions('webpki-root-certs', (major, minor, patch) => (
    major > 1 || (major === 1 && (minor > 0 || patch >= 10))
      || (major === 0 && minor === 26 && patch === 11)
  ), 'RUSTSEC-2026-0383');
});

test('native Tokio lock excludes unsafe AsyncFd constructor releases', () => {
  // RUSTSEC-2026-0386: fixed in the 1.51 and 1.53 branches and in 1.54+.
  assertSafeLockedRustVersions('tokio', (major, minor, patch) => (
    major > 1 || (major === 1 && (
      minor >= 54 || (minor === 53 && patch >= 3) || (minor === 51 && patch >= 6)
    ))
  ), 'RUSTSEC-2026-0386');
});


test('Tauri CSP restricts main WebView scripts and native IPC to bundled main webview', () => {
  const tauri = JSON.parse(readFileSync(
    new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8',
  )) as { app: { security: { csp: Record<string, string> } } };
  const policy = tauri.app.security.csp;
  assert.ok(policy, 'a missing CSP is a release blocker');
  assert.match(policy['script-src'] ?? '', /'self'/);
  assert.doesNotMatch(policy['script-src'] ?? '', /unsafe-inline|unsafe-eval|https?:|[*]/);
  assert.equal(policy['script-src-attr'], "'none'");
  assert.equal(policy['object-src'], "'none'");
  assert.equal(policy['worker-src'], "'self' blob:");
  assert.ok(policy['connect-src']?.includes('ipc:'), 'Tauri IPC must still work');
  assert.ok(policy['frame-src']?.includes('https:'), 'selected institutional Studio APIs must be frameable');

  const capabilities = JSON.parse(readFileSync(
    new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8',
  )) as { windows?: string[]; webviews?: string[]; remote?: unknown };
  assert.deepEqual(capabilities.webviews, ['main']);
  assert.equal(capabilities.windows, undefined, 'a main-window grant leaks to all native sub-WebViews');
  assert.equal(capabilities.remote, undefined, 'external provider pages must never have native capabilities');

  const mainSource = readFileSync(
    new URL('../src/components/PlainDocumentWorkspace.tsx', import.meta.url), 'utf8',
  );
  assert.match(mainSource, /if \(!nativeStudio\) await loadApiScript/);
  assert.match(mainSource, /EuroOfficeIsolatedFrame/);
  const isolatedSource = readFileSync(
    new URL('../src/components/EuroOfficeIsolatedFrame.tsx', import.meta.url), 'utf8',
  );
  assert.match(isolatedSource, /event\.origin !== target\.origin/);
  assert.match(isolatedSource, /event\.source !== ref\.current\?\.contentWindow/);
  assert.match(isolatedSource, /sandbox="allow-scripts allow-same-origin/);
});
