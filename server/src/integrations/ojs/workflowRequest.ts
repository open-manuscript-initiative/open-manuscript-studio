import { createHash, createHmac } from 'node:crypto';
import { fetchPinnedPublicUrl } from '../../cloud/security/connectionPinnedHttp.js';
import { getActiveInstallationWithSecret } from '../externalInstallations.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';

export async function ojsWorkflowRequest(installationId: string, apiBaseUrl: string, operation: string, input: unknown): Promise<Record<string, unknown>> {
  const installation = await getActiveInstallationWithSecret(installationId);
  if (!installation || installation.platform !== 'OJS') throw new Error('The OJS installation is unavailable.');
  const trusted = await assertTrustedIntegrationUrl(apiBaseUrl, installation.baseUrl);
  const target = new URL(`${trusted.toString().replace(/\/$/, '')}/${operation}`);
  const body = JSON.stringify(input);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', installation.sharedSecret)
    .update([timestamp, 'POST', target.pathname, createHash('sha256').update(body).digest('hex')].join('\n')).digest('base64url');
  const response = await fetchPinnedPublicUrl(target, {
    method: 'POST', redirect: 'error', body, signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json',
      'X-OMI-Installation': installation.installationId, 'X-OMI-Timestamp': timestamp, 'X-OMI-Signature': signature },
  });
  if (!response.ok) throw new Error(`OJS ${operation} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('OJS returned an invalid workflow receipt.');
  return result as Record<string, unknown>;
}
