import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { validateOmiManuscriptSchema } from '../src/services/omiSchemaValidation.ts';
import { validateStudioManuscript } from '../src/services/manuscriptValidation.ts';
import { parseValidationReport, serializeValidationReport } from '../src/services/validationReport.ts';

// Run this file with --disallow-code-generation-from-strings. A top-level Ajv
// compiler import would fail before any test runs, as it did in the native app.
test('runtime forbids string compilation, matching the native script policy', () => {
  assert.throws(() => new Function('return true'), EvalError);
});

test('portable manuscript validation works with dynamic code generation forbidden', () => {
  const source = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Natív próba 😀' });
  const portable = toPortableOmiManuscript(source);
  assert.deepEqual(validateOmiManuscriptSchema(portable), []);
  assert.ok(validateOmiManuscriptSchema({ ...portable, locale: '!' }).length);
  assert.ok(validateOmiManuscriptSchema({ ...portable, id: '😀'.repeat(2049) }).length);
  assert.ok(validateOmiManuscriptSchema({ ...portable, createdAt: 'yesterday' }).length);
  assert.ok(validateOmiManuscriptSchema({ ...portable, assets: [{ id: 'image', mediaType: 'image/png', uri: 'http://[' }] }).length);
});

test('validation report generation, export and reopening work under the native policy', async () => {
  const source = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Natív próba' });
  const report = await validateStudioManuscript(source, { createdAt: '2026-11-02T12:00:00Z' });
  assert.deepEqual(parseValidationReport(serializeValidationReport(report)), report);
  assert.throws(() => parseValidationReport(JSON.stringify({ ...report, createdAt: '2026-02-30T12:00:00Z' })));
  assert.throws(() => parseValidationReport(JSON.stringify({ ...report, exclusions: [...report.exclusions, report.exclusions[0]] })));
});
