import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const user = {
  id: 'profile-owner', email: 'owner@example.test', fullName: 'Profile owner',
  affiliation: null, affiliationRorId: null, country: null, website: null, orcid: null,
  bio: null, timeZone: null, workflowRole: 'general', interfaceLanguage: 'en',
  status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
};
const updates = [];
const principals = [];
let hasSession = true;
mock.module(new URL('../server/dist/lib/identityPrisma.js', import.meta.url).href, {
  namedExports: { identityPrisma: {
    userSession: { findUnique: async () => hasSession ? { userId: user.id, expiresAt: new Date(Date.now() + 60_000), user } : null },
    user: {
      findUnique: async () => ({ workflowRole: user.workflowRole }),
      update: async (input) => { updates.push(input); Object.assign(user, input.data); return user; },
    },
  } },
});
mock.module(new URL('../server/dist/identity/studioPrincipalBridge.js', import.meta.url).href, {
  namedExports: { ensureStudioPrincipal: async (input) => { principals.push(input); }, getStudioPrincipalByEmail: async () => null },
});
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma: {} } });
mock.module(new URL('../server/dist/services/assignmentInvitationService.js', import.meta.url).href, { namedExports: { consumeAssignmentInvitation: async () => null } });
const { getUserForSession, updateUserForSession } = await import('../server/dist/services/authService.js');

test('saved working role is returned on subsequent session reads and stays out of principal authorization', async () => {
  const result = await updateUserForSession('session-token', { workflowRole: 'translator' });
  assert.equal(result.preferences.workflowRole, 'translator');
  assert.deepEqual(updates.at(-1), { where: { id: user.id }, data: { workflowRole: 'translator' } });
  assert.equal((await getUserForSession('session-token')).preferences.workflowRole, 'translator');
  assert.equal(principals.at(-1).workflowRole, undefined);
  assert.equal(principals.at(-1).role, undefined);
  await updateUserForSession('session-token', { bio: 'Updated biography' });
  assert.equal(user.workflowRole, 'translator');
  assert.equal(updates.at(-1).data.workflowRole, undefined);
  const reset = await updateUserForSession('session-token', { workflowRole: 'general' });
  assert.equal(reset.preferences.workflowRole, 'general');
});

test('missing sessions cannot change the profile preference', async () => {
  hasSession = false;
  const before = updates.length;
  assert.equal(await updateUserForSession('invalid-token', { workflowRole: 'editor' }), null);
  assert.equal(updates.length, before);
});
