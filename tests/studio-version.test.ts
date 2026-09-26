import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isNewerStudioVersion,
  normalizeStudioVersion,
} from '../src/services/studioVersion.ts';

test('normalizes release tags and build metadata', () => {
  assert.equal(normalizeStudioVersion(' v0.1.0-beta.4+build.12 '), '0.1.0-beta.4');
});

test('orders beta releases numerically', () => {
  assert.equal(isNewerStudioVersion('0.1.0-beta.10', '0.1.0-beta.9'), true);
  assert.equal(isNewerStudioVersion('0.1.0-beta.3', '0.1.0-beta.3'), false);
  assert.equal(isNewerStudioVersion('0.1.0-beta.2', '0.1.0-beta.3'), false);
});

test('orders stable releases after prereleases', () => {
  assert.equal(isNewerStudioVersion('0.1.0', '0.1.0-beta.9'), true);
  assert.equal(isNewerStudioVersion('0.2.0-alpha.1', '0.1.9'), true);
});

test('detects only newer valid Studio versions', () => {
  assert.equal(isNewerStudioVersion('v0.1.0-beta.4', '0.1.0-beta.3'), true);
  assert.equal(isNewerStudioVersion('0.1.0-beta.3', '0.1.0-beta.3'), false);
  assert.equal(isNewerStudioVersion('not-a-version', '0.1.0-beta.3'), false);
});
