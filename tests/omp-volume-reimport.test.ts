import assert from 'node:assert/strict';
import test from 'node:test';
import { createVolumeFromOmpHandoff, OMP_VOLUME_ORIGIN, type OmpVolumeHandoff } from '../src/integrations/omp/importOmpVolume.ts';
import { appendNewOmpChapters, compareOmpVolume, refreshOmpPublicationMatter, previewOmpChapter, keepLocalOmpChapter, acceptIncomingOmpChapter } from '../src/integrations/omp/reimportOmpVolume.ts';
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

test('append only new chapters and reuse native contributor identity without rewriting old text', () => {
  const launch = fixture();
  launch.contributors = [{ externalId: '8', name: { given: 'Ada', family: 'Author' } }];
  launch.chapters[0]!.contributorExternalIds = ['8'];
  const doc = createVolumeFromOmpHandoff(launch, 'hu');
  doc.sections[0]!.title = 'Local edited title';
  const oldSections = structuredClone(doc.sections);
  launch.chapters.push({ ...launch.chapters[0]!, externalId: '6', sequence: 2, title: { hu: 'Új fejezet' } });
  launch.sources.push({ chapterExternalId: '6', sourceDocument: { kind: 'docx', fileExternalId: '7', paragraphs: [{ text: 'New body' }] } });
  assert.equal(compareOmpVolume(doc, launch).canAppend, true);
  const next = appendNewOmpChapters(doc, launch);
  assert.deepEqual(next.sections.slice(0, oldSections.length), oldSections);
  assert.equal(next.agents.length, 1);
  assert.equal(next.contributions.length, 2);
  assert.equal(next.contributions[0]!.agentId, next.contributions[1]!.agentId);
  assert.equal(compareOmpVolume(next, launch).items.find(item => item.id === '6')?.status, 'unchanged');
  assert.equal(appendNewOmpChapters(next, launch), next);
  assert.equal(next.revisionHistory.revisions.length, doc.revisionHistory.revisions.length + 1);
});
test('legacy contributor identities and cross-version additions fail closed', () => {
  const launch = fixture();
  launch.contributors = [{ externalId: '8', name: { given: 'Ada', family: 'Author' } }];
  launch.chapters[0]!.contributorExternalIds = ['8'];
  const doc = createVolumeFromOmpHandoff(launch, 'hu');
  const origin = doc.extensions?.[OMP_VOLUME_ORIGIN] as Record<string, unknown>;
  delete origin.contributorMappings;
  launch.chapters.push({ ...launch.chapters[0]!, externalId: '6', sequence: 2 });
  launch.sources.push({ chapterExternalId: '6', sourceDocument: { kind: 'docx', fileExternalId: '7', paragraphs: [{ text: 'New' }] } });
  assert.equal(compareOmpVolume(doc, launch).canAppend, false);
  assert.throws(() => appendNewOmpChapters(doc, launch));
});

test('chapter review distinguishes the imported snapshot, local edit and new OMP text', () => {
  const launch = fixture(), doc = createVolumeFromOmpHandoff(launch, 'hu');
  doc.sections[0]!.title = 'Local edit';
  launch.sources[0]!.sourceDocument.paragraphs![0]!.text = 'Changed upstream';
  const preview = previewOmpChapter(doc, launch, '4');
  assert.match(preview.original?.text ?? '', /Original/);
  assert.match(preview.local.text, /Local edit/);
  assert.match(preview.incoming.text, /Changed upstream/);
  assert.equal(preview.localTextChanged, true);
  assert.equal(preview.sourceChanged, true);
  const next = keepLocalOmpChapter(doc, launch, '4');
  assert.deepEqual(next.sections, doc.sections);
  assert.deepEqual(next.annotations, doc.annotations);
  assert.equal(compareOmpVolume(next, launch).items[0]?.status, 'changed');
  assert.equal(compareOmpVolume(next, launch).items[0]?.reviewedLocal, true);
  assert.equal(keepLocalOmpChapter(next, launch, '4'), next);
  launch.sources[0]!.sourceDocument.paragraphs![0]!.text = 'Another update';
  assert.equal(compareOmpVolume(next, launch).items[0]?.reviewedLocal, undefined);
});

test('accept upstream text for an unchanged plain-text chapter, preserving section and block IDs', () => {
  const launch = fixture(), doc = createVolumeFromOmpHandoff(launch, 'hu');
  launch.sources[0]!.sourceDocument.paragraphs![0]!.text = 'Updated upstream';
  assert.equal(previewOmpChapter(doc, launch, '4').canAcceptIncoming, true);
  const next = acceptIncomingOmpChapter(doc, launch, '4');
  assert.deepEqual(next.sections.map(section => section.id), doc.sections.map(section => section.id));
  assert.deepEqual(next.sections.flatMap(section => section.blocks.map(block => block.id)), doc.sections.flatMap(section => section.blocks.map(block => block.id)));
  assert.match(JSON.stringify(next.sections), /Updated upstream/);
  assert.match(JSON.stringify(doc.sections), /Original/);
  assert.equal(compareOmpVolume(next, launch).items[0]?.status, 'unchanged');
  assert.equal(next.revisionHistory.revisions.length, doc.revisionHistory.revisions.length + 1);
});
test('reject replacement if the chapter has local edits, dependent notes or a different structure', () => {
  const launch = fixture(), doc = createVolumeFromOmpHandoff(launch, 'hu');
  launch.sources[0]!.sourceDocument.paragraphs![0]!.text = 'Updated upstream';
  const edited = structuredClone(doc);
  edited.sections[0]!.title = 'Local change';
  assert.equal(previewOmpChapter(edited, launch, '4').canAcceptIncoming, false);
  assert.throws(() => acceptIncomingOmpChapter(edited, launch, '4'));
  const anchored = structuredClone(doc);
  anchored.annotations.push({ id: 'note-1', type: 'note', targetBlockId: doc.sections[0]!.blocks[0]!.id, body: 'Local note', renderingHint: 'footnote' });
  assert.equal(previewOmpChapter(anchored, launch, '4').canAcceptIncoming, false);
  assert.throws(() => acceptIncomingOmpChapter(anchored, launch, '4'));
  launch.sources[0]!.sourceDocument.paragraphs!.push({ text: 'Additional paragraph' });
  assert.equal(previewOmpChapter(doc, launch, '4').canAcceptIncoming, false);
});

