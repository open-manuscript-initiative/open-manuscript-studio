import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify as verifySignature,
} from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export const authorSignatureRouter = Router();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const ORIGIN = new URL(env.FRONTEND_ORIGIN).origin;
const RP_ID = new URL(env.FRONTEND_ORIGIN).hostname;

const registrationSchema = z.object({
  challenge: z.string().min(16).max(512),
  credentialId: z.string().min(16).max(1024),
  publicKeySpki: z.string().min(32).max(8192),
  clientDataJSON: z.string().min(16).max(8192),
  label: z.string().max(200).optional(),
});

const signingStartSchema = z.object({
  manuscriptId: z.string().min(1).max(128),
  revisionId: z.string().min(1).max(128),
  stateDigest: z.string().regex(/^[a-f0-9]{64}$/i),
  signerAgentId: z.string().min(1).max(128),
  signerName: z.string().min(1).max(200),
});

const signingFinishSchema = z.object({
  challenge: z.string().min(16).max(512),
  credentialId: z.string().min(16).max(1024),
  clientDataJSON: z.string().min(16).max(8192),
  authenticatorData: z.string().min(16).max(8192),
  signature: z.string().min(16).max(8192),
});

interface CredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key_spki: string;
  algorithm: string;
}

interface ChallengeRow {
  id: string;
  user_id: string;
  payload_hash: string | null;
  payload_json: unknown;
  nonce: string | null;
  expires_at: Date;
}

interface SigningPayload {
  model: 'OMI-PUBLICATION-SIGNATURE';
  version: '0.1.0';
  manuscriptId: string;
  revisionId: string;
  stateDigest: {
    algorithm: 'sha256';
    value: string;
    canonicalization: 'omi-manuscript-state-json-v1';
    scope: 'revision.snapshot.state';
  };
  signer: {
    agentId: string;
    displayName: string;
    identityProvider: 'ORCID';
    issuer: string;
    subject: string;
    orcid: string;
  };
  signedAt: string;
}

authorSignatureRouter.get('/signatures/status', async (request, response) => {
  const identity = await authenticatedOrcidIdentity(request.headers.cookie);
  if (!identity) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication with a linked ORCID iD is required.' } });
    return;
  }

  const credentials = await credentialRows(identity.userId);
  response.status(200).json({
    identity: {
      provider: 'ORCID',
      issuer: identity.issuer,
      subject: identity.subject,
      orcid: identity.subject,
      displayName: identity.displayName,
    },
    credentials: credentials.map((credential) => ({
      credentialId: credential.credential_id,
      algorithm: credential.algorithm,
    })),
  });
});

authorSignatureRouter.post('/signatures/credentials/challenge', async (request, response) => {
  const identity = await authenticatedOrcidIdentity(request.headers.cookie);
  if (!identity) {
    response.status(401).json({ error: { code: 'ORCID_IDENTITY_REQUIRED', message: 'Link and authenticate an ORCID iD before registering a signing credential.' } });
    return;
  }

  const challenge = randomBytes(32).toString('base64url');
  await insertChallenge(identity.userId, challenge, 'REGISTER');
  response.status(200).json({ challenge, rpId: RP_ID, userId: identity.userId, userName: identity.displayName || identity.subject });
});

authorSignatureRouter.post('/signatures/credentials', async (request, response) => {
  try {
    const identity = await authenticatedOrcidIdentity(request.headers.cookie);
    if (!identity) {
      response.status(401).json({ error: { code: 'ORCID_IDENTITY_REQUIRED', message: 'A linked ORCID identity is required.' } });
      return;
    }
    const input = registrationSchema.parse(request.body);
    const challenge = await consumeChallenge(identity.userId, input.challenge, 'REGISTER');
    if (!challenge) throw new Error('The signing credential challenge is invalid or expired.');
    verifyClientData(input.clientDataJSON, input.challenge, 'webauthn.create');

    const publicKeyDer = fromBase64Url(input.publicKeySpki);
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    if (publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw new Error('Only P-256 WebAuthn signing credentials are currently supported.');
    }

    const existing = await credentialById(input.credentialId);
    if (existing && existing.user_id !== identity.userId) {
      throw new Error('This signing credential is already bound to another account.');
    }

    if (existing) {
      await prisma.$executeRaw`
        UPDATE author_signing_credentials
        SET public_key_spki = ${input.publicKeySpki}, label = ${input.label ?? null}
        WHERE id = ${existing.id}::uuid
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO author_signing_credentials
          (id, user_id, credential_id, public_key_spki, algorithm, label)
        VALUES
          (${randomUUID()}::uuid, ${identity.userId}::uuid, ${input.credentialId}, ${input.publicKeySpki}, 'ES256', ${input.label ?? null})
      `;
    }

    response.status(201).json({ credentialId: input.credentialId, algorithm: 'ES256' });
  } catch (error) {
    response.status(400).json({ error: { code: 'SIGNING_CREDENTIAL_REGISTRATION_FAILED', message: error instanceof Error ? error.message : 'Signing credential registration failed.' } });
  }
});

