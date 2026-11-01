import type { OmiPublicationBuildFormat } from '../model/publicationBuild';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { BUILD_INFO } from '../version';
import {
  createPublicationBuildManifest,
  publicationBuildManifestFileName,
  serializePublicationBuildManifest,
} from './publicationBuildManifest';
import {
  saveExportBlobWithSidecar,
  type ExportWithSidecarDeliveryResult,
} from './exportFileDelivery';

export interface PublicationArtifactSidecarInput {
  manuscript: OmiManuscript;
  profile: OmiPublicationProfile;
  artifact: Blob;
  fileName: string;
  format: OmiPublicationBuildFormat;
  mediaType: string;
  renderer: string;
  rendererVersion: string;
  rendererInput?: {
    value: string | Uint8Array;
    mediaType: string;
  };
}

export interface PreparedPublicationArtifactSidecar {
  buildId: string;
  sidecarFileName: string;
  sidecarText: string;
}

export interface PublicationArtifactSidecarResult extends PreparedPublicationArtifactSidecar {
  delivery: ExportWithSidecarDeliveryResult;
}

/**
 * Prepare provenance from the exact artifact bytes without starting a download.
 * This lets web clients initiate each browser download from a separate click.
 */
export async function preparePublicationArtifactWithBuildSidecar(
  input: PublicationArtifactSidecarInput,
): Promise<PreparedPublicationArtifactSidecar> {
  const bytes = new Uint8Array(await input.artifact.arrayBuffer());
  const build = createPublicationBuildManifest({
    manuscript: input.manuscript,
    profile: input.profile,
    artifact: bytes,
    rendererInput: input.rendererInput,
    output: {
      format: input.format,
      mediaType: input.mediaType,
      fileName: input.fileName,
    },
    generator: {
      applicationVersion: BUILD_INFO.version,
      applicationBuild: optionalBuildValue(BUILD_INFO.build, '0'),
      applicationCommit: optionalBuildValue(BUILD_INFO.commit, '-'),
      renderer: input.renderer,
      rendererVersion: input.rendererVersion,
    },
  });
  const sidecarText = serializePublicationBuildManifest(build);
  const sidecarFileName = publicationBuildManifestFileName(input.fileName);
  return {
    buildId: build.id,
    sidecarFileName,
    sidecarText,
  };
}

/**
 * Native exports still save through a platform dialog. Web callers should
 * prepare the artifact first and offer explicit download buttons, since
 * browsers may suppress multiple programmatic downloads after an async render.
 */
export async function savePublicationArtifactWithBuildSidecar(
  input: PublicationArtifactSidecarInput,
): Promise<PublicationArtifactSidecarResult> {
  const prepared = await preparePublicationArtifactWithBuildSidecar(input);
  const delivery = await saveExportBlobWithSidecar(
    input.artifact,
    input.fileName,
    prepared.sidecarText,
    prepared.sidecarFileName,
  );
  return { ...prepared, delivery };
}

function optionalBuildValue(
  value: string,
  placeholder: string,
): string | undefined {
  const normalized = value.trim();
  return normalized && normalized !== placeholder ? normalized : undefined;
}
