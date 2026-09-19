import {
  migrateIdentityModel,
  type LegacyOmiManuscript,
} from '../document/migrateIdentityModel';
import { extractManuscriptState } from '../model/versioning';
import type { OmiManuscript, OmiManuscriptState } from '../types/omi';
import {
  inspectOmiContainer,
  type OmiContainerImportedAsset,
} from './omiContainerImport';
import { parsePortableOmiManuscript } from './omiPortableFormat';

export interface OmiStudyImportSource {
  manuscript: OmiManuscriptState;
  packagedAssets: OmiContainerImportedAsset[];
  fileName: string;
}

/** Reads either portable OMI JSON or an integrity-checked .omi container. */
export async function readOmiStudyImportSource(
  file: File,
): Promise<OmiStudyImportSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (isZipContainer(bytes)) {
    const plan = await inspectOmiContainer(bytes);
    if (!plan.validForImport || !plan.manuscript) {
      const detail = plan.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.message)
        .join(' ');
      throw new Error(detail || 'The selected OMI package is not valid for import.');
    }

    return {
      manuscript: normalizedPortableState(plan.manuscript),
      packagedAssets: plan.assets,
      fileName: file.name,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('The selected file is neither valid OMI JSON nor an OMI package.');
  }

  const manuscript = parsePortableOmiManuscript(parsed);

  return {
    manuscript: extractManuscriptState(manuscript),
    packagedAssets: [],
    fileName: file.name,
  };
}

function isZipContainer(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && bytes[2] === 0x03
    && bytes[3] === 0x04;
}

function normalizedPortableState(
  manuscript: LegacyOmiManuscript | OmiManuscript,
): OmiManuscriptState {
  const migrated = migrateIdentityModel(manuscript);
  if (
    migrated.versioningModelVersion
    && migrated.headRevisionId
    && migrated.revisionHistory
  ) {
    return extractManuscriptState(migrated as OmiManuscript);
  }

  const {
    versioningModelVersion: _versioningModelVersion,
    headRevisionId: _headRevisionId,
    revisionHistory: _revisionHistory,
    ...state
  } = migrated;
  return state;
}
