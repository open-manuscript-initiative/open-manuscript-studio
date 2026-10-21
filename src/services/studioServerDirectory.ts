import { normalizeNativeStudioServerOrigin } from './studioServer';

export type StudioServerAvailability = 'online' | 'offline' | 'unknown';

export interface StudioServerDirectoryEntry {
  id: string;
  name: string;
  origin: string;
  availability: StudioServerAvailability;
}

export function parseStudioServerDirectory(value: unknown): StudioServerDirectoryEntry[] {
  if (!value || typeof value !== 'object' || !('servers' in value) || !Array.isArray(value.servers)) {
    throw new Error('The Studio server directory has an invalid format.');
  }

  const seenIds = new Set<string>();
  const seenOrigins = new Set<string>();
  const entries: StudioServerDirectoryEntry[] = [];

  for (const item of value.servers) {
    if (!item || typeof item !== 'object') {
      throw new Error('The Studio server directory contains an invalid entry.');
    }
    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const originValue = typeof candidate.origin === 'string' ? candidate.origin : '';
    const availability = candidate.status === 'online' || candidate.status === 'offline'
      ? candidate.status
      : 'unknown';

    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id) || !name) {
      throw new Error('The Studio server directory contains an invalid entry.');
    }

    const origin = normalizeNativeStudioServerOrigin(originValue);
    if (seenIds.has(id) || seenOrigins.has(origin)) {
      throw new Error('The Studio server directory contains a duplicate entry.');
    }
    seenIds.add(id);
    seenOrigins.add(origin);
    entries.push({ id, name, origin, availability });
  }

  return entries;
}

async function fetchDirectory(url: string): Promise<StudioServerDirectoryEntry[]> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('The server directory could not be loaded.');
  return parseStudioServerDirectory(await response.json());
}

export async function fetchStudioServerDirectory(): Promise<StudioServerDirectoryEntry[]> {
  const configuredRegistryOrigin = import.meta.env?.VITE_STUDIO_SERVER_REGISTRY_ORIGIN?.trim();
  const registryOrigin = (configuredRegistryOrigin || 'https://studio.openmanuscript.org').replace(/\/$/, '');
  const [liveResult, fallbackResult] = await Promise.allSettled([
    fetchDirectory(`${registryOrigin}/api/v1/server-registry/servers`),
    fetchDirectory('/studio-servers.json'),
  ]);

  const liveEntries = liveResult.status === 'fulfilled' ? liveResult.value : [];
  const fallbackEntries = fallbackResult.status === 'fulfilled' ? fallbackResult.value : [];
  const byOrigin = new Map<string, StudioServerDirectoryEntry>();

  for (const entry of fallbackEntries) byOrigin.set(entry.origin, entry);
  for (const entry of liveEntries) byOrigin.set(entry.origin, entry);

  if (byOrigin.size === 0) {
    throw liveResult.status === 'rejected' ? liveResult.reason : new Error('The Studio server directory is empty.');
  }
  return [...byOrigin.values()];
}
