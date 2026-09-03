import { createHash } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import { requireWorkspaceRole } from './peerReviewService.js';

export type ReviewInlineSemantic =
  | 'strong'
  | 'emphasis'
  | 'strike'
  | 'underline'
  | 'small-caps'
  | 'superscript'
  | 'subscript'
  | 'code';

export interface ReviewCitationReference {
  sourceTags: string[];
  label: string;
}

export interface ReviewInlineSpan {
  text: string;
  semantics?: ReviewInlineSemantic[];
  language?: string;
  href?: string;
  citation?: ReviewCitationReference;
}

export interface ReviewBibliographicContributor {
  role: 'author' | 'editor' | 'translator' | 'contributor';
  givenName?: string;
  familyName?: string;
  literalName?: string;
}

export interface ReviewBibliographicRecord {
  sourceTag: string;
  type: string;
  title: string;
  subtitle?: string;
  contributors: ReviewBibliographicContributor[];
  containerTitle?: string;
  issued?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  identifiers: Array<{ scheme: string; value: string }>;
  url?: string;
}

export type ReviewChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area';

export type ReviewManuscriptBlock =
  | { type: 'heading'; text: string; level?: number; richText?: ReviewInlineSpan[] }
  | { type: 'paragraph'; text: string; richText?: ReviewInlineSpan[] }
  | { type: 'note'; text: string; richText?: ReviewInlineSpan[] }
  | { type: 'list'; text: string; ordered: boolean; listLevel: number; ordinal?: number; richText?: ReviewInlineSpan[] }
  | { type: 'table'; cells: string[][]; headerRows: number }
  | { type: 'image'; src: string; mediaType: string; alt?: string }
  | { type: 'chart'; cells: string[][]; chartType: ReviewChartType; title?: string };

export interface ReviewManuscriptSnapshot {
  documentKind: 'article';
  authorIdentity: 'hidden';
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  blocks: ReviewManuscriptBlock[];
  bibliographicRecords: ReviewBibliographicRecord[];
}

export interface AuthorFacingReviewRevision {
  reviewerAlias: string;
  manuscript: ReviewManuscriptSnapshot | null;
  revisionUpdatedAt?: string;
}

export interface OjsReviewAssignmentInput {
  reviewerUserId: string;
  installationId: string;
  contextId: string;
  externalAssignmentId: string;
  externalSubmissionId: string;
  reviewDocumentId?: string;
  reviewRound?: number;
  platform?: 'ojs' | 'omp';
}

export async function upsertOjsReviewAssignment(
  input: OjsReviewAssignmentInput,
): Promise<{ id: string }> {
  const reviewDocumentId = input.reviewDocumentId ?? input.externalSubmissionId;
  const existing = await prisma.peerReviewAssignment.findUnique({
    where: {
      externalInstallationId_externalAssignmentId: {
        externalInstallationId: input.installationId,
        externalAssignmentId: input.externalAssignmentId,
      },
    },
    select: {
      id: true,
      reviewerUserId: true,
      manuscriptId: true,
      externalSubmissionId: true,
    },
  });

  if (existing) {
    const legacyParentBinding = existing.manuscriptId === input.externalSubmissionId
      && (existing.externalSubmissionId === null
        || existing.externalSubmissionId === input.externalSubmissionId);
    if (
      existing.reviewerUserId !== input.reviewerUserId ||
      (!legacyParentBinding && existing.manuscriptId !== reviewDocumentId) ||
      (!legacyParentBinding
        && existing.externalSubmissionId !== null
        && existing.externalSubmissionId !== input.externalSubmissionId)
    ) {
      const error = new Error('The external review assignment is already linked to a different Studio account or article.');
      error.name = 'ForbiddenError';
      throw error;
    }

    await prisma.peerReviewAssignment.update({
      where: { id: existing.id },
      data: {
        manuscriptId: reviewDocumentId,
        externalSubmissionId: input.externalSubmissionId,
        anonymityMode: 'DOUBLE_BLIND',
      },
    });
    return { id: existing.id };
  }

  const workspaceId = `${input.platform ?? 'ojs'}:${createHash('sha256')
    .update(`${input.installationId}:${input.contextId}`)
    .digest('hex')
    .slice(0, 40)}`;
  const reviewRound = Number.isInteger(input.reviewRound) && (input.reviewRound ?? 0) > 0
    ? Math.min(99, input.reviewRound as number)
    : 1;

  const assignment = await prisma.peerReviewAssignment.create({
    data: {
      workspaceId,
      manuscriptId: reviewDocumentId,
      reviewerUserId: input.reviewerUserId,
      assignedByUserId: null,
      externalInstallationId: input.installationId,
      externalAssignmentId: input.externalAssignmentId,
      externalSubmissionId: input.externalSubmissionId,
      reviewerAlias: 'Reviewer',
      assignmentType: 'SCIENTIFIC_REVIEW',
      reviewRound,
      anonymityMode: 'DOUBLE_BLIND',
      status: 'INVITED',
    },
    select: { id: true },
  });

  return assignment;
}

