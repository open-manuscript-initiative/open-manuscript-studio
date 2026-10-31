import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { validateStudioManuscript, validationTargetSection } from '../src/services/manuscriptValidation.ts';
import { assertValidationReport, parseValidationReport, serializeValidationReport } from '../src/services/validationReport.ts';
import { executeValidationChecks, fingerprintValidationSubject, isValidationReportCurrent, MAX_VALIDATION_FINDINGS_PER_CHECK, VALIDATION_CHECKS, VALIDATION_PROFILES, type ValidationCheckId, type ValidationCheckOutput } from '../src/model/validation.ts';
import { createManuscriptTranslation, TRANSLATION_EXTENSION, TRANSLATION_PROFILE } from '../src/model/translation.ts';
import { createNoteAnnotation } from '../src/model/notes.ts';
import { createNamedAnchor } from '../src/model/namedAnchors.ts';
import { sha256HexSync } from '../src/model/stateDigest.ts';
import type { OmiManuscript } from '../src/types/omi.ts';

function source() { return createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Validation fixture' }); }
const time = '2026-10-31T08:00:00.000Z';

test('authoring report has explicit versioned coverage, is nonmutating and roundtrips', async () => {
  const manuscript = source(), before = structuredClone(manuscript);
  const report = await validateStudioManuscript(manuscript, { createdAt: time });
  assert.deepEqual(report.checks.map((check) => check.id), VALIDATION_PROFILES.authoring);
  assert.equal(report.summary.outcome, 'valid');
  assert.equal(report.summary.complete, true);
  assert.equal(report.experimental, true);
  assert.equal(report.subject.headRevisionId, manuscript.headRevisionId);
  assert.equal(report.createdAt, time);
  assertValidationReport(report);
  assert.deepEqual(parseValidationReport(serializeValidationReport(report)), report);
  assert.deepEqual(manuscript, before);
});

test('draft authoring accepts an untitled manuscript while strict exchange reports it', async () => {
  const manuscript = createBlankManuscript({ kind: 'study', locale: 'en' });
  assert.equal((await validateStudioManuscript(manuscript)).summary.outcome, 'valid');
  const report = await validateStudioManuscript(manuscript, { profile: 'exchange' });
  assert.equal(report.summary.outcome, 'invalid');
  assert.ok(report.diagnostics.some((item) => item.code === 'invalid-portable-document'));
  manuscript.title = 'Still editable';
  assert.equal(manuscript.title, 'Still editable');
});

test('publication preflight uses the selected publisher requirements', async () => {
  const manuscript = source();
  assert.equal((await validateStudioManuscript(manuscript, { profile: 'exchange' })).summary.outcome, 'valid');
  const report = await validateStudioManuscript(manuscript, { profile: 'publication-preflight' });
  assert.ok(report.diagnostics.some((item) => item.code === 'publication.missing-contributor'));
  assert.equal(report.summary.outcome, 'invalid');
  assert.ok(report.exclusions.includes('artifact-rendering-and-dtd'));
});

test('duplicate IDs, malformed languages and non-preorder section relations are located', async () => {
  const manuscript = source();
  manuscript.sections[0]!.blocks.push({ ...manuscript.sections[0]!.blocks[0]! });
  manuscript.sections[0]!.parentSectionId = manuscript.sections[0]!.id;
  manuscript.locale = '!';
  const report = await validateStudioManuscript(manuscript);
  for (const code of ['duplicate-id', 'invalid-language', 'invalid-hierarchy']) assert.ok(report.diagnostics.some((item) => item.code === code));
  assert.equal(report.diagnostics.find((item) => item.code === 'duplicate-id')?.path, '/sections/0/blocks/1/id');
});

test('invalid manuscript and head identifiers can still be described in an exportable report', async () => {
  const manuscript = source();
  manuscript.id = '';
  manuscript.headRevisionId = '';
  const report = await validateStudioManuscript(manuscript);
  assert.equal(report.subject.manuscriptId, null);
  assert.equal(report.subject.headRevisionId, null);
  assert.equal(report.summary.outcome, 'invalid');
  assertValidationReport(report);
});

test('nested blocks and sections participate in reference and bookmark checks', async () => {
  const manuscript = source(), root = manuscript.sections[0]!;
  root.children = [{ id: 'child-section', title: 'Child', blocks: [{ id: 'parent-block', type: 'paragraph', content: '', children: [{ id: 'child-block', type: 'paragraph', content: 'Nested' }] }] }];
  manuscript.namedAnchors = [createNamedAnchor({ id: 'bookmark-child', name: 'Child', targetId: 'child-block', targetKind: 'block' })];
  let report = await validateStudioManuscript(manuscript);
  assert.equal(report.summary.outcome, 'valid');
  assert.equal(validationTargetSection(manuscript, 'child-block'), 'child-section');
  manuscript.annotations.push({ id: 'orphan', type: 'comment', targetBlockId: 'absent', body: '', renderingHint: 'margin' });
  report = await validateStudioManuscript(manuscript);
  assert.equal(report.diagnostics.find((item) => item.code === 'unresolved-reference')?.path, '/annotations/0/targetBlockId');
});

test('note markers require a matching note and duplicate anchors are rejected', async () => {
  const manuscript = source(), block = manuscript.sections[0]!.blocks[0]!;
  const marker = { type: 'omiNote', attrs: { noteId: 'note', anchorId: 'anchor-note', noteType: 'footnote' } };
  block.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [marker] }] });
  manuscript.annotations.push(createNoteAnnotation({ id: 'note', anchorId: 'anchor-note', targetBlockId: block.id, body: 'Footnote' }));
  assert.equal((await validateStudioManuscript(manuscript)).summary.outcome, 'valid');
  block.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [marker, marker] }] });
  assert.ok((await validateStudioManuscript(manuscript)).diagnostics.some((item) => item.code === 'invalid-note-anchor'));
});

