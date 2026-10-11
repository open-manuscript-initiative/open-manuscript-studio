import type { OmiBibliographicRecord } from '../../types/omi';
import type { HealthSearchRecord } from './searchApi';

/** Metadata only: no article text, licence inference or peer-review claim. */
export function healthResultToReference(item: HealthSearchRecord): OmiBibliographicRecord {
  const identifier = item.doi ? `doi:${item.doi.toLowerCase()}` : item.pmid ? `pmid:${item.pmid}` : `${item.provider}:${item.id}`;
  return {
    id: `health-reference:${identifier}`, type: item.kind === 'trial' ? 'web-page' : item.kind === 'preprint' ? 'preprint' : 'journal-article',
    title: item.title, contributors: item.authors.map((name, index) => ({ id: `${identifier}:author:${index}`, role: item.kind === 'trial' ? 'contributor' : 'author', literalName: name })),
    ...(item.journal ? { containerTitle: item.journal } : {}), ...(item.year ? { issued: item.year } : {}),
    identifiers: [
      ...(item.doi ? [{ scheme: 'doi', value: item.doi }] : []),
      ...(item.pmid ? [{ scheme: 'pmid', value: item.pmid }] : []),
      ...(item.kind === 'trial' ? [{ scheme: 'nct', value: item.id }] : []),
      { scheme: 'url', value: item.url },
    ], url: item.url, status: 'provisional',
  };
}
export function hasHealthReference(records: readonly OmiBibliographicRecord[], item: HealthSearchRecord): boolean {
  return records.some(record => record.id === healthResultToReference(item).id || record.url === item.url || record.identifiers.some(identifier =>
    (item.doi && identifier.scheme === 'doi' && identifier.value.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '') === item.doi.toLowerCase()) ||
    (item.pmid && identifier.scheme === 'pmid' && identifier.value === item.pmid)));
}
export function psychArchivesSearchUrl(query: string): string {
  return `https://www.psycharchives.org/en/browse/?${new URLSearchParams({ q: query.trim() })}`;
}
