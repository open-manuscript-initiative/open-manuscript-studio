const AUTH_ORIGIN = 'https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect';
export const TRANSKRIBUS_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 6 * 1024 * 1024;
const STATUSES = ['CREATED', 'WAITING', 'RUNNING', 'FINISHED', 'FAILED', 'CANCELLED'] as const;

export class TranskribusError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus = 502) {
    super(code);
    this.name = 'TranskribusError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface TranskribusTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TranskribusJob {
  processId: number;
  status: typeof STATUSES[number];
  text: string;
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function normalizeTranskribusJob(value: unknown): TranskribusJob {
  const job = object(value);
  if (!Number.isSafeInteger(job.processId) || Number(job.processId) < 1 ||
      !STATUSES.includes(job.status as typeof STATUSES[number])) {
    throw new TranskribusError('TRANSKRIBUS_INVALID_RESPONSE');
  }
  const content = object(job.content);
  const regions = Array.isArray(content.regions) ? content.regions : [];
  const text = typeof content.text === 'string' && content.text.trim()
    ? content.text
    : regions.map(region => {
      const lines = object(region).lines;
      return (Array.isArray(lines) ? lines : []).map(line => {
        const item = object(line);
        if (typeof item.text === 'string') return item.text;
        return (Array.isArray(item.words) ? item.words : [])
          .map(word => object(word).text).filter(word => typeof word === 'string').join(' ');
      }).join('\n');
    }).join('\n\n');
  if (text.length > 1_000_000) throw new TranskribusError('TRANSKRIBUS_RESULT_TOO_LARGE');
  return { processId: Number(job.processId), status: job.status as TranskribusJob['status'], text };
}

/** Validate the actual bytes before a request that consumes provider credits. */
export function validateTranskribusImage(base64: string): void {
  if (!base64 || base64.length > Math.ceil(TRANSKRIBUS_MAX_IMAGE_BYTES / 3) * 4 ||
      base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new TranskribusError('TRANSKRIBUS_INVALID_IMAGE', 400);
  }
  const bytes = Buffer.from(base64, 'base64');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const tiff = ['49492a00', '4d4d002a', '49492b00', '4d4d002b'].includes(bytes.subarray(0, 4).toString('hex'));
  if (bytes.length > TRANSKRIBUS_MAX_IMAGE_BYTES || bytes.length < 8 || (!png && !jpeg && !tiff) || bytes.toString('base64') !== base64) {
    throw new TranskribusError('TRANSKRIBUS_INVALID_IMAGE', 400);
  }
}

export function createTranskribusClient(options: {
  apiOrigin?: string;
  fetchImpl?: typeof fetch;
} = {}) {
  const origin = options.apiOrigin ?? 'https://api.transkribus.org';
  if (!['https://api.transkribus.org', 'https://api-staging.transkribus.org'].includes(origin)) {
    throw new Error('Unsupported Transkribus API origin.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(url: string, init: RequestInit): Promise<string> {
    try {
      const response = await fetchImpl(url, {
        ...init, redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const code = response.status === 401 ? 'TRANSKRIBUS_RECONNECT'
          : response.status === 403 ? 'TRANSKRIBUS_ACCESS_REQUIRED'
          : response.status === 429 ? 'TRANSKRIBUS_LIMIT'
          : response.status === 404 ? 'TRANSKRIBUS_NOT_FOUND'
          : response.status === 400 ? 'TRANSKRIBUS_INVALID_REQUEST'
          : 'TRANSKRIBUS_UNAVAILABLE';
        throw new TranskribusError(code, response.status === 401 ? 409 : 502);
      }
      if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw new TranskribusError('TRANSKRIBUS_RESULT_TOO_LARGE');
      }
      const reader = response.body?.getReader();
      if (!reader) return '';
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) throw new TranskribusError('TRANSKRIBUS_RESULT_TOO_LARGE');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      return Buffer.concat(chunks).toString('utf8');
    } catch (error) {
      if (error instanceof TranskribusError) throw error;
      // Never forward provider responses, URLs, credentials or request bodies.
      throw new TranskribusError('TRANSKRIBUS_UNAVAILABLE');
    }
  }

  async function json(url: string, init: RequestInit): Promise<unknown> {
    const raw = await request(url, init);
    try { return JSON.parse(raw) as unknown; }
    catch { throw new TranskribusError('TRANSKRIBUS_INVALID_RESPONSE'); }
  }

  async function token(grant: Record<string, string>): Promise<TranskribusTokens> {
    const payload = object(await json(`${AUTH_ORIGIN}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: 'processing-api-client', ...grant }),
    }));
    if (typeof payload.access_token !== 'string' || !payload.access_token ||
        typeof payload.refresh_token !== 'string' || !payload.refresh_token ||
        !Number.isFinite(payload.expires_in) || Number(payload.expires_in) <= 0) {
      throw new TranskribusError('TRANSKRIBUS_INVALID_RESPONSE');
    }
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + Number(payload.expires_in) * 1000,
    };
  }

  function authorized(accessToken: string): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  }

  return {
    async login(username: string, password: string): Promise<TranskribusTokens> {
      try { return await token({ grant_type: 'password', username, password }); }
      catch (error) {
        if (error instanceof TranskribusError && ['TRANSKRIBUS_RECONNECT', 'TRANSKRIBUS_INVALID_REQUEST'].includes(error.code)) {
          throw new TranskribusError('TRANSKRIBUS_INVALID_LOGIN', 400);
        }
        throw error;
      }
    },
    async refresh(refreshToken: string): Promise<TranskribusTokens> {
      try { return await token({ grant_type: 'refresh_token', refresh_token: refreshToken }); }
      catch (error) {
        if (error instanceof TranskribusError && error.code === 'TRANSKRIBUS_INVALID_REQUEST') {
          throw new TranskribusError('TRANSKRIBUS_RECONNECT', 409);
        }
        throw error;
      }
    },
    async logout(refreshToken: string): Promise<void> {
      await request(`${AUTH_ORIGIN}/logout`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: 'processing-api-client', refresh_token: refreshToken }),
      });
    },
    async submit(accessToken: string, modelId: number, imageBase64: string): Promise<TranskribusJob> {
      if (!Number.isSafeInteger(modelId) || modelId < 1 || modelId > 2_147_483_647) {
        throw new TranskribusError('TRANSKRIBUS_INVALID_REQUEST', 400);
      }
      validateTranskribusImage(imageBase64);
      return normalizeTranskribusJob(await json(`${origin}/v2/processes`, {
        method: 'POST',
        headers: { ...authorized(accessToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { textRecognition: { htrId: modelId } }, image: { base64: imageBase64 } }),
      }));
    },
    async getJob(accessToken: string, processId: number): Promise<TranskribusJob> {
      const job = normalizeTranskribusJob(await json(`${origin}/v2/processes/${processId}`, {
        method: 'GET', headers: authorized(accessToken),
      }));
      if (job.processId !== processId) throw new TranskribusError('TRANSKRIBUS_INVALID_RESPONSE');
      return job;
    },
    getPageXml: (accessToken: string, processId: number) => request(`${origin}/v2/processes/${processId}/page`, {
      method: 'GET', headers: { ...authorized(accessToken), Accept: 'application/xml' },
    }),
  };
}
