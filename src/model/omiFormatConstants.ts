export type OmiManuscriptSchemaUri =
  'https://openmanuscript.org/schemas/omi-manuscript-0.2.schema.json';

export const OMI_MANUSCRIPT_SCHEMA_URI: OmiManuscriptSchemaUri =
  'https://openmanuscript.org/schemas/omi-manuscript-0.2.schema.json';

export const OMI_FILE_FORMAT_VERSION = '0.2.0' as const;
export const OMI_FILE_FORMAT_SPECIFICATION = 'OMI-SPEC-320@0.2.0' as const;

export const OMI_FILE_FORMAT_PROFILES = [
  'core-snapshot',
  'history-exchange',
] as const;

/**
 * Specification versions declared by Studio-produced OMI-SPEC-320@0.2.0 files.
 *
 * File-format versioning is deliberately independent from the Studio release
 * version and from the manuscript's application-defined `version` field.
 */
export const OMI_FILE_FORMAT_SPECIFICATIONS = {
  'OMI-SPEC-100': '0.1.0',
  'OMI-SPEC-120': '0.1.0',
  'OMI-SPEC-140': '0.1.0',
  'OMI-SPEC-150': '0.1.0',
  'OMI-SPEC-160': '0.1.0',
  'OMI-SPEC-210': '0.1.0',
  'OMI-SPEC-220': '0.1.0',
} as const;
