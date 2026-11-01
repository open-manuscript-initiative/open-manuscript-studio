import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { connectionTimePublicLookup, requestPinnedPublicUrl } from '../server/src/cloud/security/connectionPinnedHttp.ts';

const template = readFileSync(
  new URL('../deployment/systemd/omi-studio-api-egress-shared-uid.conf', import.meta.url),
  'utf8',
);

type Answer = { address: string; family: number };

function resolveWith(
  answers: Answer[],
): (hostname: string, options: { all: true; verbatim: true }) => Promise<Answer[]> {
  return async () => answers;
}

function lookupAddresses(
  address: string,
  answers: Answer[],
): Promise<Answer[]> {
  const fn = connectionTimePublicLookup(new URL(address), resolveWith(answers));
  return new Promise((resolve, reject) => {
    fn(new URL(address).hostname, { all: true }, (error, resolved) => {
      if (error) reject(error);
      else resolve(resolved as Answer[]);
    });
  });
}

test('shared-Plesk-UID template scopes policy to only one systemd service and preserves loopback', () => {
  assert.match(template, /^\[Service\]$/m);
  assert.match(template, /^IPAddressAllow=localhost$/m);
  assert.match(template, /IPAddressDeny=.*10\.0\.0\.0\/8/m);
  assert.match(template, /IPAddressDeny=.*169\.254\.0\.0\/16/m);
  assert.match(template, /IPAddressDeny=.*fc00::\/7/m);
  assert.match(template, /IPAddressDeny=.*fe80::\/10/m);
  assert.doesNotMatch(template, /^(?:User|Group|ExecStart|Slice|IPAddressDeny=any)=/m);
  assert.doesNotMatch(template, /^(?:IPIngressFilterPath|IPEgressFilterPath|BPFProgram)=/m);
  assert.doesNotMatch(template, /\b(?:skuid|nft|iptables|flush ruleset)\b/i);
});

test('WebDAV connects to the publicly validated IP from the lookup used by the socket', async () => {
  const url = 'https://webdav.public.example/doc';
  assert.deepEqual(await lookupAddresses(url, [
    { address: '1.1.1.1', family: 4 },
    { address: '2606:4700:4700::1111', family: 6 },
  ]), [
    { address: '1.1.1.1', family: 4 },
    { address: '2606:4700:4700::1111', family: 6 },
  ]);
});

test('a rebinding answer containing ANY private IPv4 or IPv6 address fails closed', async () => {
  const url = 'https://webdav.public.example/doc';
  for (const addresses of [
    [{ address: '127.0.0.1', family: 4 }],
    [{ address: '169.254.169.254', family: 4 }],
    [{ address: '10.0.0.3', family: 4 }],
    [{ address: '::ffff:127.0.0.1', family: 6 }],
    [{ address: 'fd00::1', family: 6 }],
    [{ address: '1.1.1.1', family: 4 }, { address: '127.0.0.1', family: 4 }],
    [],
  ]) {
    await assert.rejects(() => lookupAddresses(url, addresses), /private or reserved/);
  }
});

test('private DNS answers are rechecked on every connection, rather than only at setup', async () => {
  const answers = [{ address: '8.8.8.8', family: 4 }];
  const url = new URL('https://webdav.public.example/');
  const lookup = connectionTimePublicLookup(url, resolveWith(answers));
  const connect = () => new Promise<Answer[]>((resolve, reject) => {
    lookup(url.hostname, { all: true }, (error, address) => error ? reject(error) : resolve(address as Answer[]));
  });
  assert.deepEqual(await connect(), answers);
  answers[0] = { address: '169.254.169.254', family: 4 };
  await assert.rejects(connect, /private or reserved/);
});

test('literal private destinations are rejected before creating an outbound socket', async () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    await assert.rejects(
      requestPinnedPublicUrl(new URL('https://169.254.169.254/'), { method: 'GET' }),
      /private or reserved/,
    );
    await assert.rejects(
      requestPinnedPublicUrl(new URL('https://[::ffff:127.0.0.1]/'), { method: 'GET' }),
      /private or reserved/,
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
