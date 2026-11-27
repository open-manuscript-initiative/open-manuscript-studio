import { z } from 'zod';
import { workflowInspectionResponse } from './editorialConnectorContract.js';

const base = workflowInspectionResponse.shape.snapshot;
// OMP has series/work-type fields and never inherits an OJS issue or page field.
const localized = z.preprocess(
  value => Array.isArray(value) && value.length === 0 ? {} : value,
  z.record(z.string().max(32), z.string().max(100000)),
);
export const ompWorkflowInspectionResponse = z.object({
  snapshot: base.extend({
    protocol: z.literal('omi-omp-workflow/1'),
    authority: z.literal('OMP'),
    metadata: base.shape.metadata.omit({ pages: true, issueId: true }).extend({
      title: localized,
      subtitle: localized,
      abstract: localized,
      copyrightHolder: localized.nullable(),
      seriesId: z.union([z.number(), z.string()]).nullable(),
      seriesPosition: z.union([z.number(), z.string()]).nullable(),
      workType: z.union([z.number(), z.string()]).nullable(),
    }),
  }),
});
export type OmpWorkflowInspectionResponse = z.output<typeof ompWorkflowInspectionResponse>;
