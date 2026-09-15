import { Router } from 'express';
import { z } from 'zod';

import { identityPrisma } from '../lib/identityPrisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const publicationVenueRouter = Router();

const venueTypeSchema = z.enum(['JOURNAL', 'BOOK_PUBLISHER']);

const listSchema = z.object({
  type: venueTypeSchema.optional(),
  q: z.string().trim().max(80).optional(),
});

const createSchema = z.object({
  type: venueTypeSchema,
  name: z.string().trim().min(1).max(300),
  website: z.string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => /^https?:\/\//iu.test(value), {
      message: 'Website must use HTTP or HTTPS.',
    })
    .optional(),
  issn: z.string().trim().max(32).optional(),
  isbnPrefix: z.string().trim().max(64).optional(),
});

publicationVenueRouter.get(
  '/publication-venues',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'PUBLICATION_VENUE_QUERY_INVALID',
          message: parsed.error.issues.map((issue) => issue.message).join(' '),
        },
      });
      return;
    }

    const normalizedQuery = parsed.data.q
      ? normalizeVenueName(parsed.data.q)
      : '';
    const where = {
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(normalizedQuery
        ? { normalizedName: { contains: normalizedQuery } }
        : {}),
    };

    try {
      const venues = await identityPrisma.publicationVenue.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 100,
      });
      response.status(200).json({
        venues: venues.map(serializePublicationVenue),
      });
    } catch (error) {
      console.error('[OMI publication venues] list failed', error);
      response.status(500).json({
        error: {
          code: 'PUBLICATION_VENUE_LIST_FAILED',
          message: 'Publication venues could not be loaded.',
        },
      });
    }
  },
);

publicationVenueRouter.post(
  '/publication-venues',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'PUBLICATION_VENUE_CREATE_INVALID',
          message: parsed.error.issues.map((issue) => issue.message).join(' '),
        },
      });
      return;
    }

    const name = normalizeDisplayName(parsed.data.name);
    const normalizedName = normalizeVenueName(name);
    if (!name || !normalizedName) {
      response.status(400).json({
        error: {
          code: 'PUBLICATION_VENUE_CREATE_INVALID',
          message: 'A publication venue name is required.',
        },
      });
      return;
    }

    const key = {
      type: parsed.data.type,
      normalizedName,
    };

    try {
      const existing = await identityPrisma.publicationVenue.findUnique({
        where: { type_normalizedName: key },
      });
      if (existing) {
        response.status(200).json({
          venue: serializePublicationVenue(existing),
          created: false,
        });
        return;
      }

      const website = cleanOptional(parsed.data.website);
      const issn = cleanOptional(parsed.data.issn)?.toUpperCase();
      const isbnPrefix = cleanOptional(parsed.data.isbnPrefix);
      const venue = await identityPrisma.publicationVenue.create({
        data: {
          type: parsed.data.type,
          name,
          normalizedName,
          createdByUserId: request.authUserId!,
          ...(website ? { website } : {}),
          ...(issn ? { issn } : {}),
          ...(isbnPrefix ? { isbnPrefix } : {}),
        },
      });
      response.status(201).json({
        venue: serializePublicationVenue(venue),
        created: true,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await identityPrisma.publicationVenue.findUnique({
          where: { type_normalizedName: key },
        });
        if (existing) {
          response.status(200).json({
            venue: serializePublicationVenue(existing),
            created: false,
          });
          return;
        }
      }

      console.error('[OMI publication venues] create failed', error);
      response.status(500).json({
        error: {
          code: 'PUBLICATION_VENUE_CREATE_FAILED',
          message: 'The publication venue could not be saved.',
        },
      });
    }
  },
);

function serializePublicationVenue(venue: {
  id: string;
  type: string;
  name: string;
  website: string | null;
  issn: string | null;
  isbnPrefix: string | null;
}) {
  return {
    id: venue.id,
    type: venue.type,
    name: venue.name,
    ...(venue.website ? { website: venue.website } : {}),
    ...(venue.issn ? { issn: venue.issn } : {}),
    ...(venue.isbnPrefix ? { isbnPrefix: venue.isbnPrefix } : {}),
  };
}

function normalizeDisplayName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function normalizeVenueName(value: string): string {
  return normalizeDisplayName(value).toLocaleLowerCase('en-US');
}

function cleanOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'P2002';
}
