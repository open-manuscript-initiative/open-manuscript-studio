import { fetchPinnedPublicUrl } from '../../cloud/security/connectionPinnedHttp.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import type { RemoteRequest } from './directSubmission.js';
export class RemoteError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function nativeClient(baseUrl: string, apiKey?: string): RemoteRequest {
  return async (method, path, body) => {
    if (
      !/^(omi-integration(?:\/(?:submission-options|publication-artifact|metadata|chapter-page-range|issue-page-range|workflow-status\?submissionId=\d+))?|submissions(?:\/\d+(?:\/(?:files(?:\/\d+)?|submit|publications\/\d+(?:\/contributors(?:\/\d+)?)?))?)?)$/.test(
        path,
      )
    ) {
      throw new Error('Invalid publishing operation.');
    }
    const url = await assertTrustedIntegrationUrl(
      `${baseUrl}/api/v1/${path}`,
      baseUrl,
    );
    const headers = new Headers({ Accept: 'application/json' });
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
    const timeoutMs =
      path === 'omi-integration/publication-artifact' ? 120000 : 30000;
    const init: RequestInit = {
      method,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body instanceof FormData) init.body = body;
    else if (body) {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(body);
    }
    const response = await fetchPinnedPublicUrl(url, init);
    const text = await response.text();
    if (text.length > 4000000)
      throw new Error('The publishing response is too large.');
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      throw new RemoteError(
        response.status,
        `Publishing API returned HTTP ${response.status} without JSON. Check the plugin and API URL.`,
      );
    }
    if (!response.ok) {
      const detail = JSON.stringify(result)
        .slice(0, 3000)
        .split(apiKey || '\u0000')
        .join('[redacted]');
      throw new RemoteError(
        response.status,
        `Publishing API: HTTP ${response.status}. ${detail}`,
      );
    }
    return result;
  };
}
