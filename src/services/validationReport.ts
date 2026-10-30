import Ajv2020 from 'ajv2020/dist/2020.js';
import schema from '../schemas/studio-validation-report-0.1.schema.json' with { type: 'json' };
import { summarizeValidation, VALIDATION_CHECKS, VALIDATION_PROFILES, VALIDATION_EXCLUSIONS, type ValidationReport } from '../model/validation';

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat('date-time', (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!
    && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60;
});
const validateSchema = ajv.compile<ValidationReport>(schema);

/** Reports are portable observations, never trusted authorization evidence. */
export function assertValidationReport(value: unknown): asserts value is ValidationReport {
  if (!validateSchema(value)) throw new Error('Invalid Studio validation report schema.');
  const report = value;
  if (report.exclusions.length !== VALIDATION_EXCLUSIONS.length || VALIDATION_EXCLUSIONS.some((item, index) => report.exclusions[index] !== item)) throw new Error('Invalid validation scope exclusions.');
  const expected = VALIDATION_PROFILES[report.profile];
  if (report.checks.length !== expected.length || report.checks.some((check, index) => check.id !== expected[index]
    || check.version !== VALIDATION_CHECKS[check.id].version)) throw new Error('Invalid validation check coverage.');
  const diagnostics = new Map(report.diagnostics.map((item) => [item.id, item]));
  if (diagnostics.size !== report.diagnostics.length) throw new Error('Duplicate validation diagnostic.');
  const linked = new Set<string>();
  for (const check of report.checks) {
    if (check.complete && (check.truncated || check.status === 'skipped' || check.status === 'error')) throw new Error('Inconsistent validation completeness.');
    for (const id of check.diagnosticIds) {
      if (linked.has(id) || diagnostics.get(id)?.checkId !== check.id) throw new Error('Invalid validation diagnostic reference.');
      linked.add(id);
    }
    const hasErrors = check.diagnosticIds.some((id) => diagnostics.get(id)?.severity === 'error');
    if ((check.status !== 'fail' && hasErrors) || (check.status === 'fail' && !hasErrors && !check.truncated)) throw new Error('Inconsistent validation check status.');
  }
  if (linked.size !== diagnostics.size) throw new Error('Unlinked validation diagnostic.');
  const summary = summarizeValidation(report.checks, report.diagnostics);
  if ((Object.keys(summary) as (keyof typeof summary)[]).some((key) => report.summary[key] !== summary[key])) throw new Error('Inconsistent validation summary.');
}

export function serializeValidationReport(report: ValidationReport): string {
  assertValidationReport(report);
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function parseValidationReport(json: string): ValidationReport {
  const report: unknown = JSON.parse(json);
  assertValidationReport(report);
  return report;
}
