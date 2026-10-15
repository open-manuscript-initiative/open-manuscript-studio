import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const userId = '10000000-0000-4000-8000-000000000001';
const credentialId = 'passkey-credential-id-0123456789';
const challengeValue = 'authchallenge0123456789';
let loginCalls = 0;
let loginChallengeAvailable = false;

const identityPrisma = {
  userPasskey: {
    findMany: async () => [],
    findUnique: async () => ({
      id: '20000000-0000-4000-8000-000000000001',
      userId,
      credentialId,
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0n,
      transports: ['internal'],
      user: { id: userId, status: 'ACTIVE' },
    }),
    update: async () => ({}),
    deleteMany: async () => ({ count: 1 }),
    create: async () => ({}),
  },
  passkeyChallenge: {
    deleteMany: async ({ where }) => {
      if (!where.id) return { count: 0 };
      if (!loginChallengeAvailable) return { count: 0 };
      loginChallengeAvailable = false;
      return { count: 1 };
    },
    create: async ({ data }) => {
      if (data.purpose === 'AUTHENTICATION') loginChallengeAvailable = true;
      return {};
    },
    findFirst: async ({ where }) => where.purpose === 'AUTHENTICATION' && loginChallengeAvailable
      ? { id: '30000000-0000-4000-8000-000000000001', challenge: challengeValue }
      : null,
  },
  user: { findUnique: async () => ({ id: userId, status: 'ACTIVE' }) },
};

mock.module(new URL('../server/node_modules/@simplewebauthn/server/esm/index.js', import.meta.url).href, {
  namedExports: {
    generateAuthenticationOptions: async (input) => {
      assert.equal(input.userVerification, 'required');
      assert.equal(input.allowCredentials, undefined);
      return { challenge: challengeValue };
    },
    generateRegistrationOptions: async (input) => {
      assert.equal(input.authenticatorSelection.authenticatorAttachment, 'platform');
      assert.equal(input.authenticatorSelection.residentKey, 'required');
      assert.equal(input.authenticatorSelection.userVerification, 'required');
      return { challenge: 'registrationchallenge012345' };
    },
    verifyAuthenticationResponse: async (input) => {
      assert.equal(input.expectedChallenge, challengeValue);
      assert.equal(input.expectedOrigin, 'https://studio.example.test');
      assert.equal(input.expectedRPID, 'studio.example.test');
      return { verified: true, authenticationInfo: { newCounter: 1, credentialBackedUp: true } };
    },
    verifyRegistrationResponse: async () => ({ verified: false }),
  },
});
mock.module(new URL('../server/dist/repositories/passkeyRepository.js', import.meta.url).href, {
  namedExports: { passkeyRepository: identityPrisma },
});
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: { env: { FRONTEND_ORIGIN: 'https://studio.example.test' } },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: {
    requireSession: (request, response, next) => {
      if (request.headers['x-test-user'] !== userId) {
        response.sendStatus(401);
        return;
      }
      request.authUserId = userId;
      next();
    },
  },
});
mock.module(new URL('../server/dist/services/authService.js', import.meta.url).href, {
  namedExports: {
    loginUserWithPasskey: async (id) => {
      assert.equal(id, userId);
      loginCalls += 1;
      return { user: { id }, token: 'session-token', expiresAt: new Date('2030-01-01T00:00:00Z') };
    },
  },
});

const { passkeyRouter } = await import('../server/dist/routes/passkeyRoutes.js');
const app = express();
app.use(express.json());
app.use((_request, response, next) => { response.cookie = () => response; next(); });
app.use('/api/v1/auth', passkeyRouter);
app.use(passkeyRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});

async function request(path, body, user = null) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(user ? { 'x-test-user': user } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

test('passkey login requires a discoverable user handle and creates a session only after verification', async (t) => {
  t.after(() => server.close());
  loginCalls = 0;
  loginChallengeAvailable = false;
  const rawUserHandle = Buffer.from(userId.replaceAll('-', ''), 'hex').toString('base64url');

  assert.equal((await request('/passkeys/registration/options', {})).status, 401);
  const registration = await request('/passkeys/registration/options', {}, userId);
  assert.equal(registration.status, 200);
  assert.equal(registration.body.challenge, 'registrationchallenge012345');
  assert.equal((await request('/api/v1/auth/passkeys/registration/options', {}, userId)).status, 200);
  const v1Options = await request('/api/v1/auth/passkeys/login/options', {});
  assert.equal(v1Options.status, 200);
  assert.equal(v1Options.body.challenge, challengeValue);
  const options = await request('/passkeys/login/options', {});
  assert.equal(options.status, 200);
  assert.equal(options.body.challenge, challengeValue);

  const rejected = await request('/passkeys/login/verify', {
    challenge: challengeValue,
    response: { id: credentialId, response: { userHandle: 'wrong-user-handle' } },
  });
  assert.equal(rejected.status, 401);
  assert.equal(loginCalls, 0);

  const accepted = await request('/passkeys/login/verify', {
    challenge: challengeValue,
    response: { id: credentialId, response: { userHandle: rawUserHandle } },
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.user.id, userId);
  assert.equal(loginCalls, 1);

  const replay = await request('/passkeys/login/verify', {
    challenge: challengeValue,
    response: { id: credentialId, response: { userHandle: rawUserHandle } },
  });
  assert.equal(replay.status, 401);
  assert.equal(loginCalls, 1);
});
