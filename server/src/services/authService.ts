import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

import { prisma } from '../lib/prisma.js';

const scrypt = promisify(scryptCallback);
const SESSION_TTL_DAYS = 30;

export interface RegisterUserInput {
  email: string;
  password: string;
  fullName: string;
  affiliation?: string;
  affiliationRorId?: string;
  orcid?: string;
  interfaceLanguage?: string;
}

export interface UpdateUserInput {
  fullName?: string;
  affiliation?: string | null;
  affiliationRorId?: string | null;
  orcid?: string | null;
  interfaceLanguage?: string;
}

export interface LoginUserInput {
  email: string;
  password: string;
}

export async function registerUser(input: RegisterUserInput) {
  const email = normalizeEmail(input.email);
  validateEmail(email);
  validatePassword(input.password);

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error('The user name is required.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('An account already exists with this e-mail address.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      affiliation: cleanOptional(input.affiliation),
      affiliationRorId: cleanOptional(input.affiliationRorId),
      orcid: normalizeOptionalOrcid(input.orcid),
      interfaceLanguage: cleanOptional(input.interfaceLanguage)?.toLowerCase() ?? 'en',
      status: 'ACTIVE',
    },
  });

  const session = await createSession(user.id);
  return { user: serializeUser(user), ...session };
}

export async function loginUser(input: LoginUserInput) {
  const email = normalizeEmail(input.email);
  validateEmail(email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error('Incorrect e-mail address or password.');
  }
  if (user.status !== 'ACTIVE') {
    throw new Error('The user account is not active.');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  const session = await createSession(updated.id);
  return { user: serializeUser(updated), ...session };
}

export async function getUserForSession(rawToken: string) {
  const session = await getActiveSession(rawToken);
  return session ? serializeUser(session.user) : null;
}

export async function updateUserForSession(
  rawToken: string,
  input: UpdateUserInput,
) {
  const session = await getActiveSession(rawToken);
  if (!session) return null;

  const data: {
    fullName?: string;
    affiliation?: string | null;
    affiliationRorId?: string | null;
    orcid?: string | null;
    interfaceLanguage?: string;
  } = {};

  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim();
    if (!fullName) throw new Error('The user name is required.');
    data.fullName = fullName;
  }

  if (input.affiliation !== undefined) {
    data.affiliation = cleanNullable(input.affiliation);
  }

  if (input.affiliationRorId !== undefined) {
    data.affiliationRorId = cleanNullable(input.affiliationRorId);
  }

  if (input.orcid !== undefined) {
    data.orcid = normalizeNullableOrcid(input.orcid);
  }

  if (input.interfaceLanguage !== undefined) {
    const interfaceLanguage = input.interfaceLanguage.trim().toLowerCase();
    if (!interfaceLanguage) {
      throw new Error('The interface language is required.');
    }
    data.interfaceLanguage = interfaceLanguage;
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
  });

  return serializeUser(user);
}

export async function destroySession(rawToken: string): Promise<void> {
  await prisma.userSession.deleteMany({
    where: { tokenHash: hashSessionToken(rawToken) },
  });
}

async function getActiveSession(rawToken: string) {
  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
    if (session) {
      await prisma.userSession.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  return session;
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  });
  return { token, expiresAt };
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function serializeUser(user: {
  id: string;
  email: string;
  fullName: string;
  affiliation: string | null;
  affiliationRorId: string | null;
  orcid: string | null;
  interfaceLanguage: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: true,
    status: user.status.toLowerCase(),
    profile: {
      fullName: user.fullName,
      affiliation: user.affiliation ?? undefined,
      affiliationRorId: user.affiliationRorId ?? undefined,
      orcid: user.orcid ?? undefined,
    },
    preferences: {
      interfaceLanguage: user.interfaceLanguage,
      workingLanguages: [],
    },
    identities: [],
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString(),
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function cleanNullable(value: string | null): string | null {
  if (value === null) return null;
  return value.trim() || null;
}

function normalizeOptionalOrcid(value?: string): string | undefined {
  const normalized = value
    ?.trim()
    .replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, '')
    .toUpperCase();
  return normalized || undefined;
}

function normalizeNullableOrcid(value: string | null): string | null {
  if (value === null) return null;
  return normalizeOptionalOrcid(value) ?? null;
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid e-mail address.');
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) throw new Error('The password must contain at least 8 characters.');
  if (!/[A-Za-z]/.test(password)) throw new Error('The password must contain at least one letter.');
  if (!/\d/.test(password)) throw new Error('The password must contain at least one number.');
}
