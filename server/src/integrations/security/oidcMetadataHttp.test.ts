import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';

import {
  assertOidcIssuerBinding,
  assertOidcRemoteUrl,
  createPinnedRemoteJWKSet,
  fetchOidcDiscovery,
  fetchOidcUserInfo,
  readOidcJson,
} from './oidcMetadataHttp.js';

test('OIDC discovery and JWKS reject credential-bearing, non-HTTPS and private destinations', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    for (const url of [
      'http://identity.example.org/.well-known/openid-configuration',
      'https://user:pass@identity.example.org/jwks',
      'https://169.254.169.254/latest/meta-data',
      'https://127.0.0.1:3001/api/health',
      'https://[::ffff:127.0.0.1]/keys',
      'https://identity.example.org/keys#fragment',
    ]) {
      assert.throws(() => assertOidcRemoteUrl(url), /HTTPS|private or reserved/);
    }
    assert.doesNotThrow(() => assertOidcRemoteUrl('https://accounts.google.com'));
    assert.doesNotThrow(() => assertOidcRemoteUrl('https://oauth2.googleapis.com/token'));
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
});

test('metadata issuer is bound to configuration with only Microsoft public-cloud tenant template allowed', () => {
  assert.doesNotThrow(() => assertOidcIssuerBinding('https://accounts.google.com', 'https://accounts.google.com'));
  assert.doesNotThrow(() => assertOidcIssuerBinding(
    'https://login.microsoftonline.com/common/v2.0',
    'https://login.microsoftonline.com/{tenantid}/v2.0',
  ));
  for (const candidate of [
    'https://attacker.example',
    'https://login.microsoftonline.com/{other}/v2.0',
    'https://login.microsoftonline.com/{tenantid}/v1.0',
  ]) {
    assert.throws(() => assertOidcIssuerBinding('https://login.microsoftonline.com/common/v2.0', candidate), /issuer/);
  }
  assert.throws(() => assertOidcIssuerBinding(
    'https://oidc.institution.example',
    'https://login.microsoftonline.com/{tenantid}/v2.0',
  ), /issuer/);
});

test('OIDC JSON decoding enforces a byte limit even without Content-Length', async () => {
  assert.deepEqual(await readOidcJson(new Response('{"valid":true}'), 128), { valid: true });
  await assert.rejects(
    readOidcJson(new Response('{"padded":"' + 'X'.repeat(4096) + '"}', { headers: { 'Content-Length': '0' } }), 512),
    /exceeds/,
  );
  await assert.rejects(readOidcJson(new Response('{bad json}')), /invalid JSON/);
});

test('discovery, UserInfo and JOSE JWKS requests are socket-pinned and reject redirects', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key-id';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  const seen: string[] = [];
  const server = createServer((req, res) => {
    seen.push(req.url ?? '');
    if (req.url === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
        issuer: 'http://127.0.0.1',
        authorization_endpoint: 'http://127.0.0.1/authorize',
        token_endpoint: 'http://127.0.0.1/token',
        jwks_uri: 'http://127.0.0.1/keys',
      }));
      return;
    }
    if (req.url === '/userinfo') {
      assert.equal(req.headers.authorization, 'Bearer TEST-ACCESS-TOKEN');
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"sub":"person-1"}');
      return;
    }
    if (req.url === '/keys') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/keys' }).end();
      return;
    }
    res.writeHead(404).end();
  });
  try {
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;

    const discovery = await fetchOidcDiscovery(base);
    assert.equal(discovery.jwks_uri, 'http://127.0.0.1/keys');
    assert.deepEqual(await fetchOidcUserInfo(base + '/userinfo', 'TEST-ACCESS-TOKEN'), { sub: 'person-1' });

    const signed = await new SignJWT({ sub: 'person-1', nonce: 'known' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
      .setIssuer(base)
      .setAudience('test-client')
      .setExpirationTime('5m')
      .sign(privateKey);
    const verified = await jwtVerify(signed, createPinnedRemoteJWKSet(base + '/keys'), {
      issuer: base,
      audience: 'test-client',
    });
    assert.equal(verified.payload.sub, 'person-1');
    await assert.rejects(
      jwtVerify(signed, createPinnedRemoteJWKSet(base + '/redirect'), {
        issuer: base,
        audience: 'test-client',
      }),
      /redirect/i,
    );
    assert.deepEqual(seen, [
      '/.well-known/openid-configuration',
      '/userinfo',
      '/keys',
      '/redirect',
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => { server.close((error) => { if (error) reject(error); else resolve(); }); });
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
