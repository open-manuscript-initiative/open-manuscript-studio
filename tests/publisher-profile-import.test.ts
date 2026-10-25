import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_PUBLICATION_PROFILES, resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import { validatePublisherProfile, readPublisherProfileBytes } from '../src/model/publisherProfileImport.ts';

test('accepts built-in profile contracts and rejects malformed nested rules', () => {
  for (const p of BUILTIN_PUBLICATION_PROFILES) assert.equal(validatePublisherProfile(p), p);
  for (const mutate of [
    (p: any) => { p.rules.notes = null; },
    (p: any) => { p.rules.layout.columns = 9; },
    (p: any) => { p.rules.metadata.minimumKeywords = -1; },
    (p: any) => { p.rules.citations.noteFirstStyle = 'unrecognized'; },
    (p: any) => { p.protection = { readOnly: true }; },
    (p: any) => { p.publicationStyle = { page: null }; },
  ]) {
    const p = structuredClone(BUILTIN_PUBLICATION_PROFILES[0]); mutate(p);
    assert.throws(() => validatePublisherProfile(p), /Invalid publisher profile/);
  }
});

test('hashes exact bytes and fails closed on checksum or UTF-8 errors', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(BUILTIN_PUBLICATION_PROFILES[0]));
  const result = await readPublisherProfileBytes(bytes);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal((await readPublisherProfileBytes(bytes, result.sha256)).profile.id, result.profile.id);
  await assert.rejects(readPublisherProfileBytes(bytes, '0'.repeat(64)), /checksum/);
  await assert.rejects(readPublisherProfileBytes(new Uint8Array([255])));
  assert.notEqual((await readPublisherProfileBytes(new TextEncoder().encode(' '+new TextDecoder().decode(bytes)))).sha256, result.sha256);
});

test('resolves historical built-in versions without silently upgrading', () => {
  const old = resolvePublicationProfile({ id: 'omi-generic-scholarly', version: '0.1.0' });
  assert.equal(old.version, '0.1.0');
  assert.equal(old.rules.citations.noteFirstStyle, undefined);
  assert.equal(resolvePublicationProfile({ id: old.id, version: '0.2.0' }).version, '0.2.0');
  assert.throws(() => resolvePublicationProfile({ id: old.id, version: '999' }), /unavailable/);
});
