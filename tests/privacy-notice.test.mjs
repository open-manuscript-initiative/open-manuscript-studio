import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPrivacyNotice, privacyNoticeSchema } from '../server/dist/config/privacyNotice.js';

export const fixture = {
  version: '2026-11-07', language: 'en', operatorReviewed: true,
  controller: { name: 'Synthetic Controller', postalAddress: 'Synthetic address', email: 'privacy@example.test' },
  noticeUrl: 'https://example.test/privacy', authority: { name: 'Synthetic Authority', url: 'https://example.test/authority' },
  processing: [{ purpose: 'Account', categories: 'Profile', legalBasis: 'Synthetic legal basis', retention: 'Synthetic period', recipients: 'Synthetic provider', internationalTransfers: 'Synthetic safeguards' }],
  rights: 'Synthetic rights', dataSources: 'Synthetic sources', requiredData: 'Synthetic required data', automatedDecisions: 'None', cookies: 'Synthetic storage', backups: 'Synthetic backup period', deletion: 'Synthetic deletion',
};

test('notice is explicitly absent until an operator supplies it', () => {
  assert.deepEqual(loadPrivacyNotice(undefined), { configured: false });
});
test('a reviewed notice requires controller, purpose, retention, rights and safe URLs', () => {
  assert.ok(privacyNoticeSchema.safeParse(fixture).success);
  for (const changed of [
    { ...fixture, operatorReviewed: false }, { ...fixture, controller: { ...fixture.controller, email: '' } },
    { ...fixture, rights: '' }, { ...fixture, processing: [] },
    { ...fixture, noticeUrl: 'javascript:alert(1)' }, { ...fixture, noticeUrl: 'https://user:secret@example.test' },
    { ...fixture, privateKey: 'must-not-be-published' },
    { ...fixture, controller: { ...fixture.controller, token: 'must-not-be-published' } },
  ]) assert.equal(privacyNoticeSchema.safeParse(changed).success, false);
});
test('invalid or oversized config errors never expose input or local paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'omi-privacy-'));
  try {
    const path = join(directory, 'notice.json');
    writeFileSync(path, JSON.stringify(fixture));
    assert.equal(loadPrivacyNotice(path).configured, true);
    for (const input of ['{"secret":"private-credential"', 'x'.repeat(128 * 1024 + 1)]) {
      writeFileSync(path, input);
      assert.throws(() => loadPrivacyNotice(path), (error) => {
        assert.doesNotMatch(error.message, /private-credential|omi-privacy-/); return true;
      });
    }
    assert.throws(() => loadPrivacyNotice('relative/path.json'));
  } finally { rmSync(directory, { recursive: true }); }
});
