import assert from 'node:assert/strict';
import test from 'node:test';
import { createVolumeFromOmpHandoff, OMP_VOLUME_ORIGIN, type OmpVolumeHandoff } from '../src/integrations/omp/importOmpVolume.ts';
import { compareOmpVolume, refreshOmpPublicationMatter } from '../src/integrations/omp/reimportOmpVolume.ts';
const fixture = (): OmpVolumeHandoff => ({
  protocol: 'omi-integration/1', profile: 'omi-integration/1/omp', kind: 'volume', installation: { installationId: 'press' },
  context: { externalId: '1' }, volume: { externalId: '2', publicationExternalId: '3', title: { hu: 'Kötet' } },
  doi: null, workType: 'edited-volume', mode: 'chapters', contributors: [],
  publicationMatter: { publisher: 'Régi kiadó', formats: [] },
  chapters: [{ externalId: '4', publicationExternalId: '3', sequence: 1, title: { hu: 'Fejezet' }, contributorExternalIds: [] }],
  sources: [{ chapterExternalId: '4', sourceDocument: { kind: 'docx', fileExternalId: '5', paragraphs: [{ text: 'Original' }] } }],
});
test('reimport compares upstream source hashes without touching local edits', () => {
  const launch = fixture(), doc = createVolumeFromOmpHandoff(launch, 'hu');
  doc.sections[0]!.title = 'Local edit';
  assert.equal(compareOmpVolume(doc, launch).items[0]?.status, 'unchanged');
  launch.sources[0]!.sourceDocument.paragraphs![0]!.text = 'Updated upstream';
  assert.equal(compareOmpVolume(doc, launch).items[0]?.status, 'changed');
  assert.equal(doc.sections[0]!.title, 'Local edit');
  doc.sections = doc.sections.slice(1);
  assert.equal(compareOmpVolume(doc, launch).items[0]?.status, 'locally-removed');
});
test('metadata refresh retains text, layout and source identity; conflicts block update', () => {
  const launch = fixture(), doc = createVolumeFromOmpHandoff(launch, 'hu');
  launch.publicationMatter = { publisher: 'Új kiadó', formats: [] };
  const next = refreshOmpPublicationMatter(doc, launch);
  assert.equal(next.titleMatter?.publisherName, 'Új kiadó');
  assert.deepEqual(next.sections, doc.sections);
  assert.deepEqual(next.agents, doc.agents);
  assert.equal(next.id, doc.id);
  assert.equal(compareOmpVolume(next, launch).matterChanged, false);
  doc.titleMatter = { ...doc.titleMatter, publisherName: 'Helyi kiadó' };
  assert.deepEqual(compareOmpVolume(doc, launch).matterConflicts, ['publisherName']);
  assert.throws(() => refreshOmpPublicationMatter(doc, launch));
});
test('legacy fingerprint is unknown and publication version change blocks refresh', () => {
  const launch = fixture(), doc = createVolumeFromOmpHandoff(launch, 'hu');
  const origin = doc.extensions?.[OMP_VOLUME_ORIGIN] as { mappings: Array<{ sourceFingerprint?: string }> };
  delete origin.mappings[0]!.sourceFingerprint;
  assert.equal(compareOmpVolume(doc, launch).items[0]?.status, 'unknown');
  launch.volume.publicationExternalId = '6'; launch.chapters[0]!.publicationExternalId = '6';
  assert.equal(compareOmpVolume(doc, launch).publicationChanged, true);
  assert.throws(() => refreshOmpPublicationMatter(doc, launch));
});
