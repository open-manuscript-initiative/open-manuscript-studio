import assert from 'node:assert/strict';
import {
  createHash,
  generateKeyPairSync,
  sign,
} from 'node:crypto';
import test from 'node:test';

import { calculateManuscriptStateDigestValue } from '../src/model/stateDigest.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import type { OmiPublicationSignature } from '../src/services/authorSignatureApi.ts';
import { verifyPortablePublicationSignature } from '../src/services/publicationSignatureVerification.ts';

const ORCID = '0000-0002-1825-0097';
const ISSUER = 'https://studio.example.org';
const RP_ID = 'studio.example.org';

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  switch (typeof value) {
    case 'string': return JSON.stringify(value);
    case 'boolean': return value ? 'true' : 'false';
    case 'number': return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'undefined': return 'null';
    case 'object': {
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
    }
    default: throw new Error('Unsupported value.');
  }
}

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function manuscriptFixture(): OmiManuscript {
  const createdAt = '2026-08-22T12:00:00.000Z';
  const state = {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: 'manuscript-1',
    version: '0.1.0',
    identityModelVersion: 'OMI-SPEC-150@0.1.0',
    locale: 'en',
    title: 'Signed manuscript',
    keywords: [],
    agents: [{
      id: 'agent-1',
      type: 'person',
      names: [{ id: 'name-1', value: 'Ada Example', preferred: true, visibility: 'public' }],
      identifiers: [{
        id: 'orcid-1',
        scheme: 'orcid',
        value: ORCID,
        normalizedValue: ORCID,
        verificationStatus: 'self-asserted',
        visibility: 'public',
      }],
      affiliations: [],
      createdAt,
      updatedAt: createdAt,
    }],
    contributions: [{
      id: 'contribution-1',
      agentId: 'agent-1',
      targetId: 'manuscript-1',
      roles: ['author'],
      visibility: 'public',
      createdAt,
      updatedAt: createdAt,
    }],
    tombstones: [],
    sections: [{ id: 'section-1', title: '', blocks: [{ id: 'block-1', type: 'paragraph', content: 'Portable proof.' }] }],
    annotations: [],
    bibliographicRecords: [],
    citations: [],
    citationClusters: [],
    crossReferences: [],
  } as OmiManuscript['revisionHistory']['revisions'][number]['snapshot']['state'];

  return {
    ...state,
    headRevisionId: 'revision-1',
    revisionHistory: {
      revisions: [{
        id: 'revision-1',
        parentRevisionId: null,
        createdAt,
        snapshot: { state },
      }],
    },
  } as OmiManuscript;
}

