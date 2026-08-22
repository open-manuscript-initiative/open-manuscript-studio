import { calculateManuscriptStateDigestValue } from '../model/stateDigest';
import type { OmiManuscript, OmiManuscriptState } from '../types/omi';
import type {
  OmiCredentialIssuerAttestation,
  OmiPublicationSignature,
} from './authorSignatureApi';

export interface TrustedSignatureIssuers {
  [issuer: string]: string[];
}

export interface PublicationSignatureVerificationResult {
  valid: boolean;
  cryptographic: 'verified' | 'invalid' | 'unsupported';
  identity: 'verified' | 'invalid';
  revision: 'current' | 'historical' | 'missing' | 'mismatch';
  issuerTrust: 'trusted' | 'untrusted' | 'invalid';
  issuerFingerprint?: string;
  message: string;
}

export async function verifyPortablePublicationSignature(
  manuscript: OmiManuscript,
  signature: OmiPublicationSignature,
  trustedIssuers: TrustedSignatureIssuers = {},
): Promise<PublicationSignatureVerificationResult> {
  try {
    if (
      signature.model !== 'OMI-PUBLICATION-SIGNATURE' ||
      signature.version !== '0.2.0' ||
      signature.payload.version !== '0.2.0' ||
      !signature.payload.credential ||
      !signature.credential.issuerAttestation
    ) {
      return invalid('unsupported', 'invalid', 'missing', 'invalid', 'This signature does not contain portable OMI 0.2 verification evidence.');
    }

    const revision = manuscript.revisionHistory.revisions.find(
      (candidate) => candidate.id === signature.payload.revisionId,
    );
    if (!revision) {
      return invalid('invalid', 'invalid', 'missing', 'invalid', 'The signed revision is not present in this manuscript.');
    }

    const actualDigest = calculateManuscriptStateDigestValue(revision.snapshot.state);
    if (actualDigest.toLowerCase() !== signature.payload.stateDigest.value.toLowerCase()) {
      return invalid('invalid', 'invalid', 'mismatch', 'invalid', 'The signed revision content has been altered.');
    }

    if (!signerMatchesCommittedAuthor(revision.snapshot.state, signature)) {
      return invalid('invalid', 'invalid', revisionStatus(manuscript, revision.id), 'invalid', 'The signed ORCID identity is not bound to an author in the signed revision.');
    }

    const attestationResult = await verifyCredentialAttestation(
      signature.credential.issuerAttestation,
      signature,
      trustedIssuers,
    );
    if (!attestationResult.valid) {
      return invalid(attestationResult.crypto, 'invalid', revisionStatus(manuscript, revision.id), 'invalid', attestationResult.message);
    }

    const webAuthn = await verifyWebAuthnEvidence(signature);
    if (!webAuthn.valid) {
      return invalid(webAuthn.crypto, 'verified', revisionStatus(manuscript, revision.id), attestationResult.trust, webAuthn.message, attestationResult.fingerprint);
    }

    const revisionState = revisionStatus(manuscript, revision.id);
    return {
      valid: true,
      cryptographic: 'verified',
      identity: 'verified',
      revision: revisionState,
      issuerTrust: attestationResult.trust,
      issuerFingerprint: attestationResult.fingerprint,
      message: attestationResult.trust === 'trusted'
        ? 'The signature, author identity, issuer attestation and committed revision were verified offline.'
        : 'The signature is cryptographically valid, but this installation issuer is not in the local trust list.',
    };
  } catch (error) {
    return invalid(
      'invalid',
      'invalid',
      'missing',
      'invalid',
      error instanceof Error ? error.message : 'Portable signature verification failed.',
    );
  }
}

