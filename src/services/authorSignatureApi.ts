import { createManuscriptStateDigest } from '../model/stateDigest';
import { getExternalIdentifierValue, getPreferredNameForm } from '../model/identity';
import type { OmiManuscript } from '../types/omi';

export interface OmiPublicationSignature {
  model: 'OMI-PUBLICATION-SIGNATURE';
  version: '0.1.0';
  signatureId: string;
  payload: {
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
  };
  credential: {
    credentialId: string;
    algorithm: 'ES256';
    publicKeySpki: string;
  };
  evidence: {
    format: 'webauthn-assertion';
    origin: string;
    rpId: string;
    nonce: string;
    challenge: string;
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
  };
  identityBinding: {
    provider: 'ORCID';
    issuer: string;
    subject: string;
    verification: 'server-authenticated-session';
  };
}

export interface AuthorSignatureStatus {
  identity: {
    provider: 'ORCID';
    issuer: string;
    subject: string;
    orcid: string;
    displayName: string;
  };
  credentials: Array<{ credentialId: string; algorithm: string }>;
}

const SIGNATURE_STORAGE_PREFIX = 'omi.publication-signatures.v1:';
const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export async function getAuthorSignatureStatus(): Promise<AuthorSignatureStatus> {
  return requestJson<AuthorSignatureStatus>('/api/signatures/status');
}

export async function registerAuthorSigningCredential(label?: string): Promise<void> {
  ensureWebAuthn();
  const start = await requestJson<{
    challenge: string;
    rpId: string;
    userId: string;
    userName: string;
  }>('/api/signatures/credentials/challenge', { method: 'POST' });

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: fromBase64Url(start.challenge),
      rp: { id: start.rpId, name: 'Open Manuscript Studio' },
      user: {
        id: copyToArrayBuffer(new TextEncoder().encode(start.userId)),
        name: start.userName,
        displayName: start.userName,
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('No WebAuthn signing credential was created.');
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  const getPublicKey = (response as AuthenticatorAttestationResponse & {
    getPublicKey?: () => ArrayBuffer | null;
  }).getPublicKey;
  const publicKey = getPublicKey?.call(response);
  if (!publicKey) {
    throw new Error('This browser cannot expose the registered WebAuthn public key.');
  }

  await requestJson('/api/signatures/credentials', {
    method: 'POST',
    body: JSON.stringify({
      challenge: start.challenge,
      credentialId: credential.id,
      publicKeySpki: toBase64Url(publicKey),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      label,
    }),
  });
}

export async function signCurrentManuscriptRevision(
  manuscript: OmiManuscript,
  status: AuthorSignatureStatus,
): Promise<OmiPublicationSignature> {
  ensureWebAuthn();
  const head = manuscript.revisionHistory.revisions.find(
    (revision) => revision.id === manuscript.headRevisionId,
  );
  if (!head) throw new Error('The current manuscript revision could not be found.');

  const author = manuscript.contributions
    .filter((contribution) => contribution.targetId === manuscript.id && contribution.roles.includes('author'))
    .map((contribution) => manuscript.agents.find((agent) => agent.id === contribution.agentId))
    .find((agent) => agent && getExternalIdentifierValue(agent, 'orcid') === status.identity.orcid);
  if (!author) {
    throw new Error('The authenticated ORCID iD is not attached to an author of this manuscript.');
  }

  const digest = createManuscriptStateDigest(head.snapshot.state, head.createdAt);
  const signerName = getPreferredNameForm(author)?.value || status.identity.displayName;
  const start = await requestJson<{
    challenge: string;
    rpId: string;
    payload: unknown;
    nonce: string;
    credentialIds: string[];
  }>('/api/signatures/sign/challenge', {
    method: 'POST',
    body: JSON.stringify({
      manuscriptId: manuscript.id,
      revisionId: head.id,
      stateDigest: digest.value,
      signerAgentId: author.id,
      signerName,
    }),
  });

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: fromBase64Url(start.challenge),
      rpId: start.rpId,
      allowCredentials: start.credentialIds.map((credentialId): PublicKeyCredentialDescriptor => ({
        type: 'public-key',
        id: fromBase64Url(credentialId),
      })),
      userVerification: 'required',
      timeout: 60_000,
    },
  });

  if (!(assertion instanceof PublicKeyCredential)) {
    throw new Error('The WebAuthn signing ceremony was cancelled.');
  }
  const response = assertion.response as AuthenticatorAssertionResponse;
  const result = await requestJson<{ signature: OmiPublicationSignature }>(
    '/api/signatures/sign',
    {
      method: 'POST',
      body: JSON.stringify({
        challenge: start.challenge,
        credentialId: assertion.id,
        clientDataJSON: toBase64Url(response.clientDataJSON),
        authenticatorData: toBase64Url(response.authenticatorData),
        signature: toBase64Url(response.signature),
      }),
    },
  );
  savePublicationSignature(result.signature);
  return result.signature;
}

export function getPublicationSignatures(manuscriptId: string): OmiPublicationSignature[] {
  try {
    const raw = localStorage.getItem(`${SIGNATURE_STORAGE_PREFIX}${manuscriptId}`);
    return raw ? (JSON.parse(raw) as OmiPublicationSignature[]) : [];
  } catch {
    return [];
  }
}

export function savePublicationSignature(signature: OmiPublicationSignature): void {
  const manuscriptId = signature.payload.manuscriptId;
  const signatures = getPublicationSignatures(manuscriptId).filter(
    (candidate) => candidate.signatureId !== signature.signatureId,
  );
  signatures.push(signature);
  localStorage.setItem(`${SIGNATURE_STORAGE_PREFIX}${manuscriptId}`, JSON.stringify(signatures));
}

function ensureWebAuthn(): void {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error('This browser does not support WebAuthn/passkey signing.');
  }
}

async function requestJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const native = isNativeRuntime();
  const token = native ? globalThis.localStorage?.getItem(NATIVE_SESSION_KEY) : null;
  const headers = new Headers(init.headers ?? {});
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  if (native) {
    headers.set('X-OMI-Native-Client', '1');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const baseUrl = native && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '';
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(`Request failed with HTTP ${response.status}.`);
    }
    throw new Error('Signature API returned a non-JSON response.');
  }

  const payload = await response.json() as {
    error?: { message?: string };
  } & T;
  if (!response.ok) throw new Error(payload.error?.message || `Request failed with HTTP ${response.status}.`);
  return payload;
}

function isNativeRuntime(): boolean {
  const location = globalThis.location;
  if (!location) return false;
  return location.protocol === 'tauri:' || location.hostname === 'tauri.localhost';
}

function toBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return copyToArrayBuffer(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
