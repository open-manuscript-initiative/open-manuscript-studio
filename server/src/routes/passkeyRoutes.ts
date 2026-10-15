import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { loginUserWithPasskey } from '../services/authService.js';

export const passkeyRouter = Router();

const RP_NAME = 'Open Manuscript Studio';
const FRONTEND_URL = new URL(env.FRONTEND_ORIGIN);
const RP_ID = FRONTEND_URL.hostname;
const ORIGIN = FRONTEND_URL.origin;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const credentialResponseSchema = z.object({
  id: z.string().min(16).max(2048),
  response: z.record(z.string(), z.unknown()),
}).passthrough();
const registrationFinishSchema = z.object({
  challenge: z.string().min(16).max(128),
  response: credentialResponseSchema,
  label: z.string().trim().min(1).max(100).optional(),
});

async function storeChallenge(challenge: string, purpose: 'REGISTRATION' | 'AUTHENTICATION', userId?: string) {
  await identityPrisma.passkeyChallenge.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await identityPrisma.passkeyChallenge.create({
    data: {
      challenge,
      purpose,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      ...(userId ? { userId } : {}),
    },
  });
}

function userHandle(userId: string): string {
  return Buffer.from(userId.replaceAll('-', ''), 'hex').toString('base64url');
}

function respondWithSession(request: Request, response: Response, result: {
  user: unknown;
  token: string;
  expiresAt: Date;
}) {
  response.cookie('omi_session', result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: result.expiresAt,
    path: '/',
  });
  if (request.headers['x-omi-native-client'] === '1') {
    response.status(200).json({
      user: result.user,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
    });
    return;
  }
  response.status(200).json({ user: result.user });
}

passkeyRouter.get('/passkeys', requireSession, async (request: AuthenticatedRequest, response) => {
  const passkeys = await identityPrisma.userPasskey.findMany({
    where: { userId: request.authUserId! },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true, deviceType: true, backedUp: true },
    orderBy: { createdAt: 'asc' },
  });
  response.json({ passkeys: passkeys.map((passkey) => ({
    ...passkey,
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
  })) });
});

passkeyRouter.post('/passkeys/registration/options', requireSession, async (request: AuthenticatedRequest, response) => {
  const user = await identityPrisma.user.findUnique({ where: { id: request.authUserId! } });
  if (!user || user.status !== 'ACTIVE') {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }
  const existing = await identityPrisma.userPasskey.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Buffer.from(user.id.replaceAll('-', ''), 'hex'),
    userName: user.email,
    userDisplayName: user.fullName,
    attestationType: 'none',
    excludeCredentials: existing.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as never,
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'required',
    },
  });
  await storeChallenge(options.challenge, 'REGISTRATION', user.id);
  response.json(options);
});

passkeyRouter.post('/passkeys/registration/verify', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const input = registrationFinishSchema.parse(request.body);
    const clientResponse = input.response as unknown as RegistrationResponseJSON;
    const challenge = await identityPrisma.passkeyChallenge.findFirst({
      where: {
        userId: request.authUserId!,
        challenge: input.challenge,
        purpose: 'REGISTRATION',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new Error('The passkey setup expired. Please try again.');

    const consumed = await identityPrisma.passkeyChallenge.deleteMany({ where: { id: challenge.id } });
    if (consumed.count !== 1) throw new Error('The passkey setup has already been used.');

    const verification = await verifyRegistrationResponse({
      response: clientResponse,
      expectedChallenge: challenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('The device could not verify the passkey.');
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await identityPrisma.userPasskey.create({
      data: {
        userId: request.authUserId!,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        label: input.label?.trim() || 'Passkey',
      },
    });
    response.status(201).json({ ok: true });
  } catch {
    response.status(400).json({ error: {
      code: 'PASSKEY_REGISTRATION_FAILED',
      message: 'The passkey could not be registered. Start setup again and retry.',
    } });
  }
});

passkeyRouter.delete('/passkeys/:passkeyId', requireSession, async (request: AuthenticatedRequest, response) => {
  const passkeyId = z.string().uuid().safeParse(request.params.passkeyId);
  if (!passkeyId.success) {
    response.status(400).json({ error: { code: 'INVALID_PASSKEY_ID', message: 'Invalid passkey identifier.' } });
    return;
  }
  await identityPrisma.userPasskey.deleteMany({ where: { id: passkeyId.data, userId: request.authUserId! } });
  response.status(204).end();
});

passkeyRouter.post('/passkeys/login/options', async (_request, response) => {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
  });
  await storeChallenge(options.challenge, 'AUTHENTICATION');
  response.setHeader('Cache-Control', 'no-store');
  response.json(options);
});

passkeyRouter.post('/passkeys/login/verify', async (request, response) => {
  try {
    const input = z.object({ challenge: z.string().min(16).max(128), response: credentialResponseSchema }).parse(request.body);
    const assertion = input.response as unknown as AuthenticationResponseJSON;
    const [credential, challenge] = await Promise.all([
      identityPrisma.userPasskey.findUnique({ where: { credentialId: assertion.id }, include: { user: true } }),
      identityPrisma.passkeyChallenge.findFirst({
        where: { challenge: input.challenge, purpose: 'AUTHENTICATION', expiresAt: { gt: new Date() } },
      }),
    ]);
    if (!credential || !challenge || credential.user.status !== 'ACTIVE') {
      throw new Error('Passkey sign-in could not be verified.');
    }
    if (assertion.response.userHandle !== userHandle(credential.userId)) {
      throw new Error('Passkey sign-in could not be verified.');
    }
    const consumed = await identityPrisma.passkeyChallenge.deleteMany({ where: { id: challenge.id } });
    if (consumed.count !== 1) throw new Error('Passkey sign-in has already been used.');

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports as never,
      },
    });
    if (!verification.verified) throw new Error('Passkey sign-in could not be verified.');

    await identityPrisma.userPasskey.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    });
    const result = await loginUserWithPasskey(credential.userId);
    respondWithSession(request, response, result);
  } catch {
    response.status(401).json({ error: {
      code: 'PASSKEY_LOGIN_FAILED',
      message: 'Passkey sign-in could not be verified. Try again or use another sign-in method.',
    } });
  }
});