export async function setReviewManuscript(
  editorUserId: string,
  assignmentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, workspaceId: true },
  });

  if (!assignment) throw notFound();
  await requireWorkspaceRole(assignment.workspaceId, editorUserId, 'EDITOR');
  return storeSnapshot(assignmentId, input);
}

export async function setReviewManuscriptFromOjs(
  assignmentId: string,
  reviewDocumentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, manuscriptId: true },
  });

  if (!assignment) throw notFound();
  if (assignment.manuscriptId !== reviewDocumentId) {
    const error = new Error('The external article does not match this review assignment.');
    error.name = 'ForbiddenError';
    throw error;
  }

  return storeSnapshot(assignmentId, input);
}

export async function getReviewManuscriptForReviewer(
  reviewerUserId: string,
  assignmentId: string,
): Promise<ReviewManuscriptSnapshot | null> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { manuscriptSnapshot: true },
  });

  if (!assignment) throw notFound();
  if (!assignment.manuscriptSnapshot) return null;

  return sanitizeReviewManuscript(assignment.manuscriptSnapshot);
}

export async function getReviewRevisionForReviewer(
  reviewerUserId: string,
  assignmentId: string,
): Promise<ReviewManuscriptSnapshot | null> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { manuscriptSnapshot: true, reviewRevisionSnapshot: true },
  });

  if (!assignment) throw notFound();
  const source = assignment.reviewRevisionSnapshot ?? assignment.manuscriptSnapshot;
  return source ? sanitizeReviewManuscript(source) : null;
}

export async function saveReviewRevisionForReviewer(
  reviewerUserId: string,
  assignmentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { id: true, status: true },
  });

  if (!assignment) throw notFound();
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    throw new Error('The review revision can only be edited while the review is accepted or in progress.');
  }

  const revision = sanitizeReviewManuscript(input);
  await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: {
      reviewRevisionSnapshot: revision as unknown as Prisma.InputJsonValue,
      revisionUpdatedAt: new Date(),
      status: 'IN_PROGRESS',
    },
  });
  return revision;
}

export async function getReviewRevisionForAuthor(
  authorUserId: string,
  assignmentId: string,
): Promise<AuthorFacingReviewRevision> {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      workspaceId: true,
      reviewerAlias: true,
      status: true,
      reviewRevisionSnapshot: true,
      revisionUpdatedAt: true,
    },
  });

  if (!assignment) throw notFound();
  await requireWorkspaceRole(assignment.workspaceId, authorUserId, 'AUTHOR');
  if (!['SUBMITTED', 'COMPLETED'].includes(assignment.status)) {
    const error = new Error('The review revision is not available to the author until the review has been submitted.');
    error.name = 'ForbiddenError';
    throw error;
  }

  return {
    reviewerAlias: assignment.reviewerAlias,
    manuscript: assignment.reviewRevisionSnapshot
      ? sanitizeReviewManuscript(assignment.reviewRevisionSnapshot)
      : null,
    ...(assignment.revisionUpdatedAt
      ? { revisionUpdatedAt: assignment.revisionUpdatedAt.toISOString() }
      : {}),
  };
}

