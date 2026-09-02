import assert from 'node:assert/strict';
import test from 'node:test';

import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import {
  getDocumentStructureProfile,
} from '../src/model/documentProfile.ts';
import { normalizeTitleMatter } from '../src/model/frontMatter.ts';

test('creates a standalone OMI study with one independent editor root', () => {
  const manuscript = createBlankManuscript({
    kind: 'study',
    locale: 'hu',
  });

  assert.equal(manuscript.locale, 'hu');
  assert.equal(manuscript.sections.length, 1);
  assert.equal(manuscript.sections[0]?.blocks[0]?.type, 'heading');
  assert.equal(manuscript.sections[0]?.blocks[1]?.type, 'paragraph');
  assert.deepEqual(getDocumentStructureProfile(manuscript), {
    modelVersion: '0.1.0-alpha.1',
    kind: 'study',
    noteNumberingScope: 'continuous',
    referencesPlacement: 'volume-end',
    listsPlacement: 'volume-end',
  });
  assert.ok(manuscript.headRevisionId);
  assert.equal(manuscript.revisionHistory.revisions.length, 1);
});

test('creates monographs and edited volumes with distinct apparatus defaults', () => {
  const monograph = createBlankManuscript({
    kind: 'volume',
    volumeKind: 'monograph',
  });
  const editedVolume = createBlankManuscript({
    kind: 'volume',
    volumeKind: 'edited-volume',
  });

  assert.equal(monograph.sections.length, 0);
  assert.deepEqual(getDocumentStructureProfile(monograph), {
    modelVersion: '0.1.0-alpha.1',
    kind: 'volume',
    volumeKind: 'monograph',
    noteNumberingScope: 'continuous',
    referencesPlacement: 'volume-end',
    listsPlacement: 'volume-end',
  });
  assert.deepEqual(getDocumentStructureProfile(editedVolume), {
    modelVersion: '0.1.0-alpha.1',
    kind: 'volume',
    volumeKind: 'edited-volume',
    noteNumberingScope: 'study',
    referencesPlacement: 'study-end',
    listsPlacement: 'volume-end',
  });
});

test('legacy manuscripts keep continuous apparatus while using volume editor boundaries', () => {
  assert.deepEqual(getDocumentStructureProfile({}), {
    modelVersion: '0.1.0-alpha.1',
    kind: 'volume',
    volumeKind: 'edited-volume',
    noteNumberingScope: 'continuous',
    referencesPlacement: 'volume-end',
    listsPlacement: 'volume-end',
  });
});

test('empty title-matter fields are removed without affecting populated fields', () => {
  assert.deepEqual(normalizeTitleMatter({
    publisherName: '  OMI Press  ',
    isbn: undefined,
    colophon: '   ',
  }), {
    publisherName: 'OMI Press',
  });
});
