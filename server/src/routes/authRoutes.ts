import { Router } from 'express';
import { z } from 'zod';

import {
  destroySession,
  getUserForSession,
  loginUser,
  registerUser,
} from '../services/authService.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(200),
  affiliation: z.string().max(300).optional(),
  affiliationRorId: z.string().max(128).optional(),
  orcid: z.string().max(19).optional(),
  interfaceLanguage: z.string().max(16).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_NAME = 'omi_session';

function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function setSessionCookie(response: Parameters<typeof authRouter.post>[1] extends never ? never : any, token: string, expiresAt: Date): void {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

authRouter.post('/register', async (request, response) => {
  try {
    const input = registerSchema.parse(request.body);
    const result = await registerUser(input);
    setSessionCookie(response, result.token, result.expiresAt);
    response.status(201).json({ user: result.user });
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
    response.status(200).json({ user: result.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    response.status(401).json({ error: { code: 'LOGIN_FAILED', message } });
  }
});

authRouter.get('/me', async (request, response) => {
  const token = readSessionCookie(request.headers.cookie);
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

authRouter.post('/logout', async (request, response) => {
  const token = readSessionCookie(request.headers.cookie);
  if (token) await destroySession(token);
  response.clearCookie(COOKIE_NAME, { path: '/' });
  response.status(204).end();
});
