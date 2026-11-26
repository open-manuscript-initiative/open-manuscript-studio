import assert from 'node:assert/strict';
import test from 'node:test';
import { appendNewOjsStudies, compareOjsIssue, isSameOjsIssue } from '../src/integrations/ojs/reimportOjsIssue.ts';
import { createJournalIssueFromOjsHandoff, OJS_ISSUE_ORIGIN, type OjsIssueHandoff } from '../src/integrations/ojs/importOjsIssue.ts';
import { getDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { getPublicationMatter } from '../src/model/publicationMatter.ts';
import { getParentSectionId } from '../src/model/sectionStructure.ts';

function fixture(): OjsIssueHandoff {
  const article = (id: string, title: string, sequence: number) => ({
    submissionExternalId: id, publicationExternalId: id, sequence,
    submission: { externalId: id, title: { hu: title }, primaryLocale: 'hu', abstract: { hu: 'Összefoglaló' }, keywords: { hu: ['történelem'] } },
    contributors: [{ name: { given: 'Ada', family: 'Author' } }],
    sourceDocument: { kind: 'docx' as const, fileExternalId: id, paragraphs: [{ text: 'Imported body ' + id }] },
  });
  return {
    protocol: 'omi-integration/1', profile: 'omi-integration/1/ojs', kind: 'issue',
    installation: { installationId: 'journal-1' },
    context: { externalId: '1', name: { hu: 'Folyóirat' } },
    issue: { externalId: '41', published: false, volume: 26, number: 4, year: 2026, printIssn: '1234-5679', onlineIssn: '2049-3630' },
    sections: [
      { externalId: '2', title: { hu: 'Tanulmányok' }, sequence: 1, articles: [article('7', 'Első tanulmány', 1)] },
      { externalId: '3', title: { hu: 'Recenziók' }, sequence: 2, articles: [article('8', 'Recenzió', 1)] },
    ],
  };
}
test('issue becomes one native journal issue with separate studies and OJS identities', () => {
  const input = fixture();
  const result = createJournalIssueFromOjsHandoff(input, 'hu');
  assert.equal(getPublicationMatter(result)?.publicationKind, 'journal-issue');
  assert.equal(getDocumentStructureProfile(result).noteNumberingScope, 'study');
  assert.equal(result.titleMatter?.issn, '1234-5679');
  assert.equal(result.titleMatter?.eissn, '2049-3630');
  const roots = result.sections.filter(section => !getParentSectionId(section));
  assert.deepEqual(roots.map(section => section.title), ['Első tanulmány', 'Recenzió']);
  assert.deepEqual(roots.map(section => section.studyMetadata?.abstract), ['Összefoglaló', 'Összefoglaló']);
  assert.equal(result.contributions.length, 2);
  assert.deepEqual(result.contributions.map(item => item.targetId), roots.map(section => section.id));
  const serialized = JSON.stringify(result.sections);
  assert.match(serialized, /Imported body 7/);
  assert.match(serialized, /Imported body 8/);
  assert.doesNotMatch(serialized, /Forrás: /);
  const origin = result.extensions?.[OJS_ISSUE_ORIGIN] as { sections: Array<{ articles: Array<{ rootSectionId: string; submissionExternalId: string }> }> };
  assert.deepEqual(origin.sections.flatMap(section => section.articles.map(article => article.submissionExternalId)), ['7','8']);
  assert.deepEqual(origin.sections.flatMap(section => section.articles.map(article => article.rootSectionId)), roots.map(section => section.id));
});
test('rejects duplicate submissions and missing sources instead of partial issue', () => {
  const duplicate = fixture();
  duplicate.sections[1]!.articles[0] = duplicate.sections[0]!.articles[0]!;
  assert.throws(() => createJournalIssueFromOjsHandoff(duplicate, 'hu'));
  const missing = fixture();
  delete missing.sections[1]!.articles[0]!.sourceDocument;
  assert.throws(() => createJournalIssueFromOjsHandoff(missing, 'hu'));
});

test('repeat import detects source changes, additions and removals, preserving local editing and revision identity', () => {
  const original = fixture();
  const document = createJournalIssueFromOjsHandoff(original, 'hu');
  const first = document.sections[0]!;
  first.title = 'Helyi szerkesztés';
  const originalSections = structuredClone(document.sections);
  assert.deepEqual(compareOjsIssue(document, original).items.map(item => item.status), ['unchanged', 'unchanged']);
  const changed = fixture();
  changed.sections[0]!.articles[0]!.sourceDocument!.paragraphs![0]!.text = 'New OJS version';
  changed.sections[1]!.articles = [];
  const incoming = structuredClone(original.sections[1]!.articles[0]!);
  incoming.submissionExternalId = '9';
  incoming.publicationExternalId = '9';
  incoming.submission!.externalId = '9';
  incoming.submission!.title = { hu: 'Új tanulmány' };
  changed.sections[0]!.articles.push(incoming);
  assert.deepEqual(compareOjsIssue(document, changed).items.map(item => item.status), ['changed', 'new', 'removed']);
  const next = appendNewOjsStudies(document, changed);
  assert.equal(next.id, document.id);
  assert.equal(next.revisionHistory.revisions.length, document.revisionHistory.revisions.length + 1);
  assert.deepEqual(next.sections.slice(0, originalSections.length), originalSections);
  assert.deepEqual(next.sections.filter(item => !getParentSectionId(item)).map(item => item.title), ['Helyi szerkesztés', 'Recenzió', 'Új tanulmány']);
  assert.equal(compareOjsIssue(next, changed).items.find(item => item.id === '9')?.status, 'unchanged');
  assert.equal(appendNewOjsStudies(next, changed), next);
  assert.equal(isSameOjsIssue(next, { ...changed, installation: { installationId: 'another' } }), false);
});
test('removed local study is never silently reinserted', () => {
  const launch = fixture();
  const document = createJournalIssueFromOjsHandoff(launch, 'hu');
  document.sections = document.sections.filter(item => item.id !== document.sections[0]!.id);
  assert.equal(compareOjsIssue(document, launch).items[0]?.status, 'locally-removed');
  assert.equal(appendNewOjsStudies(document, launch), document);
});
