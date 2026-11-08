import assert from 'node:assert/strict';
import test from 'node:test';
import { publicPrivacyLink, privacyContactLink } from '../src/services/privacyApi.ts';

test('external privacy links reject executable URLs and embedded credentials', () => {
  assert.equal(publicPrivacyLink('https://example.test/privacy'), 'https://example.test/privacy');
  for (const url of ['javascript:alert(1)', 'data:text/html,unsafe', 'http://example.test', 'https://user:password@example.test', '/relative', 'privacy@example.test,other@example.test', 'privacy@example.test;other@example.test', 'privacy@example.test%0ABcc:other@example.test', 'invalid']) {
    assert.equal(publicPrivacyLink(url), undefined);
  }
});
test('a privacy contact cannot inject mail headers, recipients or query parameters', () => {
  assert.match(privacyContactLink('privacy@example.test', 'Rights & access')!, /^mailto:privacy%40example.test\?subject=Rights%20%26%20access$/);
  for (const email of ['privacy@example.test?bcc=other@example.test', 'privacy@example.test\r\nBcc: other@example.test', 'privacy@example.test&body=secret', 'privacy@example.test,other@example.test', 'privacy@example.test;other@example.test', 'privacy@example.test%0ABcc:other@example.test', 'invalid']) {
    assert.equal(privacyContactLink(email, 'Rights'), undefined);
  }
});

test('privacy clients use v1 and keep public notice requests credential-free across native server selection', async () => {
  const { fetchPrivacyNotice, fetchAccountData } = await import('../src/services/privacyApi.ts');
  const { persistNativeServerSelection } = await import('../src/platform/nativeServerSelection.ts');
  const descriptors = ['location', 'localStorage', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const calls: Array<{ url: string; headers: Headers; credentials: RequestCredentials | undefined }> = [];
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol: 'tauri:', hostname: 'localhost' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (url: string, init: RequestInit) => {
      calls.push({ url, headers: new Headers(init.headers), credentials: init.credentials });
      assert.equal(init.cache, 'no-store');
      return new Response(JSON.stringify(url.endsWith('/privacy') ? { configured: false } : { schema: 'omi-account-overview/1' }));
    } });
    persistNativeServerSelection('https://one.example', storage);
    storage.setItem('omi_native_session_token', 'synthetic-old-token');
    assert.deepEqual(await fetchPrivacyNotice(), { configured: false });
    await fetchAccountData();
    persistNativeServerSelection('https://two.example', storage);
    await fetchAccountData();
    assert.equal(calls[0].url, 'https://one.example/api/v1/privacy');
    assert.equal(calls[0].credentials, 'omit');
    assert.equal(calls[0].headers.has('authorization'), false);
    assert.equal(calls[1].url, 'https://one.example/api/v1/account/data');
    assert.equal(calls[1].headers.get('authorization'), 'Bearer synthetic-old-token');
    assert.equal(calls[1].credentials, 'include');
    assert.equal(calls[2].url, 'https://two.example/api/v1/account/data');
    assert.equal(calls[2].headers.has('authorization'), false);
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
