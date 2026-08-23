import { createHash, randomBytes } from 'node:crypto';

import { env } from '../../config/env.js';
import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecret,
} from '../../integrations/secretCrypto.js';
import type { OAuthCloudCredentials } from '../types.js';

export type CloudOAuthProviderKey = 'google-drive' | 'onedrive' | 'dropbox';

export interface CloudOAuthProviderConfig {
  key: CloudOAuthProviderKey;
  label: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  setupEnvironment: string[];
}

export interface CloudOAuthPublicConfig {
  id: CloudOAuthProviderKey;
  label: string;
  configured: boolean;
  redirectUri: string | null;
  scopes: string[];
  setupEnvironment: string[];
}

export interface CloudOAuthStatePayload {
  version: 1;
  userId: string;
  provider: CloudOAuthProviderKey;
  accountType: 'personal' | 'business';
  displayName: string;
  codeVerifier: string;
  native: boolean;
  returnOrigin?: string;
  returnPath: string;
  expiresAt: number;
  nonce: string;
}

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function listCloudOAuthProviderConfigs(): CloudOAuthProviderConfig[] {
  const microsoftTenant = env.MICROSOFT_STORAGE_OAUTH_TENANT || 'common';
  return [
    {
      key: 'google-drive',
      label: 'Google Drive',
      clientId: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      redirectUri: env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI,
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      setupEnvironment: [
        'GOOGLE_DRIVE_OAUTH_CLIENT_ID',
        'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET',
        'GOOGLE_DRIVE_OAUTH_REDIRECT_URI',
      ],
    },
    {
      key: 'onedrive',
      label: 'Microsoft OneDrive',
      clientId: env.MICROSOFT_STORAGE_OAUTH_CLIENT_ID,
      clientSecret: env.MICROSOFT_STORAGE_OAUTH_CLIENT_SECRET,
      redirectUri: env.MICROSOFT_STORAGE_OAUTH_REDIRECT_URI,
      authorizationEndpoint: `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant)}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant)}/oauth2/v2.0/token`,
      scopes: ['offline_access', 'User.Read', 'Files.ReadWrite'],
      setupEnvironment: [
        'MICROSOFT_STORAGE_OAUTH_CLIENT_ID',
        'MICROSOFT_STORAGE_OAUTH_CLIENT_SECRET',
        'MICROSOFT_STORAGE_OAUTH_REDIRECT_URI',
        'MICROSOFT_STORAGE_OAUTH_TENANT',
      ],
    },
    {
      key: 'dropbox',
      label: 'Dropbox',
      clientId: env.DROPBOX_OAUTH_CLIENT_ID,
      clientSecret: env.DROPBOX_OAUTH_CLIENT_SECRET,
      redirectUri: env.DROPBOX_OAUTH_REDIRECT_URI,
      authorizationEndpoint: 'https://www.dropbox.com/oauth2/authorize',
      tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
      scopes: ['account_info.read', 'files.content.read', 'files.content.write'],
      setupEnvironment: [
        'DROPBOX_OAUTH_CLIENT_ID',
        'DROPBOX_OAUTH_CLIENT_SECRET',
        'DROPBOX_OAUTH_REDIRECT_URI',
      ],
    },
  ];
}

export function listPublicCloudOAuthProviders(): CloudOAuthPublicConfig[] {
  return listCloudOAuthProviderConfigs().map((provider) => ({
    id: provider.key,
    label: provider.label,
    configured: isCloudOAuthConfigured(provider),
    redirectUri: provider.redirectUri ?? null,
    scopes: [...provider.scopes],
    setupEnvironment: [...provider.setupEnvironment],
  }));
}

export function getCloudOAuthProviderConfig(key: string): CloudOAuthProviderConfig | undefined {
  return listCloudOAuthProviderConfigs().find((provider) => provider.key === key);
}

export function isCloudOAuthConfigured(provider: CloudOAuthProviderConfig): boolean {
  return Boolean(provider.clientId && provider.clientSecret && provider.redirectUri);
}

