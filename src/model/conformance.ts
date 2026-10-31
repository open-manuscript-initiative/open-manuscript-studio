import { compareRoundTripInvariants, createExchangeReport, exchangeProfile, finishExchangeReport, digestBytes } from './exchange';

/** Experimental local schema; these Drafts have no approved canonical schemas. */
export const CONFORMANCE_PROFILE = 'urn:omi:studio:draft-model-self-assessment:0.1.0';
export const REQUIREMENT_INVENTORY = {
  'OMI-SPEC-340': Array.from({ length: 34 }, (_, index) => `REQ-IO-${String(index + 1).padStart(3, '0')}`),
  'OMI-SPEC-350': Array.from({ length: 38 }, (_, index) => `REQ-CON-${String(index + 1).padStart(3, '0')}`),
} as const;
export interface ImplementationIdentity { name: string; version: string; build: string; revision: string; dependencies: string }
export interface Capability {
  id: string; specification: 'OMI-SPEC-190' | 'OMI-SPEC-300' | 'OMI-SPEC-310' | 'OMI-SPEC-340' | 'OMI-SPEC-350'; specVersion: '0.1.0';
  status: 'supported' | 'partial' | 'unsupported' | 'unknown' | 'conditional';
  component: string; limitations: string[]; prerequisites: string[];
}
export function capabilityStatement(implementation: ImplementationIdentity, platform: string) {
  const capabilities: Capability[] = [
    { id: 'studio.collaboration.scoped-policy', specification: 'OMI-SPEC-190', specVersion: '0.1.0', status: 'conditional', component: 'server',
      prerequisites: ['Authenticated active manuscript membership', 'Enabled single-node collaboration server', 'Matching server implementation'],
      limitations: ['No federated grants, segment-scoped translator roles, delegation or independent confidentiality assessment.', 'Local declarations do not attest a remote server configuration.'] },
    { id: 'studio.exchange.office-import', specification: 'OMI-SPEC-340', specVersion: '0.1.0', status: 'partial', component: 'client', prerequisites: [],
      limitations: ['DOCX and ODT candidate/receipt reports only; other import paths are not instrumented.', 'Incomplete feature inspection, no zero-loss or round-trip assertion.', 'Original receipt and report live in the import panel; save them before leaving.'] },
    { id: 'studio.exchange.export-reports', specification: 'OMI-SPEC-340', specVersion: '0.1.0', status: 'partial', component: 'client', prerequisites: [],
      limitations: ['Standard export panel only; custom templates and integration exports have separate flows.', 'Minimum output availability and digest binding, not full target semantic validation.', 'No audience-safe anonymous-review projection claim.'] },
    { id: 'studio.extensions.manifest-registry', specification: 'OMI-SPEC-300', specVersion: '0.1.0', status: 'partial', component: 'server',
      prerequisites: ['Authenticated Studio account', 'Active integration registry and compatible API v1 manifest'],
      limitations: ['Registration is declarative and does not execute plugin code or grant manuscript permissions.', 'Plugin lifecycle, dependency graph, distributed event API and independent isolation are not implemented.'] },
    { id: 'studio.api.integration-extensions', specification: 'OMI-SPEC-310', specVersion: '0.1.0', status: 'conditional', component: 'server',
      prerequisites: ['Authenticated server session', 'Explicit API-version agreement', 'User-scoped integration extension registry'],
      limitations: ['Only the integration-extension API subset is covered; there is no general OMI object API.', 'Discovery does not authorize execution, writes, publishing or review access.'] },
    { id: 'studio.capabilities.disclosure', specification: 'OMI-SPEC-350', specVersion: '0.1.0', status: 'partial', component: 'client', prerequisites: [],
      limitations: ['Studio-owned vocabulary, not an approved OMI schema or suite.', 'Model self-assessment only; deployed API/WebSocket, format interoperability and independent verification are not assessed.'] },
  ];
  return { format: 'omi-studio-capability-statement', version: '0.1.0', relatedSpecification: 'OMI-SPEC-350', specVersion: '0.1.0',
    experimental: true, implementation, platform, generatedAt: new Date().toISOString(), capabilities,
    assertionLevel: 'disclosure', verification: 'not-independent', outcome: 'indeterminate' };
}
export type CaseStatus = 'pass' | 'fail' | 'skip' | 'error' | 'not-run';
export interface ModelCase {
  id: string; requirements: string[]; fixture: string; expected: string; action: string;
}
export const MODEL_CASES: readonly ModelCase[] = [
  { id: 'io-empty-output', requirements: ['REQ-IO-002', 'REQ-IO-013', 'REQ-IO-024'], fixture: '', expected: 'failed', action: 'finish-empty-artifact' },
  { id: 'io-coverage', requirements: ['REQ-IO-004', 'REQ-IO-015'], fixture: 'Unicode: árvíztűrő 中文', expected: 'incomplete:false', action: 'finish-uninspected-artifact' },
  { id: 'io-missing-roundtrip-evidence', requirements: ['REQ-IO-029', 'REQ-IO-030'], fixture: '{}', expected: 'indeterminate', action: 'compare-absent-invariant' },
  { id: 'io-changed-roundtrip-evidence', requirements: ['REQ-IO-029'], fixture: '{"before":"a","after":"b"}', expected: 'fail', action: 'compare-changed-invariant' },
  { id: 'con-absent-case', requirements: ['REQ-CON-015', 'REQ-CON-022', 'REQ-CON-024'], fixture: '[]', expected: 'indeterminate', action: 'assess-missing-case' },
  { id: 'con-failed-case', requirements: ['REQ-CON-004', 'REQ-CON-024'], fixture: '["fail","not-run"]', expected: 'nonconformant', action: 'assess-failed-case' },
  { id: 'con-unapproved-suite', requirements: ['REQ-CON-023', 'REQ-CON-025'], fixture: '["pass"]', expected: 'indeterminate', action: 'assess-unapproved-suite' },
];
export const MODEL_SUITE = {
  id: 'urn:omi:studio:draft-model-checks', version: '0.1.0', profile: CONFORMANCE_PROFILE, approved: false,
  specificationVersions: { 'OMI-SPEC-340': '0.1.0', 'OMI-SPEC-350': '0.1.0' },
  requirements: REQUIREMENT_INVENTORY,
  scope: 'Synthetic exchange-report and conservative claim-gating behavior only.',
  exclusions: ['deployed-server-authorization', 'all-format-adapter-semantics', 'independent-verification', 'manuscript-validity'],
  cases: MODEL_CASES.map((item) => ({ ...item, fixtureDigest: digestBytes(new TextEncoder().encode(item.fixture)) })),
};
export function suiteDigest(): string { return digestBytes(new TextEncoder().encode(JSON.stringify(MODEL_SUITE))); }
export function assessmentOutcome(statuses: readonly CaseStatus[], complete: boolean, approved: boolean, current: boolean) {
  if (statuses.includes('fail')) return 'nonconformant' as const;
  if (!statuses.length || !complete || !approved || !current || statuses.some((status) => status !== 'pass')) return 'indeterminate' as const;
  return 'conformant' as const;
}
export function executeModelCase(item: ModelCase): string {
  const bytes = new TextEncoder().encode(item.fixture);
  const report = () => createExchangeReport(exchangeProfile('export', 'docx'), bytes, true);
  switch (item.action) {
    case 'finish-empty-artifact': return finishExchangeReport(report(), bytes).status;
    case 'finish-uninspected-artifact': { const result = finishExchangeReport(report(), bytes); return `${result.coverage}:${result.lossless}`; }
    case 'compare-absent-invariant': return compareRoundTripInvariants(['text'], {}, {})[0].outcome;
    case 'compare-changed-invariant': { const fixture = JSON.parse(item.fixture); return compareRoundTripInvariants(['text'], { text: fixture.before }, { text: fixture.after })[0].outcome; }
    case 'assess-missing-case': return assessmentOutcome(JSON.parse(item.fixture), false, false, true);
    case 'assess-failed-case': return assessmentOutcome(JSON.parse(item.fixture), false, false, true);
    case 'assess-unapproved-suite': return assessmentOutcome(JSON.parse(item.fixture), true, false, true);
    default: throw new Error('UNKNOWN_CASE');
  }
}
export function runModelAssessment(implementation: ImplementationIdentity, environment: string) {
  const results = MODEL_SUITE.cases.map((item) => {
    try { const actual = executeModelCase(item); return { id: item.id, fixtureDigest: item.fixtureDigest, status: actual === item.expected ? 'pass' as const : 'fail' as const }; }
    catch { return { id: item.id, fixtureDigest: item.fixtureDigest, status: 'error' as const }; }
  });
  const coverage = Object.values(REQUIREMENT_INVENTORY).flat().map((requirement) => {
    const cases = MODEL_CASES.filter((item) => item.requirements.includes(requirement)).map((item) => item.id);
    return { requirement, cases, status: cases.length ? 'partially-evidenced' : 'not-run' };
  });
  const evidence = { implementation: { ...implementation }, environment, createdAt: new Date().toISOString(),
    suite: { id: MODEL_SUITE.id, version: MODEL_SUITE.version, digest: suiteDigest(), approved: false },
    runnerVersion: '0.1.0', results, coverage, complete: false,
    outcome: assessmentOutcome(results.map((item) => item.status), false, false, true),
    assertionLevel: 'self-assessment', verification: 'not-independent', deviations: [], waivers: [] };
  return { format: 'omi-studio-conformance-report', version: '0.1.0', relatedSpecification: 'OMI-SPEC-350', specVersion: '0.1.0',
    experimental: true, evidence, evidenceDigest: digestBytes(new TextEncoder().encode(JSON.stringify(evidence))) };
}
/**
 * Local consistency validation for an untrusted Draft self-assessment.
 * This does not authenticate the issuer: the digest is not a signature, and
 * even a consistent report cannot claim independent verification or approval.
 */
