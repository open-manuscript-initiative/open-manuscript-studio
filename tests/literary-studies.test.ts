import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  annotationsCsv, concordance, createLiteraryWorkspace, extractAnnotation,
  isAnnotationAnchored, isLiteraryWorkspace, uniqueReanchor, wordFrequencies,
  type LiteraryWork,
} from '../src/modules/literary-studies/model.ts';

const work: LiteraryWork = {
  id: 'work-1',
  title: 'Example',
  creator: 'Researcher',
  date: '1890',
  language: 'hu',
  genre: 'poetry',
  edition: '1900 edition',
  source: 'Archive shelfmark 12',
  rights: 'Public domain (researcher-entered)',
  text: 'Éjjel a kertben. A kertben csend.',
};

test('literary project validation protects schema, type and record references', () => {
  const project = createLiteraryWorkspace();
  assert.ok(isLiteraryWorkspace(project));
  project.works.push(work);
  assert.ok(isLiteraryWorkspace(project));
  assert.equal(isLiteraryWorkspace({ ...project, schemaVersion: 2 }), false);
  assert.equal(isLiteraryWorkspace({ ...project, works: [work, work] }), false);
  assert.equal(isLiteraryWorkspace({ ...project, annotations: [{
    id: 'a1', workId: 'missing', quote: 'abc', start: 0, end: 3,
    kind: 'motif', interpretation: '', evidence: '',
  }] }), false);
});

test('exact passage annotations detect changed texts and reanchor only unambiguously', () => {
  const annotation = extractAnnotation(work, 'a1', 0, 5, 'motif', 'night motif', '');
  assert.ok(annotation);
  assert.equal(annotation.quote, 'Éjjel');
  assert.equal(isAnnotationAnchored(annotation, work), true);
  const edited = { ...work, text: 'Előszó. Éjjel a kertben. A kertben csend.' };
  assert.equal(isAnnotationAnchored(annotation, edited), false);
  assert.deepEqual(uniqueReanchor(annotation, edited), { ...annotation, start: 8, end: 13 });
  assert.equal(uniqueReanchor(annotation, { ...work, text: 'Éjjel és Éjjel' }), null);
  assert.equal(extractAnnotation(work, 'a2', 2, 2, 'motif', '', ''), null);
});

test('counts Unicode word forms and returns bounded concordance offsets', () => {
  const words = wordFrequencies('Árvíztűrő tükörfúrógép; árvíztűrő.');
  assert.deepEqual(words.find(item => item.word === 'árvíztűrő'), { word: 'árvíztűrő', count: 2 });
  const matches = concordance(work.text, 'kertben');
  assert.deepEqual(matches.map(item => item.offset), [8, 19]);
  assert.equal(concordance('a a a a', 'a', 'en', 2).length, 2);
  assert.deepEqual(concordance(work.text, ''), []);
});

test('annotation CSV includes source and reflects stale anchor state', () => {
  const annotation = extractAnnotation(work, 'a1', 0, 5, 'motif', 'night motif', '');
  assert.ok(annotation);
  const project = { ...createLiteraryWorkspace(), works: [{ ...work, text: 'Prefix ' + work.text }], annotations: [annotation] };
  const csv = annotationsCsv(project);
  assert.match(csv, /Archive shelfmark 12/);
  assert.match(csv, /"false"/);
});