authorSignatureRouter.post('/signatures/sign/challenge', async (request, response) => {
  try {
    const identity = await authenticatedOrcidIdentity(request.headers.cookie);
    if (!identity) {
      response.status(401).json({ error: { code: 'ORCID_IDENTITY_REQUIRED', message: 'Authenticate with the ORCID iD linked to the author before signing.' } });
      return;
    }
    const input = signingStartSchema.parse(request.body);
    const credentials = await credentialRows(identity.userId);
    if (credentials.length === 0) {
      response.status(409).json({ error: { code: 'SIGNING_CREDENTIAL_REQUIRED', message: 'Register a signing credential before signing.' } });
      return;
    }

    const payload: SigningPayload = {
      model: 'OMI-PUBLICATION-SIGNATURE',
      version: '0.1.0',
      manuscriptId: input.manuscriptId,
      revisionId: input.revisionId,
      stateDigest: {
        algorithm: 'sha256',
        value: input.stateDigest.toLowerCase(),
        canonicalization: 'omi-manuscript-state-json-v1',
        scope: 'revision.snapshot.state',
      },
      signer: {
        agentId: input.signerAgentId,
        displayName: input.signerName,
        identityProvider: 'ORCID',
        issuer: identity.issuer,
        subject: identity.subject,
        orcid: identity.subject,
      },
      signedAt: new Date().toISOString(),
    };
    const nonce = randomBytes(24).toString('base64url');
    const payloadHash = sha256(canonicalJson(payload));
    const challenge = createSigningChallenge(payload, nonce);
    await insertChallenge(identity.userId, challenge, 'SIGN', payloadHash, payload, nonce);

    response.status(200).json({
      challenge,
      rpId: RP_ID,
      payload,
      nonce,
      credentialIds: credentials.map((credential) => credential.credential_id),
    });
  } catch (error) {
    response.status(400).json({ error: { code: 'SIGNING_CHALLENGE_FAILED', message: error instanceof Error ? error.message : 'Could not prepare the signature.' } });
  }
});

