import { importPKCS8, SignJWT } from 'jose';

import { env } from '../config/env.js';

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function createServerRegistryGithubToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const { OMI_SERVER_REGISTRY_GITHUB_APP_ID: appId,
    OMI_SERVER_REGISTRY_GITHUB_INSTALLATION_ID: installationId,
    OMI_SERVER_REGISTRY_GITHUB_PRIVATE_KEY: privateKeyValue } = env;
  if (!appId || !installationId || !privateKeyValue) {
    throw new Error('The registry GitHub App is not configured.');
  }

  const privateKey = await importPKCS8(privateKeyValue.replace(/\\n/g, '\n'), 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const appJwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 8 * 60)
    .sign(privateKey);

  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: 'POST',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${appJwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`GitHub App token exchange failed with HTTP ${response.status}.`);

  const result = await response.json() as { token?: string; expires_at?: string };
  if (!result.token || !result.expires_at) throw new Error('GitHub App returned an invalid installation token.');
  cachedToken = { value: result.token, expiresAt: Date.parse(result.expires_at) };
  return result.token;
}