function createPortableSignature(manuscript: OmiManuscript) {
  const revision = manuscript.revisionHistory.revisions[0]!;
  const stateDigest = calculateManuscriptStateDigestValue(revision.snapshot.state);
  const { publicKey: issuerPublic, privateKey: issuerPrivate } = generateKeyPairSync('ed25519');
  const { publicKey: credentialPublic, privateKey: credentialPrivate } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const issuerSpki = issuerPublic.export({ format: 'der', type: 'spki' });
  const credentialSpki = credentialPublic.export({ format: 'der', type: 'spki' });
  const fingerprint = createHash('sha256').update(issuerSpki).digest('hex');
  const keyId = `omi-ed25519-${fingerprint.slice(0, 32)}`;
  const credentialId = b64url(Buffer.from('portable-test-credential-id'));

  const attestationPayload = {
    model: 'OMI-SIGNING-CREDENTIAL-ATTESTATION',
    version: '0.1.0',
    issuer: ISSUER,
    issuedAt: '2026-08-22T12:01:00.000Z',
    credential: {
      credentialId,
      algorithm: 'ES256',
      publicKeySpki: credentialSpki.toString('base64url'),
    },
    identity: {
      provider: 'ORCID',
      issuer: 'https://orcid.org',
      subject: ORCID,
      displayName: 'Ada Example',
    },
  };
  const protectedValue = b64url(canonicalJson({ alg: 'EdDSA', typ: 'omi-signing-credential-attestation+jws', kid: keyId }));
  const payloadValue = b64url(canonicalJson(attestationPayload));
  const attestationSignature = sign(null, Buffer.from(`${protectedValue}.${payloadValue}`), issuerPrivate).toString('base64url');

  const nonce = b64url(Buffer.from('portable-nonce'));
  const payload = {
    model: 'OMI-PUBLICATION-SIGNATURE',
    version: '0.2.0',
    manuscriptId: manuscript.id,
    revisionId: revision.id,
    stateDigest: {
      algorithm: 'sha256',
      value: stateDigest,
      canonicalization: 'omi-manuscript-state-json-v1',
      scope: 'revision.snapshot.state',
    },
    signer: {
      agentId: 'agent-1',
      displayName: 'Ada Example',
      identityProvider: 'ORCID',
      issuer: 'https://orcid.org',
      subject: ORCID,
      orcid: ORCID,
    },
    credential: {
      credentialId,
      algorithm: 'ES256',
      issuerAttestationKeyId: keyId,
    },
    signedAt: '2026-08-22T12:02:00.000Z',
  } as const;
  const challenge = createHash('sha256').update(`${canonicalJson(payload)}\n${nonce}`).digest('base64url');
  const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: ISSUER }));
  const rpIdHash = createHash('sha256').update(RP_ID).digest();
  const authenticatorData = Buffer.concat([rpIdHash, Buffer.from([0x05, 0, 0, 0, 0])]);
  const signedData = Buffer.concat([authenticatorData, createHash('sha256').update(clientData).digest()]);
  const assertionSignature = sign('sha256', signedData, { key: credentialPrivate, dsaEncoding: 'der' });

  const signature: OmiPublicationSignature = {
    model: 'OMI-PUBLICATION-SIGNATURE',
    version: '0.2.0',
    signatureId: 'signature-1',
    payload,
    credential: {
      credentialId,
      algorithm: 'ES256',
      publicKeySpki: credentialSpki.toString('base64url'),
      issuerAttestation: {
        model: 'OMI-SIGNING-CREDENTIAL-ATTESTATION',
        version: '0.1.0',
        protected: protectedValue,
        payload: payloadValue,
        signature: attestationSignature,
        issuerKey: {
          issuer: ISSUER,
          keyId,
          algorithm: 'Ed25519',
          publicKeySpki: issuerSpki.toString('base64url'),
          fingerprint,
        },
      },
    },
    evidence: {
      format: 'webauthn-assertion',
      origin: ISSUER,
      rpId: RP_ID,
      nonce,
      challenge,
      authenticatorData: authenticatorData.toString('base64url'),
      clientDataJSON: clientData.toString('base64url'),
      signature: assertionSignature.toString('base64url'),
    },
    identityBinding: {
      provider: 'ORCID',
      issuer: 'https://orcid.org',
      subject: ORCID,
      verification: 'issuer-attested-orcid-session',
    },
  };

  return { signature, fingerprint };
}

test('verifies a portable author signature offline with a pinned issuer fingerprint', async () => {
  const manuscript = manuscriptFixture();
  const { signature, fingerprint } = createPortableSignature(manuscript);
  const result = await verifyPortablePublicationSignature(manuscript, signature, {
    [ISSUER]: [fingerprint],
  });
  assert.equal(result.valid, true);
  assert.equal(result.cryptographic, 'verified');
  assert.equal(result.identity, 'verified');
  assert.equal(result.revision, 'current');
  assert.equal(result.issuerTrust, 'trusted');
});

test('detects tampering with the signed revision without contacting the issuer', async () => {
  const manuscript = manuscriptFixture();
  const { signature, fingerprint } = createPortableSignature(manuscript);
  manuscript.revisionHistory.revisions[0]!.snapshot.state.title = 'Altered manuscript';
  const result = await verifyPortablePublicationSignature(manuscript, signature, {
    [ISSUER]: [fingerprint],
  });
  assert.equal(result.valid, false);
  assert.equal(result.revision, 'mismatch');
});