test('citation and cross-reference anchors are checked against object identity and target kind', async () => {
  const manuscript = source(), block = manuscript.sections[0]!.blocks[0]!;
  manuscript.bibliographicRecords = [{ id: 'record', type: 'book', title: 'Book', contributors: [], identifiers: [], status: 'verified' }];
  manuscript.citations = [{ id: 'citation', anchorId: 'cite-anchor', target: 'record', targetBlockId: block.id }];
  manuscript.crossReferences = [{ id: 'xref', anchorId: 'xref-anchor', sourceBlockId: block.id, targetId: manuscript.sections[0]!.id, targetKind: 'section', displayStyle: 'title' }];
  block.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'omiCitation', attrs: { citationId: 'citation', anchorId: 'cite-anchor' } },
    { type: 'omiCrossReference', attrs: { crossReferenceId: 'xref', anchorId: 'xref-anchor' } },
  ] }] });
  assert.equal((await validateStudioManuscript(manuscript)).summary.outcome, 'valid');
  manuscript.crossReferences[0]!.targetKind = 'figure';
  manuscript.citations[0]!.anchorId = 'different';
  const report = await validateStudioManuscript(manuscript);
  assert.ok(report.diagnostics.some((item) => item.code === 'invalid-citation-anchor'));
  assert.ok(report.diagnostics.some((item) => item.code === 'invalid-cross-reference'));
});

test('revision evidence detects tampering even when the head and live state are unchanged', async () => {
  const manuscript = source();
  const report = await validateStudioManuscript(manuscript);
  assert.equal(isValidationReportCurrent(manuscript, report), true);
  manuscript.revisionHistory.revisions[0]!.snapshot.state.title = 'Tampered';
  assert.equal(isValidationReportCurrent(manuscript, report), false);
  const next = await validateStudioManuscript(manuscript);
  assert.ok(next.diagnostics.some((item) => item.code === 'invalid-digest'));
  assert.equal(next.summary.outcome, 'invalid');
});

test('missing digests and shallow histories are disclosed without inventing integrity evidence', async () => {
  const manuscript = source();
  delete (manuscript.revisionHistory.revisions[0] as unknown as { stateDigest?: unknown }).stateDigest;
  manuscript.revisionHistory.completeness = 'shallow';
  const report = await validateStudioManuscript(manuscript);
  assert.equal(report.summary.outcome, 'indeterminate');
  assert.equal(report.summary.warnings, 1);
  assert.equal(report.summary.information, 1);
});

test('working edits, revision commits and foreign documents make a report stale', async () => {
  const manuscript = source(), report = await validateStudioManuscript(manuscript);
  assert.equal(isValidationReportCurrent(source(), report), false);
  manuscript.title += ' changed';
  assert.equal(isValidationReportCurrent(manuscript, report), false);
  assert.notDeepEqual(fingerprintValidationSubject(manuscript), report.subject);
});

test('unfinished translations are advisory and unsupported profiles make coverage incomplete', async () => {
  const manuscript = source();
  const variant = createManuscriptTranslation(manuscript, { kind: 'manuscript', id: manuscript.id }, 'en');
  manuscript.extensions = { [TRANSLATION_EXTENSION]: { profile: TRANSLATION_PROFILE, variants: [variant] } };
  let report = await validateStudioManuscript(manuscript);
  assert.equal(report.summary.outcome, 'valid');
  assert.ok(report.diagnostics.some((item) => item.code === 'unfinished-translation'));
  manuscript.title += ' source edit';
  report = await validateStudioManuscript(manuscript);
  assert.ok(report.diagnostics.some((item) => item.code === 'stale-translation'));
  manuscript.extensions[TRANSLATION_EXTENSION] = { profile: 'future-profile' };
  report = await validateStudioManuscript(manuscript);
  assert.equal(report.summary.outcome, 'indeterminate');
  assert.equal(report.summary.complete, false);
});

