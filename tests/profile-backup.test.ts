import assert from 'node:assert/strict';
import test from 'node:test';

import { profileFromAccountBackup } from '../src/account/profileBackup.ts';

const sample = {
  schema: 'omi-account-overview/1',
  profile: {
    id: 'old-account-id',
    email: 'old@example.test',
    fullName: 'Researcher Example',
    affiliation: 'Research Institute',
    affiliationRorId: 'https://ror.org/012345678',
    orcid: '0000-0002-1825-0097',
    bio: 'Research biography',
    country: 'hu',
    website: 'https://example.test',
    timeZone: 'Europe/Budapest',
    interfaceLanguage: 'hu',
    workflowRole: 'author',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    passwordHash: 'DO_NOT_IMPORT',
  },
  profileEmails: [{ email: 'backup@example.test', isPrimary: true }],
  identities: [{ provider: 'ORCID', subject: 'old-identity' }],
  sessions: [{ token: 'DO_NOT_IMPORT' }],
  institutionMemberships: [{ role: 'OWNER', institution: { name: 'Private Institute' } }],
  passkeys: [{ credential: 'DO_NOT_IMPORT' }],
};

test('a saved account-data JSON restores only safe personal profile fields', () => {
  assert.deepEqual(profileFromAccountBackup(sample), {
    fullName: 'Researcher Example',
    affiliation: 'Research Institute',
    affiliationRorId: 'https://ror.org/012345678',
    country: 'HU',
    website: 'https://example.test',
    bio: 'Research biography',
    timeZone: 'Europe/Budapest',
    workflowRole: 'author',
  });
});

test('backup import never restores old identity, ORCID binding, credentials, email, membership or manuscripts', () => {
  const profile = profileFromAccountBackup(sample) as unknown as Record<string, unknown>;
  for (const prohibited of [
    'id', 'email', 'orcid', 'identities', 'sessions', 'passkeys',
    'institutionMemberships', 'credentials', 'passwordHash', 'manuscripts', 'userId',
  ]) {
    assert.equal(Object.hasOwn(profile, prohibited), false, `unsafe import: ${prohibited}`);
  }
});

test('unsupported and malicious profile backups are rejected', () => {
  assert.throws(() => profileFromAccountBackup({ schema: 'other', profile: sample.profile }), /Unsupported/);
  assert.throws(() => profileFromAccountBackup({ ...sample, profile: { ...sample.profile, fullName: '' } }), /profile name/);
  assert.throws(() => profileFromAccountBackup({ ...sample, profile: { ...sample.profile, country: 'BAD' } }), /country field/);
  assert.throws(() => profileFromAccountBackup({ ...sample, profile: { ...sample.profile, country: 'H1' } }), /country code/);
  assert.throws(() => profileFromAccountBackup({ ...sample, profile: { ...sample.profile, website: 'javascript:alert(1)' } }), /website URL/);
  assert.throws(() => profileFromAccountBackup({ ...sample, profile: { ...sample.profile, workflowRole: 'OWNER' } }), /workflow preference/);
});
