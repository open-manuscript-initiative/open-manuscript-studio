import { z } from 'zod';
export const workflowInspectionRequest = z
  .object({ submissionId: z.number().int().positive() })
  .strict();
const localized = z.record(z.string().max(32), z.string().max(100000));
export const workflowInspectionResponse = z.object({
  snapshot: z.object({
    protocol: z.literal('omi-ojs-workflow/1'),
    authority: z.literal('OJS'),
    stateToken: z.string().regex(/^[0-9a-f]{64}$/),
    submissionId: z.number().int().positive(),
    publicationId: z.number().int().positive().nullable(),
    stageId: z.number().int(),
    stage: z.string(),
    submissionStatus: z.number().int(),
    publicationStatus: z.number().int().nullable(),
    lastModified: z.unknown(),
    metadata: z.object({
      title: localized,
      subtitle: localized,
      abstract: localized,
      pages: z.string().nullable(),
      issueId: z.union([z.number(), z.string()]).nullable(),
      datePublished: z.string().nullable(),
      licenseUrl: z.string().nullable(),
      copyrightHolder: localized.nullable(),
      copyrightYear: z.union([z.number(), z.string()]).nullable(),
    }),
    editorialDecisionsWritable: z.literal(false),
  }),
});
export const editorialCapabilitiesSchema = z
  .object({
    protocol: z.literal('omi-publishing-editorial/1'),
    provider: z.enum(['ojs', 'omp']),
    authority: z.enum(['OJS', 'OMP']),
    features: z
      .object({
        workflowRead: z.boolean(),
        metadataReconcile: z.boolean(),
        nativeCopyeditingWrite: z.literal(false),
        nativeProofApproval: z.literal(false),
        externalReviewAssurance: z.literal(false),
      })
      .strict(),
  })
  .strict();
export const editorialErrorSchema = z
  .object({
    error: z.object({ code: z.string(), message: z.string() }).strict(),
  })
  .strict();
export type EditorialConnectorCapabilities = z.infer<
  typeof editorialCapabilitiesSchema
>;
