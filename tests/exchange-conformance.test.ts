import assert from 'node:assert/strict';
import test from 'node:test';
import { digestBytes, createExchangeReport, exchangeProfile, finishExchangeReport, compareRoundTripInvariants } from '../src/model/exchange.ts';
import { assessmentOutcome, capabilityStatement, isAssessmentCurrent, MODEL_SUITE, runModelAssessment } from '../src/model/conformance.ts';
import { beginExportReport, ExportExchangeSession, OfficeImportPreparationError, prepareOfficeImport, reportExportArtifact } from '../src/services/exchangeSession.ts';
import type { DocxManuscriptImportPlan } from '../src/services/docxManuscriptImport.ts';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip.ts';
import { toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

const implementation = { name: 'Studio test', version: 'test', build: 'test', revision: 'test-sha', dependencies: 'test-deps' };
const bytes = new TextEncoder().encode('árvíztűrő 中文 العربية');

test('export application session binds inspected bytes and separates delivery, cancellation and failure', async () => {
  const job = await ExportExchangeSession.begin('pdf', 'synthetic source');
  assert.throws(() => job.finishDelivery(true), /OUTPUT_NOT_INSPECTED/);
  job.recordAdapterDiagnostics({ warnings: ['Known limitation', 42] });
  await job.inspectArtifact(new Blob(['%PDF-1.7 synthetic']));
  const cancelled = job.finishDelivery(false);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.lossless, false);
  assert.ok(cancelled.events.some((item) => item.code === 'ADAPTER_WARNING'));
  const invalid = await ExportExchangeSession.begin('pdf', 'synthetic source');
  await assert.rejects(invalid.inspectArtifact(new Blob(['not a PDF'])), /OUTPUT_INVALID/);
  assert.throws(() => invalid.finishDelivery(true), /OUTPUT_NOT_INSPECTED/);
  assert.ok(invalid.fail().events.some((item) => item.code === 'INVALID_ARTIFACT_ENVELOPE'));
  const valid = await ExportExchangeSession.begin('omi-json', 'exact source');
  const artifact = new Blob([JSON.stringify(toPortableOmiManuscript(createVersionedTestManuscript()))]);
  await valid.inspectArtifact(artifact);
  const saved = valid.finishDelivery(true);
  assert.equal(saved.status, 'completed-with-loss');
  assert.equal(saved.output?.digest, digestBytes(new Uint8Array(await artifact.arrayBuffer())));
  saved.events.length = 0;
  assert.ok(valid.fail().events.some((item) => item.code === 'INSPECTION_INCOMPLETE'), 'Returned reports cannot mutate application session state');
});

test('versioned mappings separate direction and publication from semantic exchange', () => {
  assert.equal(exchangeProfile('import', 'docx').source, 'docx');
  assert.equal(exchangeProfile('export', 'docx').target, 'docx');
  assert.equal(exchangeProfile('export', 'pdf').projection, 'publication');
  assert.throws(() => exchangeProfile('import', 'pdf'), /MAPPING_UNAVAILABLE/);
});

test('reports bind actual bytes without mutating input or asserting zero loss', () => {
  const source = createExchangeReport(exchangeProfile('export', 'omi'), bytes, true);
  const before = structuredClone(source);
  const result = finishExchangeReport(source, bytes);
  assert.deepEqual(source, before);
  assert.equal(result.status, 'completed-with-loss');
  assert.equal(result.output?.digest, digestBytes(bytes));
  assert.equal(result.source.digest, result.output?.digest);
  assert.equal(result.coverage, 'incomplete');
  assert.equal(result.lossless, false);
  assert.equal(result.roundTrip, 'not-assessed');
  assert.ok(!JSON.stringify(result).includes('árvíztűrő'));
});

test('empty output and mandatory errors never yield completed output', () => {
  const report = createExchangeReport(exchangeProfile('export', 'docx'), bytes, true);
  assert.equal(finishExchangeReport(report, new Uint8Array()).status, 'failed');
  assert.equal(finishExchangeReport(report, bytes, [{ code: 'BROKEN_REFERENCE', severity: 'error', disposition: 'unverifiable', feature: 'note', sourceLocator: '/notes/1', consequence: 'Required note target missing' }]).status, 'failed');
});

test('round-trip evidence must exist and compare exact declared invariants', () => {
  assert.deepEqual(compareRoundTripInvariants(['text', 'language', 'notes'], { text: 'a', language: 'hu' }, { text: 'a', language: 'de' }), [
    { invariant: 'text', outcome: 'pass' }, { invariant: 'language', outcome: 'fail' }, { invariant: 'notes', outcome: 'indeterminate' },
  ]);
  assert.equal(compareRoundTripInvariants(['toString'], {}, {})[0].outcome, 'indeterminate');
});

