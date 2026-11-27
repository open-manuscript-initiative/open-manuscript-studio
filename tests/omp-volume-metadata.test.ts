import assert from 'node:assert/strict';
import test from 'node:test';
import { ompMetadataRequest, validateOmpMetadataResponse } from '../server/src/contracts/ompMetadataContract.ts';
test('OMP metadata requires exact identity and matched receipt', () => {
  const identity = { installationId: 'press', contextId: 1, submissionId: 2, publicationId: 3 };
  const input = ompMetadataRequest.parse({ ...identity, action: 'apply', locale: 'hu', expectedStateToken: 'a'.repeat(64), confirmed: true, fields: { title: 'Book' } });
  const snapshot = { protocol: 'omi-omp-metadata/1', authority: 'OMP', contextId: 1, submissionId: 2, publicationId: 3, stateToken: 'b'.repeat(64), workflowToken: 'c'.repeat(64), stage: 'production', publicationStatus: 1,
    locales: ['hu', 'en'], writableFields: ['title'], abstractRepresentation: 'plain-text',
    metadata: { title: { hu: 'Book' }, subtitle: [], abstract: [], keywords: [], doi: null, references: '', seriesId: 5, seriesPosition: '2', workType: 1, datePublished: null, licenseUrl: null, copyrightHolder: null, copyrightYear: null }, contributors: [] };
  const receipt = { ...identity, protocol: 'omi-omp-metadata/1', locale: 'hu', fields: ['title'], previousStateToken: 'a'.repeat(64), stateToken: 'b'.repeat(64), published: false };
  assert.equal(validateOmpMetadataResponse(input, { snapshot, receipt }).snapshot.metadata.seriesId, 5);
  assert.throws(() => validateOmpMetadataResponse(input, { snapshot, receipt: { ...receipt, installationId: 'other' } }));
  assert.throws(() => validateOmpMetadataResponse(input, { snapshot: { ...snapshot, publicationId: 4 }, receipt }));
  assert.throws(() => validateOmpMetadataResponse(input, { snapshot: { ...snapshot, authority: 'OJS' }, receipt }));
  assert.throws(() => validateOmpMetadataResponse(input, { snapshot, receipt: { ...receipt, stateToken: 'd'.repeat(64) } }));
  assert.equal(ompMetadataRequest.safeParse({ ...input, fields: { seriesId: 9 } }).success, false);
});
