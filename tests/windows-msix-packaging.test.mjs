import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { renderMsixManifest, validateMsixIdentity } from '../scripts/build-windows-msix.mjs';

const valid = { identity: 'OpenManuscriptInitiative.OpenManuscriptStudio', publisher: 'CN=Open Manuscript Initiative, O=Open Manuscript Initiative, C=HU', version: '1.0.0.1', publisherDisplayName: 'Open Manuscript Initiative' };

test('manifest uses full-trust Windows desktop package and explicit deep-link protocol', () => {
  const manifest = renderMsixManifest(valid);
  for (const marker of ['Windows.FullTrustApplication', 'Name="runFullTrust"', 'windows.protocol', 'Name="openmanuscript"', 'ProcessorArchitecture="x64"', 'Version="1.0.0.1"']) {
    assert.ok(manifest.includes(marker), marker);
  }
  assert.match(manifest, /Publisher="CN=Open Manuscript Initiative, O=Open Manuscript Initiative, C=HU"/);
  assert.match(manifest, /<PublisherDisplayName>Open Manuscript Initiative<\/PublisherDisplayName>/);
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


test('Store Publisher display name uses Partner Center exact value instead of a hardcoded name', () => {
  const manifest = renderMsixManifest({ ...valid, publisherDisplayName: 'Registered Legal Publisher' });
  assert.match(manifest, /<PublisherDisplayName>Registered Legal Publisher<\/PublisherDisplayName>/);
  assert.throws(() => renderMsixManifest({ ...valid, publisherDisplayName: '' }));
  assert.throws(() => renderMsixManifest({ ...valid, publisherDisplayName: 'Invalid' + String.fromCharCode(0) }));
  assert.match(renderMsixManifest({ ...valid, publisherDisplayName: 'Smith & Company' }), /Smith &amp; Company/);
});

test('Store candidate workflow cannot depend on a skipped external signing action', async () => {
  const workflow = await readFile(new URL('../.github/workflows/windows-msix.yml', import.meta.url), 'utf8');
  // GitHub checks all referenced actions before evaluating job-level conditions.
  // An unused direct-signing branch previously prevented Store runs from starting.
  const actions = [...workflow.matchAll(/^\s+uses:\s*(\S+)/gm)].map(match => match[1]);
  const buildActions = new Set([
    'actions/checkout@v7', 'actions/setup-node@v7',
    'dtolnay/rust-toolchain@stable', 'swatinem/rust-cache@v2',
    'actions/upload-artifact@v7',
  ]);
  assert.ok(actions.length > 0);
  for (const action of actions) assert.ok(buildActions.has(action), 'Unexpected action in Store workflow: ' + action);
  assert.doesNotMatch(workflow, /secrets\.|inputs\.distribution|sign-direct:|windows-signing/);
  assert.match(workflow, /name: omi-studio-windows-msix-store-unsigned/);
  assert.match(workflow, /if-no-files-found: error/);
});
