/**
 * Verified public entry points for Italy's Archivi Nazionali portal (ICAR).
 *
 * The 2026 portal replaces the legacy SAN as the main discovery entry point.
 * No public documented search API or supported query-string contract is assumed:
 * OMI links to the official interface without proxying or scraping results.
 *
 * Source: ICAR (27 October 2026), Portale Archivi Nazionali, and its site map.
 */
export const ITALIAN_NATIONAL_ARCHIVES_ORIGIN = 'https://archivinazionali.cultura.gov.it' as const;

export const ITALIAN_NATIONAL_ARCHIVES_LINKS = [
  { id: 'home', url: 'https://archivinazionali.cultura.gov.it/it/' },
  { id: 'holdings', url: 'https://archivinazionali.cultura.gov.it/it/patrimoni-documentari' },
  { id: 'units', url: 'https://archivinazionali.cultura.gov.it/it/unit%C3%A0' },
  { id: 'explore', url: 'https://archivinazionali.cultura.gov.it/it/esplora-le-risorse' },
  { id: 'readingRoom', url: 'https://archivinazionali.cultura.gov.it/it/sala-studio' },
] as const;

export type ItalianNationalArchivesLinkId = (typeof ITALIAN_NATIONAL_ARCHIVES_LINKS)[number]['id'];

export function getItalianNationalArchivesLink(id: ItalianNationalArchivesLinkId): string {
  const link = ITALIAN_NATIONAL_ARCHIVES_LINKS.find((item) => item.id === id);
  if (!link) throw new Error('Unknown official Italian archival resource');
  return link.url;
}
