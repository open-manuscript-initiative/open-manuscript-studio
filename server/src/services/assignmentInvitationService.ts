import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export interface AssignmentInvitationDetails {
  email: string;
  fullName: string;
  expiresAt: string;
}

export async function issueAssignmentInvitation(input: {
  userId: string;
  email: string;
  fullName: string;
  assignmentType: 'SCIENTIFIC_REVIEW' | 'LANGUAGE_REVIEW' | 'TRANSLATION';
}): Promise<{ sent: boolean; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.INVITATION_TTL_HOURS * 60 * 60 * 1000);

  const invitation = await prisma.userInvitation.create({
    data: {
      userId: input.userId,
      tokenHash,
      expiresAt,
    },
  });

  const inviteUrl = new URL(env.FRONTEND_ORIGIN);
  inviteUrl.searchParams.set('invite', rawToken);

  let sent = false;
  try {
    await sendInvitationMail({
      to: input.email,
      fullName: input.fullName,
      assignmentType: input.assignmentType,
      inviteUrl: inviteUrl.toString(),
      expiresAt,
    });
    sent = true;
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { sentAt: new Date() },
    });
  } catch (error) {
    console.error('[OMI assignment invitation] mail delivery failed', error);
  }

  return { sent, expiresAt };
}

export async function getAssignmentInvitation(rawToken: string): Promise<AssignmentInvitationDetails | null> {
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });
  if (
    !invitation ||
    invitation.usedAt ||
    invitation.expiresAt <= new Date() ||
    invitation.user.status !== 'PENDING'
  ) {
    return null;
  }
  return {
    email: invitation.user.email,
    fullName: invitation.user.fullName,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export async function consumeAssignmentInvitation(rawToken: string): Promise<{
  invitationId: string;
  userId: string;
  email: string;
} | null> {
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });
  if (
    !invitation ||
    invitation.usedAt ||
    invitation.expiresAt <= new Date() ||
    invitation.user.status !== 'PENDING'
  ) {
    return null;
  }
  return {
    invitationId: invitation.id,
    userId: invitation.userId,
    email: invitation.user.email,
  };
}

export function pendingPasswordPlaceholder(): string {
  return `invited:${randomBytes(32).toString('hex')}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function sendInvitationMail(input: {
  to: string;
  fullName: string;
  assignmentType: 'SCIENTIFIC_REVIEW' | 'LANGUAGE_REVIEW' | 'TRANSLATION';
  inviteUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const role = roleLabel(input.assignmentType);
  const to = cleanHeader(input.to);
  const from = cleanHeader(env.MAIL_FROM);
  const subject = `Open Manuscript Studio invitation – ${role}`;
  const body = [
    `Dear ${input.fullName || 'colleague'},`,
    '',
    `You have been invited to Open Manuscript Studio as ${role}.`,
    'Create or activate your Studio account with the link below. The invitation is tied to your e-mail address and cannot be used for another account.',
    '',
    input.inviteUrl,
    '',
    `This invitation expires on ${input.expiresAt.toISOString()}.`,
    '',
    'Open Manuscript Studio',
    'https://openmanuscript.org/',
  ].join('\n');

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
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

function roleLabel(type: 'SCIENTIFIC_REVIEW' | 'LANGUAGE_REVIEW' | 'TRANSLATION'): string {
  if (type === 'SCIENTIFIC_REVIEW') return 'a scientific reviewer';
  if (type === 'LANGUAGE_REVIEW') return 'a language reviewer';
  return 'a translator';
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
