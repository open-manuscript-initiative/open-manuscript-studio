import type { OmiManuscript } from '../types/omi';
import { listOjsIssueTransferTargets, assertIssueArtifactTarget, issueArtifactInspectRequest, type OjsIssueTransferTarget } from '../model/ojsIssueTransferTargets';
import type { PreparedPublicationArtifact, PublicationArtifactReceipt, PublicationArtifactRequest, PublicationArtifactTarget } from '../services/publicationArtifact';
import { verifyPublicationBuildArtifact } from '../services/publicationBuildManifest';
import { assertOjsProductionTarget } from './ojsPublicationActions';

export type IssueBatchFormat = 'pdf-print' | 'html' | 'jats';
export interface IssueBatchSelection {
  rootSectionId: string;
  formats: readonly IssueBatchFormat[];
  locale: string;
  genreId: number;
}
export interface IssueBatchFile {
  rootSectionId: string;
  title: string;
  submissionId: number;
  publicationId: number;
  format: IssueBatchFormat;
  fileName: string;
  byteLength: number;
  buildId: string;
}
export interface IssueBatchResult {
  receipts: { rootSectionId: string; receipt: PublicationArtifactReceipt }[];
  failed?: { file: IssueBatchFile; message: string; outcome: 'not-sent' | 'unconfirmed' };
}
export interface IssueBatchDependencies {
  source: OmiManuscript;
  layoutKey: string;
  connectionId: string;
  currentSource: () => OmiManuscript;
  currentLayoutKey: () => string;
  currentConnectionId: () => string;
  send: (connectionId: string, request: PublicationArtifactRequest) => Promise<{
    target?: PublicationArtifactTarget; receipt?: PublicationArtifactReceipt;
  }>;
  /** Trusted local exporter, invoked once for each selected study, never after a write. */
  prepare: (target: OjsIssueTransferTarget, formats: readonly IssueBatchFormat[]) => Promise<readonly PreparedPublicationArtifact[]>;
}
export interface PreparedIssueBatch {
  readonly files: readonly Readonly<IssueBatchFile>[];
  execute: (confirmed: true) => Promise<IssueBatchResult>;
}

const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const formats = new Set<IssueBatchFormat>(['pdf-print', 'html', 'jats']);

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function mediaType(format: IssueBatchFormat): string {
  return format === 'html' ? 'text/html' : format === 'jats' ? 'application/xml' : 'application/pdf';
}
function checkFormat(target: PublicationArtifactTarget, format: IssueBatchFormat, size?: number): void {
  const cap = target.formats.find(item => item.id === format);
  if (!cap?.available || !Number.isSafeInteger(cap.maxBytes) || cap.maxBytes < 1 ||
      cap.mediaType.split(';')[0]?.trim() !== mediaType(format) ||
      (size !== undefined && size > Math.min(cap.maxBytes, MAX_FILE_BYTES))) {
    throw new Error('The inspected OJS target does not accept this format or size: ' + format);
  }
}

/**
 * Phase 1: inspect every selected article, then prepare every file locally.
 * Phase 2: explicit one-time confirmation, fresh all-target inspection, then
 * sequential writes. No automatic retry, rollback claim or publication action.
 */
