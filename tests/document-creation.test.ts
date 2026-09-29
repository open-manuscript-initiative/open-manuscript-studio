import assert from 'node:assert/strict';
import test from 'node:test';

import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { migrateVersioningModel } from '../src/document/migrateVersioningModel.ts';
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
  assert.equal(manuscript.sections[0]?.blocks.length, 1);
  assert.equal(manuscript.sections[0]?.blocks[0]?.type, 'paragraph');
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

test('seeds a new OMI with the signed-in author identity and an author contribution', () => {
  const manuscript = createBlankManuscript({
    kind: 'study',
    locale: 'hu',
    author: {
      displayName: 'Kovács Anna',
      givenName: 'Anna',
      familyName: 'Kovács',
      preferredPublicName: 'Anna Kovács',
      email: 'anna@example.org',
      affiliation: 'Sárospataki Református Hittudományi Egyetem',
      affiliationRorId: 'https://ror.org/012345678',
      orcid: '0000-0002-1825-0097',
      biography: { hu: 'Szerző.' },
    },
  });

  assert.equal(manuscript.agents.length, 1);
  assert.equal(manuscript.agents[0]?.names[0]?.value, 'Kovács Anna');
  assert.equal(manuscript.agents[0]?.names[0]?.givenName, 'Anna');
  assert.equal(manuscript.agents[0]?.names[0]?.familyName, 'Kovács');
  assert.equal(manuscript.agents[0]?.email, 'anna@example.org');
  assert.deepEqual(manuscript.agents[0]?.biography, { hu: 'Szerző.' });
  assert.equal(manuscript.agents[0]?.affiliations[0]?.organizationName, 'Sárospataki Református Hittudományi Egyetem');
  assert.equal(manuscript.agents[0]?.affiliations[0]?.organizationIdentifier?.value, 'https://ror.org/012345678');
  assert.equal(manuscript.agents[0]?.identifiers[0]?.value, '0000-0002-1825-0097');
  assert.equal(manuscript.contributions.length, 1);
  assert.equal(manuscript.contributions[0]?.agentId, manuscript.agents[0]?.id);
  assert.equal(manuscript.contributions[0]?.targetId, manuscript.sections[0]?.id);
  assert.deepEqual(manuscript.contributions[0]?.roles, ['author']);
  assert.equal(manuscript.contributions[0]?.attributionName, 'Anna Kovács');
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

test('legacy DOCX imports recover their standalone study profile on load', () => {
  const legacy = structuredClone(createBlankManuscript({
    kind: 'study',
    locale: 'hu',
  }));
  delete legacy.documentStructure;

  const rootRevision = legacy.revisionHistory.revisions[0];
  assert.ok(rootRevision);
  rootRevision.summary = 'Imported DOCX manuscript: article.docx';
  rootRevision.changeSet.summary = rootRevision.summary;
  delete rootRevision.snapshot.state.documentStructure;
  delete (rootRevision as typeof rootRevision & { stateDigest?: unknown }).stateDigest;

  const migrated = migrateVersioningModel(legacy);
  assert.equal(getDocumentStructureProfile(migrated).kind, 'study');
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
