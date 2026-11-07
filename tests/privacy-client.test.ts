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