test('office receipt retains the immutable source independently from editable candidate', async () => {
  const originalZip = createStoreZip([textZipEntry('word/document.xml', 'source')]);
  const original = new File([originalZip.buffer as ArrayBuffer], 'test.docx');
  const plan = { title: 'Editable', sections: [], warnings: [{ code: 'text-boxes-flattened', severity: 'warning', message: 'Flattened' }] } as DocxManuscriptImportPlan;
  const receipt = await prepareOfficeImport(original, 'docx', async (file) => {
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), originalZip);
    return plan;
  });
  plan.title = 'Changed';
  assert.deepEqual(new Uint8Array(await receipt.original.arrayBuffer()), originalZip);
  assert.equal(receipt.report.status, 'prepared');
  assert.equal(receipt.report.events[1].code, 'text-boxes-flattened');
  await assert.rejects(prepareOfficeImport(original, 'odt', async () => plan), /INVALID_SOURCE/);
  await assert.rejects(prepareOfficeImport({ size: 201 * 1024 * 1024 } as File, 'docx', async () => plan), /RESOURCE_LIMIT/);
});

test('failed parsing never returns a committable receipt or modifies the original', async () => {
  const original = new File([createStoreZip([textZipEntry('content.xml', 'unchanged')]).buffer as ArrayBuffer], 'bad.odt');
  await assert.rejects(prepareOfficeImport(original, 'odt', async () => { throw new Error('invalid XML'); }), (error) => {
    assert.ok(error instanceof OfficeImportPreparationError);
    assert.equal(error.report.status, 'failed');
    assert.equal(error.original, original);
    return true;
  });
  assert.ok((await original.arrayBuffer()).byteLength > 30);
});

test('asynchronous artifact receipts hash actual bytes and reject wrong output envelopes', async () => {
  const source = 'private manuscript text';
  const report = await beginExportReport('docx', source);
  assert.equal(report.source.digest, digestBytes(new TextEncoder().encode(source)));
  const invalid = await reportExportArtifact(report, new Blob(['not a zip']));
  assert.equal(invalid.status, 'failed');
  assert.ok(invalid.events.some((item) => item.code === 'INVALID_ARTIFACT_ENVELOPE'));
  const zip = createStoreZip([textZipEntry('word/document.xml', '<document/>')]);
  const valid = await reportExportArtifact(report, new Blob([zip]));
  assert.equal(valid.status, 'completed-with-loss');
  assert.equal(valid.output?.digest, digestBytes(zip));
  assert.equal(valid.validation.status, 'not-run');
  assert.equal(valid.coverage, 'incomplete');
});

test('disclosures are build-bound and never fabricate support for undeclared features', () => {
  const statement = capabilityStatement(implementation, 'web');
  assert.equal(statement.assertionLevel, 'disclosure');
  assert.equal(statement.verification, 'not-independent');
  assert.equal(statement.outcome, 'indeterminate');
  const collaboration = statement.capabilities.find((item) => item.specification === 'OMI-SPEC-190');
  assert.equal(collaboration?.status, 'conditional');
  assert.ok(collaboration?.prerequisites.length);
});

test('suite accounts for all 72 Draft requirements, without promoting partial evidence', () => {
  const report = runModelAssessment(implementation, 'test');
  assert.equal(report.evidence.coverage.length, 72);
  assert.equal(new Set(report.evidence.coverage.map((item) => item.requirement)).size, 72);
  assert.ok(report.evidence.results.every((item) => item.status === 'pass'));
  assert.ok(report.evidence.coverage.some((item) => item.status === 'not-run'));
  assert.equal(report.evidence.outcome, 'indeterminate');
  assert.equal(report.evidence.complete, false);
  assert.equal(MODEL_SUITE.approved, false);
});

test('mandatory failure dominates missing evidence and unapproved suites cannot pass', () => {
  assert.equal(assessmentOutcome(['pass', 'fail', 'not-run'], false, false, false), 'nonconformant');
  for (const status of ['skip', 'error', 'not-run'] as const) assert.equal(assessmentOutcome(['pass', status], true, true, true), 'indeterminate');
  assert.equal(assessmentOutcome([], true, true, true), 'indeterminate');
  assert.equal(assessmentOutcome(['pass'], true, false, true), 'indeterminate');
  assert.equal(assessmentOutcome(['pass'], true, true, true), 'conformant');
});

