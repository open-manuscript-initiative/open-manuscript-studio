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

  return {
    manuscript: normalizedPortableState(normalizeJsonEnvelope(parsed)),
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

function normalizeJsonEnvelope(value: unknown): LegacyOmiManuscript {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The selected file does not contain an OMI manuscript object.');
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.title !== 'string'
    || !Array.isArray(candidate.sections)
  ) {
    throw new Error('The selected file is not a valid OMI manuscript.');
  }

  const timestamp = new Date().toISOString();
  return {
    ...candidate,
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: candidate.id,
    version: typeof candidate.version === 'string' ? candidate.version : '0.1.0',
    locale: typeof candidate.locale === 'string' ? candidate.locale : 'en',
    title: candidate.title,
    keywords: Array.isArray(candidate.keywords) ? candidate.keywords : [],
    sections: candidate.sections,
    annotations: Array.isArray(candidate.annotations) ? candidate.annotations : [],
    citations: Array.isArray(candidate.citations) ? candidate.citations : [],
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : timestamp,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : timestamp,
  } as LegacyOmiManuscript;
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
