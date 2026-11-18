import { z } from 'zod';
const emptyMap = (value: unknown) =>
  Array.isArray(value) && value.length === 0 ? {} : value;
const localized = z.preprocess(
  emptyMap,
  z.record(z.string().max(32), z.string().max(100000)),
);
const keywords = z.preprocess(
  emptyMap,
  z.record(z.string().max(32), z.array(z.string().max(200)).max(100)),
);
export const ojsMetadataRequest = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('inspect'),
      submissionId: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal('apply'),
      submissionId: z.number().int().positive(),
      publicationId: z.number().int().positive(),
      locale: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/),
      expectedStateToken: z.string().regex(/^[0-9a-f]{64}$/),
      confirmed: z.literal(true),
      fields: z
        .object({
          title: z.string().max(1000).optional(),
          subtitle: z.string().max(1000).optional(),
          abstract: z.string().max(100000).optional(),
          keywords: z
            .array(z.string().trim().min(1).max(200))
            .max(100)
            .optional(),
        })
        .strict()
        .refine((fields) => Object.keys(fields).length > 0),
    })
    .strict(),
]);
const contributor = z.object({
  externalId: z.string(),
  name: z.object({ given: z.string(), family: z.string() }),
  preferredPublicName: localized.optional(),
  affiliation: z.string().optional(),
  affiliations: z
    .array(z.object({ name: localized, ror: z.string().nullable() }))
    .optional(),
  identifiers: z
    .array(z.object({ scheme: z.string(), value: z.string() }))
    .optional(),
  sequence: z.number().optional(),
  roles: z.array(z.string()).optional(),
  includeInBrowse: z.boolean().optional(),
});
export const ojsMetadataResponse = z.object({
  snapshot: z.object({
    protocol: z.literal('omi-ojs-metadata/1'),
    authority: z.literal('OJS'),
    stateToken: z.string().regex(/^[0-9a-f]{64}$/),
    workflowToken: z.string().regex(/^[0-9a-f]{64}$/),
    submissionId: z.number().int().positive(),
    publicationId: z.number().int().positive(),
    stage: z.string(),
    publicationStatus: z.number().int(),
    locales: z.array(z.string().min(1).max(32)).min(1),
    writableFields: z.array(
      z.enum(['title', 'subtitle', 'abstract', 'keywords']),
    ),
    abstractRepresentation: z.literal('plain-text'),
    metadata: z.object({
      title: localized,
      subtitle: localized,
      abstract: localized,
      keywords,
      doi: z.string().nullable(),
      references: z.string(),
      pages: z.string().nullable(),
      issueId: z.union([z.number(), z.string()]).nullable(),
      datePublished: z.string().nullable(),
      licenseUrl: z.string().nullable(),
      copyrightHolder: localized.nullable(),
      copyrightYear: z.union([z.number(), z.string()]).nullable(),
    }),
    contributors: z.array(contributor).max(500),
  }),
  receipt: z
    .object({
      protocol: z.literal('omi-ojs-metadata/1'),
      submissionId: z.number().int().positive(),
      publicationId: z.number().int().positive(),
      locale: z.string(),
      fields: z.array(z.string()),
      previousStateToken: z.string(),
      published: z.literal(false),
    })
    .optional(),
});

export type OjsMetadataRequest = z.input<typeof ojsMetadataRequest>;
export type OjsMetadataResponse = z.output<typeof ojsMetadataResponse>;
export type OjsMetadataSnapshot = OjsMetadataResponse['snapshot'];
