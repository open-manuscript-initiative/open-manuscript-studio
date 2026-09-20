import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { assertPortableOmiManuscript, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { createReferenceManuscript } from './referenceManuscriptFixture.ts';

test('portable OMI rejects embedded credentials at any nesting depth', () => {
  const portable = structuredClone(toPortableOmiManuscript(createReferenceManuscript())) as Record<string, unknown>;
  portable.extensions = {
    ...(portable.extensions as Record<string, unknown> | undefined),
    'org.openmanuscript.security-test': {
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
