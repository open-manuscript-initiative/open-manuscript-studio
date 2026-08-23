import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { identityPrisma } from '../lib/identityPrisma.js';
import {
  verifyInstitutionApiToken,
  writeAdminAuditEvent,
  type InstitutionApiScope,
} from '../services/centralAdminService.js';

export const institutionAdminApiRouter = Router();

const updateMemberSchema = z.object({
  role: z.enum(['MEMBER', 'ADMIN']),
});

institutionAdminApiRouter.get('/v1/context', async (request, response) => {
  const credential = await requireApiCredential(request, response, ['institution:read']);
  if (!credential) return;

  response.status(200).json({
    institution: {
      id: credential.institution.id,
      name: credential.institution.name,
      rorId: credential.institution.rorId,
      status: credential.institution.status,
    },
    credential: {
      id: credential.id,
      label: credential.label,
      tokenPrefix: credential.tokenPrefix,
      scopes: credential.scopes,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
    },
  });
});

institutionAdminApiRouter.get('/v1/members', async (request, response) => {
  const credential = await requireApiCredential(request, response, ['members:read']);
  if (!credential) return;

  const members = await identityPrisma.institutionMembership.findMany({
    where: { institutionId: credential.institutionId },
    include: { user: true, identity: true },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
  });

  response.status(200).json({
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      fullName: member.user.fullName,
      email: member.user.email,
      role: member.role,
      department: member.department,
      positionTitle: member.positionTitle,
      institutionalEmail: member.institutionalEmail,
      identityProvider: member.identity?.provider ?? null,
      createdAt: member.createdAt.toISOString(),
    })),
  });
});

institutionAdminApiRouter.patch('/v1/members/:membershipId/role', async (request, response) => {
  const credential = await requireApiCredential(request, response, ['members:write']);
  if (!credential) return;

  try {
    const membershipId = z.string().uuid().parse(request.params.membershipId);
    const { role } = updateMemberSchema.parse(request.body);
    const member = await identityPrisma.institutionMembership.findFirst({
      where: { id: membershipId, institutionId: credential.institutionId },
      include: { user: true },
    });
    if (!member) {
      response.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'Institution member not found.' } });
      return;
    }
    if (member.role === 'OWNER') {
      response.status(403).json({
        error: {
          code: 'OWNER_ROLE_PROTECTED',
          message: 'Institution owner roles can only be changed by a human owner or central administrator.',
        },
      });
      return;
    }

    const updated = await identityPrisma.institutionMembership.update({
      where: { id: member.id },
      data: { role },
      include: { user: true },
    });
    await writeAdminAuditEvent({
      apiCredentialId: credential.id,
      institutionId: credential.institutionId,
      action: 'institution_api.member.role',
      targetType: 'institution_membership',
      targetId: updated.id,
      details: { targetEmail: updated.user.email, role },
      ...(request.ip ? { ipAddress: request.ip } : {}),
    });

    response.status(200).json({
      member: {
        id: updated.id,
        userId: updated.userId,
        fullName: updated.user.fullName,
        email: updated.user.email,
        role: updated.role,
      },
    });
  } catch (error) {
    response.status(400).json({
      error: {
        code: 'MEMBER_ROLE_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Institution member role could not be updated.',
      },
    });
  }
});

async function requireApiCredential(
  request: Request,
  response: Response,
  scopes: InstitutionApiScope[],
) {
  const token = readBearerToken(request.headers.authorization);
  if (!token) {
    response.status(401).json({
      error: { code: 'API_TOKEN_REQUIRED', message: 'An institution Admin API bearer token is required.' },
    });
    return null;
  }
  const credential = await verifyInstitutionApiToken(token, scopes);
  if (!credential) {
    response.status(403).json({
      error: { code: 'API_TOKEN_INVALID', message: 'The institution Admin API token is invalid, expired, revoked, or missing a required scope.' },
    });
    return null;
  }
  return credential;
}

function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const value = header.trim();
  if (!value.toLowerCase().startsWith('bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}
