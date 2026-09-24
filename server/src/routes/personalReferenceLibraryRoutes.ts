import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const personalReferenceLibraryRouter = Router();

const identifierSchema = z.object({
  scheme: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(2048),
});

const contributorSchema = z.object({
  id: z.string().trim().min(1).max(128),
  role: z.string().trim().min(1).max(64),
  givenName: z.string().max(300).optional(),
  familyName: z.string().max(300).optional(),
  literalName: z.string().max(500).optional(),
});

const recordSchema = z.object({
  id: z.string().trim().min(1).max(128),
  type: z.string().trim().min(1).max(128),
  title: z.string().max(4000),
  subtitle: z.string().max(4000).optional(),
  contributors: z.array(contributorSchema).max(256),
  containerTitle: z.string().max(4000).optional(),
  issued: z.string().max(128).optional(),
  publisher: z.string().max(2000).optional(),
  place: z.string().max(1000).optional(),
  volume: z.string().max(128).optional(),
  issue: z.string().max(128).optional(),
  pages: z.string().max(256).optional(),
  language: z.string().max(64).optional(),
  identifiers: z.array(identifierSchema).max(128),
  url: z.string().max(4096).optional(),
  accessed: z.string().max(128).optional(),
  status: z.string().trim().min(1).max(64),
  createdAt: z.string().max(128).optional(),
  modifiedAt: z.string().max(128).optional(),
}).strict();

const bulkSchema = z.object({
  records: z.array(recordSchema).max(2000),
});

const recordIdSchema = z.string().trim().min(1).max(128);

personalReferenceLibraryRouter.use(requireSession);

personalReferenceLibraryRouter.get(
  '/references/library',
  async (request: AuthenticatedRequest, response) => {
    const rows = await prisma.personalReferenceRecord.findMany({
      where: { userId: request.authUserId! },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    response.status(200).json({
      records: rows.map((row) => row.record),
    });
  },
);

personalReferenceLibraryRouter.put(
  '/references/library/:recordId',
  async (request: AuthenticatedRequest, response) => {
    const recordId = recordIdSchema.safeParse(request.params.recordId);
    const record = recordSchema.safeParse(request.body?.record);

    if (!recordId.success || !record.success || record.data.id !== recordId.data) {
      response.status(400).json({
        error: {
          code: 'INVALID_PERSONAL_REFERENCE',
          message: 'A valid bibliographic record with a matching record id is required.',
        },
      });
      return;
    }

    const row = await prisma.personalReferenceRecord.upsert({
      where: {
        userId_recordId: {
          userId: request.authUserId!,
          recordId: recordId.data,
        },
      },
      create: {
        userId: request.authUserId!,
        recordId: recordId.data,
        record: record.data,
      },
      update: {
        record: record.data,
      },
    });

    response.status(200).json({ record: row.record });
  },
);

personalReferenceLibraryRouter.post(
  '/references/library/bulk',
  async (request: AuthenticatedRequest, response) => {
    const body = bulkSchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PERSONAL_REFERENCE_LIBRARY',
          message: 'The personal reference library payload is invalid.',
        },
      });
      return;
    }

    const unique = new Map(body.data.records.map((record) => [record.id, record]));
    await prisma.$transaction(
      [...unique.values()].map((record) =>
        prisma.personalReferenceRecord.upsert({
          where: {
            userId_recordId: {
              userId: request.authUserId!,
              recordId: record.id,
            },
          },
          create: {
            userId: request.authUserId!,
            recordId: record.id,
            record,
          },
          update: {
            record,
          },
        }),
      ),
    );

    response.status(200).json({
      saved: unique.size,
    });
  },
);

personalReferenceLibraryRouter.delete(
  '/references/library/:recordId',
  async (request: AuthenticatedRequest, response) => {
    const recordId = recordIdSchema.safeParse(request.params.recordId);
    if (!recordId.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PERSONAL_REFERENCE_ID',
          message: 'A valid bibliographic record id is required.',
        },
      });
      return;
    }

    await prisma.personalReferenceRecord.deleteMany({
      where: {
        userId: request.authUserId!,
        recordId: recordId.data,
      },
    });

    response.status(204).end();
  },
);
