import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '../integrations/secretCrypto.js';
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

const publishingCredentialSchema = z.object({
  apiKey: z.string().trim().min(1).max(4096),
  baseUrl: z.string().trim().url().max(2048),
});

authRouter.get('/me/ojs-credential', requireSession, async (request: AuthenticatedRequest, response) => {
  const user = await identityPrisma.user.findUnique({
    where: { id: request.authUserId! },
    select: { ojsApiBaseUrl: true, ojsApiKeyCiphertext: true },
  });
  response.json({
    configured: Boolean(user?.ojsApiKeyCiphertext && user.ojsApiBaseUrl),
    baseUrl: user?.ojsApiBaseUrl ?? null,
  });
});

authRouter.put('/me/ojs-credential', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const input = publishingCredentialSchema.parse(request.body);
    const encrypted = encryptSecret(input.apiKey);
    const baseUrl = input.baseUrl.replace(/\/+$/, '');
    await identityPrisma.user.update({
      where: { id: request.authUserId! },
      data: {
        ojsApiKeyCiphertext: encrypted.ciphertext,
        ojsApiKeyIv: encrypted.iv,
        ojsApiKeyAuthTag: encrypted.authTag,
        ojsApiBaseUrl: baseUrl,
      },
    });
    response.json({ configured: true, baseUrl });
  } catch (error) {
    response.status(400).json({
      error: {
        code: 'OJS_CREDENTIAL_SAVE_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'The OJS credential could not be saved.',
      },
    });
  }
});

authRouter.delete('/me/ojs-credential', requireSession, async (request: AuthenticatedRequest, response) => {
  await identityPrisma.user.update({
    where: { id: request.authUserId! },
    data: {
      ojsApiKeyCiphertext: null,
      ojsApiKeyIv: null,
      ojsApiKeyAuthTag: null,
      ojsApiBaseUrl: null,
    },
  });
  response.status(204).end();
});

authRouter.get('/me/omp-credential', requireSession, async (request: AuthenticatedRequest, response) => {
  const user = await identityPrisma.user.findUnique({
    where: { id: request.authUserId! },
    select: { ompApiBaseUrl: true, ompApiKeyCiphertext: true },
  });
  response.json({
    configured: Boolean(user?.ompApiKeyCiphertext && user.ompApiBaseUrl),
    baseUrl: user?.ompApiBaseUrl ?? null,
  });
});

authRouter.put('/me/omp-credential', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const input = publishingCredentialSchema.parse(request.body);
    const encrypted = encryptSecret(input.apiKey);
    const baseUrl = input.baseUrl.replace(/\/+$/, '');
    await identityPrisma.user.update({
      where: { id: request.authUserId! },
      data: {
        ompApiKeyCiphertext: encrypted.ciphertext,
        ompApiKeyIv: encrypted.iv,
        ompApiKeyAuthTag: encrypted.authTag,
        ompApiBaseUrl: baseUrl,
      },
    });
    response.json({ configured: true, baseUrl });
  } catch (error) {
    response.status(400).json({
      error: {
        code: 'OMP_CREDENTIAL_SAVE_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'The OMP credential could not be saved.',
      },
    });
  }
});

authRouter.delete('/me/omp-credential', requireSession, async (request: AuthenticatedRequest, response) => {
  await identityPrisma.user.update({
    where: { id: request.authUserId! },
    data: {
      ompApiKeyCiphertext: null,
      ompApiKeyIv: null,
      ompApiKeyAuthTag: null,
      ompApiBaseUrl: null,
    },
  });
  response.status(204).end();
});

export async function resolvePersonalOjsCredential(
  userId: string,
): Promise<{ apiKey: string; baseUrl: string } | null> {
  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    select: {
      ojsApiKeyCiphertext: true,
      ojsApiKeyIv: true,
      ojsApiKeyAuthTag: true,
      ojsApiBaseUrl: true,
    },
  });
  if (
    !user?.ojsApiKeyCiphertext ||
    !user.ojsApiKeyIv ||
    !user.ojsApiKeyAuthTag ||
    !user.ojsApiBaseUrl
  ) {
    return null;
  }
  return {
    apiKey: decryptSecret({
      ciphertext: user.ojsApiKeyCiphertext,
      iv: user.ojsApiKeyIv,
      authTag: user.ojsApiKeyAuthTag,
    } as EncryptedSecret),
    baseUrl: user.ojsApiBaseUrl,
  };
}

export async function resolvePersonalOmpCredential(
  userId: string,
): Promise<{ apiKey: string; baseUrl: string } | null> {
  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    select: {
      ompApiKeyCiphertext: true,
      ompApiKeyIv: true,
      ompApiKeyAuthTag: true,
      ompApiBaseUrl: true,
    },
  });
  if (
    !user?.ompApiKeyCiphertext ||
    !user.ompApiKeyIv ||
    !user.ompApiKeyAuthTag ||
    !user.ompApiBaseUrl
  ) {
    return null;
  }
  return {
    apiKey: decryptSecret({
      ciphertext: user.ompApiKeyCiphertext,
      iv: user.ompApiKeyIv,
      authTag: user.ompApiKeyAuthTag,
    } as EncryptedSecret),
    baseUrl: user.ompApiBaseUrl,
  };
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
