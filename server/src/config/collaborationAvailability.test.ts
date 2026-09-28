import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveManuscriptCollaborationEnabled,
} from './collaborationAvailability.js';

test('enables manuscript collaboration by default in production', () => {
  assert.equal(
    resolveManuscriptCollaborationEnabled(undefined, 'production'),
    true,
  );
});

test('keeps manuscript collaboration disabled by default outside production', () => {
  assert.equal(
    resolveManuscriptCollaborationEnabled(undefined, 'development'),
    false,
  );

  assert.equal(
    resolveManuscriptCollaborationEnabled(undefined, 'test'),
    false,
  );
});

test('allows an explicit deployment setting to override the environment default', () => {
  assert.equal(
    resolveManuscriptCollaborationEnabled('true', 'test'),
    true,
  );

  assert.equal(
    resolveManuscriptCollaborationEnabled('false', 'production'),
    false,
  );
});
