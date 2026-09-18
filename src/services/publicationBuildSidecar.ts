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

export interface PublicationArtifactSidecarResult {
  buildId: string;
  sidecarFileName: string;
  sidecarText: string;
  delivery: ExportWithSidecarDeliveryResult;
}

/**
 * Creates provenance from the exact artifact bytes that are subsequently saved,
 * then delivers the artifact and its .omi-build.json sidecar as one export
 * operation.
 */
export async function savePublicationArtifactWithBuildSidecar(
  input: PublicationArtifactSidecarInput,
): Promise<PublicationArtifactSidecarResult> {
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
  const delivery = await saveExportBlobWithSidecar(
    input.artifact,
    input.fileName,
    sidecarText,
    sidecarFileName,
  );

  return {
    buildId: build.id,
    sidecarFileName,
    sidecarText,
    delivery,
  };
}

function optionalBuildValue(
  value: string,
  placeholder: string,
): string | undefined {
  const normalized = value.trim();
  return normalized && normalized !== placeholder ? normalized : undefined;
}
