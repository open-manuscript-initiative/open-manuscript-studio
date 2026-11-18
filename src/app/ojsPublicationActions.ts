import type { OmiManuscript } from '../types/omi';
import type {
  PublicationArtifactRequest,
  PublicationArtifactReceipt,
  PublicationArtifactTarget,
} from '../services/publicationArtifact';
import {
  prepareStyledPublicationArtifact,
  publicationLayoutKey,
  type PublicationLayoutContext,
  type StyledPublicationArtifact,
  type StyledPublicationFormat,
} from '../services/styledPublicationArtifact';

export function assertOjsProductionTarget(
  target: PublicationArtifactTarget,
): void {
  if (
    target.protocol !== 'omi-publication-artifact/1' ||
    target.published !== false ||
    !Number.isSafeInteger(target.submissionId) ||
    target.submissionId < 1 ||
    !Number.isSafeInteger(target.publicationId) ||
    target.publicationId < 1 ||
    !/^[a-f0-9]{64}$/.test(target.workflowToken ?? '') ||
    target.provenance?.required !== true ||
    target.provenance?.model !== 'omi-publication-build' ||
    target.provenance.version !== '0.1.0' ||
    target.provenance.digest !== 'sha256'
  )
    throw new Error(
      'Inspect an unpublished OJS Production target using Studio Integration 1.7 or newer.',
    );
}
export async function prepareOjsPublicationOutputs(
  source: OmiManuscript,
  context: PublicationLayoutContext,
  target: PublicationArtifactTarget,
  formats: readonly StyledPublicationFormat[],
  prepare = prepareStyledPublicationArtifact,
): Promise<StyledPublicationArtifact[]> {
  assertOjsProductionTarget(target);
  if (
    !formats.length ||
    new Set(formats).size !== formats.length ||
    formats.some(
      (format) => !['html', 'pdf-print', 'pdf-interactive'].includes(format),
    )
  )
    throw new Error('Select HTML and/or one PDF output.');
  if (formats.filter((format) => format !== 'html').length > 1)
    throw new Error('Select one PDF mode.');
  const snapshot = structuredClone(context);
  const outputs: StyledPublicationArtifact[] = [];
  // Prepare every selected file before any network write; no partially prepared batch is sent.
  for (const format of formats) {
    const capability = target.formats.find((item) => item.id === format);
    if (
      !capability?.available ||
      !Number.isSafeInteger(capability.maxBytes) ||
      capability.maxBytes < 1
    )
      throw new Error(`OJS does not accept ${format} on this installation.`);
    const artifact = await prepare(source, format, snapshot);
    if (
      artifact.layoutKey !== publicationLayoutKey(snapshot) ||
      artifact.bytes.byteLength > capability.maxBytes
    )
      throw new Error(
        `The ${format} output does not match the style snapshot or exceeds the OJS limit.`,
      );
    outputs.push(artifact);
  }
  return outputs;
}
export interface OjsOutputTransferResult {
  receipts: PublicationArtifactReceipt[];
  failed?: { format: StyledPublicationFormat; message: string };
}
/** Each native OJS file transfer is atomic; the multi-file batch is deliberately not. */
export async function transferOjsPublicationOutputs(input: {
  source: OmiManuscript;
  contextKey: string;
  target: PublicationArtifactTarget;
  locale: string;
  genreId: number;
  outputs: readonly StyledPublicationArtifact[];
  currentSource: () => OmiManuscript;
  currentContextKey: () => string;
  isDestinationCurrent: () => boolean;
  send: (
    request: PublicationArtifactRequest,
  ) => Promise<{ receipt?: PublicationArtifactReceipt }>;
  onReceipt?: (receipt: PublicationArtifactReceipt) => void;
}): Promise<OjsOutputTransferResult> {
  assertOjsProductionTarget(input.target);
  if (
    !input.outputs.length ||
    !input.target.locales.includes(input.locale) ||
    !input.target.genres.some((g) => g.id === input.genreId)
  )
    throw new Error('Choose an inspected OJS language and file genre.');
  const receipts: PublicationArtifactReceipt[] = [];
  for (const artifact of input.outputs) {
    try {
      if (
        !input.isDestinationCurrent() ||
        input.currentSource() !== input.source ||
        input.currentContextKey() !== input.contextKey ||
        artifact.layoutKey !== input.contextKey
      )
        throw new Error(
          'The manuscript or publisher style changed. Prepare the outputs again.',
        );
      const result = await input.send({
        action: 'transfer',
        manuscriptId: input.source.id,
        submissionId: input.target.submissionId,
        publicationId: input.target.publicationId,
        locale: input.locale,
        genreId: input.genreId,
        format: artifact.format,
        mediaType: artifact.mediaType,
        fileName: artifact.fileName,
        artifactBase64: artifact.artifactBase64,
        build: artifact.build,
        confirmed: true,
        expectedWorkflowToken: input.target.workflowToken!,
      });
      const receipt = result.receipt;
      if (
        !receipt ||
        receipt.protocol !== 'omi-publication-artifact/1' ||
        receipt.submissionId !== input.target.submissionId ||
        receipt.publicationId !== input.target.publicationId ||
        receipt.format !== artifact.format ||
        receipt.sha256 !== artifact.build.output.digest.value ||
        receipt.buildId !== artifact.build.id ||
        receipt.provenanceVerified !== true ||
        receipt.published !== false ||
        !Number.isSafeInteger(receipt.galleyId) ||
        receipt.galleyId! < 1
      )
        throw new Error(
          'OJS returned no matching file receipt. Inspect the destination before retrying.',
        );
      receipts.push(receipt);
      input.onReceipt?.(receipt);
    } catch (error) {
      return {
        receipts,
        failed: {
          format: artifact.format,
          message:
            error instanceof Error
              ? error.message
              : 'The OJS transfer could not be confirmed.',
        },
      };
    }
  }
  return { receipts };
}
