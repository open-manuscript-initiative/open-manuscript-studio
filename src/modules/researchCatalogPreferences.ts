export type ResearchCatalogId = 'rism' | 'musicbrainz' | 'pleiades' | 'clarin' | 'eurostat' | 'zenodo' | 'europePmc';

export function getResearchCatalogPreferencesKey(storageKey: string): string {
  return `omi:research-catalogs:v1:${storageKey}`;
}

export function readVisibleResearchCatalogs(
  availableCatalogs: readonly ResearchCatalogId[],
  raw: string | null,
): ResearchCatalogId[] {
  if (raw === null) return [...availableCatalogs];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...availableCatalogs];
    return availableCatalogs.filter((catalog) => parsed.includes(catalog));
  } catch {
    return [...availableCatalogs];
  }
}
