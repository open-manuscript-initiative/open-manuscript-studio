import { digestBytes } from '../model/exchange';
import type { ImplementationIdentity } from '../model/conformance';
import type { ValidationReport } from '../model/validation';

/**
 * An operational check of the selected Studio server, NOT an OMI-SPEC
 * conformance suite. No manuscript content, server response body, session
 * cookie, bearer token or user-specific registry entries are retained.
 */
export type RuntimeProbeId = 'server-health' | 'collaboration-enabled' | 'extension-api' | 'extension-registry';
export type RuntimeProbeStatus = 'pass' | 'fail' | 'unavailable';
export type RuntimeProbeCode =
  | 'OBSERVED' | 'DISABLED' | 'AUTH_REQUIRED' | 'NOT_FOUND'
  | 'SERVICE_ERROR' | 'INVALID_RESPONSE' | 'NETWORK_ERROR';

export interface RuntimeProbe {
  id: RuntimeProbeId;
  status: RuntimeProbeStatus;
  code: RuntimeProbeCode;
  /** HTTP status is evidence of transport only, never proof of authorization. */
  httpStatus?: number;
}
export interface RuntimeManuscriptEvidence {
  profile: 'exchange';
  stateDigest: string;
  outcome: 'valid' | 'invalid' | 'indeterminate';
  complete: boolean;
  errors: number;
  warnings: number;
  checks: Array<{ id: string; status: 'pass' | 'fail' | 'skipped' | 'error'; complete: boolean }>;
}

/** Projection of actual OMI-SPEC-180 Studio validation, without manuscript text. */
export function summarizeManuscriptValidation(report: ValidationReport): RuntimeManuscriptEvidence {
  if (report.profile !== 'exchange') throw new Error('RUNTIME_REQUIRES_EXCHANGE_PROFILE');
  return {
    profile: 'exchange', stateDigest: report.subject.stateDigest,
    outcome: report.summary.outcome, complete: report.summary.complete,
    errors: report.summary.errors, warnings: report.summary.warnings,
    checks: report.checks.map(({ id, status, complete }) => ({ id, status, complete })),
  };
}

export interface RuntimeAssessment {
  format: 'omi-studio-runtime-capability-check';
  version: '0.1.0';
  experimental: true;
  specification: 'OMI-SPEC-350@0.1.0';
  assertionLevel: 'operational-self-check';
  verification: 'not-independent';
  normativeOutcome: 'indeterminate';
  implementation: ImplementationIdentity;
  platform: string;
  serverOrigin: string;
  checkedAt: string;
  probes: RuntimeProbe[];
  manuscript?: RuntimeManuscriptEvidence;
  limitations: string[];
  evidenceDigest: string;
}
export type RuntimeRequest = (path: string, init?: RequestInit) => Promise<Response>;