async function storeSnapshot(
  assignmentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const snapshot = sanitizeReviewManuscript(input);
  await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: {
      manuscriptSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  return snapshot;
}

export function sanitizeReviewManuscript(input: unknown): ReviewManuscriptSnapshot {
  const record = asRecord(input);
  const title = cleanText(record.title, 500) || 'Untitled article';
  const subtitle = cleanText(record.subtitle, 500);
  const abstract = cleanText(record.abstract, 20_000);
  const keywords = Array.isArray(record.keywords)
    ? record.keywords
        .map((value) => cleanText(value, 200))
        .filter((value): value is string => Boolean(value))
        .slice(0, 100)
    : [];

  const rawBlocks = Array.isArray(record.blocks) ? record.blocks : [];
  const blocks: ReviewManuscriptBlock[] = [];

  for (const rawBlock of rawBlocks.slice(0, 20_000)) {
    const block = asRecord(rawBlock);

    if (block.type === 'table') {
      const cells = sanitizeCells(block.cells);
      if (!cells.length) continue;
      const headerRows = typeof block.headerRows === 'number'
        ? Math.max(0, Math.min(cells.length, Math.trunc(block.headerRows)))
        : 0;
      blocks.push({ type: 'table', cells, headerRows });
      continue;
    }

    if (block.type === 'chart') {
      const cells = sanitizeCells(block.cells);
      if (!cells.length) continue;
      const chartType = sanitizeChartType(block.chartType);
      const chartTitle = cleanText(block.title, 1_000);
      blocks.push({
        type: 'chart',
        cells,
        chartType,
        ...(chartTitle ? { title: chartTitle } : {}),
      });
      continue;
    }

    if (block.type === 'image') {
      const src = cleanImageSource(block.src);
      if (!src) continue;
      const mediaType = cleanText(block.mediaType, 200) || 'application/octet-stream';
      const alt = cleanText(block.alt, 4_000);
      blocks.push({
        type: 'image',
        src,
        mediaType,
        ...(alt ? { alt } : {}),
      });
      continue;
    }

    const text = cleanText(block.text, 200_000);
    if (!text) continue;
    const richText = sanitizeRichText(block.richText);

    if (block.type === 'heading') {
      const level = typeof block.level === 'number'
        ? Math.max(1, Math.min(6, Math.trunc(block.level)))
        : undefined;
      blocks.push({
        type: 'heading',
        text,
        ...(level !== undefined ? { level } : {}),
        ...(richText.length ? { richText } : {}),
      });
      continue;
    }

    if (block.type === 'note') {
      blocks.push({ type: 'note', text, ...(richText.length ? { richText } : {}) });
      continue;
    }

    if (block.type === 'list') {
      const listLevel = typeof block.listLevel === 'number'
        ? Math.max(0, Math.min(8, Math.trunc(block.listLevel)))
        : 0;
      const ordinal = typeof block.ordinal === 'number' && Number.isFinite(block.ordinal)
        ? Math.max(1, Math.min(99_999, Math.trunc(block.ordinal)))
        : undefined;
      blocks.push({
        type: 'list',
        text,
        ordered: block.ordered === true,
        listLevel,
        ...(ordinal !== undefined ? { ordinal } : {}),
        ...(richText.length ? { richText } : {}),
      });
      continue;
    }

    blocks.push({ type: 'paragraph', text, ...(richText.length ? { richText } : {}) });
  }

  return {
    // Reviewer snapshots are an allow-listed, article-only projection. These
    // literals are deliberately not copied from input, so a stored payload
    // cannot opt into book chrome or author identity disclosure.
    documentKind: 'article',
    authorIdentity: 'hidden',
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(abstract ? { abstract } : {}),
    keywords,
    blocks,
    bibliographicRecords: sanitizeBibliographicRecords(record.bibliographicRecords),
  };
}

function sanitizeCells(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  const rows: string[][] = [];
  for (const rawRow of value.slice(0, 2_000)) {
    if (!Array.isArray(rawRow)) continue;
    const row = rawRow
      .slice(0, 100)
      .map((cell) => cleanText(cell, 20_000) ?? '');
    if (row.length) rows.push(row);
  }
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
}

function sanitizeRichText(value: unknown): ReviewInlineSpan[] {
  if (!Array.isArray(value)) return [];
  const spans: ReviewInlineSpan[] = [];
  for (const rawSpan of value.slice(0, 20_000)) {
    const span = asRecord(rawSpan);
    const text = cleanInlineText(span.text, 200_000);
    if (!text) continue;
    const semantics = Array.isArray(span.semantics)
      ? span.semantics.filter(isInlineSemantic).slice(0, 8)
      : [];
    const language = cleanText(span.language, 100);
    const href = cleanExternalUrl(span.href);
    const citation = sanitizeCitationReference(span.citation, text);
    spans.push({
      text,
      ...(semantics.length ? { semantics } : {}),
      ...(language ? { language } : {}),
      ...(href ? { href } : {}),
      ...(citation ? { citation } : {}),
    });
  }
  return spans;
}

function sanitizeCitationReference(value: unknown, fallbackLabel: string): ReviewCitationReference | undefined {
  const record = asRecord(value);
  const sourceTags = Array.isArray(record.sourceTags)
    ? record.sourceTags
        .map((item) => cleanText(item, 500))
        .filter((item): item is string => Boolean(item))
        .slice(0, 100)
    : [];
  if (!sourceTags.length) return undefined;
  const label = cleanInlineText(record.label, 5_000) ?? fallbackLabel;
  return { sourceTags, label };
}

function sanitizeBibliographicRecords(value: unknown): ReviewBibliographicRecord[] {
  if (!Array.isArray(value)) return [];
  const result: ReviewBibliographicRecord[] = [];
  const seen = new Set<string>();

  for (const rawRecord of value.slice(0, 10_000)) {
    const record = asRecord(rawRecord);
    const sourceTag = cleanText(record.sourceTag, 500);
    const title = cleanText(record.title, 5_000);
    if (!sourceTag || !title || seen.has(sourceTag)) continue;
    seen.add(sourceTag);

    const contributors: ReviewBibliographicContributor[] = [];
    if (Array.isArray(record.contributors)) {
      for (const rawContributor of record.contributors.slice(0, 100)) {
        const contributor = asRecord(rawContributor);
        const role = sanitizeBibliographicRole(contributor.role);
        const givenName = cleanText(contributor.givenName, 500);
        const familyName = cleanText(contributor.familyName, 500);
        const literalName = cleanText(contributor.literalName, 1_000);
        if (!givenName && !familyName && !literalName) continue;
        contributors.push({
          role,
          ...(givenName ? { givenName } : {}),
          ...(familyName ? { familyName } : {}),
          ...(literalName ? { literalName } : {}),
        });
      }
    }

    const identifiers: Array<{ scheme: string; value: string }> = [];
    if (Array.isArray(record.identifiers)) {
      for (const rawIdentifier of record.identifiers.slice(0, 100)) {
        const identifier = asRecord(rawIdentifier);
        const scheme = cleanText(identifier.scheme, 100);
        const identifierValue = cleanText(identifier.value, 5_000);
        if (scheme && identifierValue) identifiers.push({ scheme, value: identifierValue });
      }
    }

    const type = cleanText(record.type, 200) ?? 'document';
    const subtitle = cleanText(record.subtitle, 5_000);
    const containerTitle = cleanText(record.containerTitle, 5_000);
    const issued = cleanText(record.issued, 500);
    const publisher = cleanText(record.publisher, 2_000);
    const place = cleanText(record.place, 1_000);
    const volume = cleanText(record.volume, 500);
    const issue = cleanText(record.issue, 500);
    const pages = cleanText(record.pages, 500);
    const url = cleanExternalUrl(record.url);

    result.push({
      sourceTag,
      type,
      title,
      contributors,
      identifiers,
      ...(subtitle ? { subtitle } : {}),
      ...(containerTitle ? { containerTitle } : {}),
      ...(issued ? { issued } : {}),
      ...(publisher ? { publisher } : {}),
      ...(place ? { place } : {}),
      ...(volume ? { volume } : {}),
      ...(issue ? { issue } : {}),
      ...(pages ? { pages } : {}),
      ...(url ? { url } : {}),
    });
  }

  return result;
}

function sanitizeBibliographicRole(value: unknown): ReviewBibliographicContributor['role'] {
  if (value === 'editor' || value === 'translator' || value === 'contributor') return value;
  return 'author';
}

function isInlineSemantic(value: unknown): value is ReviewInlineSemantic {
  return value === 'strong' || value === 'emphasis' || value === 'strike' ||
    value === 'underline' || value === 'small-caps' || value === 'superscript' ||
    value === 'subscript' || value === 'code';
}

function sanitizeChartType(value: unknown): ReviewChartType {
  return value === 'line' || value === 'pie' || value === 'scatter' || value === 'area'
    ? value
    : 'bar';
}

function cleanImageSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 35 * 1024 * 1024) return undefined;
  const normalized = value.replace(/\u0000/g, '').trim();
  if (/^https:\/\//i.test(normalized)) return normalized;
  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(normalized)) return normalized;
  return undefined;
}

function cleanExternalUrl(value: unknown): string | undefined {
  const normalized = cleanText(value, 10_000);
  return normalized && /^https?:\/\//i.test(normalized) ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\u0000/g, '').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function cleanInlineText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\u0000/g, '').slice(0, maxLength);
  return normalized.length ? normalized : undefined;
}

function notFound(): Error {
  const error = new Error('The review assignment was not found.');
  error.name = 'NotFoundError';
  return error;
}
