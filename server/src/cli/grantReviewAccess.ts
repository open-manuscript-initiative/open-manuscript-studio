import 'dotenv/config';

import { prisma } from '../lib/prisma.js';

const [workspaceIdRaw, manuscriptIdRaw, emailRaw, roleRaw] = process.argv.slice(2);

const workspaceId = workspaceIdRaw?.trim();
const manuscriptId = manuscriptIdRaw?.trim();
const email = emailRaw?.trim().toLowerCase();
const role = roleRaw?.trim().toUpperCase();

if (!workspaceId || !manuscriptId || !email || !role) {
  console.error(
    'Usage: npm run review:grant -- <workspaceId> <manuscriptId> <userEmail> <AUTHOR|EDITOR>',
  );
  process.exitCode = 1;
} else if (role !== 'AUTHOR' && role !== 'EDITOR') {
  console.error('Role must be AUTHOR or EDITOR.');
  process.exitCode = 1;
} else {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No user account exists for ${email}.`);

    const access = await prisma.reviewWorkspaceAccess.upsert({
      where: {
        workspaceId_userId_role: {
          workspaceId,
          userId: user.id,
          role,
        },
      },
      create: {
        workspaceId,
        manuscriptId,
        userId: user.id,
        role,
      },
      update: { manuscriptId },
    });

    console.log(
      `Granted ${access.role} review access to ${email} for workspace ${workspaceId}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unable to grant review access.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
