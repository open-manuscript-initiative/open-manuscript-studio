const ROMANIAN_ARCHIVES_TEXT_SEARCH_URL = 'https://descopera.arhivelenationale.ro/cautare-text/';

/** Builds a text-search URL for the Romanian National Archives discovery portal. */
export function buildRomanianArchivesSearchUrl(query: string): string {
  const url = new URL(ROMANIAN_ARCHIVES_TEXT_SEARCH_URL);
  url.searchParams.set('ts', query.trim());
  url.searchParams.set('pg', '1');
  url.searchParams.set('pgs', '10');
  return url.toString();
}
