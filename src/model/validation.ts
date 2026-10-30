import type { OmiManuscript } from '../types/omi';
import { calculateManuscriptStateDigestValue, canonicalizeManuscriptState, sha256HexSync } from './stateDigest';
import { extractManuscriptState } from './versioning';

/** Local implementation profile. OMI-SPEC-180 is Reserved, not a published standard. */
export const VALIDATION_REPORT_FORMAT = 'omi-studio-validation-report' as const;
export const VALIDATION_REPORT_VERSION = '0.1.0' as const;
export const VALIDATION_RULESET = 'studio-validation-0.1' as const;
export const VALIDATION_REPORT_SCHEMA = 'urn:omi:studio:validation-report:0.1' as const;
export const VALIDATION_EXCLUSIONS = ['external-link-availability', 'scholarly-accuracy', 'artifact-rendering-and-dtd', 'signature-and-publisher-authentication'] as const;
export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationCheckStatus = 'pass' | 'fail' | 'skipped' | 'error';
export type ValidationProfile = 'authoring' | 'exchange' | 'publication-preflight';
export type ValidationOutcome = 'valid' | 'invalid' | 'indeterminate';

export const VALIDATION_CHECKS = {
  identifiers: { specification: 'OMI-SPEC-120', version: '0.1.0' },
  references: { specification: 'OMI-SPEC-120', version: '0.1.0' },
  anchors: { specification: 'OMI-SPEC-130', version: '0.1.0' },
  history: { specification: 'OMI-SPEC-160', version: '0.1.0' },
  translations: { specification: 'OMI-SPEC-170', version: '0.1.0' },
  portability: { specification: 'OMI-SPEC-320', version: '0.1.0' },
  assets: { specification: 'OMI-SPEC-330', version: '0.1.0' },
  publication: { specification: 'OMI-SPEC-240', version: '0.1.0' },
} as const;
export type ValidationCheckId = keyof typeof VALIDATION_CHECKS;
export const VALIDATION_PROFILES: Readonly<Record<ValidationProfile, readonly ValidationCheckId[]>> = {
  authoring: ['identifiers', 'references', 'anchors', 'history', 'translations'],
  exchange: ['identifiers', 'references', 'anchors', 'history', 'translations', 'portability', 'assets'],
  'publication-preflight': ['identifiers', 'references', 'anchors', 'history', 'translations', 'portability', 'assets', 'publication'],
};

export interface ValidationSubject {
  manuscriptId: string | null;
  headRevisionId: string | null;
  stateDigest: string;
  /** Includes the envelope and history evidence, not just the working state. */
  evidenceDigest: string;
}
export interface ValidationDiagnostic {
  id: string;
  checkId: ValidationCheckId;
  code: string;
  severity: ValidationSeverity;
  /** RFC 6901 JSON pointer into the inspected Studio state. */
  path: string;
  targetId?: string;
  relatedId?: string;
}
export type ValidationFinding = Omit<ValidationDiagnostic, 'id' | 'checkId'>;
export interface ValidationCheckResult {
  id: ValidationCheckId;
  version: string;
  status: ValidationCheckStatus;
  diagnosticIds: string[];
  truncated: boolean;
  complete: boolean;
}
export interface ValidationReport {
  $schema: typeof VALIDATION_REPORT_SCHEMA;
  format: typeof VALIDATION_REPORT_FORMAT;
  version: typeof VALIDATION_REPORT_VERSION;
  ruleset: typeof VALIDATION_RULESET;
  relatedSpecification: 'OMI-SPEC-180';
  experimental: true;
  id: string;
  createdAt: string;
  profile: ValidationProfile;
  subject: ValidationSubject;
  checks: ValidationCheckResult[];
  diagnostics: ValidationDiagnostic[];
  summary: {
    outcome: ValidationOutcome;
    complete: boolean;
    errors: number;
    warnings: number;
    information: number;
  };
  /** Explicit scope boundaries; a valid preflight is not a publication certificate. */
  exclusions: string[];
}