export function createCloudOAuthAuthorization(input: {
  provider: CloudOAuthProviderConfig;
  userId: string;
  accountType: 'personal' | 'business';
  displayName?: string;
  native: boolean;
  returnOrigin?: string;
  returnPath?: string;
}): { authorizationUrl: string; expiresAt: string } {
  assertConfigured(input.provider);
  const codeVerifier = randomBytes(48).toString('base64url');
  const expiresAt = Date.now() + STATE_TTL_MS;
  const state = encodeState({
    version: 1,
    userId: input.userId,
    provider: input.provider.key,
    accountType: input.accountType,
    displayName: input.displayName?.trim() || input.provider.label,
    codeVerifier,
    native: input.native,
    ...(input.returnOrigin ? { returnOrigin: input.returnOrigin } : {}),
    returnPath: normalizeReturnPath(input.returnPath),
    expiresAt,
    nonce: randomBytes(24).toString('base64url'),
  });

  const url = new URL(input.provider.authorizationEndpoint);
  url.searchParams.set('client_id', input.provider.clientId!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', input.provider.redirectUri!);
  url.searchParams.set('scope', input.provider.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', sha256Base64Url(codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');

  if (input.provider.key === 'google-drive') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
  } else if (input.provider.key === 'onedrive') {
    url.searchParams.set('prompt', 'select_account');
  } else if (input.provider.key === 'dropbox') {
    url.searchParams.set('token_access_type', 'offline');
  }

  return {
    authorizationUrl: url.toString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function consumeCloudOAuthState(state: string): CloudOAuthStatePayload {
  if (!state || state.length > 12_000) throw new Error('Cloud OAuth state is invalid.');
  let encrypted: EncryptedSecret;
  try {
    encrypted = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as EncryptedSecret;
  } catch {
    throw new Error('Cloud OAuth state is invalid.');
  }
  if (!encrypted?.ciphertext || !encrypted.iv || !encrypted.authTag) {
    throw new Error('Cloud OAuth state is invalid.');
  }

  let payload: CloudOAuthStatePayload;
  try {
    payload = JSON.parse(decryptSecret(encrypted)) as CloudOAuthStatePayload;
  } catch {
    throw new Error('Cloud OAuth state validation failed.');
  }

  if (
    payload.version !== 1 ||
    !payload.userId ||
    !getCloudOAuthProviderConfig(payload.provider) ||
    !payload.codeVerifier ||
    !payload.nonce ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt <= Date.now()
  ) {
    throw new Error('Cloud OAuth state has expired or is invalid.');
  }
  return payload;
}

export async function exchangeCloudOAuthCode(input: {
  provider: CloudOAuthProviderConfig;
  code: string;
  codeVerifier: string;
}): Promise<OAuthCloudCredentials> {
  assertConfigured(input.provider);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.provider.redirectUri!,
    client_id: input.provider.clientId!,
    client_secret: input.provider.clientSecret!,
    code_verifier: input.codeVerifier,
  });

  const token = await tokenRequest(input.provider, body);
  if (!token.access_token) throw new Error('Cloud OAuth provider did not return an access token.');

  return {
    provider: input.provider.key,
    accessToken: token.access_token,
    ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
    ...(token.expires_in
      ? { expiresAt: new Date(Date.now() + Math.max(1, token.expires_in - 60) * 1000).toISOString() }
      : {}),
    ...(token.scope ? { scope: token.scope } : {}),
    rootPath: 'OMI',
  };
}

export async function refreshCloudOAuthCredentials(
  credentials: OAuthCloudCredentials,
): Promise<OAuthCloudCredentials> {
  if (!credentials.refreshToken) {
    throw new Error('The cloud connection must be authorized again because no refresh token is available.');
  }
  const provider = getCloudOAuthProviderConfig(credentials.provider);
  if (!provider) throw new Error('Unsupported OAuth cloud provider.');
  assertConfigured(provider);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
    client_id: provider.clientId!,
    client_secret: provider.clientSecret!,
  });
  if (provider.key === 'onedrive') body.set('scope', provider.scopes.join(' '));

  const token = await tokenRequest(provider, body);
  if (!token.access_token) throw new Error('Cloud OAuth refresh did not return an access token.');
  return {
    ...credentials,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? credentials.refreshToken,
    ...(token.expires_in
      ? { expiresAt: new Date(Date.now() + Math.max(1, token.expires_in - 60) * 1000).toISOString() }
      : {}),
    ...(token.scope ? { scope: token.scope } : {}),
  };
}

function encodeState(payload: CloudOAuthStatePayload): string {
  const encrypted = encryptSecret(JSON.stringify(payload));
  return Buffer.from(JSON.stringify(encrypted), 'utf8').toString('base64url');
}

function normalizeReturnPath(value: string | undefined): string {
  const candidate = value?.trim() || '/';
  return candidate.startsWith('/') && !candidate.startsWith('//') && candidate.length <= 1024
    ? candidate
    : '/';
}

function assertConfigured(provider: CloudOAuthProviderConfig): void {
  if (!isCloudOAuthConfigured(provider)) {
    throw new Error(`${provider.label} OAuth 2.0 is not configured on this Studio server.`);
  }
}

async function tokenRequest(
  provider: CloudOAuthProviderConfig,
  body: URLSearchParams,
): Promise<OAuthTokenResponse> {
  const response = await fetch(provider.tokenEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const preview = (await response.text()).slice(0, 300);
    throw new Error(`Cloud OAuth token request failed with HTTP ${response.status}${preview ? `: ${preview}` : ''}`);
  }
  return await response.json() as OAuthTokenResponse;
}

function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
