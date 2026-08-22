import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
} from 'node:crypto';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { env } from '../config/env.js';
import { getStudioPrincipalByEmail } from '../identity/studioPrincipalBridge.js';
import { identityPrisma } from '../lib/identityPrisma.js';

const scrypt = promisify(scryptCallback);

const RESET_ERROR = 'The password reset link is invalid or has expired.';

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  let user = await identityPrisma.user.findUnique({ where: { email } });

  // Preserve reset support for accounts that predate the separate Identity DB.
  if (!user) {
    const legacy = await getStudioPrincipalByEmail(email);
    if (legacy && legacy.status === 'ACTIVE' && legacy.passwordHash !== 'identity-managed') {
      user = await identityPrisma.user.create({
        data: {
          id: legacy.id,
          email: legacy.email,
          passwordHash: legacy.passwordHash,
          fullName: legacy.fullName,
          affiliation: legacy.affiliation,
          affiliationRorId: legacy.affiliationRorId,
          orcid: legacy.orcid,
          interfaceLanguage: legacy.interfaceLanguage,
          status: legacy.status,
          createdAt: legacy.createdAt,
          lastLoginAt: legacy.lastLoginAt,
        },
      });
    }
  }

  // Do not reveal whether an address exists or whether the account is active.
  if (!user || user.status !== 'ACTIVE') return;

  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
  );

  await identityPrisma.$transaction([
    identityPrisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    }),
    identityPrisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    }),
  ]);

  const resetUrl = new URL(env.FRONTEND_ORIGIN);
  resetUrl.searchParams.set('resetPassword', rawToken);

  await sendPasswordResetMail({
    to: user.email,
    fullName: user.fullName,
    interfaceLanguage: user.interfaceLanguage,
    resetUrl: resetUrl.toString(),
    expiresAt,
  });
}

export async function resetPasswordWithToken(
  rawToken: string,
  password: string,
): Promise<void> {
  validatePassword(password);

  const token = await identityPrisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });

  if (
    !token ||
    token.usedAt ||
    token.expiresAt <= new Date() ||
    token.user.status !== 'ACTIVE'
  ) {
    throw new Error(RESET_ERROR);
  }

  const passwordHash = await hashPassword(password);
  const usedAt = new Date();

  await identityPrisma.$transaction([
    identityPrisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    }),
    identityPrisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt },
    }),
    identityPrisma.passwordResetToken.deleteMany({
      where: {
        userId: token.userId,
        id: { not: token.id },
      },
    }),
    // Password changes invalidate every previously authenticated device.
    identityPrisma.userSession.deleteMany({
      where: { userId: token.userId },
    }),
  ]);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error('The password must contain at least 8 characters.');
  }
  if (!/[A-Za-z]/.test(password)) {
    throw new Error('The password must contain at least one letter.');
  }
  if (!/\d/.test(password)) {
    throw new Error('The password must contain at least one number.');
  }
}

async function sendPasswordResetMail(input: {
  to: string;
  fullName: string;
  interfaceLanguage: string;
  resetUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const locale = input.interfaceLanguage.toLowerCase();
  const copy = locale === 'hu'
    ? {
        subject: 'OMI Studio – jelszó visszaállítása',
        greeting: `Kedves ${input.fullName || 'Felhasználó'}!`,
        intro: 'Jelszó-visszaállítási kérelmet kaptunk az OMI Studio-fiókjához.',
        action: 'Az új jelszó beállításához nyissa meg az alábbi hivatkozást:',
        expiry: `A hivatkozás ${input.expiresAt.toISOString()} időpontig érvényes, és csak egyszer használható.`,
        ignore: 'Ha nem Ön kérte a jelszó visszaállítását, ezt az üzenetet figyelmen kívül hagyhatja.',
      }
    : locale === 'de'
      ? {
          subject: 'OMI Studio – Passwort zurücksetzen',
          greeting: `Guten Tag ${input.fullName || ''}`.trim() + ',',
          intro: 'Für Ihr OMI-Studio-Konto wurde eine Passwortzurücksetzung angefordert.',
          action: 'Öffnen Sie den folgenden Link, um ein neues Passwort festzulegen:',
          expiry: `Der Link ist bis ${input.expiresAt.toISOString()} gültig und kann nur einmal verwendet werden.`,
          ignore: 'Wenn Sie diese Zurücksetzung nicht angefordert haben, können Sie diese Nachricht ignorieren.',
        }
      : {
          subject: 'OMI Studio – reset your password',
          greeting: `Dear ${input.fullName || 'user'},`,
          intro: 'A password reset was requested for your OMI Studio account.',
          action: 'Open the link below to choose a new password:',
          expiry: `The link expires at ${input.expiresAt.toISOString()} and can be used only once.`,
          ignore: 'If you did not request this reset, you can ignore this message.',
        };

  const body = [
    copy.greeting,
    '',
    copy.intro,
    copy.action,
    '',
    input.resetUrl,
    '',
    copy.expiry,
    copy.ignore,
    '',
    'Open Manuscript Studio',
    'https://openmanuscript.org/',
  ].join('\n');

  const message = [
    `From: ${cleanHeader(env.MAIL_FROM)}`,
    `To: ${cleanHeader(input.to)}`,
    `Subject: ${cleanHeader(copy.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '',
  ].join('\r\n');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(env.SENDMAIL_PATH, ['-i', '-t'], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sendmail exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(message);
  });
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
