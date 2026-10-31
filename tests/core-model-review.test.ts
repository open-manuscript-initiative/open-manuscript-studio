import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { validateCoreSnapshot } from '../src/model/coreSnapshotValidator.mjs';
import { isCoreReviewCurrent, runCoreModelReview } from '../src/services/coreModelReview.ts';
const root = new URL('./fixtures/core-review/', import.meta.url);

test('vendored validator is bound to its disclosed shared-source digest', async () => {
  const provenance = JSON.parse(await readFile(new URL('provenance.json', root), 'utf8'));
  const module = await readFile(new URL('../src/model/coreSnapshotValidator.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(module).digest('hex'), provenance.sha256);
  assert.equal(provenance.independentImplementation, false);
});
test('all 22 canonical fixture results agree with the same versioned review corpus', async () => {
  const folder = new URL('0.1.0/', root), manifest = JSON.parse(await readFile(new URL('manifest.json', folder), 'utf8'));
  assert.equal(manifest.fixtures.length, 22);
  for (const fixture of manifest.fixtures) {
    const bytes = await readFile(new URL(fixture.path, folder));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.sha256);
    const document = JSON.parse(bytes.toString()), before = structuredClone(document);
    const result = validateCoreSnapshot(document, { mode: fixture.mode });
    assert.equal(result.outcome, fixture.expectedOutcome, fixture.id);
    assert.deepEqual([...new Set(result.diagnostics.map(item => item.code))].sort(), fixture.expectedDiagnostics, fixture.id);
    assert.deepEqual(document, before);
  }
});
test('actual Studio working state is reviewable without changing envelopes, history or editor content', () => {
  const manuscript = createBlankManuscript({ kind: 'study', locale: 'hu', title: '' });
  const before = structuredClone(manuscript);
  const authoring = runCoreModelReview(manuscript);
  assert.equal(authoring.result.outcome, 'valid');
  assert.equal(authoring.result.mode, 'authoring');
  assert.equal(authoring.conformance, 'not-assessed');
  assert.equal(runCoreModelReview(manuscript, 'exchange').result.outcome, 'invalid');
  assert.deepEqual(manuscript, before);
});
test('metadata errors are diagnosed and report downloads contain no manuscript text', () => {
  const manuscript = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Private manuscript title' });
  manuscript.updatedAt = '2026-02-30T00:00:00Z';
  const report = runCoreModelReview(manuscript);
  assert.equal(report.result.outcome, 'invalid');
  assert.ok(report.result.diagnostics.some(item => item.code === 'INVALID_TIMESTAMP'));
  assert.equal(JSON.stringify(report).includes('Private manuscript title'), false);
});
test('changes invalidate reports while moving between UI locales does not affect source metadata', () => {
  const manuscript = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Same' });
  const report = runCoreModelReview(manuscript);
  assert.equal(isCoreReviewCurrent(manuscript, report), true);
  const id = manuscript.sections[0].id;
  manuscript.sections[0].title = 'Edited';
  assert.equal(manuscript.sections[0].id, id);
  assert.equal(manuscript.locale, 'hu');
  assert.equal(isCoreReviewCurrent(manuscript, report), false);
});
