import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  randomUUID,
  sign as signBytes,
} from 'node:crypto';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecret,
} from '../integrations/secretCrypto.js';

export const PUBLICATION_SIGNATURE_MODEL = 'OMI-PUBLICATION-SIGNATURE' as const;
export const PUBLICATION_SIGNATURE_VERSION = '0.2.0' as const;
export const CREDENTIAL_ATTESTATION_MODEL = 'OMI-SIGNING-CREDENTIAL-ATTESTATION' as const;
export const CREDENTIAL_ATTESTATION_VERSION = '0.1.0' as const;
export const STATE_CANONICALIZATION = 'omi-manuscript-state-json-v1' as const;

interface IssuerKeyRow {
  id: string;
  issuer: string;
  key_id: string;
  public_key_spki: string;
  encrypted_private_key: string;
  algorithm: string;
}

export interface VerifiedSigningIdentity {
  userId: string;
  issuer: string;
  subject: string;
  displayName: string;
}

export interface OmiCredentialAttestation {
  model: typeof CREDENTIAL_ATTESTATION_MODEL;
  version: typeof CREDENTIAL_ATTESTATION_VERSION;
  protected: string;
  payload: string;
  signature: string;
  issuerKey: {
    issuer: string;
    keyId: string;
    algorithm: 'Ed25519';
    publicKeySpki: string;
    fingerprint: string;
  };
}

