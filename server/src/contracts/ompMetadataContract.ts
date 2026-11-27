import { z } from 'zod';
import { ojsMetadataRequest, ojsMetadataResponse } from './ojsMetadataContract.js';
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const token = z.string().regex(/^[0-9a-f]{64}$/);
const identity = { installationId: z.string().min(1).max(255), contextId: id, submissionId: id, publicationId: id };
export const ompMetadataRequest = z.discriminatedUnion('action', [
  ojsMetadataRequest.options[0].extend(identity),
  ojsMetadataRequest.options[1].extend(identity),
]);
export type OmpMetadataRequest = z.output<typeof ompMetadataRequest>;
const protocol = z.literal('omi-omp-metadata/1');
const base = ojsMetadataResponse.shape.snapshot;
const snapshot = base.extend({
  protocol, authority: z.literal('OMP'), contextId: id,
  metadata: base.shape.metadata.omit({ pages: true, issueId: true }).extend({
    seriesId: z.union([z.number(), z.string()]).nullable(),
    seriesPosition: z.union([z.number(), z.string()]).nullable(),
    workType: z.union([z.number(), z.string()]).nullable(),
  }),
  contributors: z.array(base.shape.contributors.element.extend({ isEditor: z.boolean().optional() })).max(500),
});
export const ompMetadataResponse = z.object({
  snapshot,
  receipt: z.object({
    ...identity, protocol, locale: z.string(), fields: z.array(z.enum(['title', 'subtitle', 'abstract', 'keywords'])),
    previousStateToken: token, stateToken: token, published: z.literal(false),
  }).optional(),
});
export type OmpMetadataResponse = z.output<typeof ompMetadataResponse>;
export type OmpMetadataSnapshot = OmpMetadataResponse['snapshot'];
export function validateOmpMetadataResponse(input: OmpMetadataRequest, raw: unknown): OmpMetadataResponse {
  const result = ompMetadataResponse.parse(raw);
  const matches = (value: { contextId: number; submissionId: number; publicationId: number }) =>
    value.contextId === input.contextId && value.submissionId === input.submissionId && value.publicationId === input.publicationId;
  if (!matches(result.snapshot)) throw new Error('Mismatched OMP volume metadata target.');
  if (input.action === 'inspect') {
    if (result.receipt) throw new Error('Unexpected OMP metadata write receipt.');
  } else {
    const receipt = result.receipt;
    if (!receipt || !matches(receipt) || receipt.installationId !== input.installationId ||
      receipt.previousStateToken !== input.expectedStateToken || receipt.stateToken !== result.snapshot.stateToken ||
      receipt.locale !== input.locale || JSON.stringify([...receipt.fields].sort()) !== JSON.stringify(Object.keys(input.fields).sort()))
      throw new Error('Mismatched OMP metadata write receipt.');
  }
  return result;
}
