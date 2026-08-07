import { collectReferencedAssetIds, sha256Hex } from '../model/assets';
import { isValidLinearRevisionHistory } from '../model/versioning';
import {
  OMI_CONTAINER_MEDIA_TYPE,
  OMI_CONTAINER_VERSION,
  isSafeContainerPath,
  type OmiContainerDiagnostic,
  type OmiContainerManifest,
} from './omiContainer';
import type { OmiAsset } from '../types/assets';
import type {
  OmiBlock,
  OmiManuscript,
  OmiManuscriptState,
} from '../types/omi';

export const MAX_OMI_IMPORT_BYTES = 256 * 1024 * 1024;
export const MAX_OMI_IMPORT_ENTRIES = 2048;
export const MAX_OMI_IMPORT_ENTRY_BYTES = 128 * 1024 * 1024;
export const MAX_OMI_IMPORT_TOTAL_BYTES = 512 * 1024 * 1024;

interface ParsedZipEntry {
  path: string;
  bytes: Uint8Array;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
}

interface OmiChecksumFile {
  algorithm: 'sha256';
  canonicalization: 'raw-bytes';
  entries: Array<{
    path: string;
    algorithm: 'sha256';
    value: string;
    scope: 'raw-bytes';
  }>;
}

export interface OmiContainerImportedAsset {
  metadata: OmiAsset;
  bytes: Uint8Array;
  path: string;
}

export interface OmiContainerImportSummary {
  manuscriptId?: string;
  title?: string;
  headRevisionId?: string;
  entryCount: number;
  assetCount: number;
  revisionCount: number;
  declaredChecksums: number;
  verifiedChecksums: number;
  totalBytes: number;
}

export interface OmiContainerImportPlan {
  manuscript?: OmiManuscript;
  manifest?: OmiContainerManifest;
  assets: OmiContainerImportedAsset[];
  diagnostics: OmiContainerDiagnostic[];
  summary: OmiContainerImportSummary;
  validForImport: boolean;
}

export async function inspectOmiContainer(
  input: ArrayBuffer | Uint8Array,
): Promise<OmiContainerImportPlan> {
  const diagnostics: OmiContainerDiagnostic[] = [];
  const bytes = input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input);
  const emptySummary: OmiContainerImportSummary = {
    entryCount: 0,
    assetCount: 0,
    revisionCount: 0,
    declaredChecksums: 0,
    verifiedChecksums: 0,
    totalBytes: bytes.byteLength,
  };

  if (bytes.byteLength > MAX_OMI_IMPORT_BYTES) {
    diagnostics.push(errorDiagnostic(
      'container-too-large',
      `The OMI package exceeds the ${Math.round(MAX_OMI_IMPORT_BYTES / 1024 / 1024)} MB import limit.`,
    ));
    return invalidPlan(diagnostics, emptySummary);
  }

  let entries: Map<string, ParsedZipEntry>;
  try {
    entries = readStrictStoreZip(bytes);
  } catch (readError) {
    diagnostics.push(errorDiagnostic(
      'invalid-omi-archive',
      readError instanceof Error ? readError.message : 'The OMI archive could not be read safely.',
    ));
    return invalidPlan(diagnostics, emptySummary);
  }

  const summary: OmiContainerImportSummary = {
    ...emptySummary,
    entryCount: entries.size,
  };

  const required = [
    'META-INF/mimetype',
    'META-INF/manifest.json',
    'META-INF/checksums.json',
    'manuscript/document.json',
    'manuscript/history.json',
  ];
  for (const path of required) {
    if (!entries.has(path)) {
      diagnostics.push(errorDiagnostic(
        'required-container-member-missing',
        `Required OMI container member is missing: ${path}.`,
      ));
    }
  }

  const mimetype = decodeUtf8(entries.get('META-INF/mimetype')?.bytes);
  if (mimetype !== undefined && mimetype.trim() !== OMI_CONTAINER_MEDIA_TYPE) {
    diagnostics.push(errorDiagnostic(
      'invalid-container-mimetype',
      `Unsupported OMI container media type: ${mimetype.trim() || '(empty)'}.`,
    ));
  }

  const manifest = parseJsonEntry<OmiContainerManifest>(
    entries,
    'META-INF/manifest.json',
    diagnostics,
  );
  const checksums = parseJsonEntry<OmiChecksumFile>(
    entries,
    'META-INF/checksums.json',
    diagnostics,
  );
  const documentState = parseJsonEntry<OmiManuscriptState>(
    entries,
    'manuscript/document.json',
    diagnostics,
  );
  const historyEnvelope = parseJsonEntry<{
    versioningModelVersion: OmiManuscript['versioningModelVersion'];
    headRevisionId: OmiManuscript['headRevisionId'];
    revisionHistory: OmiManuscript['revisionHistory'];
  }>(entries, 'manuscript/history.json', diagnostics);

  validateManifest(manifest, entries, diagnostics);
  const verifiedChecksums = checksums
    ? await verifyChecksums(checksums, entries, diagnostics)
    : 0;
  summary.declaredChecksums = checksums?.entries.length ?? 0;
  summary.verifiedChecksums = verifiedChecksums;

  let manuscript: OmiManuscript | undefined;
  if (documentState && historyEnvelope) {
    manuscript = {
      ...documentState,
      ...historyEnvelope,
    };
    summary.manuscriptId = manuscript.id;
    summary.title = manuscript.title;
    summary.headRevisionId = manuscript.headRevisionId;
    summary.revisionCount = manuscript.revisionHistory?.revisions?.length ?? 0;
    validateManuscriptEnvelope(manuscript, manifest, diagnostics);
  }

  const importedAssets = manuscript && manifest
    ? await collectImportedAssets(manuscript, manifest, entries, diagnostics)
    : [];
  summary.assetCount = importedAssets.length;

  validatePackagedProfile(entries, manuscript, diagnostics);

  return {
    manuscript,
    manifest,
    assets: importedAssets,
    diagnostics,
    summary,
    validForImport:
      Boolean(manuscript && manifest && checksums) &&
      !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}

