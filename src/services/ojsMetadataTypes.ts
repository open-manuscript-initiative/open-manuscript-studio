export type OjsWritableMetadataField =
  | 'title'
  | 'subtitle'
  | 'abstract'
  | 'keywords';
export type OjsPullMetadataField =
  | OjsWritableMetadataField
  | 'licenseUrl'
  | 'copyrightHolder'
  | 'copyrightYear';
export type { OjsMetadataSnapshot, OjsMetadataRequest, OjsMetadataResponse } from '../../server/src/contracts/ojsMetadataContract';