async function verifyCredentialAttestation(
  attestation: OmiCredentialIssuerAttestation,
  signature: OmiPublicationSignature,
  trustedIssuers: TrustedSignatureIssuers,
): Promise<{
  valid: boolean;
  crypto: 'verified' | 'invalid' | 'unsupported';
  trust: 'trusted' | 'untrusted' | 'invalid';
  fingerprint?: string;
  message: string;
}> {
  try {
    const header = JSON.parse(decodeBase64UrlText(attestation.protected)) as {
      alg?: string;
      typ?: string;
      kid?: string;
    };
    const payload = JSON.parse(decodeBase64UrlText(attestation.payload)) as {
      model?: string;
      version?: string;
      issuer?: string;
      credential?: { credentialId?: string; algorithm?: string; publicKeySpki?: string };
      identity?: { provider?: string; issuer?: string; subject?: string };
    };

    if (
      attestation.model !== 'OMI-SIGNING-CREDENTIAL-ATTESTATION' ||
      attestation.version !== '0.1.0' ||
      header.alg !== 'EdDSA' ||
      header.kid !== attestation.issuerKey.keyId ||
      payload.model !== 'OMI-SIGNING-CREDENTIAL-ATTESTATION' ||
      payload.version !== '0.1.0' ||
      payload.issuer !== attestation.issuerKey.issuer ||
      payload.credential?.credentialId !== signature.credential.credentialId ||
      payload.credential?.algorithm !== 'ES256' ||
      payload.credential?.publicKeySpki !== signature.credential.publicKeySpki ||
      payload.identity?.provider !== 'ORCID' ||
      payload.identity?.issuer !== signature.identityBinding.issuer ||
      payload.identity?.subject !== signature.identityBinding.subject ||
      signature.payload.credential?.issuerAttestationKeyId !== attestation.issuerKey.keyId
    ) {
      return { valid: false, crypto: 'invalid', trust: 'invalid', message: 'The signing credential issuer attestation does not match the signature envelope.' };
    }

    const publicKeyBytes = decodeBase64Url(attestation.issuerKey.publicKeySpki);
    const fingerprint = await sha256Hex(publicKeyBytes);
    if (fingerprint.toLowerCase() !== attestation.issuerKey.fingerprint.toLowerCase()) {
      return { valid: false, crypto: 'invalid', trust: 'invalid', message: 'The issuer public-key fingerprint is invalid.' };
    }

    const issuerOrigin = new URL(attestation.issuerKey.issuer).origin;
    if (issuerOrigin !== signature.evidence.origin || new URL(issuerOrigin).hostname !== signature.evidence.rpId) {
      return { valid: false, crypto: 'invalid', trust: 'invalid', message: 'The issuer, WebAuthn origin and relying-party identifier do not match.' };
    }

    const publicKey = await crypto.subtle.importKey(
      'spki',
      copyArrayBuffer(publicKeyBytes),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const signingInput = new TextEncoder().encode(`${attestation.protected}.${attestation.payload}`);
    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      copyArrayBuffer(decodeBase64Url(attestation.signature)),
      copyArrayBuffer(signingInput),
    );
    if (!valid) {
      return { valid: false, crypto: 'invalid', trust: 'invalid', fingerprint, message: 'The installation issuer attestation signature is invalid.' };
    }

    const trusted = trustedIssuers[attestation.issuerKey.issuer]?.some(
      (candidate) => candidate.toLowerCase() === fingerprint.toLowerCase(),
    ) ?? false;
    return {
      valid: true,
      crypto: 'verified',
      trust: trusted ? 'trusted' : 'untrusted',
      fingerprint,
      message: trusted ? 'Issuer attestation verified.' : 'Issuer attestation verified but is not locally trusted.',
    };
  } catch (error) {
    const unsupported = error instanceof DOMException && error.name === 'NotSupportedError';
    return {
      valid: false,
      crypto: unsupported ? 'unsupported' : 'invalid',
      trust: 'invalid',
      message: unsupported
        ? 'This runtime does not support Ed25519 verification.'
        : 'The signing credential issuer attestation is invalid.',
    };
  }
}

async function verifyWebAuthnEvidence(signature: OmiPublicationSignature): Promise<{
  valid: boolean;
  crypto: 'verified' | 'invalid' | 'unsupported';
  message: string;
}> {
  try {
    const clientDataBytes = decodeBase64Url(signature.evidence.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes)) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };
    if (
      clientData.type !== 'webauthn.get' ||
      clientData.challenge !== signature.evidence.challenge ||
      clientData.origin !== signature.evidence.origin
    ) {
      return { valid: false, crypto: 'invalid', message: 'The WebAuthn client data does not match the exported signature evidence.' };
    }

    const expectedChallenge = await sha256Base64Url(
      new TextEncoder().encode(`${canonicalJson(signature.payload)}\n${signature.evidence.nonce}`),
    );
    if (expectedChallenge !== signature.evidence.challenge) {
      return { valid: false, crypto: 'invalid', message: 'The exported signature payload or nonce was altered.' };
    }

    const authenticatorData = decodeBase64Url(signature.evidence.authenticatorData);
    if (authenticatorData.byteLength < 37) {
      return { valid: false, crypto: 'invalid', message: 'The WebAuthn authenticator data is invalid.' };
    }
    const expectedRpIdHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature.evidence.rpId)),
    );
    if (!equalBytes(authenticatorData.slice(0, 32), expectedRpIdHash)) {
      return { valid: false, crypto: 'invalid', message: 'The WebAuthn relying-party hash is invalid.' };
    }
    const flags = authenticatorData[32] ?? 0;
    if ((flags & 0x01) === 0 || (flags & 0x04) === 0) {
      return { valid: false, crypto: 'invalid', message: 'The exported signature does not prove user presence and verification.' };
    }

    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', copyArrayBuffer(clientDataBytes)));
    const signedData = concatBytes(authenticatorData, clientDataHash);
    const credentialKey = await crypto.subtle.importKey(
      'spki',
      copyArrayBuffer(decodeBase64Url(signature.credential.publicKeySpki)),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const rawSignature = derEcdsaToRaw(decodeBase64Url(signature.evidence.signature));
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      credentialKey,
      copyArrayBuffer(rawSignature),
      copyArrayBuffer(signedData),
    );
    return valid
      ? { valid: true, crypto: 'verified', message: 'WebAuthn signature verified.' }
      : { valid: false, crypto: 'invalid', message: 'The WebAuthn signature is invalid.' };
  } catch (error) {
    const unsupported = error instanceof DOMException && error.name === 'NotSupportedError';
    return {
      valid: false,
      crypto: unsupported ? 'unsupported' : 'invalid',
      message: unsupported ? 'This runtime cannot verify the exported WebAuthn signature.' : 'The exported WebAuthn evidence is invalid.',
    };
  }
}

