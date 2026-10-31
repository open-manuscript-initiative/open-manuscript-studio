import assert from 'node:assert/strict';
import test from 'node:test';
import { COLLABORATION_ROLE_ACTIONS, collaborationDecision } from '../server/src/services/collaborationPolicy.ts';

const evidence = { principalId: 'author', documentId: 'A', role: 'AUTHOR', revoked: false };
const request = { principalId: 'author', documentId: 'A', action: 'edit-content' as const };

test('explicit accepted membership allows only declared scoped actions', () => {
  assert.equal(collaborationDecision(evidence, request).allowed, true);
  assert.equal(collaborationDecision(evidence, { ...request, documentId: 'B' }).allowed, false);
  assert.equal(collaborationDecision(evidence, { ...request, principalId: 'other' }).allowed, false);
  assert.equal(collaborationDecision(evidence, { ...request, action: 'approve-or-publish' }).allowed, false);
});
test('unknown principals, pending invitations and administrative or scholarly labels grant no rights', () => {
  assert.equal(collaborationDecision(null, request).allowed, false);
  for (const role of ['PENDING', 'ADMIN', 'TRANSLATOR', 'reviewer', 'constructor', '__proto__']) {
    assert.equal(collaborationDecision({ ...evidence, role }, request).allowed, false);
  }
  assert.equal(collaborationDecision(evidence, { ...request, principalId: '' }).allowed, false);
});
test('denials, revocation and expired or malformed expiry override a broad role', () => {
  assert.equal(collaborationDecision({ ...evidence, deniedActions: ['edit-content'] }, request).allowed, false);
  assert.equal(collaborationDecision({ ...evidence, revoked: true }, request).allowed, false);
  for (const expiresAt of [0, 99, NaN, Infinity]) assert.equal(collaborationDecision({ ...evidence, expiresAt }, request, 100).allowed, false);
});
test('viewer cannot edit, invite or manage members, and no role implies editorial approval', () => {
  const viewer = { ...evidence, role: 'VIEWER' };
  assert.equal(collaborationDecision(viewer, { ...request, action: 'read' }).allowed, true);
  for (const action of ['edit-content', 'invite', 'manage-members'] as const) assert.equal(collaborationDecision(viewer, { ...request, action }).allowed, false);
  for (const role of Object.keys(COLLABORATION_ROLE_ACTIONS)) assert.equal(collaborationDecision({ ...evidence, role }, { ...request, action: 'approve-or-publish' }).allowed, false);
});