test('evidence becomes stale for changed builds, dependencies, environment or tampered results', () => {
  const report = runModelAssessment(implementation, 'web');
  assert.equal(isAssessmentCurrent(report, implementation, 'web'), true);
  assert.equal(isAssessmentCurrent(report, { ...implementation, revision: 'new' }, 'web'), false);
  assert.equal(isAssessmentCurrent(report, { ...implementation, dependencies: 'new' }, 'web'), false);
  assert.equal(isAssessmentCurrent(report, implementation, 'android'), false);
  report.evidence.results[0].status = 'fail';
  assert.equal(isAssessmentCurrent(report, implementation, 'web'), false);
});


test('exchange inspection refuses fake and truncated ZIPs rather than reporting completed export', async () => {
  const report = await beginExportReport('docx', 'source');
  const validZip = createStoreZip([textZipEntry('word/document.xml', 'known synthetic fixture')]);
  const ok = await reportExportArtifact(report, new Blob([validZip]));
  assert.equal(ok.status, 'completed-with-loss');
  assert.equal(ok.validation.status, 'not-run', 'Envelope preflight is not DOCX semantic validation');
  for (const bytes of [
    new Uint8Array([0x50, 0x4b, 3, 4]),
    validZip.slice(0, validZip.length - 12),
    new Uint8Array(validZip.length).fill(0x50),
  ]) {
    const rejected = await reportExportArtifact(report, new Blob([bytes]));
    assert.equal(rejected.status, 'failed');
    assert.ok(rejected.events.some((event) => event.code === 'INVALID_ARTIFACT_ENVELOPE'));
    assert.equal(rejected.output, undefined);
  }
  const tampered = validZip.slice();
  const central = tampered.findIndex((byte, index) => byte === 0x50 &&
    tampered[index + 1] === 0x4b && tampered[index + 2] === 1 && tampered[index + 3] === 2);
  assert.ok(central > 0);
  tampered[central] = 0;
  assert.equal((await reportExportArtifact(report, new Blob([tampered]))).status, 'failed');
});

test('exchange inspection requires canonical OMI JSON and a JATS article envelope', async () => {
  const manuscript = createVersionedTestManuscript();
  const valid = JSON.stringify(toPortableOmiManuscript(manuscript));
  const source = await beginExportReport('omi-json', valid);
  assert.equal((await reportExportArtifact(source, new Blob([valid]))).status, 'completed-with-loss');

  for (const value of [
    '{ "synthetic": true }',
    '<html><body>not JSON</body></html>',
    '{"omi":{"version":"999.0.0","format":"manuscript"}}',
  ]) {
    const inspected = await reportExportArtifact(source, new Blob([value]));
    assert.equal(inspected.status, 'failed');
    assert.ok(inspected.events.some((event) => event.code === 'INVALID_ARTIFACT_ENVELOPE'));
  }

  const jats = await beginExportReport('jats', 'source');
  assert.equal((await reportExportArtifact(jats, new Blob(['<p>arbitrary content</p>']))).status, 'failed');
  const article = await reportExportArtifact(jats,
    new Blob(['<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE article SYSTEM "local.dtd"><article dtd-version="1.4"><front/><body/></article>']));
  assert.equal(article.status, 'completed-with-loss');
  assert.equal(article.validation.status, 'not-run', 'DTD validation remains a separate mandatory release gate');
});


test('office preflight rejects fake or broken DOCX/ODT archives and preserves source bytes', async () => {
  const invalid = new File(['not a ZIP package'], 'fake.docx');
  let parserInvoked = false;
  await assert.rejects(
    prepareOfficeImport(invalid, 'docx', async () => {
      parserInvoked = true;
      throw new Error('Should not be invoked for invalid input.');
    }),
    (error) => {
      assert.ok(error instanceof OfficeImportPreparationError);
      assert.equal(error.original, invalid);
      assert.equal(error.report.status, 'failed');
      assert.ok(error.report.events.some((event) => event.code === 'INVALID_SOURCE_ENVELOPE'));
      return true;
    },
  );
  assert.equal(parserInvoked, false);
  assert.equal(await invalid.text(), 'not a ZIP package');
});

test('office preflight rejects a parser that returns a non-committable candidate', async () => {
  const zip = createStoreZip([textZipEntry('content.xml', '<office:text/>')]);
  const original = new File([zip.buffer as ArrayBuffer], 'candidate.odt');
  await assert.rejects(
    prepareOfficeImport(original, 'odt', async () => ({
      title: 'Missing editable document sections', warnings: [],
    } as unknown as DocxManuscriptImportPlan)),
    (error) => {
      assert.ok(error instanceof OfficeImportPreparationError);
      assert.equal(error.report.status, 'failed');
      assert.ok(error.report.events.some((event) => event.code === 'INVALID_IMPORT_CANDIDATE'));
      return true;
    },
  );
  assert.deepEqual(new Uint8Array(await original.arrayBuffer()), zip);
});
