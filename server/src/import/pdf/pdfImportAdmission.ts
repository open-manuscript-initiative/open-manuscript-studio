/** Fail-closed, per-process admission limits for memory-intensive PDF imports.
 * These supplement API rate limits and OS-level worker/memory isolation; they
 * do not replace cluster-wide quotas in multi-instance deployments.
 */
export const PDF_IMPORT_LIMITS = {
  activePerUser: 1,
  activePerProcess: 2,
  retainedPerUser: 12,
  retainedPerProcess: 100,
} as const;

type PdfImportAdmissionJob = {
  ownerUserId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
};

export type PdfImportAdmissionRejection =
  | 'PDF_IMPORT_USER_BUSY'
  | 'PDF_IMPORT_SERVER_BUSY'
  | 'PDF_IMPORT_USER_HISTORY_FULL'
  | 'PDF_IMPORT_SERVER_HISTORY_FULL';

/**
 * Called synchronously before inserting the new job into the process-local
 * job registry; there must be no await between admission and insertion.
 */
export function rejectPdfImportAdmission(
  entries: Iterable<PdfImportAdmissionJob>,
  userId: string,
): PdfImportAdmissionRejection | null {
  let active = 0;
  let activeForUser = 0;
  let retained = 0;
  let retainedForUser = 0;
  for (const job of entries) {
    retained += 1;
    if (job.ownerUserId === userId) retainedForUser += 1;
    if (job.status === 'queued' || job.status === 'processing') {
      active += 1;
      if (job.ownerUserId === userId) activeForUser += 1;
    }
  }

  if (activeForUser >= PDF_IMPORT_LIMITS.activePerUser) return 'PDF_IMPORT_USER_BUSY';
  if (active >= PDF_IMPORT_LIMITS.activePerProcess) return 'PDF_IMPORT_SERVER_BUSY';
  if (retainedForUser >= PDF_IMPORT_LIMITS.retainedPerUser) return 'PDF_IMPORT_USER_HISTORY_FULL';
  if (retained >= PDF_IMPORT_LIMITS.retainedPerProcess) return 'PDF_IMPORT_SERVER_HISTORY_FULL';
  return null;
}

export function pdfImportRejectionMessage(code: PdfImportAdmissionRejection): string {
  if (code === 'PDF_IMPORT_USER_BUSY') return 'Another PDF import is in progress. Finish it before starting a new one.';
  if (code === 'PDF_IMPORT_SERVER_BUSY') return 'The PDF import service is at capacity. Retry later.';
  if (code === 'PDF_IMPORT_USER_HISTORY_FULL') return 'PDF import history limit reached. Retry after older jobs expire.';
  return 'The PDF import service history is full. Retry after older jobs expire.';
}

export class PdfImportCapacityError extends Error {
  readonly code: PdfImportAdmissionRejection;
  readonly httpStatus: 429 | 503;

  constructor(code: PdfImportAdmissionRejection) {
    super(pdfImportRejectionMessage(code));
    this.name = 'PdfImportCapacityError';
    this.code = code;
    this.httpStatus = code === 'PDF_IMPORT_SERVER_BUSY' || code === 'PDF_IMPORT_SERVER_HISTORY_FULL'
      ? 503
      : 429;
  }
}
