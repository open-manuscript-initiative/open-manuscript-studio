import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { sanitizeReviewManuscript, authorVisibleReviewManuscript } from '../server/src/services/reviewManuscriptModel.ts';
import { buildReviewDocx } from '../server/src/integrations/ojs/reviewDocument.ts';
import { readDocxReviewAnnotations } from '../server/src/integrations/ojs/docxReviewAnnotations.ts';
import { createReviewSnapshotFromOjs } from '../server/src/integrations/ojs/reviewSnapshot.ts';
import { createManuscriptFromOjsLaunch } from '../src/integrations/ojs/importOjsLaunch.ts';
import { createManuscriptFromOjsLaunch as importLocalized } from '../src/integrations/ojs/importOjsLaunchLocalized.ts';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const JSZip = require('jszip');
const input = {
  title: 'Article', authors: [{ name: 'Author identity' }], authorIdentity: 'visible', fileName: 'Author identity.docx',
  blocks: [{ id: 'p-1', type: 'paragraph', text: 'Corrected sentence', richText: [{ text: 'Corrected ', semantics: ['strong'] }, { text: 'sentence', semantics: ['emphasis'] }] },
    { id: 'table-1', type: 'table', cells: [['A', 'B'], ['1', '2']], headerRows: 1 }],
  annotations: [
    { id: 'public', type: 'comment', targetBlockId: 'p-1', targetText: 'Corrected', body: 'Visible note', visibility: 'author_and_editor', authorName: 'Reviewer identity', status: 'open' },
    { id: 'private', type: 'comment', targetBlockId: 'p-1', targetText: 'sentence', body: 'Confidential note', visibility: 'editor_only', authorName: 'Reviewer identity', status: 'resolved' },
    { id: 'reply', type: 'comment', targetBlockId: 'p-1', targetText: 'sentence', body: 'Public reply', visibility: 'author_and_editor', replyToCommentId: 'private', status: 'open' },
  ],
};

test('scientific snapshot enforces double anonymity while preserving formatting and anchored comments', () => {
  const result = sanitizeReviewManuscript(input);
  assert.equal(result.authorIdentity, 'hidden');
  assert.equal(result.authors, undefined);
  assert.ok(!JSON.stringify(result).includes('identity'));
  assert.equal(result.annotations?.length, 3);
  assert.equal(result.blocks[0]?.id, 'p-1');
  assert.deepEqual(result.blocks[1], input.blocks[1]);
  assert.equal(result.annotations?.find(item => item.id === 'reply')?.replyToCommentId, undefined);
});
for (const role of ['language_review', 'translation']) test(`${role} preserves author and participant names`, () => {
  const result = sanitizeReviewManuscript(input, true);
  assert.equal(result.authorIdentity, 'visible');
  assert.equal(result.authors?.[0]?.name, 'Author identity');
  assert.equal(result.annotations?.[0]?.authorName, 'Reviewer identity');
});

test('author projection omits private annotations and private parent links', () => {
  const result = authorVisibleReviewManuscript(input, true);
  assert.equal(result.annotations?.length, 2);
  assert.ok(!JSON.stringify(result).includes('Confidential note'));
  assert.equal(result.annotations?.[1]?.replyToCommentId, undefined);
});

for (const openIdentity of [false, true]) test(`returned Word document contains real comments and formatted text; open=${openIdentity}`, async () => {
  const bytes = await buildReviewDocx(sanitizeReviewManuscript(input, openIdentity), openIdentity, 'Reviewer identity');
  const zip = await JSZip.loadAsync(bytes);
  const document = await zip.file('word/document.xml').async('string');
  const comments = await zip.file('word/comments.xml').async('string');
  const core = await zip.file('docProps/core.xml').async('string');
  assert.match(document, /Corrected/);
  assert.match(document, /<w:b\b/);
  assert.match(document, /<w:i\b/);
  assert.match(document, /<w:tbl\b/);
  assert.match(document, /<w:commentRangeStart\b/);
  assert.match(comments, /Visible note/);
  assert.ok(!comments.includes('Confidential note'));
  assert.equal(`${document}${comments}${core}`.includes('Reviewer identity'), openIdentity);
  assert.equal(`${document}${comments}${core}`.includes('Author identity'), openIdentity);
});

test('DOCX comments spanning paragraphs, replies and unresolved ranges are retained', () => {
  const prefix = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const document = `<w:document ${prefix}><w:body><w:p><w:commentRangeStart w:id="0"/><w:r><w:t>First</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r><w:commentRangeEnd w:id="0"/></w:p></w:body></w:document>`;
  const comments = `<w:comments ${prefix}><w:comment w:id="0" w:author="Editor"><w:p><w:r><w:t>Comment</w:t></w:r></w:p></w:comment><w:comment w:id="1"><w:p><w:r><w:t>Unresolved</w:t></w:r></w:p></w:comment></w:comments>`;
  const notes = readDocxReviewAnnotations(document, comments);
  assert.equal(notes.length, 2);
  assert.equal(notes[0]?.targetText, 'FirstSecond');
  assert.equal(notes[0]?.paragraphText, 'First');
  const snapshot = createReviewSnapshotFromOjs({ submission: {}, contributors: [], files: [], sourceDocument: {
    kind: 'docx', fileExternalId: '1', fileName: 'test.docx', mediaType: '', paragraphs: [{ text: 'First' }, { text: 'Second' }], footnotes: [], endnotes: [], reviewAnnotations: notes,
  } });
  const stored = sanitizeReviewManuscript(snapshot);
  assert.equal(stored.annotations?.length, 2);
  assert.equal(stored.annotations?.[0]?.targetBlockId, stored.blocks[0]?.id);
  assert.equal(stored.annotations?.[1]?.anchorStatus, 'unresolved');
});

test('deleting a target paragraph does not discard its comment', () => {
  const snapshot = sanitizeReviewManuscript({ ...input, blocks: [{ id: 'other', type: 'paragraph', text: '' }] });
  assert.equal(snapshot.blocks.length, 1);
  assert.equal(snapshot.annotations?.length, 3);
  assert.equal(snapshot.annotations?.[0]?.anchorStatus, 'unresolved');
});

test('paired snapshot restores public comment IDs and status through both OJS reopening paths', () => {
  const snapshot = authorVisibleReviewManuscript(input, true);
  const source = { kind: 'docx' as const, fileExternalId: '1', fileName: 'returned.docx', mediaType: '',
    paragraphs: [{ text: 'Corrected sentence' }], footnotes: [], endnotes: [], reviewSnapshot: snapshot };
  for (const importer of [createManuscriptFromOjsLaunch, importLocalized]) {
    const manuscript = importer({ protocol: 'omi-integration/1', profile: 'omi-integration/1/ojs',
      submission: { externalId: '217', title: { en: 'Article' }, primaryLocale: 'en' }, contributors: [], files: [], sourceDocument: source });
    assert.ok(manuscript);
    const comments = manuscript.annotations.filter(item => item.type === 'comment');
    assert.equal(comments.length, 2);
    assert.ok(comments.every(item => item.visibility === 'author_and_editor'));
    assert.ok(manuscript.sections.flatMap(section => section.blocks).some(block => block.id === comments[0]?.targetBlockId));
    assert.equal(comments[0]?.body, 'Visible note');
  }
  const reviewerCopy = createReviewSnapshotFromOjs({ submission: {}, contributors: [], files: [], sourceDocument: source });
  assert.equal(reviewerCopy.authorIdentity, 'hidden');
  assert.equal(reviewerCopy.authors, undefined);
  assert.equal(reviewerCopy.annotations?.[0]?.id, 'public');
});