export function isAssessmentCurrent(report: ReturnType<typeof runModelAssessment>, implementation: ImplementationIdentity, environment: string): boolean {
  if (!report || report.format !== 'omi-studio-conformance-report' || report.specVersion !== '0.1.0'
    || report.relatedSpecification !== 'OMI-SPEC-350' || report.experimental !== true) return false;
  const evidence = report.evidence;
  if (!evidence || evidence.assertionLevel !== 'self-assessment' || evidence.verification !== 'not-independent'
    || evidence.complete !== false || evidence.outcome !== 'indeterminate'
    || evidence.runnerVersion !== '0.1.0' || !Array.isArray(evidence.deviations) || !Array.isArray(evidence.waivers)
    || evidence.waivers.length > 0 || evidence.deviations.length > 0) return false;
  if (evidence.suite.id !== MODEL_SUITE.id || evidence.suite.version !== MODEL_SUITE.version
    || evidence.suite.approved !== false || evidence.suite.digest !== suiteDigest()
    || evidence.environment !== environment
    || JSON.stringify(evidence.implementation) !== JSON.stringify(implementation)) return false;

  // Require EXACT per-case fixture identities and known results. Missing or
  // added test cases must never be interpreted as full conformance coverage.
  if (!Array.isArray(evidence.results) || evidence.results.length !== MODEL_CASES.length) return false;
  for (let i = 0; i < MODEL_CASES.length; i += 1) {
    const actual = evidence.results[i];
    const expected = MODEL_SUITE.cases[i];
    if (!actual || !expected || actual.id !== expected.id || actual.fixtureDigest !== expected.fixtureDigest) return false;
    const definition = MODEL_CASES[i];
    if (!definition) return false;
    let observed: string;
    try { observed = executeModelCase(definition); }
    catch { return false; }
    if (actual.status !== (observed === expected.expected ? 'pass' : 'fail')) return false;
  }

  const required = Object.values(REQUIREMENT_INVENTORY).flat();
  if (!Array.isArray(evidence.coverage) || evidence.coverage.length !== required.length) return false;
  for (let i = 0; i < required.length; i += 1) {
    const entry = evidence.coverage[i];
    const requirement = required[i];
    if (!requirement) return false;
    const expectedCases = MODEL_CASES.filter((item) => item.requirements.includes(requirement)).map((item) => item.id);
    if (!entry || entry.requirement !== requirement || JSON.stringify(entry.cases) !== JSON.stringify(expectedCases)
      || entry.status !== (expectedCases.length ? 'partially-evidenced' : 'not-run')) return false;
  }
  return report.evidenceDigest === digestBytes(new TextEncoder().encode(JSON.stringify(evidence)));
}
