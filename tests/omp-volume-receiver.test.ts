import assert from 'node:assert/strict';
import test from 'node:test';
import { planOmpVolumeImport, validateOmpLaunchTarget } from '../server/src/integrations/omp/volumeImportBoundary.ts';
import { createOmpVolumeHandoff, consumeOmpVolumeHandoff } from '../server/src/integrations/omp/volumeHandoffStore.ts';
import type { OmpLaunchClaims } from '../server/src/integrations/omp/launchVerifier.ts';

const claims: OmpLaunchClaims = {
  protocol: 'omi-integration/1', profile: 'omi-integration/1/omp', installationId: 'press-1',
  context: { externalId: '1', type: 'press', path: 'press' }, actor: { externalId: '2' },
  volume: { submissionId: '3', publicationId: '4' }, actorMode: 'volume', scope: ['volume.import.read'],
  iat: 1, exp: 301, nonce: 'a'.repeat(32), externalBaseUrl: 'https://press.example',
  apiBaseUrl: 'https://press.example/api/v1/omi-integration',
};
const source = (externalId: string, chapterExternalId: string | null) => ({
  externalId, chapterExternalId, genreKey: chapterExternalId ? 'CHAPTER' : 'MANUSCRIPT',
  name: 'source.docx', contentPath: `volume-import/files/${externalId}/content`,
});
const manifest = {
  protocol: claims.protocol, profile: claims.profile, installationId: claims.installationId,
  context: claims.context, volume: { externalId: '3', publicationExternalId: '4' },
  binaryTransfer: { available: true }, workType: 'edited-volume', contributors: [],
  chapters: [{ externalId: '8', publicationExternalId: '4', sequence: 2 }, { externalId: '7', publicationExternalId: '4', sequence: 1 }],
  sources: [source('10', null), source('11', '8'), source('12', '7')],
};

test('volume launch scope is isolated from regular author and review launches', () => {
  assert.doesNotThrow(() => validateOmpLaunchTarget(claims, 'volume'));
  assert.throws(() => validateOmpLaunchTarget(claims, 'submission'));
  for (const invalid of [
    { ...claims, actorMode: 'author' as const },
    { ...claims, scope: ['volume.import.read', 'files.read'] },
    { ...claims, submission: { externalId: '3' } },
    { ...claims, exp: 302 }, { ...claims, nonce: 'short' },
  ]) assert.throws(() => validateOmpLaunchTarget(invalid, 'volume'));
});

test('edited volumes select complete ordered chapters; authored works prefer whole manuscript', () => {
  const edited = planOmpVolumeImport(manifest, claims);
  assert.equal(edited.mode, 'chapters');
  assert.deepEqual(edited.candidates.map(item => item.externalId), ['12', '11']);
  const authored = planOmpVolumeImport({ ...manifest, workType: 'authored-work' }, claims);
  assert.equal(authored.mode, 'full-manuscript');
  assert.deepEqual(authored.candidates.map(item => item.externalId), ['10']);
  assert.equal(planOmpVolumeImport({ ...manifest, sources: manifest.sources.slice(0, 2) }, claims).mode, 'full-manuscript');
  assert.throws(() => planOmpVolumeImport({ ...manifest, sources: [source('11', '8')] }, claims));
});

test('reject foreign identities, duplicate chapters and arbitrary source URLs', () => {
  for (const invalid of [
    { ...manifest, installationId: 'other' },
    { ...manifest, volume: { externalId: '3', publicationExternalId: '5' } },
    { ...manifest, chapters: [manifest.chapters[0], manifest.chapters[0]] },
    { ...manifest, sources: [source('11', '9')] },
    { ...manifest, sources: [{ ...source('10', null), contentPath: 'https://other.example/file' }] },
  ]) assert.throws(() => planOmpVolumeImport(invalid, claims));
});

test('volume handoff is single use', () => {
  const token = createOmpVolumeHandoff({ volume: '3' });
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(JSON.parse(consumeOmpVolumeHandoff(token)!), { volume: '3' });
  assert.equal(consumeOmpVolumeHandoff(token), undefined);
});