export function fingerprintValidationSubject(manuscript: OmiManuscript): ValidationSubject {
  const state = extractManuscriptState(manuscript);
  // Canonicalizing revision states separately avoids hashing large nested state
  // trees twice and follows the existing image-preview exclusion convention.
  const history = manuscript.revisionHistory;
  const evidence = {
    versioningModelVersion: manuscript.versioningModelVersion,
    headRevisionId: manuscript.headRevisionId,
    omi: manuscript.omi,
    revisionHistory: {
      ...history,
      revisions: history.revisions.map((revision) => ({
        ...revision,
        snapshot: {
          manuscriptId: revision.snapshot.manuscriptId,
          stateDigest: calculateManuscriptStateDigestValue(revision.snapshot.state),
        },
      })),
    },
  };
  // The shared canonicalizer sorts arbitrary JSON members as well as state.
  const evidenceJson = canonicalizeManuscriptState({ ...state, sections: [], extensions: { validationEvidence: evidence } });
  return {
    manuscriptId: typeof manuscript.id === 'string' && manuscript.id.trim() ? manuscript.id : null,
    headRevisionId: typeof manuscript.headRevisionId === 'string' && manuscript.headRevisionId.trim() ? manuscript.headRevisionId : null,
    stateDigest: calculateManuscriptStateDigestValue(state),
    evidenceDigest: sha256HexSync(new TextEncoder().encode(evidenceJson)),
  };
}

export function isValidationReportCurrent(manuscript: OmiManuscript, report: ValidationReport): boolean {
  try {
    const subject = fingerprintValidationSubject(manuscript);
    return (Object.keys(subject) as (keyof ValidationSubject)[]).every((key) => subject[key] === report.subject[key]);
  } catch { return false; }
}

export function summarizeValidation(checks: readonly ValidationCheckResult[], diagnostics: readonly ValidationDiagnostic[]): ValidationReport['summary'] {
  const complete = checks.every((check) => check.complete);
  return {
    outcome: checks.some((check) => check.status === 'fail') ? 'invalid' : complete ? 'valid' : 'indeterminate',
    complete,
    errors: diagnostics.filter((item) => item.severity === 'error').length,
    warnings: diagnostics.filter((item) => item.severity === 'warning').length,
    information: diagnostics.filter((item) => item.severity === 'info').length,
  };
}

export interface ValidationCheckOutput {
  findings: ValidationFinding[];
  /** A check that could not inspect its scope cannot silently pass. */
  skipped?: boolean;
}
export const MAX_VALIDATION_FINDINGS_PER_CHECK = 200;

/** Independent adapters can fail without suppressing the remaining checks. */
export async function executeValidationChecks(
  source: OmiManuscript,
  profile: ValidationProfile,
  adapters: Record<ValidationCheckId, (snapshot: OmiManuscript) => ValidationCheckOutput | Promise<ValidationCheckOutput>>,
  createdAt = new Date().toISOString(),
): Promise<ValidationReport> {
  const required = VALIDATION_PROFILES[profile];
  if (!required) throw new Error('Unknown validation profile.');
  const snapshot = structuredClone(source);
  const subject = fingerprintValidationSubject(snapshot);
  const checks: ValidationCheckResult[] = [];
  const diagnostics: ValidationDiagnostic[] = [];
  for (const id of required) {
    let status: ValidationCheckStatus;
    let findings: ValidationFinding[];
    let complete: boolean;
    try {
      const output = await adapters[id](snapshot);
      findings = output.findings;
      complete = !output.skipped;
      status = findings.some((item) => item.severity === 'error') ? 'fail' : output.skipped ? 'skipped' : 'pass';
    } catch {
      // Never put exception text or manuscript content into a report.
      status = 'error';
      complete = false;
      findings = [{ code: 'check-unavailable', severity: 'warning', path: '' }];
    }
    const truncated = findings.length > MAX_VALIDATION_FINDINGS_PER_CHECK;
    const items = findings.slice(0, MAX_VALIDATION_FINDINGS_PER_CHECK).map((finding, index) => {
      const { targetId, relatedId, ...location } = finding;
      return {
        ...location, checkId: id, id: `${id}:${index + 1}`,
        ...(typeof targetId === 'string' && targetId.trim() ? { targetId } : {}),
        ...(typeof relatedId === 'string' && relatedId.trim() ? { relatedId } : {}),
      };
    });
    diagnostics.push(...items);
    checks.push({ id, version: VALIDATION_CHECKS[id].version, status, diagnosticIds: items.map((item) => item.id), truncated, complete: complete && !truncated });
  }
  return {
    $schema: VALIDATION_REPORT_SCHEMA, format: VALIDATION_REPORT_FORMAT,
    version: VALIDATION_REPORT_VERSION, ruleset: VALIDATION_RULESET,
    relatedSpecification: 'OMI-SPEC-180', experimental: true,
    id: crypto.randomUUID(), createdAt, profile, subject, checks, diagnostics,
    summary: summarizeValidation(checks, diagnostics),
    exclusions: [...VALIDATION_EXCLUSIONS],
  };
}
