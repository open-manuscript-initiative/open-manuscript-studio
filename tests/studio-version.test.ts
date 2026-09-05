import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareStudioVersions,
  isNewerStudioVersion,
  normalizeStudioVersion,
} from '../src/services/studioVersion.ts';

test('normalizes release tags and build metadata', () => {
  assert.equal(normalizeStudioVersion(' v0.1.0-beta.4+build.12 '), '0.1.0-beta.4');
});

test('orders beta releases numerically', () => {
  assert.equal(compareStudioVersions('0.1.0-beta.10', '0.1.0-beta.9'), 1);
  assert.equal(compareStudioVersions('0.1.0-beta.3', '0.1.0-beta.3'), 0);
  assert.equal(compareStudioVersions('0.1.0-beta.2', '0.1.0-beta.3'), -1);
});

test('orders stable releases after prereleases', () => {
  assert.equal(compareStudioVersions('0.1.0', '0.1.0-beta.9'), 1);
  assert.equal(compareStudioVersions('0.2.0-alpha.1', '0.1.9'), 1);
});

test('detects only newer valid Studio versions', () => {
  assert.equal(isNewerStudioVersion('v0.1.0-beta.4', '0.1.0-beta.3'), true);
  assert.equal(isNewerStudioVersion('0.1.0-beta.3', '0.1.0-beta.3'), false);
  assert.equal(isNewerStudioVersion('not-a-version', '0.1.0-beta.3'), false);
});
