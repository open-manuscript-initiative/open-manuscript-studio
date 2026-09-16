import { Router } from 'express';
import { z } from 'zod';

import {
  ExternalInstallationStatus,
  ExternalPlatform,
} from '../generated/prisma/client.js';
import { assertTrustedIntegrationUrl } from '../integrations/security/trustedRemoteUrl.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';
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
  integrationConnectionId: z.string().uuid(),
});

type PublicationVenueIntegrationProvider = 'OJS' | 'OMP';

interface ExpectedPublishingIntegration {
  providerId: 'ojs' | 'omp';
  platform: ExternalPlatform;
  integrationProvider: PublicationVenueIntegrationProvider;
}

function expectedPublishingIntegration(
  type: 'JOURNAL' | 'BOOK_PUBLISHER',
): ExpectedPublishingIntegration {
  return type === 'JOURNAL'
    ? {
        providerId: 'ojs',
        platform: ExternalPlatform.OJS,
        integrationProvider: 'OJS',
      }
    : {
        providerId: 'omp',
        platform: ExternalPlatform.OMP,
        integrationProvider: 'OMP',
      };
}

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
      integrationStatus: 'VERIFIED' as const,
      ...(normalizedQuery
        ? { normalizedName: { contains: normalizedQuery } }
        : {}),
    };

    try {
      const venues = await identityPrisma.publicationVenue.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 500,
      });
      const installationIds = [
        ...new Set(
          venues
            .map((venue) => venue.integrationInstallationId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (!installationIds.length) {
        response.status(200).json({ venues: [] });
        return;
      }

      const activeInstallations = await prisma.externalInstallation.findMany({
        where: {
          installationId: { in: installationIds },
          status: ExternalInstallationStatus.ACTIVE,
        },
        select: { installationId: true, platform: true },
      });
      const activePlatforms = new Map(
        activeInstallations.map((installation) => [
          installation.installationId,
          installation.platform,
        ]),
      );
      const visibleVenues = venues.filter((venue) => {
        if (!venue.integrationInstallationId) return false;
        const platform = activePlatforms.get(venue.integrationInstallationId);
        return platform !== undefined
          && matchesPlatform(venue.integrationProvider, platform);
      });

      response.status(200).json({
        venues: visibleVenues.map(serializePublicationVenue),
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

    const expected = expectedPublishingIntegration(parsed.data.type);
    let connection: { id: string; config: unknown } | null = null;
    let installation: {
      installationId: string;
      platform: ExternalPlatform;
      baseUrl: string;
      status: ExternalInstallationStatus;
    } | null = null;

    try {
      connection = await prisma.userIntegration.findFirst({
        where: {
          id: parsed.data.integrationConnectionId,
          userId: request.authUserId!,
          providerId: expected.providerId,
          enabled: true,
        },
        select: { id: true, config: true },
      });
      const installationId = readConfigString(connection?.config, 'installationId');
      installation = installationId
        ? await prisma.externalInstallation.findUnique({
            where: { installationId },
            select: {
              installationId: true,
              platform: true,
              baseUrl: true,
              status: true,
            },
          })
        : null;
    } catch (error) {
      console.error('[OMI publication venues] integration lookup failed', error);
      response.status(500).json({
        error: {
          code: 'PUBLICATION_VENUE_INTEGRATION_LOOKUP_FAILED',
          message: 'The publishing integration could not be checked.',
        },
      });
      return;
    }

    if (
      !connection ||
      !installation ||
      installation.platform !== expected.platform ||
      installation.status !== ExternalInstallationStatus.ACTIVE
    ) {
      response.status(409).json({
        error: {
          code: 'PUBLICATION_VENUE_INTEGRATION_NOT_VERIFIED',
          message: 'Select an active OJS/OMP connection with a registered publishing installation.',
        },
      });
      return;
    }

    let remoteName: string;
    try {
      remoteName = await readVerifiedRemoteVenueName(installation.baseUrl, expected);
    } catch (error) {
      console.warn('[OMI publication venues] remote integration verification failed', error);
      response.status(409).json({
        error: {
          code: 'PUBLICATION_VENUE_INTEGRATION_NOT_VERIFIED',
          message: 'The selected publishing integration could not be verified. Check that the OJS/OMP plugin is enabled and reachable.',
        },
      });
      return;
    }

    if (normalizeVenueName(remoteName) !== normalizedName) {
      response.status(400).json({
        error: {
          code: 'PUBLICATION_VENUE_NAME_MISMATCH',
          message: 'The name must match the name reported by the selected publishing integration: ' + remoteName + '.',
        },
      });
      return;
    }

    const website = cleanOptional(parsed.data.website);
    const issn = cleanOptional(parsed.data.issn)?.toUpperCase();
    const isbnPrefix = cleanOptional(parsed.data.isbnPrefix);
    const integrationData = {
      integrationProvider: expected.integrationProvider,
      integrationStatus: 'VERIFIED' as const,
      integrationInstallationId: installation.installationId,
      integrationBaseUrl: installation.baseUrl,
      integrationVerifiedAt: new Date(),
    };

    try {
      const existing = await identityPrisma.publicationVenue.findUnique({
        where: {
          type_normalizedName: {
            type: parsed.data.type,
            normalizedName,
          },
        },
      });
      const venue = existing
        ? await identityPrisma.publicationVenue.update({
            where: { id: existing.id },
            data: {
              ...(website ? { website } : {}),
              ...(issn ? { issn } : {}),
              ...(isbnPrefix ? { isbnPrefix } : {}),
              ...integrationData,
            },
          })
        : await identityPrisma.publicationVenue.create({
            data: {
              type: parsed.data.type,
              name,
              normalizedName,
              createdByUserId: request.authUserId!,
              ...(website ? { website } : {}),
              ...(issn ? { issn } : {}),
              ...(isbnPrefix ? { isbnPrefix } : {}),
              ...integrationData,
            },
          });

      response.status(existing ? 200 : 201).json({
        venue: serializePublicationVenue(venue),
        created: !existing,
        verified: true,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrent = await identityPrisma.publicationVenue.findUnique({
          where: {
            type_normalizedName: {
              type: parsed.data.type,
              normalizedName,
            },
          },
        });
        if (concurrent?.integrationStatus === 'VERIFIED') {
          response.status(200).json({
            venue: serializePublicationVenue(concurrent),
            created: false,
            verified: true,
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
  integrationProvider: string | null;
  integrationStatus: string | null;
}) {
  return {
    id: venue.id,
    type: venue.type,
    name: venue.name,
    ...(venue.website ? { website: venue.website } : {}),
    ...(venue.issn ? { issn: venue.issn } : {}),
    ...(venue.isbnPrefix ? { isbnPrefix: venue.isbnPrefix } : {}),
    ...(venue.integrationProvider
      ? { integrationProvider: venue.integrationProvider }
      : {}),
    ...(venue.integrationStatus
      ? { integrationStatus: venue.integrationStatus }
      : {}),
  };
}

async function readVerifiedRemoteVenueName(
  baseUrl: string,
  expected: ExpectedPublishingIntegration,
): Promise<string> {
  const remoteUrl = await assertTrustedIntegrationUrl(
    baseUrl.replace(/\/+$/u, '') + '/api/v1/omi-integration/submission-options',
    baseUrl,
  );
  const remoteResponse = await fetch(remoteUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  const body = await remoteResponse.text();
  if (body.length > 1_000_000) {
    throw new Error('The publishing integration response is too large.');
  }
  if (!remoteResponse.ok) {
    throw new Error('The publishing integration returned HTTP ' + remoteResponse.status + '.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error('The publishing integration did not return JSON.');
  }
  if (
    !isRecord(payload) ||
    payload.protocol !== 'omi-direct-submission/1' ||
    payload.platform !== expected.providerId
  ) {
    throw new Error('The publishing integration does not implement the expected protocol.');
  }

  const name = typeof payload.name === 'string'
    ? normalizeDisplayName(payload.name)
    : '';
  if (!name || name.length > 300) {
    throw new Error('The publishing integration did not return a valid venue name.');
  }
  return name;
}

function matchesPlatform(
  provider: string | null,
  platform: ExternalPlatform,
): boolean {
  return (
    (provider === 'OJS' && platform === ExternalPlatform.OJS) ||
    (provider === 'OMP' && platform === ExternalPlatform.OMP)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readConfigString(config: unknown, key: string): string | null {
  if (!isRecord(config)) return null;
  const value = config[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