export interface CredentialAttestationPayload {
  model: typeof CREDENTIAL_ATTESTATION_MODEL;
  version: typeof CREDENTIAL_ATTESTATION_VERSION;
  issuer: string;
  issuedAt: string;
  credential: {
    credentialId: string;
    algorithm: 'ES256';
    publicKeySpki: string;
  };
  identity: {
    provider: 'ORCID';
    issuer: string;
    subject: string;
    displayName: string;
  };
}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error('Canonical JSON cannot contain non-finite numbers.');
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'undefined':
      return 'null';
    case 'object': {
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object)
        .filter((key) => object[key] !== undefined)
        .sort(compareCodeUnits)
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
        .join(',')}}`;
    }
    default:
      throw new Error(`Canonical JSON contains unsupported ${typeof value} data.`);
  }
}

export function calculatePortableStateDigest(state: unknown): string {
  return sha256(canonicalJson(normalizeStateForDigest(state)));
}

export function assertSignerIsAuthor(
  state: unknown,
  manuscriptId: string,
  signerAgentId: string,
  identity: VerifiedSigningIdentity,
): { signerName: string; orcid: string } {
  const root = asRecord(state);
  if (!root || root.id !== manuscriptId) {
    throw new Error('The committed revision does not belong to the requested manuscript.');
  }

  const contributions = Array.isArray(root.contributions) ? root.contributions : [];
  const authorContribution = contributions
    .map(asRecord)
    .find((contribution) =>
      contribution?.agentId === signerAgentId &&
      contribution.targetId === manuscriptId &&
      Array.isArray(contribution.roles) &&
      contribution.roles.includes('author'),
    );
  if (!authorContribution) {
    throw new Error('The authenticated signer is not an author of this committed revision.');
  }

  const agents = Array.isArray(root.agents) ? root.agents : [];
  const agent = agents.map(asRecord).find((candidate) => candidate?.id === signerAgentId);
  if (!agent) {
    throw new Error('The signer agent is missing from the committed revision.');
  }

  const identityOrcid = normalizeOrcid(identity.subject);
  const identifiers = Array.isArray(agent.identifiers) ? agent.identifiers : [];
  const hasAuthenticatedOrcid = identifiers
    .map(asRecord)
    .some((identifier) => {
      if (String(identifier?.scheme ?? '').toLowerCase() !== 'orcid') return false;
      const value = String(identifier?.normalizedValue ?? identifier?.value ?? '');
      return normalizeOrcid(value) === identityOrcid;
    });

  if (!identityOrcid || !hasAuthenticatedOrcid) {
    throw new Error('The committed author identity does not match the authenticated ORCID iD.');
  }

  const names = Array.isArray(agent.names)
    ? agent.names.map(asRecord).filter((name): name is Record<string, unknown> => Boolean(name))
    : [];
  const preferred = names.find((name) => name.preferred === true) ?? names[0];
  const signerName = typeof preferred?.value === 'string' && preferred.value.trim()
    ? preferred.value.trim()
    : identity.displayName;

  return { signerName, orcid: identityOrcid };
}

export async function getSignatureIssuerDescriptor() {
  const issuerKey = await getOrCreateIssuerKey();
  const publicKeyBytes = Buffer.from(issuerKey.public_key_spki, 'base64url');
  return {
    model: 'OMI-SIGNATURE-ISSUER',
    version: '0.1.0',
    issuer: issuerKey.issuer,
    keyId: issuerKey.key_id,
    algorithm: 'Ed25519' as const,
    publicKeySpki: issuerKey.public_key_spki,
    fingerprint: sha256(publicKeyBytes),
  };
}

export async function createCredentialAttestation(input: {
  credentialId: string;
  publicKeySpki: string;
  identity: VerifiedSigningIdentity;
}): Promise<OmiCredentialAttestation> {
  const issuerKey = await getOrCreateIssuerKey();
  const payload: CredentialAttestationPayload = {
    model: CREDENTIAL_ATTESTATION_MODEL,
    version: CREDENTIAL_ATTESTATION_VERSION,
    issuer: issuerKey.issuer,
    issuedAt: new Date().toISOString(),
    credential: {
      credentialId: input.credentialId,
      algorithm: 'ES256',
      publicKeySpki: input.publicKeySpki,
    },
    identity: {
      provider: 'ORCID',
      issuer: input.identity.issuer,
      subject: input.identity.subject,
      displayName: input.identity.displayName,
    },
  };
  const protectedHeader = {
    alg: 'EdDSA',
    typ: 'omi-signing-credential-attestation+jws',
    kid: issuerKey.key_id,
  };
  const protectedEncoded = base64Url(canonicalJson(protectedHeader));
  const payloadEncoded = base64Url(canonicalJson(payload));
  const signingInput = Buffer.from(`${protectedEncoded}.${payloadEncoded}`, 'ascii');
  const privateKey = createPrivateKey({
    key: Buffer.from(decryptPrivateKey(issuerKey.encrypted_private_key), 'base64url'),
    format: 'der',
    type: 'pkcs8',
  });
  const signature = signBytes(null, signingInput, privateKey).toString('base64url');
  const publicKeyBytes = Buffer.from(issuerKey.public_key_spki, 'base64url');

  return {
    model: CREDENTIAL_ATTESTATION_MODEL,
    version: CREDENTIAL_ATTESTATION_VERSION,
    protected: protectedEncoded,
    payload: payloadEncoded,
    signature,
    issuerKey: {
      issuer: issuerKey.issuer,
      keyId: issuerKey.key_id,
      algorithm: 'Ed25519',
      publicKeySpki: issuerKey.public_key_spki,
      fingerprint: sha256(publicKeyBytes),
    },
  };
}

async function getOrCreateIssuerKey(): Promise<IssuerKeyRow> {
  const existing = await activeIssuerKey();
  if (existing) return existing;

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
  const privateKeyDer = privateKey.export({ format: 'der', type: 'pkcs8' });
  const fingerprint = sha256(publicKeyDer);
  const keyId = `omi-ed25519-${fingerprint.slice(0, 32)}`;
  const issuer = new URL(env.FRONTEND_ORIGIN).origin;
  const encryptedPrivateKey = JSON.stringify(
    encryptSecret(privateKeyDer.toString('base64url')),
  );

  try {
    await prisma.$executeRaw`
      INSERT INTO signature_issuer_keys
        (id, issuer, key_id, public_key_spki, encrypted_private_key, algorithm, active)
      VALUES
        (${randomUUID()}::uuid, ${issuer}, ${keyId}, ${publicKeyDer.toString('base64url')}, ${encryptedPrivateKey}, 'Ed25519', TRUE)
    `;
  } catch {
    const raced = await activeIssuerKey();
    if (raced) return raced;
    throw new Error('Could not initialize the installation publication-signature issuer key.');
  }

  const created = await activeIssuerKey();
  if (!created) {
    throw new Error('Could not load the installation publication-signature issuer key.');
  }
  return created;
}

async function activeIssuerKey(): Promise<IssuerKeyRow | undefined> {
  const rows = await prisma.$queryRaw<IssuerKeyRow[]>`
    SELECT id, issuer, key_id, public_key_spki, encrypted_private_key, algorithm
    FROM signature_issuer_keys
    WHERE active = TRUE
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0];
}

function decryptPrivateKey(serialized: string): string {
  const parsed = JSON.parse(serialized) as Partial<EncryptedSecret>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
    throw new Error('Stored signature issuer private key is invalid.');
  }
  return decryptSecret(parsed as EncryptedSecret);
}

function normalizeStateForDigest(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeStateForDigest);
  if (!value || typeof value !== 'object') return value;

  const object = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(object)) {
    normalized[key] = normalizeStateForDigest(child);
  }

  const visual = asRecord(normalized.visual);
  if (visual?.kind === 'image' && typeof visual.assetId === 'string' && visual.assetId) {
    normalized.visual = { ...visual, src: '' };
  }
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizeOrcid(value: string): string {
  const normalized = value
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(normalized) ? normalized : '';
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
