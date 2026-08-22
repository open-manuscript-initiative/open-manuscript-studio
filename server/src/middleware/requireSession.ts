import type { NextFunction, Request, Response } from 'express';

import { getUserIdForSession } from '../services/authService.js';

const COOKIE_NAME = 'omi_session';

export interface AuthenticatedRequest extends Request<Record<string, string>> {
  authUserId?: string;
}

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
  if (!value.toLowerCase().startsWith('bearer ')) return undefined;
  return value.slice(7).trim() || undefined;
}

export async function requireSession(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearerToken(request.headers.authorization)
    ?? readSessionCookie(request.headers.cookie);
  if (!token) {
    response.status(401).json({
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
    return;
  }

  const userId = await getUserIdForSession(token);
  if (!userId) {
    response.status(401).json({
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
    return;
  }

  request.authUserId = userId;
  next();
}
