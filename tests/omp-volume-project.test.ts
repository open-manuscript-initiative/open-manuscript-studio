import assert from 'node:assert/strict';
import test from 'node:test';
import { createVolumeFromOmpHandoff, isSameOmpVolume, OMP_VOLUME_ORIGIN, type OmpVolumeHandoff } from '../src/integrations/omp/importOmpVolume.ts';
import { getDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { getPublicationMatter } from '../src/model/publicationMatter.ts';
import { getParentSectionId } from '../src/model/sectionStructure.ts';

function fixture(): OmpVolumeHandoff {
  const source = (id: string, chapterExternalId: string | null) => ({ chapterExternalId,
    sourceDocument: { kind: 'docx' as const, fileExternalId: id, paragraphs: [{ text: 'Body ' + id }] } });
  return { protocol: 'omi-integration/1', profile: 'omi-integration/1/omp', kind: 'volume',
    installation: { installationId: 'press-1' }, context: { externalId: '1' },
    volume: { externalId: '3', publicationExternalId: '4', primaryLocale: 'hu', title: { hu: 'Kötet' } },
    doi: '10.1234/book', workType: 'edited-volume', mode: 'chapters',
    contributors: [{ externalId: '8', name: { given: 'Ada', family: 'Author' } },
      { externalId: '9', name: { given: 'Bela', family: 'Editor' }, isEditor: true }],
    chapters: [
      { externalId: '12', publicationExternalId: '4', sequence: 2, title: { hu: 'Második' }, contributorExternalIds: ['8'] },
      { externalId: '11', publicationExternalId: '4', sequence: 1, title: { hu: 'Első' }, contributorExternalIds: ['8'] },
    ], sources: [source('22', '12'), source('21', '11')] };
}
test('edited volume keeps ordered independent chapters and shared author identity', () => {
  const input = fixture();
  const result = createVolumeFromOmpHandoff(input, 'en');
  assert.equal(result.title, 'Kötet');
  assert.equal(result.titleMatter?.doi, '10.1234/book');
  assert.equal(getPublicationMatter(result)?.publicationKind, 'volume');
  assert.equal(getDocumentStructureProfile(result).volumeKind, 'edited-volume');
  const roots = result.sections.filter(section => !getParentSectionId(section));
  assert.deepEqual(roots.map(section => section.title), ['Első', 'Második']);
  assert.equal(result.agents.length, 2);
  const chapters = result.contributions.filter(item => item.targetId !== result.id);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0]?.agentId, chapters[1]?.agentId);
  assert.deepEqual(chapters.map(item => item.targetId), roots.map(item => item.id));
  assert.doesNotMatch(JSON.stringify(result.sections), /Forrás: /);
  const origin = result.extensions?.[OMP_VOLUME_ORIGIN] as { mappings: Array<{ chapterExternalId: string; rootSectionId: string }> };
  assert.deepEqual(origin.mappings.map(item => item.chapterExternalId), ['11', '12']);
  assert.deepEqual(origin.mappings.map(item => item.rootSectionId), roots.map(item => item.id));
  assert.ok(isSameOmpVolume(result, { ...input, volume: { ...input.volume, publicationExternalId: '5' } }));
});
test('whole manuscript retains continuous monograph and does not infer external chapter boundaries', () => {
  const input = fixture();
  input.workType = 'authored-work'; input.mode = 'full-manuscript';
  input.sources = [{ chapterExternalId: null, sourceDocument: { kind: 'docx', fileExternalId: '23', paragraphs: [{ text: 'Full book body' }] } }];
  const result = createVolumeFromOmpHandoff(input, 'hu');
  assert.equal(getDocumentStructureProfile(result).volumeKind, 'monograph');
  assert.equal(getDocumentStructureProfile(result).noteNumberingScope, 'continuous');
  assert.match(JSON.stringify(result.sections), /Full book body/);
  const origin = result.extensions?.[OMP_VOLUME_ORIGIN] as { mappings: unknown[] };
  assert.equal(origin.mappings.length, 0);
});
test('mixed, incomplete and unknown chapter sources fail atomically', () => {
  const input = fixture();
  assert.throws(() => createVolumeFromOmpHandoff({ ...input, sources: input.sources.slice(0, 1) }, 'hu'));
  assert.throws(() => createVolumeFromOmpHandoff({ ...input, sources: [...input.sources, { ...input.sources[0]!, chapterExternalId: null }] }, 'hu'));
  assert.throws(() => createVolumeFromOmpHandoff({ ...input, chapters: [{ ...input.chapters[0]!, contributorExternalIds: ['999'] }, input.chapters[1]!] }, 'hu'));
});

