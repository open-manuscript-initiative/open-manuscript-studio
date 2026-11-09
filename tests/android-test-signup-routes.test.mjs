import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { after, mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const env = {
  OMI_ANDROID_TEST_SIGNUPS_ENABLED: true,
  OMI_ANDROID_TEST_ORIGIN: 'https://studio.openmanuscript.org',
  MAIL_FROM: 'Studio <no-reply@openmanuscript.org>',
  SENDMAIL_PATH: '/mock/sendmail',
};
const calls = [];
const messages = [];
const prisma = {
  $executeRaw: async () => { calls.push('execute'); return 1; },
  $queryRaw: async () => { calls.push('query'); return [{ email: 'tester@example.test' }]; },
};
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: { env },
});
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma },
});
mock.module('node:child_process', {
  namedExports: {
    spawn: () => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin = new EventEmitter();
      child.stdin.end = (message) => {
        messages.push(message);
        queueMicrotask(() => child.emit('close', 0));
      };
      return child;
    },
  },
});

const { androidTestSignupRouter } = await import('../server/dist/routes/androidTestSignupRoutes.js');
const { apiCors } = await import('../server/dist/middleware/apiCors.js');
const { cookieOriginGuard } = await import('../server/dist/middleware/cookieOriginGuard.js');
const allowedOrigins = new Set(['https://studio.openmanuscript.org']);
const app = express();
app.set('trust proxy', 1);
// Use the same middleware ordering as the central API, not a router-only mock.
app.use(apiCors(allowedOrigins));
app.use(cookieOriginGuard(allowedOrigins));
app.use(express.json());
app.use('/api/public/android-test', express.urlencoded({ extended: false }), androidTestSignupRouter);
const server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
after(() => { server.closeAllConnections(); server.close(); });
const base = `http://127.0.0.1:${server.address().port}/api/public/android-test`;
const post = (path, body) => fetch(base + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('the signup API is disabled by default when central operation is not enabled', async () => {
  env.OMI_ANDROID_TEST_SIGNUPS_ENABLED = false;
  const response = await post('/signups', { email: 'tester@example.test', consent: true });
  assert.equal(response.status, 503);
  env.OMI_ANDROID_TEST_SIGNUPS_ENABLED = true;
});

test('validation prevents malformed addresses and missing consent', async () => {
  const invalid = await post('/signups', { email: 'not-an-email', consent: true });
  const noConsent = await post('/signups', { email: 'tester@example.test', consent: false });
  assert.equal(invalid.status, 400);
  assert.equal(noConsent.status, 400);
  assert.equal(messages.length, 0);
});

test('honeypot silently discards submissions without storing addresses', async () => {
  const before = calls.length;
  const response = await post('/signups', { email: 'bot@example.test', consent: true, website: 'spam' });
  assert.equal(response.status, 202);
  assert.equal(calls.length, before);
});

test('new application sends confirmation but does not grant Google Play entitlement', async () => {
  const response = await post('/signups', { email: 'Tester@Example.test', consent: true, language: 'hu' });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    received: true, requiresEmailConfirmation: true, playAccessGranted: false,
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Erősítsd meg/);
  assert.match(messages[0], /https:\/\/studio\.openmanuscript\.org\/api\/public\/android-test\/confirm\?token=/);
  assert.match(messages[0], /unsubscribe\?token=/);
});

test('GET confirmation only displays a form; POST performs a token-based confirmation', async () => {
  const token = 'a'.repeat(43);
  const view = await fetch(base + '/confirm?token=' + token + '&lang=hu');
  assert.equal(view.status, 200);
  assert.match(await view.text(), /<form method="post"/);
  assert.equal(view.headers.get('referrer-policy'), 'no-referrer');
  const body = new URLSearchParams({ token });
  const verify = await fetch(base + '/confirm', { method: 'POST', body });
  assert.equal(verify.status, 200);
  assert.match(await verify.text(), /Registration confirmed/);
});

test('the unsubscribe endpoint removes an applicant by a separate secret', async () => {
  const token = 'b'.repeat(43);
  const view = await fetch(base + '/unsubscribe?token=' + token);
  assert.equal(view.status, 200);
  assert.match(await view.text(), /Delete registration/);
  const response = await fetch(base + '/unsubscribe', {
    method: 'POST', body: new URLSearchParams({ token }),
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Registration removed/);
});

test('email-client navigation origins do not cause HTTP 500 for one-time public token pages', async () => {
  const token = 'c'.repeat(43);
  for (const origin of ['null', 'https://mail.example.test']) {
    const view = await fetch(base + '/confirm?token=' + token + '&lang=hu', {
      headers: { Origin: origin },
    });
    assert.equal(view.status, 200, 'confirmation GET with Origin ' + origin);
    assert.equal(view.headers.get('access-control-allow-origin'), null);
    assert.match(await view.text(), /Jelentkezés megerősítése/);
    const submit = await fetch(base + '/confirm', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    assert.equal(submit.status, 200, 'confirmation POST with Origin ' + origin);
    assert.equal(submit.headers.get('access-control-allow-origin'), null);
    assert.match(await submit.text(), /Registration confirmed/);
  }
  const remove = await fetch(base + '/unsubscribe', {
    method: 'POST',
    headers: { Origin: 'null', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: 'd'.repeat(43) }),
  });
  assert.equal(remove.status, 200);
  assert.equal(remove.headers.get('access-control-allow-origin'), null);
  assert.match(await remove.text(), /Registration removed/);
});

test('email token CORS exception never bypasses credentialed cookie Origin protection', async () => {
  const response = await fetch(base + '/confirm', {
    method: 'POST',
    headers: {
      Origin: 'https://mail.example.test',
      Cookie: 'omi_session=fake',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ token: 'e'.repeat(43) }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'COOKIE_ORIGIN_FORBIDDEN');
});
