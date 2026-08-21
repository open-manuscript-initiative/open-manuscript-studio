import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

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

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  affiliation: z.string().max(300).nullable().optional(),
  affiliationRorId: z.string().max(128).nullable().optional(),
  orcid: z.string().max(19).nullable().optional(),
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