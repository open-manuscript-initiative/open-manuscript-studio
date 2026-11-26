import type { OjsIssueTransferTarget } from '../model/ojsIssueTransferTargets';
import { assertPageSnapshot, pageIdentity, prepareIssuePageWrite, printedPageLabel,
  type OjsIssuePageSnapshot, type OjsIssuePageReceipt, type PrintedPageRange } from '../model/ojsIssuePrintedPages';
import { requestOjsIssuePages } from './integrationApi';

export async function inspectOjsIssuePrintedPages(connectionId: string, target: OjsIssueTransferTarget): Promise<OjsIssuePageSnapshot> {
  const response = await requestOjsIssuePages(connectionId, { ...pageIdentity(target), action: 'inspect' });
  assertPageSnapshot(target, response.snapshot);
  if (response.receipt) throw new Error('Unexpected OJS write receipt.');
  return response.snapshot;
}

/** Never silently refresh a stale token or retry an uncertain write. */
export async function applyReviewedOjsIssuePrintedPages(connectionId: string, target: OjsIssueTransferTarget,
  snapshot: OjsIssuePageSnapshot, range: PrintedPageRange, confirmed: true): Promise<OjsIssuePageReceipt> {
  const request = prepareIssuePageWrite(target, snapshot, range, confirmed);
  const response = await requestOjsIssuePages(connectionId, request);
  assertPageSnapshot(target, response.snapshot);
  const receipt = response.receipt;
  if (!receipt || receipt.protocol !== 'omi-issue-page-range/1' || receipt.published !== false ||
    Object.entries(pageIdentity(target)).some(([key, value]) => receipt[key as keyof ReturnType<typeof pageIdentity>] !== value) ||
    receipt.previousPages !== snapshot.pages || receipt.previousWorkflowToken !== snapshot.workflowToken ||
    receipt.pages !== printedPageLabel(range) || response.snapshot.pages !== receipt.pages ||
    response.snapshot.workflowToken !== receipt.workflowToken || receipt.unchanged !== (snapshot.pages === receipt.pages)) {
    throw new Error('Uncertain OJS page write result. Inspect the destination before retrying.');
  }
  return receipt;
}
