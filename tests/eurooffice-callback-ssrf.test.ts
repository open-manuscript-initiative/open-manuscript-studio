import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateEuroOfficeCallbackSource } from '../server/src/integrations/eurooffice/callbackUrl.ts';
import {
  connectionTimePublicLookup,
  fetchPinnedPublicUrl,
} from '../server/src/cloud/security/connectionPinnedHttp.ts';

const configured = 'https://office.openmanuscript.org';

test('EuroOffice callback accepts signed document server cache URLs on the exact configured HTTPS origin', () => {
  const value = validateEuroOfficeCallbackSource(
    'https://office.openmanuscript.org/cache/files/doc.docx?expires=123&md5=abc',
    configured,
  );
  assert.equal(value.origin, configured);
  assert.equal(value.searchParams.get('expires'), '123');
});

test('EuroOffice callback rejects alternate origins, userinfo, protocol downgrades, ports, fragments and invalid URLs', () => {
  for (const candidate of [
    'http://office.openmanuscript.org/cache/file.docx',
    'https://office.openmanuscript.org.attacker.test/file.docx',
    'https://office.openmanuscript.org:8443/file.docx',
    'https://office.openmanuscript.org@169.254.169.254/file.docx',
    'https://user:pass@office.openmanuscript.org/file.docx',
    'https://office.openmanuscript.org/file.docx#ignored',
    'https://127.0.0.1:3001/api/health',
    'https://[::1]/',
    'file:///etc/passwd',
    '/relative/file.docx',
    'not-a-url',
  ]) {
    assert.throws(() => validateEuroOfficeCallbackSource(candidate, configured), /callback URL/);
  }
  assert.throws(() =>
    validateEuroOfficeCallbackSource('https://127.0.0.1/file.docx', 'http://127.0.0.1'),
  /callback URL/);
});

test('callback download rechecks DNS at the actual connection instead of trusting preflight', async () => {
  const answers = [{ address: '203.0.113.9', family: 4 }];
  const url = new URL(configured + '/cache/fixture.docx');
  const lookup = connectionTimePublicLookup(url, async () => answers);
  const connect = (): Promise<string> => new Promise((resolve, reject) => {
    lookup(url.hostname, { family: 4 }, (error, address) => {
      if (error) reject(error);
      else resolve(String(address));
    });
  });
  await assert.rejects(connect, /private or reserved/); // documentation IP is never public
  answers[0] = { address: '1.1.1.1', family: 4 };
  assert.equal(await connect(), '1.1.1.1');
  answers[0] = { address: '169.254.169.254', family: 4 };
  await assert.rejects(connect, /private or reserved/);
  answers[0] = { address: '127.0.0.1', family: 4 };
  await assert.rejects(connect, /private or reserved/);
  answers[0] = { address: '8.8.8.8', family: 4 };
  assert.equal(await connect(), '8.8.8.8');
  answers.push({ address: 'fd00::1', family: 6 });
  await assert.rejects(connect, /private or reserved/);
});

test('production callback destination disallows direct metadata and loopback IP sockets', async () => {
  const oldEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    for (const target of [
      'https://169.254.169.254/latest/meta-data/',
      'https://127.0.0.1:3001/api/health',
      'https://[::ffff:127.0.0.1]/cache/docx',
      'https://[::1]/cache/docx',
    ]) {
      await assert.rejects(fetchPinnedPublicUrl(target, {
        method: 'GET', redirect: 'error',
      }), /private or reserved/);
    }
  } finally {
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});

test('EuroOffice callback code paths retain capability check, DOCX limits and pinned no-redirect fetch', () => {
  const source = readFileSync(
    new URL('../server/src/services/euroOfficeService.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /const session = await capability\(documentId, token\)/);
  assert.match(source, /validateEuroOfficeCallbackSource\(callback\.url, env\.EUROOFFICE_URL!\)/);
  assert.match(source, /readBoundedDocx\(await fetchPinnedPublicUrl\(source, /);
  assert.match(source, /redirect: 'error'/);
  assert.doesNotMatch(source, /\bawait fetch\(source/);
});