authorSignatureRouter.post('/signatures/sign', async (request, response) => {
  try {
    const identity = await authenticatedOrcidIdentity(request.headers.cookie);
    if (!identity) {
      response.status(401).json({ error: { code: 'ORCID_IDENTITY_REQUIRED', message: 'A linked ORCID identity is required.' } });
      return;
    }
    const input = signingFinishSchema.parse(request.body);
    const challengeRow = await consumeChallenge(identity.userId, input.challenge, 'SIGN');
    if (!challengeRow || !challengeRow.payload_json || !challengeRow.nonce) {
      throw new Error('The manuscript signing challenge is invalid or expired.');
    }
    const payload = challengeRow.payload_json as SigningPayload;
    const expectedPayloadHash = sha256(canonicalJson(payload));
    if (challengeRow.payload_hash !== expectedPayloadHash || createSigningChallenge(payload, challengeRow.nonce) !== input.challenge) {
      throw new Error('The signable publication payload was altered.');
    }

    const credential = await credentialById(input.credentialId);
    if (!credential || credential.user_id !== identity.userId) throw new Error('The signing credential is not registered to this account.');
    if (payload.signer.subject !== identity.subject || payload.signer.issuer !== identity.issuer) throw new Error('The signing identity no longer matches the prepared payload.');

    const clientDataBytes = fromBase64Url(input.clientDataJSON);
    verifyClientData(input.clientDataJSON, input.challenge, 'webauthn.get');
    const authenticatorData = fromBase64Url(input.authenticatorData);
    verifyAuthenticatorData(authenticatorData);
    const signedBytes = Buffer.concat([authenticatorData, createHash('sha256').update(clientDataBytes).digest()]);
    const publicKey = createPublicKey({ key: fromBase64Url(credential.public_key_spki), format: 'der', type: 'spki' });
    if (!verifySignature('sha256', signedBytes, publicKey, fromBase64Url(input.signature))) {
      throw new Error('The WebAuthn signature could not be verified.');
    }

    const evidenceId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO publication_signature_evidence
        (id, user_id, signing_credential_id, manuscript_id, revision_id, state_digest, signer_agent_id, signer_name, signer_orcid, identity_issuer, signed_payload, nonce, authenticator_data, client_data_json, signature)
      VALUES
        (${evidenceId}::uuid, ${identity.userId}::uuid, ${credential.id}::uuid, ${payload.manuscriptId}, ${payload.revisionId}, ${payload.stateDigest.value}, ${payload.signer.agentId}, ${payload.signer.displayName}, ${payload.signer.orcid}, ${payload.signer.issuer}, ${JSON.stringify(payload)}::jsonb, ${challengeRow.nonce}, ${input.authenticatorData}, ${input.clientDataJSON}, ${input.signature})
    `;
    await prisma.$executeRaw`UPDATE author_signing_credentials SET last_used_at = CURRENT_TIMESTAMP WHERE id = ${credential.id}::uuid`;

    response.status(201).json({
      signature: {
        model: 'OMI-PUBLICATION-SIGNATURE',
        version: '0.1.0',
        signatureId: evidenceId,
        payload,
        credential: {
          credentialId: credential.credential_id,
          algorithm: 'ES256',
          publicKeySpki: credential.public_key_spki,
        },
        evidence: {
          format: 'webauthn-assertion',
          origin: ORIGIN,
          rpId: RP_ID,
          nonce: challengeRow.nonce,
          challenge: input.challenge,
          authenticatorData: input.authenticatorData,
          clientDataJSON: input.clientDataJSON,
          signature: input.signature,
        },
        identityBinding: {
          provider: 'ORCID',
          issuer: identity.issuer,
          subject: identity.subject,
          verification: 'server-authenticated-session',
        },
      },
      verification: { cryptographic: 'verified', identity: 'verified', currentRevision: payload.revisionId },
    });
  } catch (error) {
    response.status(400).json({ error: { code: 'PUBLICATION_SIGNING_FAILED', message: error instanceof Error ? error.message : 'Publication signing failed.' } });
  }
});

async function authenticatedOrcidIdentity(cookieHeader: string | undefined) {
  const token = readSessionCookie(cookieHeader);
  if (!token) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  const identity = await prisma.userIdentity.findFirst({
    where: { userId: session.userId, provider: 'ORCID' },
    orderBy: { lastUsedAt: 'desc' },
  });
  if (!identity) return null;
  return { userId: session.userId, issuer: identity.issuer, subject: identity.subject, displayName: identity.displayName ?? session.user.fullName };
}

function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'omi_session') return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

async function credentialRows(userId: string): Promise<CredentialRow[]> {
  return prisma.$queryRaw<CredentialRow[]>`
    SELECT id, user_id, credential_id, public_key_spki, algorithm
    FROM author_signing_credentials
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at ASC
  `;
}

async function credentialById(credentialId: string): Promise<CredentialRow | undefined> {
  const rows = await prisma.$queryRaw<CredentialRow[]>`
    SELECT id, user_id, credential_id, public_key_spki, algorithm
    FROM author_signing_credentials
    WHERE credential_id = ${credentialId}
    LIMIT 1
  `;
  return rows[0];
}

async function insertChallenge(userId: string, challenge: string, purpose: 'REGISTER' | 'SIGN', payloadHash: string | null = null, payload: unknown = null, nonce: string | null = null): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO author_signing_challenges
      (id, user_id, challenge_hash, purpose, payload_hash, payload_json, nonce, expires_at)
    VALUES
      (${randomUUID()}::uuid, ${userId}::uuid, ${sha256(challenge)}, ${purpose}, ${payloadHash}, ${payload === null ? null : JSON.stringify(payload)}::jsonb, ${nonce}, ${new Date(Date.now() + CHALLENGE_TTL_MS)})
  `;
}

async function consumeChallenge(userId: string, challenge: string, purpose: 'REGISTER' | 'SIGN'): Promise<ChallengeRow | undefined> {
  const rows = await prisma.$queryRaw<ChallengeRow[]>`
    DELETE FROM author_signing_challenges
    WHERE challenge_hash = ${sha256(challenge)}
      AND user_id = ${userId}::uuid
      AND purpose = ${purpose}
      AND expires_at > CURRENT_TIMESTAMP
    RETURNING id, user_id, payload_hash, payload_json, nonce, expires_at
  `;
  return rows[0];
}

function verifyClientData(clientDataBase64Url: string, expectedChallenge: string, expectedType: 'webauthn.create' | 'webauthn.get'): void {
  const clientData = JSON.parse(fromBase64Url(clientDataBase64Url).toString('utf8')) as { type?: string; challenge?: string; origin?: string };
  if (clientData.type !== expectedType || clientData.challenge !== expectedChallenge || clientData.origin !== ORIGIN) {
    throw new Error('The WebAuthn client data does not match this Studio installation or signing ceremony.');
  }
}

function verifyAuthenticatorData(authenticatorData: Buffer): void {
  if (authenticatorData.length < 37) throw new Error('Invalid WebAuthn authenticator data.');
  const expectedRpIdHash = createHash('sha256').update(RP_ID).digest();
  if (!authenticatorData.subarray(0, 32).equals(expectedRpIdHash)) throw new Error('The authenticator RP ID does not match this Studio installation.');
  const flags = authenticatorData[32] ?? 0;
  if ((flags & 0x01) === 0 || (flags & 0x04) === 0) throw new Error('User presence and user verification are required for publication signing.');
}

function createSigningChallenge(payload: SigningPayload, nonce: string): string {
  return createHash('sha256').update(`${canonicalJson(payload)}\n${nonce}`).digest('base64url');
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