test('missing, corrupt and unavailable asset payloads have distinct results', async () => {
  const manuscript = source(), bytes = new Uint8Array([1, 2, 3]);
  manuscript.assets = [{ id: 'asset', modelVersion: '0.1.0-alpha.1', fileName: 'image.png', mediaType: 'image/png', size: 3, role: 'figure', checksum: { algorithm: 'sha256', scope: 'raw-bytes', value: sha256HexSync(bytes) } }];
  const run = (loadAsset?: (m: string, a: string) => Promise<Uint8Array | undefined>) => validateStudioManuscript(manuscript, { profile: 'exchange', loadAsset });
  assert.equal((await run()).summary.outcome, 'indeterminate');
  assert.equal((await run(async () => bytes)).summary.outcome, 'valid');
  assert.ok((await run(async () => undefined)).diagnostics.some((item) => item.code === 'missing-asset'));
  assert.ok((await run(async () => new Uint8Array([3, 2, 1]))).diagnostics.some((item) => item.code === 'invalid-asset'));
  const unavailable = await run(async () => { throw new Error('private exception text'); });
  assert.equal(unavailable.summary.outcome, 'indeterminate');
  assert.equal(unavailable.checks.find((item) => item.id === 'assets')?.status, 'error');
  assert.equal(serializeValidationReport(unavailable).includes('private exception text'), false);
});

test('asynchronous validation inspects an isolated snapshot while editing continues', async () => {
  const manuscript = source();
  const original = fingerprintValidationSubject(manuscript);
  const pending = validateStudioManuscript(manuscript, { profile: 'exchange' });
  manuscript.title = 'An edit during validation';
  const report = await pending;
  assert.deepEqual(report.subject, original);
  assert.equal(isValidationReportCurrent(manuscript, report), false);
});

test('reports reject omitted checks, orphan diagnostics, false summaries and malformed timestamps', async () => {
  const report = await validateStudioManuscript(source());
  for (const corrupt of [
    (copy: typeof report) => { copy.checks.pop(); },
    (copy: typeof report) => { copy.exclusions = []; },
    (copy: typeof report) => { copy.summary.outcome = 'invalid'; },
    (copy: typeof report) => { copy.createdAt = '2026-02-30T00:00:00Z'; },
    (copy: typeof report) => { copy.version = '9.9.9' as never; },
    (copy: typeof report) => { copy.checks[0]!.diagnosticIds.push('missing'); },
    (copy: typeof report) => { copy.diagnostics.push({ id: 'fake', checkId: 'history', code: 'invalid-history', severity: 'error', path: '/revisionHistory' }); },
  ]) { const copy = structuredClone(report); corrupt(copy); assert.throws(() => assertValidationReport(copy)); }
});

test('large result sets are bounded and disclosed as incomplete', async () => {
  const manuscript = source();
  for (let index = 0; index < 300; index++) manuscript.annotations.push({ id: `comment-${index}`, type: 'comment', targetBlockId: 'missing', body: 'private', renderingHint: 'margin' });
  const report = await validateStudioManuscript(manuscript);
  assert.equal(report.checks.find((check) => check.id === 'references')?.truncated, true);
  assert.equal(report.diagnostics.length, MAX_VALIDATION_FINDINGS_PER_CHECK);
  assert.equal(report.summary.complete, false);
  assert.equal(report.summary.outcome, 'invalid');
  assertValidationReport(report);
  assert.equal(serializeValidationReport(report).includes('private'), false);
});

test('failed check execution is never converted to a valid result and later checks still run', async () => {
  const adapters = Object.fromEntries(Object.keys(VALIDATION_CHECKS).map((id) => [id, () => ({ findings: [] })])) as Record<ValidationCheckId, (source: OmiManuscript) => ValidationCheckOutput>;
  adapters.identifiers = () => { throw new Error('secret content'); };
  const report = await executeValidationChecks(source(), 'authoring', adapters);
  assert.equal(report.summary.outcome, 'indeterminate');
  assert.equal(report.checks.at(-1)!.status, 'pass');
  assertValidationReport(report);
  assert.equal(serializeValidationReport(report).includes('secret content'), false);
});

test('published report fixtures distinguish invalid documents from malformed reports', () => {
  for (const [file, outcome] of [['valid-authoring', 'valid'], ['invalid-reference', 'invalid'], ['incomplete-assets', 'indeterminate']]) {
    const report = parseValidationReport(readFileSync(new URL(`./fixtures/validation/${file}.json`, import.meta.url), 'utf8'));
    assert.equal(report.summary.outcome, outcome);
  }
  assert.throws(() => parseValidationReport(readFileSync(new URL('./fixtures/validation/rejected-missing-check.json', import.meta.url), 'utf8')));
});
