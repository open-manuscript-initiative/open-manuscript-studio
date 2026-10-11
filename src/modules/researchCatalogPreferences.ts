export type ResearchCatalogId = 'rism' | 'musicbrainz' | 'pleiades' | 'clarin' | 'eurostat' | 'zenodo' | 'europePmc'
  | 'nsiBelgium' | 'nsiBulgaria' | 'nsiCzechia' | 'nsiDenmark' | 'nsiGermany' | 'nsiEstonia'
  | 'nsiIreland' | 'nsiGreece' | 'nsiSpain' | 'nsiFrance' | 'nsiCroatia' | 'nsiItaly'
  | 'nsiCyprus' | 'nsiLatvia' | 'nsiLithuania' | 'nsiLuxembourg' | 'nsiHungary' | 'nsiMalta'
  | 'nsiNetherlands' | 'nsiAustria' | 'nsiPoland' | 'nsiPortugal' | 'nsiRomania'
  | 'nsiSlovenia' | 'nsiSlovakia' | 'nsiFinland' | 'nsiSweden';

export const EU_NSI_CATALOGS = [
  'nsiBelgium', 'nsiBulgaria', 'nsiCzechia', 'nsiDenmark', 'nsiGermany', 'nsiEstonia',
  'nsiIreland', 'nsiGreece', 'nsiSpain', 'nsiFrance', 'nsiCroatia', 'nsiItaly',
  'nsiCyprus', 'nsiLatvia', 'nsiLithuania', 'nsiLuxembourg', 'nsiHungary', 'nsiMalta',
  'nsiNetherlands', 'nsiAustria', 'nsiPoland', 'nsiPortugal', 'nsiRomania',
  'nsiSlovenia', 'nsiSlovakia', 'nsiFinland', 'nsiSweden',
] as const satisfies readonly ResearchCatalogId[];

export function getResearchCatalogPreferencesKey(storageKey: string): string {
  return `omi:research-catalogs:v1:${storageKey}`;
}

export function readVisibleResearchCatalogs(
  availableCatalogs: readonly ResearchCatalogId[],
  raw: string | null,
  defaultVisibleCatalogs: readonly ResearchCatalogId[] = availableCatalogs,
): ResearchCatalogId[] {
  if (raw === null) return availableCatalogs.filter((catalog) => defaultVisibleCatalogs.includes(catalog));
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return availableCatalogs.filter((catalog) => defaultVisibleCatalogs.includes(catalog));
    return availableCatalogs.filter((catalog) => parsed.includes(catalog));
  } catch {
    return availableCatalogs.filter((catalog) => defaultVisibleCatalogs.includes(catalog));
  }
}