function invalidPlan(
  diagnostics: OmiContainerDiagnostic[],
  summary: OmiContainerImportSummary,
): OmiContainerImportPlan {
  return {
    assets: [],
    diagnostics,
    summary,
    validForImport: false,
  };
}

function readStrictStoreZip(bytes: Uint8Array): Map<string, ParsedZipEntry> {
  if (bytes.byteLength < 22) throw new Error('The file is too small to be a ZIP-compatible OMI container.');
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error('ZIP end-of-central-directory record is missing.');

  const eocd = viewAt(bytes, eocdOffset, 22);
  const diskNumber = eocd.getUint16(4, true);
  const centralDisk = eocd.getUint16(6, true);
  const entriesOnDisk = eocd.getUint16(8, true);
  const entryCount = eocd.getUint16(10, true);
  const centralSize = eocd.getUint32(12, true);
  const centralOffset = eocd.getUint32(16, true);
  const commentLength = eocd.getUint16(20, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error('Multi-disk ZIP containers are not supported.');
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 containers are not supported by this OMI alpha reader.');
  }
  if (entryCount > MAX_OMI_IMPORT_ENTRIES) {
    throw new Error(`The package contains more than ${MAX_OMI_IMPORT_ENTRIES} entries.`);
  }
  if (eocdOffset + 22 + commentLength !== bytes.byteLength) {
    throw new Error('Unexpected trailing data follows the ZIP directory.');
  }
  if (centralOffset + centralSize > eocdOffset) {
    throw new Error('The ZIP central directory exceeds package bounds.');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries = new Map<string, ParsedZipEntry>();
  const normalizedPaths = new Set<string>();
  let cursor = centralOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index += 1) {
    const central = viewAt(bytes, cursor, 46);
    if (central.getUint32(0, true) !== 0x02014b50) {
      throw new Error('Invalid ZIP central-directory entry signature.');
    }

    const versionMadeBy = central.getUint16(4, true);
    const flags = central.getUint16(8, true);
    const method = central.getUint16(10, true);
    const crc = central.getUint32(16, true);
    const compressedSize = central.getUint32(20, true);
    const uncompressedSize = central.getUint32(24, true);
    const nameLength = central.getUint16(28, true);
    const extraLength = central.getUint16(30, true);
    const entryCommentLength = central.getUint16(32, true);
    const externalAttributes = central.getUint32(38, true);
    const localOffset = central.getUint32(42, true);
    const completeCentralLength = 46 + nameLength + extraLength + entryCommentLength;

    ensureBounds(bytes, cursor, completeCentralLength);
    const path = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    if (!isSafeContainerPath(path)) throw new Error(`Unsafe container path: ${path}.`);
    const normalizedPath = path.normalize('NFC').toLowerCase();
    if (normalizedPaths.has(normalizedPath)) {
      throw new Error(`Duplicate or case-ambiguous container path: ${path}.`);
    }
    normalizedPaths.add(normalizedPath);

    if ((flags & 0x0001) !== 0) throw new Error(`Encrypted ZIP entry is not permitted: ${path}.`);
    if (method !== 0) {
      throw new Error(
        `Compression method ${method} is not accepted by the current OMI Draft reader (${path}).`,
      );
    }
    if (compressedSize !== uncompressedSize) {
      throw new Error(`Stored ZIP entry has inconsistent sizes: ${path}.`);
    }
    if (uncompressedSize > MAX_OMI_IMPORT_ENTRY_BYTES) {
      throw new Error(`Container entry exceeds the per-entry limit: ${path}.`);
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_OMI_IMPORT_TOTAL_BYTES) {
      throw new Error('The package exceeds the maximum allowed expanded size.');
    }

    const hostSystem = versionMadeBy >>> 8;
    const unixMode = externalAttributes >>> 16;
    if (hostSystem === 3 && (unixMode & 0xf000) === 0xa000) {
      throw new Error(`Symbolic links are not permitted in OMI containers: ${path}.`);
    }

    const local = viewAt(bytes, localOffset, 30);
    if (local.getUint32(0, true) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP header for ${path}.`);
    }
    const localFlags = local.getUint16(6, true);
    const localMethod = local.getUint16(8, true);
    const localCrc = local.getUint32(14, true);
    const localCompressedSize = local.getUint32(18, true);
    const localUncompressedSize = local.getUint32(22, true);
    const localNameLength = local.getUint16(26, true);
    const localExtraLength = local.getUint16(28, true);
    const localHeaderLength = 30 + localNameLength + localExtraLength;
    ensureBounds(bytes, localOffset, localHeaderLength);
    const localPath = decoder.decode(
      bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength),
    );
    if (
      localPath !== path ||
      localFlags !== flags ||
      localMethod !== method ||
      localCrc !== crc ||
      localCompressedSize !== compressedSize ||
      localUncompressedSize !== uncompressedSize
    ) {
      throw new Error(`ZIP local and central metadata disagree for ${path}.`);
    }

    const dataStart = localOffset + localHeaderLength;
    ensureBounds(bytes, dataStart, uncompressedSize);
    const payload = bytes.slice(dataStart, dataStart + uncompressedSize);
    if (crc32(payload) !== crc) throw new Error(`ZIP CRC-32 mismatch for ${path}.`);

    entries.set(path, {
      path,
      bytes: payload,
      crc32: crc,
      compressedSize,
      uncompressedSize,
    });
    cursor += completeCentralLength;
  }

  if (cursor !== centralOffset + centralSize) {
    throw new Error('ZIP central-directory size does not match its entries.');
  }
  return entries;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.byteLength - 22 - 0xffff);
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
}

function viewAt(bytes: Uint8Array, offset: number, length: number): DataView {
  ensureBounds(bytes, offset, length);
  return new DataView(bytes.buffer, bytes.byteOffset + offset, length);
}

function ensureBounds(bytes: Uint8Array, offset: number, length: number): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > bytes.byteLength
  ) {
    throw new Error('ZIP structure exceeds package bounds.');
  }
}

function parseJsonEntry<T>(
  entries: ReadonlyMap<string, ParsedZipEntry>,
  path: string,
  diagnostics: OmiContainerDiagnostic[],
): T | undefined {
  const entry = entries.get(path);
  if (!entry) return undefined;
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes)) as T;
  } catch {
    diagnostics.push(errorDiagnostic('invalid-json-member', `Invalid UTF-8 JSON in ${path}.`));
    return undefined;
  }
}

function decodeUtf8(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes) return undefined;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function validateManifest(
  manifest: OmiContainerManifest | undefined,
  entries: ReadonlyMap<string, ParsedZipEntry>,
  diagnostics: OmiContainerDiagnostic[],
): void {
  if (!manifest) return;
  if (
    manifest.format !== 'OMI' ||
    manifest.mediaType !== OMI_CONTAINER_MEDIA_TYPE ||
    manifest.containerVersion !== OMI_CONTAINER_VERSION
  ) {
    diagnostics.push(errorDiagnostic(
      'unsupported-container-version',
      'The package does not declare the OMI container format/version supported by this Studio build.',
    ));
  }
  if (!Array.isArray(manifest.entries)) {
    diagnostics.push(errorDiagnostic('invalid-manifest', 'The OMI manifest entries collection is invalid.'));
    return;
  }

  const declared = new Map<string, OmiContainerManifest['entries'][number]>();
  const normalized = new Set<string>();
  for (const item of manifest.entries) {
    if (!item || typeof item.path !== 'string' || !isSafeContainerPath(item.path)) {
      diagnostics.push(errorDiagnostic('invalid-manifest-path', 'The manifest contains an unsafe or invalid path.'));
      continue;
    }
    const normalizedPath = item.path.normalize('NFC').toLowerCase();
    if (declared.has(item.path) || normalized.has(normalizedPath)) {
      diagnostics.push(errorDiagnostic('duplicate-manifest-path', `Duplicate manifest path: ${item.path}.`));
      continue;
    }
    declared.set(item.path, item);
    normalized.add(normalizedPath);
    if (!entries.has(item.path)) {
      diagnostics.push(errorDiagnostic('manifest-member-missing', `Manifest declares a missing member: ${item.path}.`));
    }
  }

  for (const path of entries.keys()) {
    if (!declared.has(path)) {
      diagnostics.push(errorDiagnostic('undeclared-container-member', `Package member is not declared by the manifest: ${path}.`));
    }
  }
}

async function verifyChecksums(
  checksums: OmiChecksumFile,
  entries: ReadonlyMap<string, ParsedZipEntry>,
  diagnostics: OmiContainerDiagnostic[],
): Promise<number> {
  if (
    checksums.algorithm !== 'sha256' ||
    checksums.canonicalization !== 'raw-bytes' ||
    !Array.isArray(checksums.entries)
  ) {
    diagnostics.push(errorDiagnostic('unsupported-checksum-profile', 'Unsupported or invalid OMI checksum profile.'));
    return 0;
  }

  const declarations = new Map<string, OmiChecksumFile['entries'][number]>();
  for (const declaration of checksums.entries) {
    if (
      !declaration ||
      typeof declaration.path !== 'string' ||
      !isSafeContainerPath(declaration.path) ||
      declaration.algorithm !== 'sha256' ||
      declaration.scope !== 'raw-bytes' ||
      !/^[a-f0-9]{64}$/i.test(declaration.value)
    ) {
      diagnostics.push(errorDiagnostic('invalid-checksum-entry', 'The checksum file contains an invalid declaration.'));
      continue;
    }
    if (declarations.has(declaration.path)) {
      diagnostics.push(errorDiagnostic('duplicate-checksum-path', `Duplicate checksum path: ${declaration.path}.`));
      continue;
    }
    declarations.set(declaration.path, declaration);
  }

  let verified = 0;
  for (const [path, entry] of entries) {
    if (path === 'META-INF/checksums.json') continue;
    const declaration = declarations.get(path);
    if (!declaration) {
      diagnostics.push(errorDiagnostic('checksum-missing', `No SHA-256 checksum is declared for ${path}.`));
      continue;
    }
    const digest = await sha256Hex(entry.bytes);
    if (digest.toLowerCase() !== declaration.value.toLowerCase()) {
      diagnostics.push(errorDiagnostic('checksum-mismatch', `SHA-256 verification failed for ${path}.`));
      continue;
    }
    verified += 1;
  }

  for (const path of declarations.keys()) {
    if (path === 'META-INF/checksums.json') {
      diagnostics.push(errorDiagnostic(
        'self-checksum-unsupported',
        'checksums.json must not declare a checksum for itself in the current raw-byte profile.',
      ));
    } else if (!entries.has(path)) {
      diagnostics.push(errorDiagnostic('checksum-member-missing', `Checksum declares a missing member: ${path}.`));
    }
  }
  return verified;
}

function validateManuscriptEnvelope(
  manuscript: OmiManuscript,
  manifest: OmiContainerManifest | undefined,
  diagnostics: OmiContainerDiagnostic[],
): void {
  if (
    !manuscript ||
    typeof manuscript.id !== 'string' ||
    typeof manuscript.title !== 'string' ||
    !Array.isArray(manuscript.sections) ||
    !Array.isArray(manuscript.agents) ||
    !Array.isArray(manuscript.contributions) ||
    !Array.isArray(manuscript.annotations) ||
    !Array.isArray(manuscript.citations)
  ) {
    diagnostics.push(errorDiagnostic('invalid-manuscript-state', 'The packaged manuscript state is structurally invalid.'));
    return;
  }
  if (
    manuscript.versioningModelVersion !== 'OMI-SPEC-160@0.1.0' ||
    !manuscript.revisionHistory ||
    !Array.isArray(manuscript.revisionHistory.revisions)
  ) {
    diagnostics.push(errorDiagnostic('invalid-versioning-envelope', 'The packaged OMI revision envelope is invalid.'));
    return;
  }
  try {
    if (!isValidLinearRevisionHistory(manuscript.revisionHistory)) {
      diagnostics.push(errorDiagnostic('invalid-revision-history', 'The packaged revision history is not a valid linear OMI history.'));
    }
  } catch {
    diagnostics.push(errorDiagnostic('invalid-revision-history', 'The packaged revision history cannot be validated safely.'));
  }

  if (manuscript.headRevisionId !== manuscript.revisionHistory.headRevisionId) {
    diagnostics.push(errorDiagnostic('head-revision-mismatch', 'The manuscript and revision history declare different head revisions.'));
  }
  if (manifest) {
    if (manifest.manuscriptId !== manuscript.id) {
      diagnostics.push(errorDiagnostic('manifest-manuscript-mismatch', 'The manifest manuscript ID does not match document.json.'));
    }
    if (manifest.headRevisionId !== manuscript.headRevisionId) {
      diagnostics.push(errorDiagnostic('manifest-revision-mismatch', 'The manifest head revision does not match history.json.'));
    }
  }

  const head = manuscript.revisionHistory.revisions.find(
    (revision) => revision.id === manuscript.headRevisionId,
  );
  if (!head || head.snapshot?.manuscriptId !== manuscript.id) {
    diagnostics.push(errorDiagnostic('head-snapshot-missing', 'The declared head revision does not contain this manuscript snapshot.'));
  } else if (
    stableComparableState(head.snapshot.state) !==
    stableComparableState(stripEnvelope(manuscript))
  ) {
    diagnostics.push(errorDiagnostic(
      'document-history-head-mismatch',
      'Portable document.json does not represent the same semantic state as the committed head snapshot.',
    ));
  }
}

async function collectImportedAssets(
  manuscript: OmiManuscript,
  manifest: OmiContainerManifest,
  entries: ReadonlyMap<string, ParsedZipEntry>,
  diagnostics: OmiContainerDiagnostic[],
): Promise<OmiContainerImportedAsset[]> {
  const assets = manuscript.assets ?? [];
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const referenced = collectReferencedAssetIds(
    manuscript.sections.flatMap((section) => section.blocks),
  );
  const result: OmiContainerImportedAsset[] = [];

  for (const assetId of referenced) {
    if (!assetMap.has(assetId)) {
      diagnostics.push(errorDiagnostic('asset-metadata-missing', `Referenced asset metadata is missing: ${assetId}.`, assetId));
    }
  }

  const manifestAssets = manifest.entries.filter((entry) => entry.assetId);
  for (const item of manifestAssets) {
    const assetId = item.assetId as string;
    const metadata = assetMap.get(assetId);
    if (!metadata) {
      diagnostics.push(errorDiagnostic('unknown-manifest-asset', `Manifest asset is absent from document metadata: ${assetId}.`, assetId));
      continue;
    }
    const entry = entries.get(item.path);
    if (!entry) continue;
    if (item.mediaType !== metadata.mediaType) {
      diagnostics.push(errorDiagnostic('asset-media-type-mismatch', `Asset media type differs between manifest and manuscript metadata: ${assetId}.`, assetId));
    }
    const digest = await sha256Hex(entry.bytes);
    if (entry.bytes.byteLength !== metadata.size || digest.toLowerCase() !== metadata.checksum.value.toLowerCase()) {
      diagnostics.push(errorDiagnostic('asset-integrity-mismatch', `Asset bytes do not match manuscript metadata: ${assetId}.`, assetId));
      continue;
    }
    result.push({ metadata, bytes: entry.bytes, path: item.path });
  }

  for (const metadata of assets) {
    if (!manifestAssets.some((entry) => entry.assetId === metadata.id)) {
      diagnostics.push(errorDiagnostic('asset-manifest-entry-missing', `Asset metadata has no manifest payload entry: ${metadata.id}.`, metadata.id));
    }
  }
  return result;
}

function validatePackagedProfile(
  entries: ReadonlyMap<string, ParsedZipEntry>,
  manuscript: OmiManuscript | undefined,
  diagnostics: OmiContainerDiagnostic[],
): void {
  const profileEntry = entries.get('profiles/publication-profile.json');
  if (!profileEntry) return;
  try {
    const profile = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(profileEntry.bytes)) as {
      id?: string;
      version?: string;
    };
    const reference = (manuscript as OmiManuscript & {
      publicationProfile?: { id?: string; version?: string };
    } | undefined)?.publicationProfile;
    if (reference && (reference.id !== profile.id || reference.version !== profile.version)) {
      diagnostics.push(errorDiagnostic(
        'publication-profile-mismatch',
        'The packaged publication profile does not match the manuscript profile reference.',
      ));
    }
  } catch {
    diagnostics.push(errorDiagnostic('invalid-publication-profile', 'The packaged publication profile is not valid UTF-8 JSON.'));
  }
}

function stripEnvelope(manuscript: OmiManuscript): OmiManuscriptState {
  const {
    versioningModelVersion: _versioningModelVersion,
    headRevisionId: _headRevisionId,
    revisionHistory: _revisionHistory,
    ...state
  } = manuscript;
  return state;
}

function stableComparableState(state: OmiManuscriptState): string {
  return JSON.stringify(sortJson(normalizeAssetPreviewFields(state)));
}

function normalizeAssetPreviewFields(state: OmiManuscriptState): OmiManuscriptState {
  return {
    ...state,
    sections: state.sections.map((section) => ({
      ...section,
      blocks: normalizeBlockPreviews(section.blocks),
    })),
  };
}

function normalizeBlockPreviews(blocks: readonly OmiBlock[]): OmiBlock[] {
  return blocks.map((block) => ({
    ...block,
    visual:
      block.visual?.kind === 'image' && block.visual.assetId
        ? { ...block.visual, src: '' }
        : block.visual,
    children: block.children ? normalizeBlockPreviews(block.children) : block.children,
  }));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortJson(item)]),
  );
}

function errorDiagnostic(
  code: string,
  message: string,
  targetId?: string,
): OmiContainerDiagnostic {
  return { code, severity: 'error', message, targetId };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
