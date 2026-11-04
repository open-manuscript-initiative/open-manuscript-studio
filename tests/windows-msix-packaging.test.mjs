import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMsixManifest, validateMsixIdentity } from '../scripts/build-windows-msix.mjs';

const valid = { identity: 'OpenManuscriptInitiative.OpenManuscriptStudio', publisher: 'CN=Open Manuscript Initiative, O=Open Manuscript Initiative, C=HU', version: '1.0.0.1' };

test('manifest uses full-trust Windows desktop package and explicit deep-link protocol', () => {
  const manifest = renderMsixManifest(valid);
  for (const marker of ['Windows.FullTrustApplication', 'Name="runFullTrust"', 'windows.protocol', 'Name="openmanuscript"', 'ProcessorArchitecture="x64"', 'Version="1.0.0.1"']) {
    assert.ok(manifest.includes(marker), marker);
  }
  assert.match(manifest, /Publisher="CN=Open Manuscript Initiative, O=Open Manuscript Initiative, C=HU"/);
  assert.match(manifest, /Assets\\Square44x44Logo\.png/);
});

test('requires exact identity, publisher DN and four-part MSIX versions', () => {
  for (const change of [
    { identity: '../outside' },
    { publisher: '' },
    { publisher: 'CN=Contoso' },
    { publisher: 'CN=Example <corp>' },
    { version: '1.0.0-rc.1' },
    { version: '1.0.0.65536' },
  ]) assert.throws(() => validateMsixIdentity({ ...valid, ...change }));
});

test('publisher parsing rejects malformed, repeated and untrusted certificate subjects', () => {
  const invalid = [
    'CN=Valid Publisher,XYZ=unexpected',
    'CN=Valid Publisher,O=Organization,OU',
    'CN=Valid Publisher,O=Organization=Extra',
    'CN=Valid Publisher,OU=Unit,OU=Unit,'.repeat(250),
    'CN=Valid Publisher' + ',OU=Unit'.repeat(200),
    'CN=Valid Publisher, OU=Unit\\,Unexpected',
  ];
  for (const publisher of invalid) {
    assert.throws(() => validateMsixIdentity({ ...valid, publisher }), publisher.slice(0, 50));
  }
});

test('publisher identity cannot inject additional XML attributes', () => {
  assert.throws(() => renderMsixManifest({ ...valid, publisher: 'CN=Org" invalid="true' }));
});
