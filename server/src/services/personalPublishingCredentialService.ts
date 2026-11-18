import { PublicationVenueIntegrationProvider } from '../generated/identity-prisma/client.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import {
  decryptSecret,
  type EncryptedSecret,
} from '../integrations/secretCrypto.js';
function normalizeProfileEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePublishingBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}
async function resolvePersonalPublishingCredential(
  userId: string,
  provider: PublicationVenueIntegrationProvider,
  baseUrl: string,
  email?: string,
): Promise<{ apiKey: string; baseUrl: string; email: string } | null> {
  const normalizedBaseUrl = normalizePublishingBaseUrl(baseUrl);
  const normalizedEmail = email ? normalizeProfileEmail(email) : undefined;

  let credential = await identityPrisma.personalPublishingCredential.findFirst({
    where: {
      userId,
      provider,
      baseUrl: normalizedBaseUrl,
      profileEmail: normalizedEmail
        ? { email: normalizedEmail }
        : { isPrimary: true },
    },
    include: { profileEmail: true },
  });

  if (!credential && !normalizedEmail) {
    credential = await identityPrisma.personalPublishingCredential.findFirst({
      where: {
        userId,
        provider,
        baseUrl: normalizedBaseUrl,
      },
      include: { profileEmail: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!credential) return null;

  return {
    apiKey: decryptSecret({
      ciphertext: credential.apiKeyCiphertext,
      iv: credential.apiKeyIv,
      authTag: credential.apiKeyAuthTag,
    } as EncryptedSecret),
    baseUrl: credential.baseUrl,
    email: credential.profileEmail.email,
  };
}

export async function resolvePersonalOjsCredential(
  userId: string,
  baseUrl: string,
  email?: string,
): Promise<{ apiKey: string; baseUrl: string; email: string } | null> {
  return resolvePersonalPublishingCredential(
    userId,
    PublicationVenueIntegrationProvider.OJS,
    baseUrl,
    email,
  );
}

export async function resolvePersonalOmpCredential(
  userId: string,
  baseUrl: string,
  email?: string,
): Promise<{ apiKey: string; baseUrl: string; email: string } | null> {
  return resolvePersonalPublishingCredential(
    userId,
    PublicationVenueIntegrationProvider.OMP,
    baseUrl,
    email,
  );
}
