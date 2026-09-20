import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '../integrations/secretCrypto.js';
import { PublicationVenueIntegrationProvider } from '../generated/identity-prisma/client.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';

import {
  destroySession,
  getUserForSession,
  loginUser,
  registerUser,
  updateUserForSession,
  type RegisterUserInput,
  type UpdateUserInput,
} from '../services/authService.js';
import { getAssignmentInvitation } from '../services/assignmentInvitationService.js';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '../services/passwordResetService.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(200),
  affiliation: z.string().max(300).optional(),
  affiliationRorId: z.string().max(128).optional(),
  orcid: z.string().max(19).optional(),
  interfaceLanguage: z.string().max(16).optional(),
  invitationToken: z.string().min(20).max(512).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  password: z.string().min(8).max(512),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  affiliation: z.string().max(300).nullable().optional(),
  affiliationRorId: z.string().max(128).nullable().optional(),
  orcid: z.string().max(19).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  timeZone: z.string().max(64).nullable().optional(),
  interfaceLanguage: z.string().max(16).optional(),
});

const COOKIE_NAME = 'omi_session';
const NATIVE_HEADER = 'x-omi-native-client';

function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function readBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const value = header.trim();
  const prefix = 'bearer ';
  if (value.length <= prefix.length || value.slice(0, prefix.length).toLowerCase() !== prefix) {
    return undefined;
  }
  const token = value.slice(prefix.length).trim();
  return token || undefined;
}

function readSessionToken(request: Request): string | undefined {
  return readBearerToken(request.headers.authorization) ?? readSessionCookie(request.headers.cookie);
}

function isNativeClient(request: Request): boolean {
  return request.headers[NATIVE_HEADER] === '1';
}

function setSessionCookie(response: Response, token: string, expiresAt: Date): void {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

function authResponse(
  request: Request,
  result: { user: unknown; token: string; expiresAt: Date },
) {
  return isNativeClient(request)
    ? {
        user: result.user,
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
      }
    : { user: result.user };
}

authRouter.get('/invitations/:token', async (request, response) => {
  const token = typeof request.params.token === 'string' ? request.params.token : '';
  if (!token) {
    response.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'The invitation is invalid or has expired.' } });
    return;
  }
  const invitation = await getAssignmentInvitation(token);
  if (!invitation) {
    response.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'The invitation is invalid or has expired.' } });
    return;
  }
  response.status(200).json({ invitation });
});

