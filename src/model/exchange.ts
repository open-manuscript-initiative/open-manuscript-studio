import { sha256HexSync } from './stateDigest';

/** Studio-owned vocabulary for the Draft; not a canonical OMI wire schema. */
export const EXCHANGE_PROFILE_VERSION = '0.1.0' as const;
export type ExchangeFormat = 'omi' | 'omi-json' | 'docx' | 'odt' | 'jats' | 'html' | 'idml' | 'xtg' | 'mif' | 'sla' | 'latex' | 'epub' | 'pdf';
export type ExchangeDisposition = 'unsupported' | 'unknown' | 'transformed' | 'omitted' | 'unverifiable';
export interface ExchangeEvent {
  code: string;
  severity: 'info' | 'warning' | 'error';
  disposition: ExchangeDisposition;
  sourceLocator: string;
  feature: string;
  consequence: string;
}
export interface ExchangeProfile {
  id: string;
  version: typeof EXCHANGE_PROFILE_VERSION;
  direction: 'import' | 'export';
  source: string;
  sourceVersion: string;
  target: string;
  targetVersion: string;
  projection: 'semantic' | 'publication';
  unsupportedPolicy: 'report-no-lossless-claim';
  accessibility: readonly string[];
  limitations: readonly string[];
}
export function exchangeProfile(direction: 'import' | 'export', format: ExchangeFormat): ExchangeProfile {
  if (direction === 'import' && format !== 'docx' && format !== 'odt') throw new Error('MAPPING_UNAVAILABLE');
  const external = { sourceVersion: 'unknown; format edition not detected', targetVersion: 'adapter-defined; edition not independently verified' };
  return {
    id: `urn:omi:studio:mapping:${direction}:${format}`, version: EXCHANGE_PROFILE_VERSION, direction,
    source: direction === 'import' ? format : 'omi-manuscript',
    sourceVersion: direction === 'import' ? external.sourceVersion : 'studio-working-state',
    target: direction === 'import' ? 'omi-manuscript' : format,
    targetVersion: direction === 'import' ? 'studio-working-state' : external.targetVersion,
    projection: direction === 'import' || ['omi', 'omi-json', 'docx', 'odt', 'jats'].includes(format) ? 'semantic' : 'publication',
    unsupportedPolicy: 'report-no-lossless-claim',
    accessibility: ['heading-roles', 'alternative-text', 'table-headers', 'span-language', 'reading-order', 'note-navigation'],
    limitations: ['No complete source/target feature inventory.', 'No proven round trip or lossless guarantee.',
      'RTL, vertical script, layout and accessibility equivalence are not independently assessed.',
      ...(direction === 'export' && format !== 'omi' ? ['Target projection may omit history, translations, annotations or extensions.'] : []),
      ...(format === 'omi-json' ? ['External binary asset payloads are not embedded in JSON.'] : []),
      ...(format === 'idml' ? ['Notes may be projected as endnotes; native footnote behavior is not guaranteed.'] : [])],
  };
}
export interface ExchangeReport {
  format: 'omi-studio-exchange-report';
  version: '0.1.0';
  relatedSpecification: 'OMI-SPEC-340';
  specVersion: '0.1.0';
  experimental: true;
  id: string;
  createdAt: string;
  mapping: ExchangeProfile;
  source: { digest: string; bytes: number; retained: boolean };
  output?: { digest: string; bytes: number };
  status: 'prepared' | 'completed' | 'completed-with-loss' | 'failed' | 'cancelled';
  coverage: 'incomplete';
  lossless: false;
  roundTrip: 'not-assessed';
  events: ExchangeEvent[];
  validation: { status: 'not-run' | 'passed' | 'failed'; scope: string; evidenceId?: string };
  confidentiality: { policy: 'existing-adapter-policy'; reviewIdentities: 'not-assessed'; credentials: 'not-part-of-report' };
}
export function digestBytes(bytes: Uint8Array): string { return `sha256:${sha256HexSync(bytes)}`; }
export function createExchangeReport(mapping: ExchangeProfile, source: Uint8Array, retained: boolean): ExchangeReport {
  return {
    format: 'omi-studio-exchange-report', version: '0.1.0', relatedSpecification: 'OMI-SPEC-340', specVersion: '0.1.0', experimental: true,
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), mapping,
    source: { digest: digestBytes(source), bytes: source.byteLength, retained },
    status: 'prepared', coverage: 'incomplete', lossless: false, roundTrip: 'not-assessed',
    events: [{ code: 'INSPECTION_INCOMPLETE', severity: 'warning', disposition: 'unverifiable', sourceLocator: '/',
      feature: 'feature-inventory', consequence: 'Uninspected features may be lost; zero loss cannot be asserted.' }],
    validation: { status: 'not-run', scope: 'No manuscript validation claimed.' },
    confidentiality: { policy: 'existing-adapter-policy', reviewIdentities: 'not-assessed', credentials: 'not-part-of-report' },
  };
}
export function finishExchangeReport(report: ExchangeReport, output: Uint8Array, events: ExchangeEvent[] = []): ExchangeReport {
  return finishExchangeReceipt(report, { digest: digestBytes(output), bytes: output.byteLength }, events);
}
export function finishExchangeReceipt(report: ExchangeReport, output: { digest: string; bytes: number }, events: ExchangeEvent[] = []): ExchangeReport {
  if (!Number.isSafeInteger(output.bytes) || output.bytes <= 0 || !/^sha256:[a-f0-9]{64}$/.test(output.digest)
    || [...report.events, ...events].some((event) => event.severity === 'error')) {
    return { ...report, status: 'failed', events: [...report.events, ...events, { code: 'OUTPUT_INVALID', severity: 'error', disposition: 'unverifiable', sourceLocator: '/', feature: 'output', consequence: 'No committable output.' }] };
  }
  return { ...report, output: { ...output },
    status: 'completed-with-loss', events: [...report.events, ...events] };
}
export function compareRoundTripInvariants(
  invariants: readonly string[], expected: Readonly<Record<string, string>>, actual: Readonly<Record<string, string>>,
): { invariant: string; outcome: 'pass' | 'fail' | 'indeterminate' }[] {
  return invariants.map((invariant) => ({ invariant, outcome:
    typeof expected[invariant] !== 'string' || typeof actual[invariant] !== 'string' ? 'indeterminate'
      : expected[invariant] === actual[invariant] ? 'pass' : 'fail' }));
}
