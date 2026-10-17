import { TranskribusError } from './client.js';

const MAX_BYTES = 2 * 1024 * 1024;
const CACHE_MS = 15 * 60_000;

export interface TranskribusModel {
  modelId: number;
  name: string;
  languages: string[];
  centuries: number[];
  material: 'handwritten' | 'print' | '';
  creator: string;
  scripts: string[];
}

function unavailable(): TranskribusError {
  return new TranskribusError('TRANSKRIBUS_MODELS_UNAVAILABLE', 503);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string =>
    typeof item === 'string' && item.length > 0 && item.length <= 100).slice(0, 40) : [];
}

/** Adapt the public website catalog, not the authenticated processing API. */
export function normalizeTranskribusModels(value: unknown): TranskribusModel[] {
  const rows = value && typeof value === 'object' && 'models' in value ? value.models : null;
  if (!Array.isArray(rows) || rows.length > 5000) throw unavailable();
  const models = new Map<number, TranskribusModel>();
  for (const row of rows) {
    if (!row || row.category !== 'text' || row.type !== 'text' ||
        !Number.isSafeInteger(row.modelId) || row.modelId < 1 || row.modelId > 2_147_483_647 ||
        typeof row.name !== 'string' || !row.name.trim() || row.name.length > 300) continue;
    if (models.has(row.modelId)) continue;
    models.set(row.modelId, {
      modelId: row.modelId, name: row.name.trim(),
      languages: strings(row.isoLanguages).filter(code => /^[a-z]{2,3}$/.test(code)),
      centuries: Array.isArray(row.centuries) ? row.centuries.filter((item: unknown): item is number =>
        Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 30).slice(0, 40) : [],
      material: row.docType === 'handwritten' || row.docType === 'print' ? row.docType : '',
      creator: typeof row.creator === 'string' ? row.creator.slice(0, 300) : '',
      scripts: strings(row.scriptTypes),
    });
  }
  if (!models.size) throw unavailable();
  return [...models.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function createTranskribusModelCatalog(options: { fetchImpl?: typeof fetch; now?: () => number } = {}) {
  const now = options.now ?? Date.now;
  let cached: { models: TranskribusModel[]; expiresAt: number } | null = null;
  let pending: Promise<TranskribusModel[]> | null = null;

  async function load(): Promise<TranskribusModel[]> {
    try {
      // Public metadata only: never send account tokens or follow provider links.
      const response = await (options.fetchImpl ?? fetch)('https://www.transkribus.org/api/models', {
        method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit',
        redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) {
        await response.body?.cancel();
        throw unavailable();
      }
      const reader = response.body?.getReader();
      if (!reader) throw unavailable();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) throw unavailable();
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const models = normalizeTranskribusModels(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      cached = { models, expiresAt: now() + CACHE_MS };
      return models;
    } catch { throw unavailable(); }
  }

  return async (): Promise<TranskribusModel[]> => {
    if (cached && cached.expiresAt > now()) return cached.models;
    if (!pending) pending = load().finally(() => { pending = null; });
    return pending;
  };
}

export const listTranskribusModels = createTranskribusModelCatalog();