authRouter.post('/register', async (request, response) => {
  try {
    const parsed = registerSchema.parse(request.body);
    const input: RegisterUserInput = {
      email: parsed.email,
      password: parsed.password,
      fullName: parsed.fullName,
      ...(parsed.affiliation !== undefined ? { affiliation: parsed.affiliation } : {}),
      ...(parsed.affiliationRorId !== undefined ? { affiliationRorId: parsed.affiliationRorId } : {}),
      ...(parsed.orcid !== undefined ? { orcid: parsed.orcid } : {}),
      ...(parsed.interfaceLanguage !== undefined ? { interfaceLanguage: parsed.interfaceLanguage } : {}),
      ...(parsed.invitationToken !== undefined ? { invitationToken: parsed.invitationToken } : {}),
    };
    const result = await registerUser(input);
    setSessionCookie(response, result.token, result.expiresAt);
    response.status(201).json(authResponse(request, result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.';
    response.status(400).json({ error: { code: 'REGISTRATION_FAILED', message } });
  }
});

authRouter.post('/login', async (request, response) => {
  try {
    const input = loginSchema.parse(request.body);
    const result = await loginUser(input);
    setSessionCookie(response, result.token, result.expiresAt);
    response.status(200).json(authResponse(request, result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    response.status(401).json({ error: { code: 'LOGIN_FAILED', message } });
  }
});

authRouter.post('/password/forgot', async (request, response) => {
  try {
    const input = forgotPasswordSchema.parse(request.body);
    try {
      await requestPasswordReset(input.email);
    } catch (error) {
      // The public response deliberately does not reveal account existence or
      // mail-delivery state. Operational failures stay in the server log.
      console.error('[OMI password reset] request failed', error);
    }
    response.status(202).json({ ok: true });
  } catch {
    response.status(400).json({
      error: { code: 'INVALID_EMAIL', message: 'Invalid e-mail address.' },
    });
  }
});

authRouter.post('/password/reset', async (request, response) => {
  try {
    const input = resetPasswordSchema.parse(request.body);
    await resetPasswordWithToken(input.token, input.password);
    response.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed.';
    response.status(400).json({ error: { code: 'PASSWORD_RESET_FAILED', message } });
  }
});

authRouter.get('/me', async (request, response) => {
  const token = readSessionToken(request);
  if (!token) {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }

  const user = await getUserForSession(token);
  if (!user) {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }

  response.status(200).json({ user });
});

authRouter.patch('/me', async (request, response) => {
  try {
    const token = readSessionToken(request);
    if (!token) {
      response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
      return;
    }

    const parsed = updateProfileSchema.parse(request.body);
    const input: UpdateUserInput = {
      ...(parsed.fullName !== undefined ? { fullName: parsed.fullName } : {}),
      ...(parsed.affiliation !== undefined ? { affiliation: parsed.affiliation } : {}),
      ...(parsed.affiliationRorId !== undefined ? { affiliationRorId: parsed.affiliationRorId } : {}),
      ...(parsed.orcid !== undefined ? { orcid: parsed.orcid } : {}),
      ...(parsed.bio !== undefined ? { bio: parsed.bio } : {}),
      ...(parsed.timeZone !== undefined ? { timeZone: parsed.timeZone } : {}),
      ...(parsed.interfaceLanguage !== undefined ? { interfaceLanguage: parsed.interfaceLanguage } : {}),
    };
    const user = await updateUserForSession(token, input);
    if (!user) {
      response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
      return;
    }

    response.status(200).json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile update failed.';
    response.status(400).json({ error: { code: 'PROFILE_UPDATE_FAILED', message } });
  }
});

const profileEmailSchema = z.object({
  email: z.string().trim().email().max(320),
});

const profileEmailIdSchema = z.string().uuid();

function normalizeProfileEmail(value: string): string {
  return value.trim().toLowerCase();
}

function publicProfileEmail(profileEmail: {
  id: string;
  email: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: profileEmail.id,
    email: profileEmail.email,
    isPrimary: profileEmail.isPrimary,
    createdAt: profileEmail.createdAt.toISOString(),
    updatedAt: profileEmail.updatedAt.toISOString(),
  };
}

async function ensurePrimaryProfileEmail(userId: string): Promise<void> {
  const existing = await identityPrisma.userProfileEmail.findFirst({
    where: { userId, isPrimary: true },
  });
  if (existing) return;

  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return;

  const email = normalizeProfileEmail(user.email);
  await identityPrisma.userProfileEmail.upsert({
    where: { userId_email: { userId, email } },
    update: { isPrimary: true },
    create: { userId, email, isPrimary: true },
  });
}

authRouter.get('/me/profile-emails', requireSession, async (request: AuthenticatedRequest, response) => {
  await ensurePrimaryProfileEmail(request.authUserId!);
  const emails = await identityPrisma.userProfileEmail.findMany({
    where: { userId: request.authUserId! },
    orderBy: [{ isPrimary: 'desc' }, { email: 'asc' }],
  });
  response.json({ emails: emails.map(publicProfileEmail) });
});

authRouter.post('/me/profile-emails', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    await ensurePrimaryProfileEmail(request.authUserId!);
    const input = profileEmailSchema.parse(request.body);
    const email = normalizeProfileEmail(input.email);
    const profileEmail = await identityPrisma.userProfileEmail.upsert({
      where: {
        userId_email: {
          userId: request.authUserId!,
          email,
        },
      },
      update: {},
      create: {
        userId: request.authUserId!,
        email,
        isPrimary: false,
      },
    });
    response.json({ email: publicProfileEmail(profileEmail) });
  } catch (error) {
    response.status(400).json({
      error: {
        code: 'PROFILE_EMAIL_SAVE_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'The e-mail address could not be added to the personal profile.',
      },
    });
  }
});

authRouter.delete('/me/profile-emails/:profileEmailId', requireSession, async (request: AuthenticatedRequest, response) => {
  const parsed = profileEmailIdSchema.safeParse(request.params.profileEmailId);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_PROFILE_EMAIL_ID',
        message: 'Invalid profile e-mail identifier.',
      },
    });
    return;
  }

  const profileEmail = await identityPrisma.userProfileEmail.findFirst({
    where: {
      id: parsed.data,
      userId: request.authUserId!,
    },
  });
  if (!profileEmail) {
    response.status(404).json({
      error: {
        code: 'PROFILE_EMAIL_NOT_FOUND',
        message: 'The profile e-mail address was not found.',
      },
    });
    return;
  }
  if (profileEmail.isPrimary) {
    response.status(409).json({
      error: {
        code: 'PRIMARY_PROFILE_EMAIL',
        message: 'The primary account e-mail address cannot be removed here.',
      },
    });
    return;
  }

  const credentialCount = await identityPrisma.personalPublishingCredential.count({
    where: { profileEmailId: profileEmail.id },
  });
  if (credentialCount > 0) {
    response.status(409).json({
      error: {
        code: 'PROFILE_EMAIL_IN_USE',
        message: 'Remove the API keys associated with this e-mail address before removing the address.',
      },
    });
    return;
  }

  await identityPrisma.userProfileEmail.delete({ where: { id: profileEmail.id } });
  response.status(204).end();
});

