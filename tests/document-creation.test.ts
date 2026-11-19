import assert from 'node:assert/strict';
import test from 'node:test';

import { createAndOpenBlankOmiDocument } from '../src/app/newDocumentActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { migrateVersioningModel } from '../src/document/migrateVersioningModel.ts';
import { createUser } from '../src/model/user.ts';
import {
  getDocumentStructureProfile,
} from '../src/model/documentProfile.ts';
import { normalizeTitleMatter } from '../src/model/frontMatter.ts';
import { useAuthStore } from '../src/store/authStore.ts';

import { getPublicationMatter, publicationMatterTemplate } from '../src/model/publicationMatter.ts';
import { publicationIdentifierFields, publicationIdentifierLines } from '../src/model/publicationIdentifiers.ts';
import { inspectRevisionStateIntegrity } from '../src/model/revisionIntegrity.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';

test('creates a standalone OMI study with one independent editor root', () => {
  const manuscript = createBlankManuscript({
    kind: 'study',
    locale: 'hu',
  });

  assert.equal(manuscript.locale, 'hu');
  assert.equal('editorMode' in manuscript, false);
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
      country: 'HU',
      url: 'https://example.org/anna',
      orcid: '0000-0002-1825-0097',
      biography: { hu: 'Szerző.' },
    },
  });

  assert.equal(manuscript.agents.length, 1);
  assert.equal(manuscript.agents[0]?.names[0]?.value, 'Kovács Anna');
  assert.equal(manuscript.agents[0]?.names[0]?.givenName, 'Anna');
  assert.equal(manuscript.agents[0]?.names[0]?.familyName, 'Kovács');
  assert.equal(manuscript.agents[0]?.email, 'anna@example.org');
  assert.equal(manuscript.agents[0]?.country, 'HU');
  assert.equal(manuscript.agents[0]?.url, 'https://example.org/anna');
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

test('copies saved profile country and website into a newly opened OMI author', () => {
  const previousAuth = useAuthStore.getState();
  const previousStudio = useStudioStore.getState();
  const user = createUser({ email: 'anna@example.org', fullName: 'Anna Kovács' });
  user.profile.country = 'HU';
  user.profile.website = 'https://example.org/anna';

  try {
    useAuthStore.setState({
      users: [user],
      session: {
        userId: user.id,
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      },
    });
    useStudioStore.setState({ hasOpenDocument: false });

    const manuscript = createAndOpenBlankOmiDocument({ kind: 'study', locale: 'hu' });

    assert.equal('editorMode' in manuscript, false);
    assert.equal('editorMode' in manuscript.revisionHistory.revisions[0]!.snapshot.state, false);
    assert.equal(manuscript.agents[0]?.names[0]?.value, 'Anna Kovács');
    assert.deepEqual(manuscript.contributions[0]?.roles, ['author']);
    assert.equal(manuscript.agents[0]?.country, 'HU');
    assert.equal(manuscript.agents[0]?.url, 'https://example.org/anna');
    assert.equal(useStudioStore.getState().manuscript.agents[0]?.country, 'HU');
    assert.equal(useStudioStore.getState().manuscript.agents[0]?.url, 'https://example.org/anna');
  } finally {
    useAuthStore.setState(previousAuth);
    useStudioStore.setState(previousStudio);
  }
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

test('periodicals retain ISBN and both ISSNs together in the initial revision and imprint', () => {
  const manuscript = createBlankManuscript({
    kind: 'volume', volumeKind: 'edited-volume', publicationKind: 'journal-issue', locale: 'hu', title: 'Special issue',
    titleMatter: { isbn: ' 978-0-306-40615-7 ', electronicIsbn: '978-3-16-148410-0', issn: '1234-5679', eissn: '2049-3630',
      doi: '10.1234/whole-issue', otherIdentifiers: 'ark:/41386/example\nurn:example:issue' },
  });
  assert.equal(getPublicationMatter(manuscript)?.publicationKind, 'journal-issue');
  assert.equal(manuscript.titleMatter?.isbn, '978-0-306-40615-7');
  const snapshot = manuscript.revisionHistory.revisions[0]!.snapshot.state;
  assert.deepEqual(snapshot.titleMatter, manuscript.titleMatter);
  assert.equal(getPublicationMatter(snapshot)?.publicationKind, 'journal-issue');
  const reopened = parseOmiJson(serializeOmiJson(manuscript));
  assert.deepEqual(reopened.titleMatter, manuscript.titleMatter);
  assert.equal(getPublicationMatter(reopened)?.publicationKind, 'journal-issue');
  assert.equal(inspectRevisionStateIntegrity(manuscript.revisionHistory.revisions[0]!).status, 'verified');
  const imprint = publicationMatterTemplate('imprint-page', manuscript);
  for (const line of publicationIdentifierLines(manuscript.titleMatter)) assert.ok(imprint.includes(line), line);
  assert.equal(publicationIdentifierLines(manuscript.titleMatter).length, 7);
});

test('publication kind changes identifier order without hiding ISBN or ISSN', () => {
  assert.equal(publicationIdentifierFields('journal-issue')[0], 'issn');
  assert.equal(publicationIdentifierFields('volume')[0], 'isbn');
  assert.deepEqual(new Set(publicationIdentifierFields('journal-issue')), new Set(publicationIdentifierFields('volume')));
});

test('identifiers are optional and multiple identifiers keep separate imprint lines', () => {
  const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', titleMatter: { isbn: '  ', issn: '' } });
  assert.equal(manuscript.titleMatter, undefined);
  assert.deepEqual(publicationIdentifierLines(undefined), []);
  assert.deepEqual(publicationIdentifierLines({ isbn: '111\n222', issn: '333' }), ['ISBN 111', 'ISBN 222', 'ISSN 333']);
});
