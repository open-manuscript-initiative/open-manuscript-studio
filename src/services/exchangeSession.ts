import type { DocxManuscriptImportPlan } from './docxManuscriptImport';
import { createExchangeReport, digestBytes, exchangeProfile, finishExchangeReceipt, type ExchangeFormat, type ExchangeReport } from '../model/exchange';

async function digestBuffer(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) return digestBytes(new Uint8Array(buffer));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return `sha256:${Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** A receipt holds the immutable original File independently of the editable candidate. */
export interface OfficeImportReceipt {
  original: File;
  plan: DocxManuscriptImportPlan;
  report: ExchangeReport;
}
export class OfficeImportPreparationError extends Error {
  readonly report: ExchangeReport;
  readonly original: File;
  constructor(report: ExchangeReport, original: File) {
    super('IMPORT_EXECUTION_FAILED');
    this.name = 'OfficeImportPreparationError';
    this.report = report;
    this.original = original;
  }
}
export async function prepareOfficeImport(
  file: File, format: 'docx' | 'odt', parser: (file: File) => Promise<DocxManuscriptImportPlan>,
): Promise<OfficeImportReceipt> {
  if (file.size > 200 * 1024 * 1024) throw new Error('RESOURCE_LIMIT');
  if (!new RegExp(`\\.${format}$`, 'i').test(file.name)) throw new Error('INVALID_SOURCE');
  const buffer = await file.arrayBuffer();
  const report = createExchangeReport(exchangeProfile('import', format), new Uint8Array(), true);
  report.source = { digest: await digestBuffer(buffer), bytes: buffer.byteLength, retained: true };
  const buffered = { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified,
    arrayBuffer: async () => buffer } as File;
  let plan: DocxManuscriptImportPlan;
  try { plan = await parser(buffered); }
  catch {
    throw new OfficeImportPreparationError({ ...report, status: 'failed', events: [...report.events, {
      code: 'IMPORT_EXECUTION_FAILED', severity: 'error', disposition: 'unverifiable', sourceLocator: '/',
      feature: 'source-parser', consequence: 'Parsing failed; the original file is unchanged. No candidate was committed.',
    }] }, file);
  }
  // Keep diagnostics independent of hidden text/provenance and editable blocks.
  report.events.push(...plan.warnings.map((warning) => ({ code: warning.code, severity: warning.severity,
    disposition: 'unknown' as const, sourceLocator: warning.sourcePart ?? '/', feature: warning.code,
    consequence: warning.message })));
  report.validation = { status: 'not-run', scope: 'Adapter parsing passed; OMI-SPEC-180 manuscript validation has not run.' };
  return { original: file, plan, report };
}
export async function reportExportArtifact(report: ExchangeReport, artifact: Blob): Promise<ExchangeReport> {
  const buffer = await artifact.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const target = report.mapping.target;
  const zip = ['omi', 'docx', 'odt', 'idml', 'html', 'epub'].includes(target);
  const validEnvelope = (!zip || bytes[0] === 0x50 && bytes[1] === 0x4b)
    && (target !== 'pdf' || new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-');
  return finishExchangeReceipt(report, { digest: await digestBuffer(buffer), bytes: bytes.byteLength }, validEnvelope ? [] : [{ code: 'INVALID_ARTIFACT_ENVELOPE',
    severity: 'error', disposition: 'unverifiable', sourceLocator: '/', feature: 'output', consequence: 'The generated artifact does not match its declared file type.' }]);
}
export async function beginExportReport(format: ExchangeFormat, source: string): Promise<ExchangeReport> {
  const bytes = new TextEncoder().encode(source);
  const report = createExchangeReport(exchangeProfile('export', format), new Uint8Array(), true);
  report.source = { digest: await digestBuffer(bytes.buffer), bytes: bytes.byteLength, retained: true };
  return report;
}
