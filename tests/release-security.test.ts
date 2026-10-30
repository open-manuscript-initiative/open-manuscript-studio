import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import './session-cookie-security.test.ts';
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
