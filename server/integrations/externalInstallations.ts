import {ExternalInstallationStatus, ExternalPlatform} from '@prisma/client';
import {prisma} from '../db';
import {decryptSecret, encryptSecret} from './secretCrypto';

export interface UpsertExternalInstallationInput {
  installationId: string;
  platform: ExternalPlatform;
  displayName: string;
  baseUrl: string;
  sharedSecret: string;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('External integration base URL must use HTTPS in production.');
  }
  return url.toString().replace(/\/$/, '');
}

export async function upsertExternalInstallation(input: UpsertExternalInstallationInput) {
  const installationId = input.installationId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(installationId)) {
    throw new Error('installationId must be 3–128 characters and use only letters, digits, dot, underscore, colon or hyphen.');
  }

  const secret = input.sharedSecret.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error('Shared secret must be a 64-character hexadecimal value.');
  }

  const encrypted = encryptSecret(secret.toLowerCase());
  const data = {
    platform: input.platform,
    displayName: input.displayName.trim(),
    baseUrl: normalizeBaseUrl(input.baseUrl),
    sharedSecretCiphertext: encrypted.ciphertext,
    sharedSecretIv: encrypted.iv,
    sharedSecretAuthTag: encrypted.authTag,
    status: ExternalInstallationStatus.ACTIVE,
  };

  return prisma.externalInstallation.upsert({
    where: {installationId},
    update: data,
    create: {installationId, ...data},
    select: {
      id: true,
      installationId: true,
      platform: true,
      displayName: true,
      baseUrl: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function getActiveInstallationWithSecret(installationId: string) {
  const record = await prisma.externalInstallation.findUnique({
    where: {installationId},
  });

  if (!record || record.status !== ExternalInstallationStatus.ACTIVE) {
    return null;
  }

  return {
    ...record,
    sharedSecret: decryptSecret({
      ciphertext: record.sharedSecretCiphertext,
      iv: record.sharedSecretIv,
      authTag: record.sharedSecretAuthTag,
    }),
  };
}