test('accept revised note body with identical inline marker, retaining native annotation and anchor IDs', () => {
  const launch = fixture();
  const source = launch.sources[0]!.sourceDocument;
  source.paragraphs = [{ text: 'Note bearing paragraph.', inline: [
    { kind: 'text', text: 'Note bearing paragraph.' }, { kind: 'footnoteReference', footnoteId: '1' },
  ] }, { text: 'Ordinary paragraph.' }];
  source.footnotes = [{ id: '1', text: 'Original note.' }];
  const doc = createVolumeFromOmpHandoff(launch, 'hu');
  assert.equal(doc.annotations.length, 1);
  source.footnotes[0]!.text = 'New note.';
  source.paragraphs[1]!.text = 'Updated ordinary paragraph.';
  assert.equal(previewOmpChapter(doc, launch, '4').canAcceptIncoming, true);
  const next = acceptIncomingOmpChapter(doc, launch, '4');
  assert.equal(next.annotations[0]?.id, doc.annotations[0]?.id);
  assert.equal(next.annotations[0]?.anchorId, doc.annotations[0]?.anchorId);
  assert.equal(next.annotations[0]?.targetBlockId, doc.annotations[0]?.targetBlockId);
  assert.equal(next.annotations[0]?.body, 'New note.');
  assert.match(JSON.stringify(next.sections), /Updated ordinary paragraph/);
  assert.equal(doc.annotations[0]?.body, 'Original note.');
  assert.equal(compareOmpVolume(next, launch).items[0]?.status, 'unchanged');
});
test('reject locally edited notes and moved note markers', () => {
  const launch = fixture(), source = launch.sources[0]!.sourceDocument;
  source.paragraphs = [{ text: 'Text.', inline: [{ kind: 'text', text: 'Text.' }, { kind: 'footnoteReference', footnoteId: '1' }] }];
  source.footnotes = [{ id: '1', text: 'Original note.' }];
  const doc = createVolumeFromOmpHandoff(launch, 'hu');
  source.footnotes[0]!.text = 'New note.';
  const local = structuredClone(doc);
  local.annotations[0]!.body = 'Local note.';
  assert.equal(previewOmpChapter(local, launch, '4').canAcceptIncoming, false);
  source.paragraphs[0]!.inline = [{ kind: 'footnoteReference', footnoteId: '1' }, { kind: 'text', text: 'Text.' }];
  assert.equal(previewOmpChapter(doc, launch, '4').canAcceptIncoming, false);
});

test('preserve an unchanged citation graph and update an independent paragraph', () => {
  const launch = fixture();
  const source = launch.sources[0]!.sourceDocument as unknown as Record<string, unknown>;
  source.paragraphs = [{ text: 'Reference [Author].', inline: [
    { kind: 'text', text: 'Reference ' }, { kind: 'citationReference', sourceTags: ['A'], label: '[Author]' },
    { kind: 'text', text: '.' },
  ] }, { text: 'Ordinary paragraph.' }];
  source.bibliographicRecords = [{ sourceTag: 'A', type: 'book', title: 'Reference work', contributors: [{ role: 'author', familyName: 'Author' }] }];
  const doc = createVolumeFromOmpHandoff(launch, 'hu');
  assert.equal(doc.citations.length, 1);
  assert.equal(doc.citationClusters?.length, 1);
  launch.sources[0]!.sourceDocument.paragraphs![1]!.text = 'Updated ordinary paragraph.';
  assert.equal(previewOmpChapter(doc, launch, '4').canAcceptIncoming, true);
  const next = acceptIncomingOmpChapter(doc, launch, '4');
  assert.deepEqual(next.citations, doc.citations);
  assert.deepEqual(next.citationClusters, doc.citationClusters);
  assert.deepEqual(next.bibliographicRecords, doc.bibliographicRecords);
  assert.match(JSON.stringify(next.sections), /Updated ordinary paragraph/);
  const local = structuredClone(doc);
  local.bibliographicRecords![0]!.title = 'Local correction';
  assert.equal(previewOmpChapter(local, launch, '4').canAcceptIncoming, false);
  (source.bibliographicRecords as Array<{ title: string }>)[0]!.title = 'Different reference';
  assert.equal(previewOmpChapter(doc, launch, '4').canAcceptIncoming, false);
});