function signerMatchesCommittedAuthor(
  state: OmiManuscriptState,
  signature: OmiPublicationSignature,
): boolean {
  const contribution = state.contributions.find(
    (candidate) =>
      candidate.agentId === signature.payload.signer.agentId &&
      candidate.targetId === state.id &&
      candidate.roles.includes('author'),
  );
  if (!contribution) return false;
  const agent = state.agents.find((candidate) => candidate.id === signature.payload.signer.agentId);
  if (!agent) return false;
  const expectedOrcid = normalizeOrcid(signature.payload.signer.orcid);
  return agent.identifiers.some(
    (identifier) =>
      identifier.scheme.toLowerCase() === 'orcid' &&
      normalizeOrcid(identifier.normalizedValue || identifier.value) === expectedOrcid,
  );
}

function revisionStatus(manuscript: OmiManuscript, revisionId: string): 'current' | 'historical' {
  return revisionId === manuscript.headRevisionId ? 'current' : 'historical';
}

function invalid(
  cryptographic: 'verified' | 'invalid' | 'unsupported',
  identity: 'verified' | 'invalid',
  revision: 'current' | 'historical' | 'missing' | 'mismatch',
  issuerTrust: 'trusted' | 'untrusted' | 'invalid',
  message: string,
  issuerFingerprint?: string,
): PublicationSignatureVerificationResult {
  return { valid: false, cryptographic, identity, revision, issuerTrust, message, issuerFingerprint };
}

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
    default: throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
  }
}

function normalizeOrcid(value: string): string {
  return value.trim().replace(/^https?:\/\/orcid\.org\//i, '').toUpperCase();
}

function decodeBase64UrlText(value: string): string {
  return new TextDecoder().decode(decodeBase64Url(value));
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copyArrayBuffer(bytes)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copyArrayBuffer(bytes)));
  let binary = '';
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.byteLength + right.byteLength);
  result.set(left, 0);
  result.set(right, left.byteLength);
  return result;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function derEcdsaToRaw(der: Uint8Array): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Invalid DER ECDSA signature sequence.');
  const sequence = readDerLength(der, offset);
  offset = sequence.offset;
  if (der[offset++] !== 0x02) throw new Error('Invalid DER ECDSA r value.');
  const rLength = readDerLength(der, offset);
  offset = rLength.offset;
  const r = der.slice(offset, offset + rLength.length);
  offset += rLength.length;
  if (der[offset++] !== 0x02) throw new Error('Invalid DER ECDSA s value.');
  const sLength = readDerLength(der, offset);
  offset = sLength.offset;
  const s = der.slice(offset, offset + sLength.length);
  return concatBytes(leftPadCoordinate(r), leftPadCoordinate(s));
}

function readDerLength(bytes: Uint8Array, offset: number): { length: number; offset: number } {
  const first = bytes[offset++];
  if (first === undefined) throw new Error('Invalid DER length.');
  if ((first & 0x80) === 0) return { length: first, offset };
  const count = first & 0x7f;
  if (count < 1 || count > 2) throw new Error('Unsupported DER length.');
  let length = 0;
  for (let index = 0; index < count; index += 1) {
    const value = bytes[offset++];
    if (value === undefined) throw new Error('Invalid DER length.');
    length = (length << 8) | value;
  }
  return { length, offset };
}

function leftPadCoordinate(value: Uint8Array): Uint8Array {
  let normalized = value;
  while (normalized.byteLength > 32 && normalized[0] === 0) normalized = normalized.slice(1);
  if (normalized.byteLength > 32) throw new Error('Invalid ECDSA coordinate size.');
  const result = new Uint8Array(32);
  result.set(normalized, 32 - normalized.byteLength);
  return result;
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