const publishingCredentialSchema = z.object({
  provider: z.enum(['ojs', 'omp']),
  profileEmailId: z.string().uuid(),
  apiKey: z.string().trim().min(1).max(4096),
  baseUrl: z.string().trim().url().max(2048),
  label: z.string().trim().max(200).optional(),
});

const publishingCredentialIdSchema = z.string().uuid();

function publishingProvider(value: 'ojs' | 'omp'): PublicationVenueIntegrationProvider {
  return value === 'omp'
    ? PublicationVenueIntegrationProvider.OMP
    : PublicationVenueIntegrationProvider.OJS;
}

function publicPublishingCredential(credential: {
  id: string;
  profileEmailId: string;
  provider: PublicationVenueIntegrationProvider;
  label: string | null;
  baseUrl: string;
  createdAt: Date;
  updatedAt: Date;
  profileEmail: { email: string };
}) {
  return {
    id: credential.id,
    profileEmailId: credential.profileEmailId,
    email: credential.profileEmail.email,
    provider: credential.provider === PublicationVenueIntegrationProvider.OMP ? 'omp' : 'ojs',
    label: credential.label,
    baseUrl: credential.baseUrl,
    configured: true,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

function normalizePublishingBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

authRouter.get('/me/publishing-credentials', requireSession, async (request: AuthenticatedRequest, response) => {
  const credentials = await identityPrisma.personalPublishingCredential.findMany({
    where: { userId: request.authUserId! },
    include: { profileEmail: true },
    orderBy: [{ provider: 'asc' }, { baseUrl: 'asc' }],
  });
  response.json({
    credentials: credentials.map(publicPublishingCredential),
  });
});

authRouter.put('/me/publishing-credentials', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const input = publishingCredentialSchema.parse(request.body);
    const profileEmail = await identityPrisma.userProfileEmail.findFirst({
      where: {
        id: input.profileEmailId,
        userId: request.authUserId!,
      },
    });
    if (!profileEmail) {
      response.status(400).json({
        error: {
          code: 'PROFILE_EMAIL_NOT_FOUND',
          message: 'Choose an e-mail address from the personal profile.',
        },
      });
      return;
    }

    const encrypted = encryptSecret(input.apiKey);
    const provider = publishingProvider(input.provider);
    const baseUrl = normalizePublishingBaseUrl(input.baseUrl);
    const label = input.label?.trim() || null;
    const credential = await identityPrisma.personalPublishingCredential.upsert({
      where: {
        userId_provider_baseUrl_profileEmailId: {
          userId: request.authUserId!,
          provider,
          baseUrl,
          profileEmailId: profileEmail.id,
        },
      },
      update: {
        label,
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyAuthTag: encrypted.authTag,
      },
      create: {
        userId: request.authUserId!,
        profileEmailId: profileEmail.id,
        provider,
        label,
        baseUrl,
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyAuthTag: encrypted.authTag,
      },
      include: { profileEmail: true },
    });
    response.json({ credential: publicPublishingCredential(credential) });
  } catch (error) {
    response.status(400).json({
      error: {
        code: 'PUBLISHING_CREDENTIAL_SAVE_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'The publishing credential could not be saved.',
      },
    });
  }
});

