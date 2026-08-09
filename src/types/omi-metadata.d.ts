import type {
  OmiIntegrationExtensions,
  OmiScholarlyMetadata,
} from '../model/scholarlyMetadata';
import './omi';

declare module './omi' {
  interface OmiManuscriptState {
    metadata?: OmiScholarlyMetadata;
    extensions?: OmiIntegrationExtensions;
  }
}
