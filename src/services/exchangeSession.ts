import type { DocxManuscriptImportPlan } from './docxManuscriptImport';
import { createExchangeReport, digestBytes, exchangeProfile, finishExchangeReceipt, type ExchangeFormat, type ExchangeReport } from '../model/exchange';
import { hasExpectedExchangeArtifactEnvelope } from './exchangeArtifactInspection';

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
  const validEnvelope = hasExpectedExchangeArtifactEnvelope(report.mapping.target as ExchangeFormat, bytes);
  return finishExchangeReceipt(report, { digest: await digestBuffer(buffer), bytes: bytes.byteLength }, validEnvelope ? [] : [{ code: 'INVALID_ARTIFACT_ENVELOPE',
    severity: 'error', disposition: 'unverifiable', sourceLocator: '/', feature: 'output', consequence: 'The generated artifact does not match its declared file type.' }]);
}
export async function beginExportReport(format: ExchangeFormat, source: string): Promise<ExchangeReport> {
  const bytes = new TextEncoder().encode(source);
  const report = createExchangeReport(exchangeProfile('export', format), new Uint8Array(), true);
  report.source = { digest: await digestBuffer(bytes.buffer), bytes: bytes.byteLength, retained: true };
  return report;
}

/** Application-owned report lifecycle; UI adapters own notices and file delivery. */
export class ExportExchangeSession {
  private report: ExchangeReport;
  private constructor(report: ExchangeReport) { this.report = report; }
  static async begin(format: ExchangeFormat, source: string): Promise<ExportExchangeSession> {
    return new ExportExchangeSession(await beginExportReport(format, source));
  }
  recordAdapterDiagnostics(result: unknown): void {
    if (!result || typeof result !== 'object' || !('warnings' in result) || !Array.isArray(result.warnings)) return;
    this.report = { ...this.report, events: [...this.report.events, ...result.warnings
      .filter((item): item is string => typeof item === 'string').map((message) => ({
        code: 'ADAPTER_WARNING', severity: 'warning' as const, disposition: 'unknown' as const,
        sourceLocator: '/', feature: `${this.report.mapping.target}-mapping`, consequence: message,
      }))] };
  }
  async inspectArtifact(blob: Blob): Promise<void> {
    this.report = await reportExportArtifact(this.report, blob);
    if (this.report.status === 'failed') throw new Error('OUTPUT_INVALID');
  }
  finishDelivery(saved: boolean): ExchangeReport {
    if (this.report.status !== 'completed-with-loss') throw new Error('OUTPUT_NOT_INSPECTED');
    this.report = { ...this.report, status: saved ? this.report.status : 'cancelled' };
    return structuredClone(this.report);
  }
  fail(): ExchangeReport {
    this.report = { ...this.report, status: 'failed', events: [...this.report.events, {
      code: 'EXPORT_EXECUTION_FAILED', severity: 'error', disposition: 'unverifiable',
      sourceLocator: '/', feature: 'output', consequence: 'Artifact generation or delivery failed; the source remains available.',
    }] };
    return structuredClone(this.report);
  }
}
