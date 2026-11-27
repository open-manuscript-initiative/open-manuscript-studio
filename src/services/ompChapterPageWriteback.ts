import type { OmpChapterTransferTarget } from '../model/ompChapterTransferTargets';
import { printedPageLabel } from '../model/ojsIssuePrintedPages';
import { assertPageSnapshot, pageIdentity, prepareChapterPageWrite,
  type OmpChapterPageSnapshot, type OmpChapterPageReceipt, type PrintedPageRange } from '../model/ompChapterPrintedPages';
import { requestOmpChapterPages } from './integrationApi';

export async function inspectOmpChapterPrintedPages(connectionId: string, target: OmpChapterTransferTarget): Promise<OmpChapterPageSnapshot> {
  const response = await requestOmpChapterPages(connectionId, { ...pageIdentity(target), action: 'inspect' });
  assertPageSnapshot(target, response.snapshot);
  if (response.receipt) throw new Error('Unexpected OMP write receipt.');
  return response.snapshot;
}

/** Never silently refresh a stale token or retry an uncertain write. */
export async function applyReviewedOmpChapterPrintedPages(connectionId: string, target: OmpChapterTransferTarget,
  snapshot: OmpChapterPageSnapshot, range: PrintedPageRange, confirmed: true): Promise<OmpChapterPageReceipt> {
  const request = prepareChapterPageWrite(target, snapshot, range, confirmed);
  const response = await requestOmpChapterPages(connectionId, request);
  assertPageSnapshot(target, response.snapshot);
  const receipt = response.receipt;
  if (!receipt || receipt.protocol !== 'omi-chapter-page-range/1' || receipt.published !== false ||
    Object.entries(pageIdentity(target)).some(([key, value]) => receipt[key as keyof ReturnType<typeof pageIdentity>] !== value) ||
    receipt.previousPages !== snapshot.pages || receipt.previousWorkflowToken !== snapshot.workflowToken ||
    receipt.pages !== printedPageLabel(range) || response.snapshot.pages !== receipt.pages ||
    response.snapshot.workflowToken !== receipt.workflowToken || receipt.unchanged !== (snapshot.pages === receipt.pages)) {
    throw new Error('Uncertain OMP page write result. Inspect the destination before retrying.');
  }
  return receipt;
}
