import {
  getRevisionStateDigest,
  inspectRevisionStateIntegrity,
} from '../model/revisionIntegrity';
import {
  calculateManuscriptStateDigestValue,
  createManuscriptStateDigest,
  sha256HexSync,
} from '../model/stateDigest';
import { extractManuscriptState } from '../model/versioning';
import {
  OMI_PUBLICATION_BUILD_MODEL,
  OMI_PUBLICATION_BUILD_VERSION,
  OMI_PUBLICATION_PROFILE_DIGEST_CANONICALIZATION,
  type OmiPublicationBuild,
  type OmiPublicationBuildFormat,
} from '../model/publicationBuild';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';

export interface PublicationBuildGeneratorInput {
  applicationVersion: string;
  applicationBuild?: string;
  applicationCommit?: string;
  renderer: string;
  rendererVersion: string;
}

export interface CreatePublicationBuildManifestInput {
  manuscript: OmiManuscript;
  profile: OmiPublicationProfile;
  artifact: string | Uint8Array;
  rendererInput?: {
    value: string | Uint8Array;
    mediaType: string;
  };
  output: {
    format: OmiPublicationBuildFormat;
    mediaType: string;
    fileName: string;
  };
  generator: PublicationBuildGeneratorInput;
  createdAt?: string;
}

/**
 * Creates immutable provenance for one exported artifact.
 *
 * A publication build is deliberately outside the manuscript semantic state:
 * exporting does not create scholarly content. The build points to a committed
 * revision, fingerprints the exact publication profile and output bytes, and
 * records the renderer that produced the artifact.
 *
 * The current working state must match the committed head revision. Callers
 * must checkpoint before creating a build manifest when there are unsaved
 * manuscript changes.
 */
export function createPublicationBuildManifest(
  input: CreatePublicationBuildManifestInput,
): OmiPublicationBuild {
  const head = input.manuscript.revisionHistory.revisions.find(
    (revision) => revision.id === input.manuscript.headRevisionId,
  );
  if (!head) {
    throw new Error(
      `Publication build requires committed head revision ${input.manuscript.headRevisionId}.`,
    );
  }

  const integrity = inspectRevisionStateIntegrity(head);
  if (integrity.status === 'mismatch' || integrity.status === 'unsupported') {
    throw new Error(
      `Publication build cannot use revision ${head.id}: state digest is ${integrity.status}.`,
    );
  }

  const stateDigest =
    getRevisionStateDigest(head) ??
    createManuscriptStateDigest(head.snapshot.state, head.createdAt);
  const workingStateDigest = calculateManuscriptStateDigestValue(
    extractManuscriptState(input.manuscript),
  );
  if (
    workingStateDigest.toLowerCase() !==
    stateDigest.value.toLowerCase()
  ) {
    throw new Error(
      'Publication build requires a checkpoint: the working manuscript differs from the committed head revision.',
    );
  }

  const artifactBytes = toBytes(input.artifact);
  const outputDigest = sha256HexSync(artifactBytes);
  const profileDigest = calculatePublicationProfileDigest(input.profile);
  const generator = {
    application: 'open-manuscript-studio' as const,
    applicationVersion: requireValue(
      input.generator.applicationVersion,
      'applicationVersion',
    ),
    applicationBuild: optionalValue(input.generator.applicationBuild),
    applicationCommit: optionalValue(input.generator.applicationCommit),
    renderer: requireValue(input.generator.renderer, 'renderer'),
    rendererVersion: requireValue(
      input.generator.rendererVersion,
      'rendererVersion',
    ),
  };
  const output = {
    format: input.output.format,
    mediaType: requireValue(input.output.mediaType, 'mediaType'),
    fileName: requireValue(input.output.fileName, 'fileName'),
    byteLength: artifactBytes.byteLength,
    digest: {
      algorithm: 'sha256' as const,
      value: outputDigest,
    },
  };
  const rendererInput = input.rendererInput
    ? createRendererInput(input.rendererInput.value, input.rendererInput.mediaType)
    : undefined;
  const profile = {
    id: requireValue(input.profile.id, 'profile.id'),
    version: requireValue(input.profile.version, 'profile.version'),
    digest: {
      algorithm: 'sha256' as const,
      value: profileDigest,
      canonicalization: OMI_PUBLICATION_PROFILE_DIGEST_CANONICALIZATION,
    },
  };
  const manuscript = {
    id: requireValue(input.manuscript.id, 'manuscript.id'),
    revisionId: head.id,
    stateDigest: {
      algorithm: stateDigest.algorithm,
      value: stateDigest.value,
      canonicalization: stateDigest.canonicalization,
    },
  };
  const identity = {
    model: OMI_PUBLICATION_BUILD_MODEL,
    version: OMI_PUBLICATION_BUILD_VERSION,
    manuscript,
    profile,
    output,
    rendererInput,
    generator,
  };
  const identityDigest = sha256HexSync(
    new TextEncoder().encode(canonicalJson(identity)),
  );

  return {
    model: OMI_PUBLICATION_BUILD_MODEL,
    version: OMI_PUBLICATION_BUILD_VERSION,
    id: `urn:omi:publication-build:sha256:${identityDigest}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    manuscript,
    profile,
    output,
    rendererInput,
    generator,
  };
}

function createRendererInput(
  value: string | Uint8Array,
  mediaType: string,
): NonNullable<OmiPublicationBuild['rendererInput']> {
  const bytes = toBytes(value);
  return {
    mediaType: requireValue(mediaType, 'rendererInput.mediaType'),
    byteLength: bytes.byteLength,
    digest: {
      algorithm: 'sha256',
      value: sha256HexSync(bytes),
    },
  };
}

export function calculatePublicationProfileDigest(
  profile: OmiPublicationProfile,
): string {
  return sha256HexSync(
    new TextEncoder().encode(canonicalJson(profile)),
  );
}

export function verifyPublicationBuildArtifact(
  build: OmiPublicationBuild,
  artifact: string | Uint8Array,
): boolean {
  const bytes = toBytes(artifact);
  if (bytes.byteLength !== build.output.byteLength) return false;
  return (
    sha256HexSync(bytes).toLowerCase() ===
    build.output.digest.value.toLowerCase()
  );
}

export function serializePublicationBuildManifest(
  build: OmiPublicationBuild,
): string {
  return `${JSON.stringify(build, null, 2)}\n`;
}

export function publicationBuildManifestFileName(
  artifactFileName: string,
): string {
  return `${requireValue(artifactFileName, 'artifactFileName')}.omi-build.json`;
}

function toBytes(value: string | Uint8Array): Uint8Array {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value);
  }
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Publication build ${field} must not be empty.`);
  }
  return normalized;
}

function optionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error('Publication build canonical JSON cannot contain non-finite numbers.');
      }
      return JSON.stringify(value);
    case 'object': {
      const record = value as Record<string, unknown>;
      const entries = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${canonicalJson(record[key])}`,
        );
      return `{${entries.join(',')}}`;
    }
    default:
      throw new Error(
        `Publication build canonical JSON cannot encode ${typeof value} values.`,
      );
  }
}
