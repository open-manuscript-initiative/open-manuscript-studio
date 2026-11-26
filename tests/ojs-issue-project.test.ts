import assert from 'node:assert/strict';
import test from 'node:test';
import { appendNewOjsStudies, compareOjsIssue, isSameOjsIssue } from '../src/integrations/ojs/reimportOjsIssue.ts';
import { createJournalIssueFromOjsHandoff, OJS_ISSUE_ORIGIN, type OjsIssueHandoff } from '../src/integrations/ojs/importOjsIssue.ts';
import { getDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { getPublicationMatter } from '../src/model/publicationMatter.ts';
import { getParentSectionId } from '../src/model/sectionStructure.ts';
import { projectIssueStudyForExport } from '../src/model/issueStudyExport.ts';
import { getIssueStudyCitationMetadata } from '../src/model/issueStudyCitationMetadata.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';

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


test('planned article exports preserve distinct citation identifiers, localized journal and reviewed pages', () => {
  const input = fixture();
  input.issue.doi = '10.1234/issue.26.4';
  const first = input.sections[0]!.articles[0]!;
  first.submission = { ...first.submission, externalId: first.submissionExternalId, publicationExternalId: first.publicationExternalId,
    citationMetadata: { doi: 'https://doi.org/10.1234/article.7', pages: '3-8' } };
  const second = input.sections[1]!.articles[0]!;
  second.submission = { ...second.submission, externalId: second.submissionExternalId, publicationExternalId: second.publicationExternalId,
    citationMetadata: { doi: '10.1234/article.8' } };
  const issue = createJournalIssueFromOjsHandoff(input, 'hu');
  const roots = issue.sections.filter(section => !getParentSectionId(section));
  const article = projectIssueStudyForExport(issue, roots[0]!.id, { reviewedPrintedPages: { firstPrintedPage: 101, lastPrintedPage: 118 } });
  const citation = getIssueStudyCitationMetadata(article);
  assert.equal(citation?.articleDoi, '10.1234/article.7');
  assert.equal(citation?.issueDoi, '10.1234/issue.26.4');
  assert.equal(citation?.journalTitle, 'Folyóirat');
  assert.equal(citation?.printIssn, '1234-5679');
  assert.equal(citation?.onlineIssn, '2049-3630');
  assert.equal(citation?.volume, '26');
  assert.equal(citation?.issue, '4');
  assert.equal(citation?.year, '2026');
  assert.equal(citation?.sectionTitle, 'Tanulmányok');
  assert.equal(citation?.pages, '101-118');
  const repeat = projectIssueStudyForExport(issue, roots[0]!.id);
  assert.equal(repeat.id, article.id);
  assert.equal(getIssueStudyCitationMetadata(repeat)?.pages, undefined);
  assert.notEqual(projectIssueStudyForExport(issue, roots[1]!.id).id, article.id);
  const html = renderHtmlArticle(article).html;
  const xml = renderJatsArticle(article).xml;
  assert.ok(html.includes('name="citation_doi" content="10.1234/article.7"'));
  assert.ok(html.includes('name="citation_firstpage" content="101"'));
  assert.ok(html.includes('name="citation_lastpage" content="118"'));
  assert.ok(html.includes('name="omi-issue-doi" content="10.1234/issue.26.4"'));
  assert.ok(!html.includes('name="citation_publication_date"'));
  assert.ok(xml.includes('<meta-name>omi-article-doi</meta-name><meta-value>10.1234/article.7</meta-value>'));
  assert.ok(xml.includes('<meta-name>omi-printed-pages</meta-name><meta-value>101-118</meta-value>'));
  assert.ok(!xml.includes('<pub-date'));
  assert.ok(!html.includes('10.1234/article.8') && !xml.includes('10.1234/article.8'));
});

test('legacy plugin omits article DOI and old imported pagination instead of guessing', () => {
  const input = fixture();
  input.issue.doi = '10.1234/issue';
  const issue = createJournalIssueFromOjsHandoff(input, 'hu');
  const root = issue.sections.find(section => !getParentSectionId(section))!;
  const article = projectIssueStudyForExport(issue, root.id);
  const citation = getIssueStudyCitationMetadata(article);
  assert.equal(citation?.issueDoi, '10.1234/issue');
  assert.equal(citation?.articleDoi, undefined);
  assert.equal(citation?.pages, undefined);
  assert.ok(!renderHtmlArticle(article).html.includes('name="citation_doi"'));
  const first = input.sections[0]!.articles[0]!;
  first.submission = { ...first.submission, publicationExternalId: first.publicationExternalId, citationMetadata: { doi: '10.1234/issue' } };
  const invalid = createJournalIssueFromOjsHandoff(input, 'hu');
  const invalidRoot = invalid.sections.find(section => !getParentSectionId(section))!;
  assert.throws(() => projectIssueStudyForExport(invalid, invalidRoot.id), /Article DOI must differ/);
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


test('issue HTML displays public authors under the correct study, not at issue level', () => {
  const input = fixture();
  input.sections[0]!.articles[0]!.contributors = [{ name: { given: 'Ada', family: 'FirstAuthor' }, email: 'private-ada@example.test' }];
  input.sections[1]!.articles[0]!.contributors = [{ name: { given: 'Bela', family: 'SecondAuthor' } }];
  const issue = createJournalIssueFromOjsHandoff(input, 'hu');
  const roots = issue.sections.filter(section => !getParentSectionId(section));
  assert.equal(issue.contributions.filter(item => item.targetId === issue.id).length, 0);
  const html = renderHtmlArticle(issue).html;
  const first = html.indexOf('data-omi-section-id="' + roots[0]!.id + '"');
  const second = html.indexOf('data-omi-section-id="' + roots[1]!.id + '"');
  assert.ok(first >= 0 && second > first);
  assert.ok(html.indexOf('FirstAuthor', first) < second && html.indexOf('FirstAuthor', first) >= first);
  assert.ok(html.indexOf('SecondAuthor', second) >= second);
  assert.doesNotMatch(html.slice(first, second), /SecondAuthor/);
  assert.doesNotMatch(html, /private-ada@example.test/);
  const article = projectIssueStudyForExport(issue, roots[0]!.id);
  assert.match(renderHtmlArticle(article).html, /FirstAuthor/);
  assert.doesNotMatch(renderHtmlArticle(article).html, /SecondAuthor/);
});
