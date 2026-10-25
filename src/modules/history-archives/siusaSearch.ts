const SIUSA_SEARCH_URL = 'https://siusa-archivi.cultura.gov.it/cgi-bin/siusa/pagina.pl';

/** Builds a public simple-search URL for the official SIUSA archive catalogue. */
export function buildSiusaSearchUrl(query: string): string {
  const url = new URL(SIUSA_SEARCH_URL);
  url.searchParams.set('RicFrmRicSemplice', query.trim());
  return url.toString();
}
