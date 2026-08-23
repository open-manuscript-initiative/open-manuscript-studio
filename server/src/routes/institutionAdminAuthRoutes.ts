import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import {
  destroySession,
  loginUser,
} from '../services/authService.js';
import {
  hasInstitutionAdminAccess,
  provisionConfiguredInstitutionOwner,
} from '../services/institutionAccessService.js';

export const institutionAdminAuthRouter = Router();

const COOKIE_NAME = 'omi_session';
const NATIVE_HEADER = 'x-omi-native-client';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

institutionAdminAuthRouter.post('/institution-admin/login', async (request, response) => {
  try {
    const input = loginSchema.parse(request.body);
    const result = await loginUser(input);
    const userId = result.user.id;

    await provisionConfiguredInstitutionOwner(userId);
    if (!(await hasInstitutionAdminAccess(userId))) {
      await destroySession(result.token);
      response.status(403).json({
        error: {
          code: 'INSTITUTION_ADMIN_REQUIRED',
          message: 'This Studio account is not an administrator of an institution.',
        },
      });
      return;
    }

    setSessionCookie(response, result.token, result.expiresAt);
    response.status(200).json(
      isNativeClient(request)
        ? {
            user: result.user,
            token: result.token,
            expiresAt: result.expiresAt.toISOString(),
            institutionAdmin: true,
          }
        : { user: result.user, institutionAdmin: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Institution administrator login failed.';
    response.status(401).json({
      error: {
        code: 'INSTITUTION_ADMIN_LOGIN_FAILED',
        message,
      },
    });
  }
});

function setSessionCookie(response: Response, token: string, expiresAt: Date): void {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

function isNativeClient(request: Request): boolean {
  return request.headers[NATIVE_HEADER] === '1';
}
