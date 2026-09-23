import {
  createAccountHolderApprovedAssurance,
} from '../integrations/webPublicationContract';
import { ensureManuscriptRevisionStateDigests } from '../model/revisionIntegrity';
import { createManuscriptStateDigest } from '../model/stateDigest';
import {
  extractManuscriptState,
  OMI_VERSIONING_MODEL_VERSION,
} from '../model/versioning';
import type { OmiBibliographicRecord, OmiBlock, OmiManuscript } from '../types/omi';
import { getAssetPayload, putAssetPayload } from './assetRepository';
import { prepareWebPublicationArtifact } from './webPublicationArtifact';

export interface NativeEditorialAssetPayload {
  assetId: string;
  mediaType: string;
  checksum: string;
  bytesBase64: string;
}

export interface NativeReviewSnapshot {
  documentKind: 'article';
  authorIdentity: 'hidden';
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  blocks: Array<Record<string, unknown>>;
  bibliographicRecords: Array<Record<string, unknown>>;
}

export async function prepareNativeEditorialRevision(
  manuscript: OmiManuscript,
): Promise<{
  manuscriptId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  manuscriptStateSnapshot: ReturnType<typeof extractManuscriptState>;
  reviewSnapshot: NativeReviewSnapshot;
  assets: NativeEditorialAssetPayload[];
}> {
  const manuscriptStateSnapshot = extractManuscriptState(manuscript);
  const stateDigest = createManuscriptStateDigest(
    manuscriptStateSnapshot,
  ).value;
  const intent = manuscript.metadata?.publicationVenue?.type === 'BOOK_PUBLISHER'
    ? 'book-chapter'
    : 'scholarly-article';
  const artifact = await prepareWebPublicationArtifact(
    manuscript,
    createAccountHolderApprovedAssurance(intent),
  );
  const assets = await collectAssetPayloads(manuscript);
  const reviewSnapshot = await createNativeReviewSnapshot(manuscript);

  return {
    manuscriptId: manuscript.id,
    title: manuscript.title,
    revisionId: manuscript.headRevisionId,
    stateDigest,
    publicationContentDigest: artifact.publicationContentDigest,
    manuscriptStateSnapshot,
    reviewSnapshot,
    assets,
  };
}

export async function restoreNativeEditorialManuscript(input: {
  revisionId: string;
  manuscriptStateSnapshot: ReturnType<typeof extractManuscriptState>;
  assets: Array<{
    assetId: string;
    bytesBase64: string;
  }>;
}): Promise<OmiManuscript> {
  const state = JSON.parse(
    JSON.stringify(input.manuscriptStateSnapshot),
  ) as ReturnType<typeof extractManuscriptState>;
  for (const asset of input.assets) {
    await putAssetPayload(
      state.id,
      asset.assetId,
      base64ToBytes(asset.bytesBase64),
    );
  }
  const createdAt = state.updatedAt || state.createdAt || new Date().toISOString();
  const summary = 'Studio-native editorial submission snapshot';
  const manuscript = {
    ...state,
    versioningModelVersion: OMI_VERSIONING_MODEL_VERSION,
    headRevisionId: input.revisionId,
    revisionHistory: {
      profile: 'core-revision-history',
      completeness: 'shallow',
      rootRevisionId: input.revisionId,
      headRevisionId: input.revisionId,
      revisions: [{
        id: input.revisionId,
        parentRevisionIds: [],
        createdAt,
        summary,
        changeSet: {
          id: crypto.randomUUID(),
          summary,
          createdAt,
          events: [{
            id: crypto.randomUUID(),
            operation: 'manuscript.snapshot.create',
            targetId: state.id,
            path: '/',
            nextValue: {
              manuscriptId: state.id,
              title: state.title,
            },
            createdAt,
          }],
        },
        snapshot: {
          manuscriptId: state.id,
          state,
        },
      }],
    },
  } as OmiManuscript;
  return ensureManuscriptRevisionStateDigests(manuscript);
}

export async function createNativeReviewSnapshot(
  manuscript: OmiManuscript,
): Promise<NativeReviewSnapshot> {
  const blocks: Array<Record<string, unknown>> = [];
  for (const section of manuscript.sections) {
    if (section.title.trim()) {
      blocks.push({
        type: 'heading',
        text: section.title.trim(),
        level: 2,
      });
    }
    for (const block of section.blocks) {
      await appendReviewBlock(manuscript, block, blocks);
    }
  }

  return {
    documentKind: 'article',
    authorIdentity: 'hidden',
    title: manuscript.title,
    ...(manuscript.subtitle?.trim()
      ? { subtitle: manuscript.subtitle.trim() }
      : {}),
    ...(manuscript.abstract?.trim()
      ? { abstract: manuscript.abstract.trim() }
      : {}),
    keywords: [...manuscript.keywords],
    blocks,
    bibliographicRecords: (manuscript.bibliographicRecords ?? [])
      .map(toReviewBibliographicRecord),
  };
}

