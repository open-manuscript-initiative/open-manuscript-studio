import { normalizeNativeStudioServerOrigin } from './studioServer';

export interface StudioServerDirectoryEntry {
  id: string;
  name: string;
  origin: string;
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

    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id) || !name) {
      throw new Error('The Studio server directory contains an invalid entry.');
    }

    const origin = normalizeNativeStudioServerOrigin(originValue);
    if (seenIds.has(id) || seenOrigins.has(origin)) {
      throw new Error('The Studio server directory contains a duplicate entry.');
    }
    seenIds.add(id);
    seenOrigins.add(origin);
    entries.push({ id, name, origin });
  }

  return entries;
}

export async function fetchStudioServerDirectory(): Promise<StudioServerDirectoryEntry[]> {
  const response = await fetch('/studio-servers.json', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('The Studio server directory could not be loaded.');
  }
  return parseStudioServerDirectory(await response.json());
}