const probePaths: ReadonlyArray<{ id: RuntimeProbeId; path: string }> = [
  { id: 'server-health', path: '/api/health' },
  { id: 'collaboration-enabled', path: '/api/collaboration/status' },
  { id: 'extension-api', path: '/api/v1/integrations/extensions/capabilities' },
  { id: 'extension-registry', path: '/api/v1/integrations/extensions' },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validRuntimeProbePayload(id: RuntimeProbeId, value: unknown): boolean {
  if (!isObject(value)) return false;
  switch (id) {
    case 'server-health':
      return value.status === 'ok' &&
        value.service === 'open-manuscript-studio-server' && value.database === 'connected';
    case 'collaboration-enabled':
      return typeof value.enabled === 'boolean';
    case 'extension-api':
      return value.model === 'omi-studio-integration-extension-api' &&
        value.apiVersion === '1' &&
        value.specification === 'OMI-SPEC-310@0.1.0' &&
        value.pluginSpecification === 'OMI-SPEC-300@0.1.0' &&
        value.registryScope === 'authenticated-user' &&
        value.status === 'partial-draft-implementation' &&
        value.manifestOnly === true &&
        value.executesPluginCode === false &&
        value.grantsManuscriptAccess === false &&
        value.publishingAuthority === false &&
        Array.isArray(value.permissions) && value.permissions.every((permission) => typeof permission === 'string');
    case 'extension-registry':
      // The session-scoped list is queried but its contents are never persisted.
      return Array.isArray(value.extensions);
  }
}

async function probe(id: RuntimeProbeId, path: string, request: RuntimeRequest): Promise<RuntimeProbe> {
  let response: Response;
  // Do not leave the UI checking indefinitely if a selected server hangs.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    response = await request(path, { signal: controller.signal });
  } catch {
    return { id, status: 'unavailable', code: 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
  const httpStatus = response.status;
  if (httpStatus === 401 || httpStatus === 403) return { id, status: 'unavailable', code: 'AUTH_REQUIRED', httpStatus };
  if (httpStatus === 404) return { id, status: 'unavailable', code: 'NOT_FOUND', httpStatus };
  if (!response.ok) return { id, status: 'unavailable', code: 'SERVICE_ERROR', httpStatus };
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { id, status: 'fail', code: 'INVALID_RESPONSE', httpStatus };
  }
  if (!validRuntimeProbePayload(id, data)) return { id, status: 'fail', code: 'INVALID_RESPONSE', httpStatus };
  if (id === 'collaboration-enabled' && (data as { enabled: boolean }).enabled === false) {
    return { id, status: 'fail', code: 'DISABLED', httpStatus };
  }
  return { id, status: 'pass', code: 'OBSERVED', httpStatus };
}

function evidence(report: Omit<RuntimeAssessment, 'evidenceDigest'>): string {
  return digestBytes(new TextEncoder().encode(JSON.stringify(report)));
}

/**
 * Only makes fixed same-selected-server requests through the supplied Studio
 * transport. Does not follow arbitrary URLs returned by a server.
 */
export async function runRuntimeCapabilityAssessment(
  implementation: ImplementationIdentity,
  platform: string,
  serverOrigin: string,
  request: RuntimeRequest,
  manuscript?: RuntimeManuscriptEvidence,
): Promise<RuntimeAssessment> {
  const probes = await Promise.all(probePaths.map(({ id, path }) => probe(id, path, request)));
  const base = {
    format: 'omi-studio-runtime-capability-check' as const,
    version: '0.1.0' as const,
    experimental: true as const,
    specification: 'OMI-SPEC-350@0.1.0' as const,
    assertionLevel: 'operational-self-check' as const,
    verification: 'not-independent' as const,
    normativeOutcome: 'indeterminate' as const,
    implementation: { ...implementation },
    platform,
    serverOrigin,
    checkedAt: new Date().toISOString(),
    probes,
    ...(manuscript ? { manuscript } : {}),
    limitations: [
      'Health only verifies an API/database response, not all server components.',
      'Collaboration enabled does not verify WebSocket reachability or manuscript-specific membership.',
      'Extension discovery and registry listing do not execute extensions or authorize manuscript access.',
      'Import/export interoperability, manuscript semantics and independent OMI-SPEC conformance are not assessed.',
    ],
  };
  return { ...base, evidenceDigest: evidence(base) };
}

/** A digest detects accidental changes; it is not an issuer signature. */
export function isRuntimeAssessmentCurrent(
  report: RuntimeAssessment,
  implementation: ImplementationIdentity,
  platform: string,
  serverOrigin: string,
): boolean {
  if (report.format !== 'omi-studio-runtime-capability-check' ||
    report.version !== '0.1.0' || report.experimental !== true ||
    report.specification !== 'OMI-SPEC-350@0.1.0' ||
    report.verification !== 'not-independent' || report.normativeOutcome !== 'indeterminate' ||
    report.assertionLevel !== 'operational-self-check' ||
    report.serverOrigin !== serverOrigin || report.platform !== platform ||
    JSON.stringify(report.implementation) !== JSON.stringify(implementation) ||
    !Array.isArray(report.probes) || report.probes.length !== probePaths.length ||
    !Array.isArray(report.limitations) || report.limitations.length !== 4 ||
    (report.manuscript !== undefined && (report.manuscript.profile !== 'exchange' ||
      typeof report.manuscript.stateDigest !== 'string' || !Array.isArray(report.manuscript.checks)))) return false;
  for (let i = 0; i < probePaths.length; i += 1) {
    const probeItem = report.probes[i];
    if (!probeItem || probeItem.id !== probePaths[i]?.id ||
      !['pass', 'fail', 'unavailable'].includes(probeItem.status) ||
      !['OBSERVED', 'DISABLED', 'AUTH_REQUIRED', 'NOT_FOUND', 'SERVICE_ERROR', 'INVALID_RESPONSE', 'NETWORK_ERROR'].includes(probeItem.code)) return false;
  }
  const { evidenceDigest, ...base } = report;
  return evidenceDigest === evidence(base);
}