async function appendReviewBlock(
  manuscript: OmiManuscript,
  block: OmiBlock,
  output: Array<Record<string, unknown>>,
): Promise<void> {
  const visual = block.visual;
  if (visual?.kind === 'table') {
    output.push({
      type: 'table',
      cells: visual.cells.map((row) => [...row]),
      headerRows: visual.headerRows ?? 0,
    });
  } else if (visual?.kind === 'chart') {
    output.push({
      type: 'chart',
      cells: visual.cells.map((row) => [...row]),
      chartType: visual.chartType,
      ...(visual.title?.trim() ? { title: visual.title.trim() } : {}),
    });
  } else if (visual?.kind === 'image') {
    const src = await reviewImageSource(manuscript, visual);
    output.push({
      type: 'image',
      src,
      mediaType: visual.mediaType,
      ...(visual.alt?.trim() ? { alt: visual.alt.trim() } : {}),
    });
  } else {
    const text = blockText(block.content);
    if (text) {
      output.push({
        type: block.type === 'heading'
          ? 'heading'
          : block.type === 'quote'
            ? 'note'
            : 'paragraph',
        text,
        ...(block.type === 'heading' ? { level: 3 } : {}),
      });
    }
  }

  for (const child of block.children ?? []) {
    await appendReviewBlock(manuscript, child, output);
  }
}

async function reviewImageSource(
  manuscript: OmiManuscript,
  visual: Extract<NonNullable<OmiBlock['visual']>, { kind: 'image' }>,
): Promise<string> {
  if (visual.assetId) {
    const bytes = await getAssetPayload(manuscript.id, visual.assetId);
    if (!bytes) {
      throw new Error(
        `The image asset ${visual.assetId} is not available on this device.`,
      );
    }
    return `data:${visual.mediaType};base64,${bytesToBase64(bytes)}`;
  }
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(visual.src)) {
    return visual.src;
  }
  throw new Error(
    'Studio-native peer review requires embedded or locally available manuscript images.',
  );
}

async function collectAssetPayloads(
  manuscript: OmiManuscript,
): Promise<NativeEditorialAssetPayload[]> {
  const result: NativeEditorialAssetPayload[] = [];
  for (const asset of manuscript.assets ?? []) {
    const bytes = await getAssetPayload(manuscript.id, asset.id);
    if (!bytes) {
      throw new Error(
        `The manuscript asset ${asset.id} is missing from local storage.`,
      );
    }
    result.push({
      assetId: asset.id,
      mediaType: asset.mediaType,
      checksum: asset.checksum.value,
      bytesBase64: bytesToBase64(bytes),
    });
  }
  return result;
}

function blockText(content: string): string {
  if (!content.trim()) return '';
  try {
    return jsonNodeText(JSON.parse(content) as unknown)
      .replace(/\s+/gu, ' ')
      .trim();
  } catch {
    return content.replace(/\s+/gu, ' ').trim();
  }
}

function jsonNodeText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const node = value as Record<string, unknown>;
  const own = typeof node.text === 'string' ? node.text : '';
  const children = Array.isArray(node.content)
    ? node.content.map(jsonNodeText).join(
        node.type === 'paragraph' || node.type === 'heading' ? ' ' : '',
      )
    : '';
  return own + children;
}

function toReviewBibliographicRecord(
  record: OmiBibliographicRecord,
): Record<string, unknown> {
  return {
    sourceTag: record.id,
    type: record.type,
    title: record.title,
    ...(record.subtitle ? { subtitle: record.subtitle } : {}),
    contributors: record.contributors.map((contributor) => ({
      role: normalizeContributorRole(contributor.role),
      ...(contributor.givenName ? { givenName: contributor.givenName } : {}),
      ...(contributor.familyName ? { familyName: contributor.familyName } : {}),
      ...(contributor.literalName ? { literalName: contributor.literalName } : {}),
    })),
    ...(record.containerTitle ? { containerTitle: record.containerTitle } : {}),
    ...(record.issued ? { issued: record.issued } : {}),
    ...(record.publisher ? { publisher: record.publisher } : {}),
    ...(record.place ? { place: record.place } : {}),
    ...(record.volume ? { volume: record.volume } : {}),
    ...(record.issue ? { issue: record.issue } : {}),
    ...(record.pages ? { pages: record.pages } : {}),
    identifiers: record.identifiers.map((identifier) => ({
      scheme: identifier.scheme,
      value: identifier.value,
    })),
    ...(record.url ? { url: record.url } : {}),
  };
}

function normalizeContributorRole(
  role: string,
): 'author' | 'editor' | 'translator' | 'contributor' {
  if (role === 'author' || role === 'editor' || role === 'translator') {
    return role;
  }
  return 'contributor';
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
