import assert from 'node:assert/strict';
import { createHash, scryptSync } from 'node:crypto';
import { mock, test } from 'node:test';

process.env.IDENTITY_DATABASE_URL = 'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic';
delete globalThis.identityPrisma;
const constructors = [];
const sessions = new Map();
let migrated = false;
let preferenceFailure = null;
let preferenceReads = 0;
const user = {
  id: 'synthetic-owner', email: 'owner@example.test', fullName: 'Synthetic owner',
  passwordHash: `scrypt:synthetic-salt:${scryptSync('correct-password', 'synthetic-salt', 64).toString('hex')}`,
  affiliation: null, affiliationRorId: null, country: null, website: null, orcid: null,
  bio: null, timeZone: null, interfaceLanguage: 'en', workflowRole: 'translator',
  status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
};
const missingColumn = (column = 'users.workflow_role') => Object.assign(
  new Error(`The column ${column} does not exist in the current database.`),
  { code: 'P2022', meta: { modelName: 'User', column } },
);

class SyntheticIdentityClient {
  constructor(options) {
    constructors.push(options);
    const account = () => {
      // Simulate both direct account lookups and nested session user projections.
      // A client that implicitly fetches the optional column reproduces the outage.
      if (!migrated && options.omit?.user?.workflowRole !== true) throw missingColumn();
      const { workflowRole: _omitted, ...required } = user;
      return required;
    };
    this.user = {
      findUnique: async (args) => {
        if (args.select?.workflowRole) {
          preferenceReads += 1;
          if (preferenceFailure) throw preferenceFailure;
          if (!migrated) throw missingColumn();
          return { workflowRole: user.workflowRole };
        }
        return account();
      },
      update: async ({ data }) => { Object.assign(user, data); return account(); },
    };
    this.userSession = {
      create: async ({ data }) => { sessions.set(data.tokenHash, { id: data.tokenHash, ...data }); return data; },
      findUnique: async ({ where }) => {
        const session = sessions.get(where.tokenHash);
        return session ? { ...session, user: account() } : null;
      },
      delete: async ({ where }) => { sessions.delete(where.id); },
    };
  }
}

mock.module(new URL('../server/node_modules/@prisma/adapter-pg/dist/index.mjs', import.meta.url).href, {
  namedExports: { PrismaPg: class SyntheticAdapter {} },
});
mock.module(new URL('../server/dist/generated/identity-prisma/client.js', import.meta.url).href, {
  namedExports: { PrismaClient: SyntheticIdentityClient },
});
mock.module(new URL('../server/dist/identity/studioPrincipalBridge.js', import.meta.url).href, {
  namedExports: { ensureStudioPrincipal: async () => {}, getStudioPrincipalByEmail: async () => null },
});
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma: {} } });
mock.module(new URL('../server/dist/services/assignmentInvitationService.js', import.meta.url).href, { namedExports: { consumeAssignmentInvitation: async () => null } });
const { loginUser, loginUserWithPasskey, getUserForSession } = await import('../server/dist/services/authService.js');
const { isMissingWorkflowRoleColumn, readWorkflowRolePreference } = await import('../server/dist/services/workflowRoleStorage.js');

test('password login succeeds on the pre-migration schema and returns the full workspace', async () => {
  const result = await loginUser({ email: user.email, password: 'correct-password' });
  assert.equal(result.user.id, user.id);
  assert.equal(result.user.preferences.workflowRole, 'general');
  assert.equal(typeof result.token, 'string');
  assert.equal(constructors[0].omit.user.workflowRole, true);
});

test('passkey login and nested session restoration do not require the role column', async () => {
  const result = await loginUserWithPasskey(user.id);
  assert.equal(result.user.preferences.workflowRole, 'general');
  assert.equal((await getUserForSession(result.token)).preferences.workflowRole, 'general');
});

test('invalid passwords and disabled accounts still fail without creating sessions', async () => {
  const count = sessions.size;
  await assert.rejects(loginUser({ email: user.email, password: 'wrong-password' }), /Incorrect/);
  assert.equal(sessions.size, count);
  user.status = 'DISABLED';
  try {
    await assert.rejects(loginUserWithPasskey(user.id), /not active/);
    await assert.rejects(loginUser({ email: user.email, password: 'correct-password' }), /not active/);
    assert.equal(sessions.size, count);
  } finally { user.status = 'ACTIVE'; }
});

test('expired and invalid sessions remain unauthenticated', async () => {
  const result = await loginUserWithPasskey(user.id);
  const hash = createHash('sha256').update(result.token).digest('hex');
  sessions.get(hash).expiresAt = new Date(0);
  const reads = preferenceReads;
  assert.equal(await getUserForSession(result.token), null);
  assert.equal(await getUserForSession('invalid-token'), null);
  assert.equal(preferenceReads, reads);
});

test('only the exact missing preference column is eligible for fallback', async () => {
  assert.equal(isMissingWorkflowRoleColumn(missingColumn()), true);
  assert.equal(isMissingWorkflowRoleColumn({ code: 'P2022', message: 'The column `users.workflow_role` does not exist.' }), true);
  for (const error of [missingColumn('users.email'), { code: 'P1001', message: 'workflow_role connection error' }, { code: 'P2022', meta: { modelName: 'Other', column: 'workflow_role' } }]) {
    assert.equal(isMissingWorkflowRoleColumn(error), false);
    preferenceFailure = error;
    await assert.rejects(readWorkflowRolePreference(user.id), (received) => received === error);
  }
  preferenceFailure = null;
});

test('saved roles become available immediately after migration without a client restart', async () => {
  migrated = true;
  const result = await loginUserWithPasskey(user.id);
  assert.equal(result.user.preferences.workflowRole, 'translator');
  user.workflowRole = 'editor';
  assert.equal((await getUserForSession(result.token)).preferences.workflowRole, 'editor');
  assert.equal(constructors.length, 1);
});
