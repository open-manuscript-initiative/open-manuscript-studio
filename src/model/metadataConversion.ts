import type { OmiManuscript } from '../types/omi';
import type { OmiPublicationRenderingContext } from './publicationRendering';

/** Bounded observations for the current single-language DOCX/ODT adapters. */
export interface MetadataConversionObservation {
  disposition: 'preserved' | 'normalized' | 'omitted' | 'unverified';
  sourceLocator: string;
  code: string;
}
export function officeMetadataConversion(
  source: OmiManuscript, context: OmiPublicationRenderingContext,
): MetadataConversionObservation[] {
  const result: MetadataConversionObservation[] = [];
  const compare = (path: string, before: unknown, after: unknown) => result.push({
    sourceLocator: path,
    disposition: JSON.stringify(before) === JSON.stringify(after) ? 'preserved'
      : after === undefined ? 'omitted' : 'normalized',
    code: 'OFFICE_PRIMARY_METADATA',
  });
  compare('/title', source.title, context.title);
  compare('/locale', source.locale, context.locale);
  compare('/abstract', source.abstract, context.abstract);
  compare('/keywords', source.keywords, context.keywords);
  for (const [field, values, projected] of [
    ['abstracts', source.abstracts, context.abstract],
    ['keywordsByLocale', source.keywordsByLocale, context.keywords.length ? context.keywords : undefined],
  ] as const) {
    for (const [locale, value] of Object.entries(values ?? {})) {
      const matchesProjection = locale === context.locale && JSON.stringify(value) === JSON.stringify(projected);
      result.push({ sourceLocator: `/${field}/${pointer(locale)}`,
        disposition: matchesProjection ? 'preserved' : 'omitted',
        code: matchesProjection ? 'OFFICE_PRIMARY_VARIANT' : 'OFFICE_LOCALIZED_VARIANT_OMITTED' });
    }
  }
  // These adapters do not write the scholarly metadata object into their output.
  if (source.metadata && Object.keys(source.metadata).length) result.push({
    sourceLocator: '/metadata', disposition: 'omitted', code: 'OFFICE_SCHOLARLY_METADATA_OMITTED',
  });
  result.push({ sourceLocator: '/', disposition: 'unverified', code: 'OFFICE_METADATA_MAPPING_INCOMPLETE' });
  return result;
}
export function metadataConversionWarnings(observations: MetadataConversionObservation[]): string[] {
  return observations.filter(item => item.disposition === 'omitted').map(item =>
    `${item.code}: Metadata at ${item.sourceLocator} is omitted from this single-language office export; the source retains it.`);
}
function pointer(value: string): string { return value.replace(/~/g, '~0').replace(/\//g, '~1'); }