export async function prepareOjsIssueBatch(
  dependencies: IssueBatchDependencies, selections: readonly IssueBatchSelection[],
): Promise<PreparedIssueBatch> {
  const { source, layoutKey, connectionId, currentSource, currentLayoutKey, currentConnectionId, send, prepare } = dependencies;
  const assertCurrent = () => {
    if (!connectionId || currentConnectionId() !== connectionId ||
        currentSource() !== source || currentLayoutKey() !== layoutKey) {
      throw new Error('Issue, layout or OJS connection changed. Prepare the batch again.');
    }
  };
  assertCurrent();
  const targets = listOjsIssueTransferTargets(source);
  const selected = new Map<string, IssueBatchSelection>();
  for (const row of selections) {
    if (selected.has(row.rootSectionId) || !row.formats.length ||
        new Set(row.formats).size !== row.formats.length || row.formats.some(format => !formats.has(format))) {
      throw new Error('Choose distinct supported formats for each selected study.');
    }
    selected.set(row.rootSectionId, structuredClone(row));
  }
  if (!selected.size || selected.size > 100 || [...selected.keys()].some(id => !targets.some(t => t.rootSectionId === id))) {
    throw new Error('Choose existing OJS-linked studies in this issue.');
  }
  const rows: { target: OjsIssueTransferTarget; selection: IssueBatchSelection; remote: PublicationArtifactTarget }[] = [];
  const inspect = async (target: OjsIssueTransferTarget, selection: IssueBatchSelection) => {
    assertCurrent();
    const result = await send(connectionId, issueArtifactInspectRequest(target, source.id));
    assertCurrent();
    if (!result.target || result.receipt) throw new Error('OJS did not return an inspection result.');
    const remote = result.target;
    assertIssueArtifactTarget(target, remote);
    assertOjsProductionTarget(remote);
    if (!remote.locales.includes(selection.locale) ||
        !Number.isSafeInteger(selection.genreId) || selection.genreId < 1 ||
        !remote.genres.some(genre => genre.id === selection.genreId)) {
      throw new Error('Choose an inspected language and file component.');
    }
    selection.formats.forEach(format => checkFormat(remote, format));
    return structuredClone(remote);
  };
  for (const target of targets) {
    const selection = selected.get(target.rootSectionId);
    if (selection) rows.push({ target, selection, remote: await inspect(target, selection) });
  }

  const staged: { file: IssueBatchFile; request: Extract<PublicationArtifactRequest, { action: 'transfer' }> }[] = [];
  let totalBytes = 0;
  for (const row of rows) {
    assertCurrent();
    const artifacts = await prepare(structuredClone(row.target), [...row.selection.formats]);
    assertCurrent();
    if (artifacts.length !== row.selection.formats.length ||
        new Set(artifacts.map(a => a.format)).size !== artifacts.length) throw new Error('Incomplete or duplicate study artifacts.');
    for (const format of row.selection.formats) {
      const a = artifacts.find(item => item.format === format);
      if (!a) throw new Error('Selected study artifact is missing.');
      const bytes = new Uint8Array(a.bytes);
      const build = structuredClone(a.build);
      checkFormat(row.remote, format, bytes.byteLength);
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES || !bytes.byteLength ||
          build.output.format !== format || build.output.fileName !== a.fileName ||
          build.output.mediaType !== a.mediaType || a.mediaType.split(';')[0]?.trim() !== mediaType(format) ||
          !verifyPublicationBuildArtifact(build, bytes) || !build.manuscript.id ||
          (format === 'pdf-print' && (build.manuscript.id !== source.id || build.manuscript.revisionId !== source.headRevisionId))) {
        throw new Error('Artifact provenance, media type or batch size is invalid.');
      }
      const file: IssueBatchFile = {
        rootSectionId: row.target.rootSectionId, title: row.target.title,
        submissionId: row.target.submissionId, publicationId: row.target.publicationId,
        format, fileName: a.fileName, byteLength: bytes.byteLength, buildId: build.id,
      };
      staged.push({ file, request: {
        action: 'transfer', manuscriptId: build.manuscript.id,
        submissionId: row.target.submissionId, publicationId: row.target.publicationId,
        expectedIssueId: row.target.issueId, expectedInstallationId: row.target.installationId,
        expectedWorkflowToken: row.remote.workflowToken!, locale: row.selection.locale,
        genreId: row.selection.genreId, format, mediaType: a.mediaType,
        fileName: a.fileName, artifactBase64: encodeBytes(bytes), build, confirmed: true,
      } });
    }
  }
  assertCurrent();
  let attempted = false;
  return {
    files: Object.freeze(staged.map(item => Object.freeze({ ...item.file }))),
    async execute(confirmed) {
      if (confirmed !== true || attempted) throw new Error('Confirm a fresh prepared batch; do not replay an attempted batch.');
      attempted = true;
      // All-target preflight before the first remote write. Do not silently
      // replace the original workflow tokens with newer ones.
      for (const row of rows) {
        const remote = await inspect(row.target, row.selection);
        if (remote.workflowToken !== row.remote.workflowToken) throw new Error('OJS workflow changed after inspection.');
        for (const item of staged.filter(item => item.file.rootSectionId === row.target.rootSectionId)) {
          checkFormat(remote, item.file.format, item.file.byteLength);
        }
      }
      const receipts: IssueBatchResult['receipts'] = [];
      for (const item of staged) {
        let sent = false;
        try {
          assertCurrent();
          sent = true;
          const { receipt } = await send(connectionId, structuredClone(item.request));
          if (!receipt || receipt.protocol !== 'omi-publication-artifact/1' ||
              receipt.submissionId !== item.request.submissionId || receipt.publicationId !== item.request.publicationId ||
              receipt.issueId !== item.request.expectedIssueId || receipt.format !== item.request.format ||
              receipt.sha256 !== item.request.build.output.digest.value || receipt.buildId !== item.request.build.id ||
              receipt.mediaType !== item.request.mediaType || receipt.provenanceVerified !== true || receipt.published !== false ||
              !Number.isSafeInteger(receipt.galleyId) || receipt.galleyId! < 1 ||
              !Number.isSafeInteger(receipt.submissionFileId) || receipt.submissionFileId < 1) {
            throw new Error('OJS did not return a matching receipt. Inspect before retrying.');
          }
          receipts.push({ rootSectionId: item.file.rootSectionId, receipt: structuredClone(receipt) });
        } catch (error) {
          return { receipts, failed: { file: { ...item.file }, outcome: sent ? 'unconfirmed' : 'not-sent',
            message: error instanceof Error ? error.message : String(error) } };
        }
      }
      return { receipts };
    },
  };
}
