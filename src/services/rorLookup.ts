export const ROR_API_BASE_URL = 'https://api.ror.org/v2/organizations';

export interface RorOrganizationSuggestion {
  id: string;
  displayName: string;
  city?: string;
  country?: string;
  countryCode?: string;
  types: string[];
}

interface RorNameRecord {
  value?: unknown;
  types?: unknown;
}

interface RorLocationRecord {
  geonames_details?: {
    name?: unknown;
    country_name?: unknown;
    country_code?: unknown;
  };
}

interface RorOrganizationRecord {
  id?: unknown;
  status?: unknown;
  names?: unknown;
  locations?: unknown;
  types?: unknown;
}

interface RorSearchResponse {
  items?: unknown;
}

export function buildRorSearchUrl(query: string): string {
  const trimmed = query.trim();
  const parameters = new URLSearchParams({ query: trimmed });
  return `${ROR_API_BASE_URL}?${parameters.toString()}`;
}

export async function searchRorOrganizations(
  query: string,
  options: {
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RorOrganizationSuggestion[]> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(buildRorSearchUrl(trimmed), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`ROR lookup failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as RorSearchResponse;
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items
    .map(mapRorOrganization)
    .filter((item): item is RorOrganizationSuggestion => Boolean(item))
    .slice(0, 8);
}

export function mapRorOrganization(
  value: unknown,
): RorOrganizationSuggestion | null {
  if (!isRecord(value)) {
    return null;
  }

  const record = value as RorOrganizationRecord;
  const id = typeof record.id === 'string' ? record.id.trim() : '';

  if (!id || (typeof record.status === 'string' && record.status !== 'active')) {
    return null;
  }

  const names = Array.isArray(record.names)
    ? record.names.filter(isRecord) as RorNameRecord[]
    : [];
  const displayName = pickDisplayName(names);

  if (!displayName) {
    return null;
  }

  const locations = Array.isArray(record.locations)
    ? record.locations.filter(isRecord) as RorLocationRecord[]
    : [];
  const location = locations[0]?.geonames_details;
  const types = Array.isArray(record.types)
    ? record.types.filter((type): type is string => typeof type === 'string')
    : [];

  return {
    id,
    displayName,
    city: stringValue(location?.name),
    country: stringValue(location?.country_name),
    countryCode: stringValue(location?.country_code),
    types,
  };
}

function pickDisplayName(names: RorNameRecord[]): string {
  const display = names.find((name) =>
    Array.isArray(name.types) && name.types.includes('ror_display'),
  );
  const label = names.find((name) =>
    Array.isArray(name.types) && name.types.includes('label'),
  );
  const fallback = names[0];

  return stringValue(display?.value) ?? stringValue(label?.value) ?? stringValue(fallback?.value) ?? '';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
