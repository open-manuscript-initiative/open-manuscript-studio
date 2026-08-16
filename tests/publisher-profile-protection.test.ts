import assert from 'node:assert/strict';
import test from 'node:test';

import { getPublicationProfile } from '../src/model/publicationProfile.ts';
import {
  canProtectPublisherProfile,
  canUnlockPublisherProfile,
  createEditablePublisherProfileVersion,
  isPublisherProfileReadOnly,
  protectPublisherProfile,
  unlockPublisherProfile,
  type PublisherProfileActor,
} from '../src/model/publisherProfileProtection.ts';

const actor: PublisherProfileActor = {
  userId: 'publisher-user-1',
  email: 'editor@example.org',
  displayName: 'Publisher Editor',
  status: 'active',
  emailVerified: true,
  affiliation: 'Example University Press',
  affiliationRorId: 'https://ror.org/012345678',
};

test('requires an active authenticated account before a publisher profile can be protected', () => {
  assert.equal(canProtectPublisherProfile(actor), true);
  assert.equal(canProtectPublisherProfile({ ...actor, status: 'suspended' }), false);
  assert.equal(canProtectPublisherProfile(undefined), false);
});

test('protects one immutable profile version with recorded publisher identity evidence', () => {
  const source = getPublicationProfile('omi-humanities-notes');
  assert.ok(source);

  const protectedProfile = protectPublisherProfile(
    { ...source, id: 'publisher:example', version: '1.0.0' },
    actor,
    '2026-08-16T20:00:00.000Z',
  );

  assert.equal(isPublisherProfileReadOnly(protectedProfile), true);
  assert.equal(protectedProfile.protection?.lockedByUserId, actor.userId);
  assert.equal(protectedProfile.protection?.identityMethod, 'ror-affiliation');
  assert.equal(protectedProfile.protection?.lockedAt, '2026-08-16T20:00:00.000Z');
});

test('only the account that protected a profile can remove its read-only state', () => {
  const source = getPublicationProfile('omi-generic-scholarly');
  assert.ok(source);
  const protectedProfile = protectPublisherProfile(
    { ...source, id: 'publisher:example', version: '1.0.0' },
    actor,
  );

  assert.equal(canUnlockPublisherProfile(protectedProfile, actor.userId), true);
  assert.equal(canUnlockPublisherProfile(protectedProfile, 'another-user'), false);
  assert.throws(
    () => unlockPublisherProfile(protectedProfile, 'another-user'),
    /Only the authenticated account/,
  );

  const unlocked = unlockPublisherProfile(protectedProfile, actor.userId);
  assert.equal(isPublisherProfileReadOnly(unlocked), false);
});

test('creates an editable successor without modifying the protected source version', () => {
  const source = getPublicationProfile('omi-journal-author-date');
  assert.ok(source);
  const protectedProfile = protectPublisherProfile(
    { ...source, id: 'publisher:example', version: '1.0.0' },
    actor,
  );

  const next = createEditablePublisherProfileVersion(protectedProfile, '1.0.1');

  assert.equal(isPublisherProfileReadOnly(protectedProfile), true);
  assert.equal(isPublisherProfileReadOnly(next), false);
  assert.equal(next.id, protectedProfile.id);
  assert.equal(next.version, '1.0.1');
});