authRouter.delete('/me/publishing-credentials/:credentialId', requireSession, async (request: AuthenticatedRequest, response) => {
  const parsed = publishingCredentialIdSchema.safeParse(request.params.credentialId);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_PUBLISHING_CREDENTIAL_ID',
        message: 'Invalid publishing credential identifier.',
      },
    });
    return;
  }

  await identityPrisma.personalPublishingCredential.deleteMany({
    where: {
      id: parsed.data,
      userId: request.authUserId!,
    },
  });
  response.status(204).end();
});

async function resolvePersonalPublishingCredential(
  userId: string,
  provider: PublicationVenueIntegrationProvider,
  baseUrl: string,
  email?: string,
): Promise<{ apiKey: string; baseUrl: string; email: string } | null> {
  const normalizedBaseUrl = normalizePublishingBaseUrl(baseUrl);
  const normalizedEmail = email ? normalizeProfileEmail(email) : undefined;

  let credential = await identityPrisma.personalPublishingCredential.findFirst({
    where: {
      userId,
      provider,
      baseUrl: normalizedBaseUrl,
      profileEmail: normalizedEmail
        ? { email: normalizedEmail }
        : { isPrimary: true },
    },
    include: { profileEmail: true },
  });

  if (!credential && !normalizedEmail) {
    credential = await identityPrisma.personalPublishingCredential.findFirst({
      where: {
        userId,
        provider,
        baseUrl: normalizedBaseUrl,
      },
      include: { profileEmail: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!credential) return null;

  return {
    apiKey: decryptSecret({
      ciphertext: credential.apiKeyCiphertext,
      iv: credential.apiKeyIv,
      authTag: credential.apiKeyAuthTag,
    } as EncryptedSecret),
    baseUrl: credential.baseUrl,
    email: credential.profileEmail.email,
  };
}

export async function resolvePersonalOjsCredential(
  userId: string,
  baseUrl: string,
  email?: string,
): Promise<{ apiKey: string; baseUrl: string; email: string } | null> {
  return resolvePersonalPublishingCredential(
    userId,
    PublicationVenueIntegrationProvider.OJS,
    baseUrl,
    email,
  );
}

export async function resolvePersonalOmpCredential(
  userId: string,
  baseUrl: string,
  email?: string,
): Promise<{ apiKey: string; baseUrl: string; email: string } | null> {
  return resolvePersonalPublishingCredential(
    userId,
    PublicationVenueIntegrationProvider.OMP,
    baseUrl,
    email,
  );
}

authRouter.post('/logout', async (request, response) => {
  const token = readSessionToken(request);
  if (token) await destroySession(token);
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  response.status(204).end();
});
