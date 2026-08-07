export const ORCID_CSV_SEARCH_ENDPOINT =
  'https://pub.orcid.org/v3.0/csv-search/' as const;

export interface OrcidSearchInput {
  givenName: string;
  familyName: string;
  affiliation?: string;
  rorId?: string;
}

export interface OrcidSuggestion {
  orcid: string;
  givenName: string;
  familyName: string;
  creditName?: string;
  currentInstitution?: string;
  pastInstitution?: string;
  profileUrl: string;
}

const ORCID_FIELDS = [
  'orcid',
  'given-names',
  'family-name',
  'credit-name',
  'current-institution-affiliation-name',
  'past-institution-affiliation-name',
].join(',');

const MAX_RESULTS = 8;

export function buildOrcidSearchUrl(
  input: OrcidSearchInput,
  options: { useAffiliation?: boolean } = {},
): string {
  const givenName = input.givenName.trim();
  const familyName = input.familyName.trim();
  const nameQuery = buildNameQuery(givenName, familyName);
  const clauses = [nameQuery];

  if (options.useAffiliation !== false) {
    const rorId = normalizeRorForSearch(input.rorId ?? '');
    const affiliation = input.affiliation?.trim() ?? '';

    if (rorId) {
      clauses.push(`ror-org-id:${quoteSolr(rorId)}`);
    } else if (affiliation.length >= 3) {
      clauses.push(`affiliation-org-name:${quoteSolr(affiliation)}`);
    }
  }

  const url = new URL(ORCID_CSV_SEARCH_ENDPOINT);
  url.searchParams.set('q', clauses.filter(Boolean).join(' AND '));
  url.searchParams.set('fl', ORCID_FIELDS);
  url.searchParams.set('rows', String(MAX_RESULTS));
  return url.toString();
}

export async function searchOrcidRegistry(
  input: OrcidSearchInput,
  options: { signal?: AbortSignal } = {},
): Promise<OrcidSuggestion[]> {
  if (!hasSearchableName(input)) return [];

  const narrowed = await requestOrcidCsv(
    buildOrcidSearchUrl(input, { useAffiliation: true }),
    options.signal,
  );

  if (narrowed.length > 0 || (!input.rorId && !input.affiliation?.trim())) {
    return narrowed;
  }

  return requestOrcidCsv(
    buildOrcidSearchUrl(input, { useAffiliation: false }),
    options.signal,
  );
}

export function parseOrcidCsv(csv: string): OrcidSuggestion[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const headers = rows[0]?.map((header) => header.trim().toLowerCase()) ?? [];
  const indexOf = (...names: string[]) =>
    names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;

  const orcidIndex = indexOf('orcid');
  const givenIndex = indexOf('given-names', 'given-name');
  const familyIndex = indexOf('family-name', 'family-names');
  const creditIndex = indexOf('credit-name');
  const currentInstitutionIndex = indexOf('current-institution-affiliation-name');
  const pastInstitutionIndex = indexOf('past-institution-affiliation-name');

  if (orcidIndex < 0) return [];

  const seen = new Set<string>();
  const suggestions: OrcidSuggestion[] = [];

  for (const row of rows.slice(1)) {
    const orcid = normalizeOrcidId(row[orcidIndex] ?? '');
    if (!orcid || seen.has(orcid)) continue;
    seen.add(orcid);

    suggestions.push({
      orcid,
      givenName: cleanCell(row[givenIndex]),
      familyName: cleanCell(row[familyIndex]),
      creditName: optionalCell(row[creditIndex]),
      currentInstitution: optionalCell(row[currentInstitutionIndex]),
      pastInstitution: optionalCell(row[pastInstitutionIndex]),
      profileUrl: `https://orcid.org/${orcid}`,
    });

    if (suggestions.length >= MAX_RESULTS) break;
  }

  return suggestions;
}

export function normalizeOrcidId(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, '')
    .replace(/^orcid\.org\//i, '')
    .replace(/^\//, '')
    .toUpperCase();
}

function hasSearchableName(input: OrcidSearchInput): boolean {
  const givenName = input.givenName.trim();
  const familyName = input.familyName.trim();
  return familyName.length >= 2 || `${givenName} ${familyName}`.trim().length >= 4;
}

function buildNameQuery(givenName: string, familyName: string): string {
  if (givenName && familyName) {
    return `given-names:${quoteSolr(givenName)} AND family-name:${quoteSolr(familyName)}`;
  }

  if (familyName) return `family-name:${quoteSolr(familyName)}`;
  return `given-names:${quoteSolr(givenName)}`;
}

function quoteSolr(value: string): string {
  return `"${value.replace(/([\\"])/g, '\\$1')}"`;
}

function normalizeRorForSearch(value: string): string {
  const id = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?ror\.org\//i, '')
    .replace(/^ror\.org\//i, '')
    .replace(/\/$/, '')
    .toLowerCase();

  return /^0[a-hj-km-np-tv-z0-9]{6}[0-9]{2}$/.test(id)
    ? `https://ror.org/${id}`
    : '';
}

async function requestOrcidCsv(
  url: string,
  signal?: AbortSignal,
): Promise<OrcidSuggestion[]> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/csv',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`ORCID search failed with HTTP ${response.status}.`);
  }

  return parseOrcidCsv(await response.text());
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? '';

    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += character;
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function cleanCell(value: string | undefined): string {
  return value?.trim() ?? '';
}

function optionalCell(value: string | undefined): string | undefined {
  const normalized = cleanCell(value);
  return normalized || undefined;
}
