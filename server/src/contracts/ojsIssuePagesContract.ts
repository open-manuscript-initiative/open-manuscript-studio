import { z } from 'zod';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const token = z.string().regex(/^[0-9a-f]{64}$/);
const printed = z.number().int().min(1).max(999999);
const identity = {
  installationId: z.string().min(1).max(255),
  contextId: id, issueId: id, submissionId: id, publicationId: id,
};
const protocol = z.literal('omi-issue-page-range/1');
export const ojsIssuePagesRequest = z.discriminatedUnion('action', [
  z.object({ ...identity, action: z.literal('inspect') }).strict(),
  z.object({ ...identity, action: z.literal('apply'), firstPrintedPage: printed, lastPrintedPage: printed,
    expectedWorkflowToken: token, confirmed: z.literal(true) }).strict(),
]).refine(value => value.action === 'inspect' || value.firstPrintedPage <= value.lastPrintedPage);
export type OjsIssuePagesRequest = z.output<typeof ojsIssuePagesRequest>;

export const ojsIssuePagesResponse = z.object({
  snapshot: z.object({ ...identity, protocol, pages: z.string().nullable(), workflowToken: token, published: z.literal(false) }),
  receipt: z.object({ ...identity, protocol, previousPages: z.string().nullable(), pages: z.string(),
    previousWorkflowToken: token, workflowToken: token, unchanged: z.boolean(), published: z.literal(false) }).optional(),
});
type Response = z.output<typeof ojsIssuePagesResponse>;

export function validateOjsIssuePagesResponse(input: OjsIssuePagesRequest, raw: unknown): Response {
  const result = ojsIssuePagesResponse.parse(raw);
  const matches = (target: Response['snapshot'] | NonNullable<Response['receipt']>) =>
    target.installationId === input.installationId && target.contextId === input.contextId &&
    target.issueId === input.issueId && target.submissionId === input.submissionId && target.publicationId === input.publicationId;
  if (!matches(result.snapshot)) throw new Error('Mismatched OJS page destination.');
  if (input.action === 'inspect') {
    if (result.receipt) throw new Error('Unexpected write receipt for inspection.');
  } else {
    const pages = input.firstPrintedPage === input.lastPrintedPage ? String(input.firstPrintedPage) :
      `${input.firstPrintedPage}-${input.lastPrintedPage}`;
    const receipt = result.receipt;
    if (!receipt || !matches(receipt) || receipt.pages !== pages || result.snapshot.pages !== pages ||
        receipt.previousWorkflowToken !== input.expectedWorkflowToken ||
        receipt.workflowToken !== result.snapshot.workflowToken ||
        receipt.unchanged !== (receipt.previousPages === receipt.pages) ||
        (receipt.unchanged ? receipt.workflowToken !== receipt.previousWorkflowToken : receipt.workflowToken === receipt.previousWorkflowToken)) {
      throw new Error('Mismatched OJS printed page write receipt.');
    }
  }
  return result;
}
