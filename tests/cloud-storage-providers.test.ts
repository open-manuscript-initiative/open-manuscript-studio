import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloudStorageProviders,
  getCloudConnectionMethods,
  getDefaultCloudConnectionMethod,
} from '../src/integrations/cloudStorageProviders.ts';
import { hasNativeSystemStorage } from '../src/mobile/platform/platform.ts';

test('system storage is enabled for every installed Studio platform', () => {
  assert.equal(hasNativeSystemStorage('desktop'), true);
  assert.equal(hasNativeSystemStorage('android'), true);
  assert.equal(hasNativeSystemStorage('ios'), true);
  assert.equal(hasNativeSystemStorage('web'), false);
});

test('native system storage is not duplicated as a cloud provider entry', () => {
  assert.equal(cloudStorageProviders.some((provider) => provider.id === 'local-folder'), false);
});

test('provider configuration contains only direct Studio-managed connections', () => {
  for (const provider of cloudStorageProviders) {
    for (const platform of ['desktop', 'android', 'ios', 'web'] as const) {
      const accountType = provider.accountTypes[0] ?? 'personal';
      const methods = getCloudConnectionMethods(provider.id, accountType, platform);
      assert.equal(methods.some((method) => method.id === 'local-folder'), false);
    }
  }
});

test('Nextcloud and WebDAV use direct WebDAV when configured', () => {
  assert.equal(getDefaultCloudConnectionMethod('nextcloud', 'personal', 'desktop'), 'webdav');
  assert.equal(getDefaultCloudConnectionMethod('nextcloud', 'personal', 'android'), 'webdav');
  assert.equal(getDefaultCloudConnectionMethod('nextcloud', 'personal', 'web'), 'webdav');
  assert.equal(getDefaultCloudConnectionMethod('webdav', 'personal', 'desktop'), 'webdav');
});

test('planned OAuth providers remain optional direct connections', () => {
  const methods = getCloudConnectionMethods('onedrive', 'personal', 'desktop');
  assert.equal(methods.length, 1);
  assert.equal(methods[0]?.id, 'oauth2');
  assert.equal(methods[0]?.available, false);
  assert.equal(getDefaultCloudConnectionMethod('onedrive', 'personal', 'desktop'), 'oauth2');
});

test('iCloud requires no Studio-side provider connection to use system storage', () => {
  assert.equal(getCloudConnectionMethods('icloud-drive', 'personal', 'desktop').length, 0);
  assert.equal(getDefaultCloudConnectionMethod('icloud-drive', 'personal', 'desktop'), null);
});
