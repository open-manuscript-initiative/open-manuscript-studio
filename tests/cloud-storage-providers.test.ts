import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloudStorageProviders,
  getCloudConnectionMethods,
  getDefaultCloudConnectionMethod,
  type CloudAccountType,
  type CloudStorageProviderId,
} from '../src/integrations/cloudStorageProviders.ts';

test('locally synchronized folder is a provider method, not a provider entry', () => {
  assert.equal(cloudStorageProviders.some((provider) => provider.id === 'local-folder'), false);
});

const synchronizedProviders: Array<[CloudStorageProviderId, CloudAccountType]> = [
  ['nextcloud', 'personal'],
  ['onedrive', 'personal'],
  ['sharepoint', 'business'],
  ['google-drive', 'personal'],
  ['dropbox', 'personal'],
  ['icloud-drive', 'personal'],
];

for (const [providerId, accountType] of synchronizedProviders) {
  test(`${providerId} recommends its locally synchronized folder on desktop`, () => {
    const methods = getCloudConnectionMethods(providerId, accountType, 'desktop');
    const local = methods.find((method) => method.id === 'local-folder');
    assert.ok(local);
    assert.equal(local.available, true);
    assert.equal(local.recommended, true);
    assert.equal(getDefaultCloudConnectionMethod(providerId, accountType, 'desktop'), 'local-folder');
  });
}

test('plain WebDAV remains a direct connection without a local-folder method', () => {
  const methods = getCloudConnectionMethods('webdav', 'personal', 'desktop');
  assert.equal(methods.some((method) => method.id === 'local-folder'), false);
  assert.equal(getDefaultCloudConnectionMethod('webdav', 'personal', 'desktop'), 'webdav');
});

test('local provider folders are not filesystem-accessible from the hosted web Studio', () => {
  const methods = getCloudConnectionMethods('onedrive', 'personal', 'web');
  const local = methods.find((method) => method.id === 'local-folder');
  assert.ok(local);
  assert.equal(local.available, false);
});

test('Nextcloud uses WebDAV as the available web default', () => {
  assert.equal(getDefaultCloudConnectionMethod('nextcloud', 'personal', 'web'), 'webdav');
});