import { publicationShortcodeValues } from '../src/model/publicationShortcodes.ts';
test('volume publication matter keeps distinct print and electronic identifiers and localized series', () => {
  const input = fixture();
  input.publicationMatter = { publisher: 'Kiadó', pressName: { hu: 'Kiadó', en: 'Press' }, publicationPlace: 'Sárospatak',
    series: { title: { hu: 'Sorozat', en: 'Series' }, position: 5, printIssn: '1234-5679', onlineIssn: '2049-3630' },
    formats: [{ physical: true, identifiers: [{ type: '15', value: '978-963-000-000-1' }] },
      { physical: false, identifiers: [{ type: '15', value: '9789630000025' }] }] };
  const volume = createVolumeFromOmpHandoff(input, 'hu');
  assert.equal(volume.titleMatter?.isbn, '9789630000001');
  assert.equal(volume.titleMatter?.electronicIsbn, '9789630000025');
  assert.equal(volume.titleMatter?.seriesTitle, 'Sorozat');
  assert.equal(publicationShortcodeValues(volume, 'en').series, 'Series');
  assert.equal(publicationShortcodeValues(volume)['electronic-isbn'], '9789630000025');
  assert.equal(publicationShortcodeValues(volume)['series-number'], '5');
  (input.publicationMatter.formats as unknown[]).push({ physical: false, identifiers: [{ type: '15', value: '9789630000032' }] });
  const ambiguous = createVolumeFromOmpHandoff(input, 'hu');
  assert.ok(!ambiguous.titleMatter?.electronicIsbn);
});

import { validateSavedOmpVolume } from '../src/integrations/omp/savedOmpVolume.ts';
import { buildOmiContainer } from '../src/services/omiContainer.ts';
import { inspectOmiContainer } from '../src/services/omiContainerImport.ts';

test('saved OMP volume recovery preserves the original ID and revision, including a newer native publication', async () => {
  const input = fixture();
  const original = createVolumeFromOmpHandoff(input, 'hu');
  const packed = await buildOmiContainer(original);
  const plan = await inspectOmiContainer(packed.bytes);
  const next = { ...input, volume: { ...input.volume, publicationExternalId: '5' },
    chapters: input.chapters.map(chapter => ({ ...chapter, publicationExternalId: '5' })) };
  const restored = validateSavedOmpVolume(plan, next, [], original.id);
  assert.equal(restored.id, original.id);
  assert.equal(restored.headRevisionId, original.headRevisionId);
  assert.deepEqual(restored.sections, original.sections);
  assert.throws(() => validateSavedOmpVolume(plan, input, [], 'wrong-id'));
  assert.throws(() => validateSavedOmpVolume(plan, { ...input, installation: { installationId: 'other-press' } }, []));
  assert.throws(() => validateSavedOmpVolume(plan, { ...input, context: { externalId: '7' } }, []));
  assert.throws(() => validateSavedOmpVolume(plan, { ...input, volume: { ...input.volume, externalId: '9' } }, []));
  assert.throws(() => validateSavedOmpVolume(plan, input, [original]));
  assert.throws(() => validateSavedOmpVolume(plan, input, [createVolumeFromOmpHandoff(input, 'hu')]));
  assert.throws(() => validateSavedOmpVolume({ ...plan, validForImport: false }, input, []));
});
