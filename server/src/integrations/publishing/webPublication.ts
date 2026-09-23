import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { assertEditorialDecisionEvidence } from '../../services/editorialDecisionService.js';
import { writeIntegrationAuditEvent } from '../integrationAudit.js';
import { decryptSecret, type EncryptedSecret } from '../secretCrypto.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';

export const WEB_PUBLICATION_PROTOCOL = 'omi-web-publication/1' as const;
export const WEB_PUBLICATION_APPROVAL =
  'account-holder-approves-exact-web-publication-v1' as const;

const GRANT_TTL_MS = 10 * 60 * 1000;
const IN_FLIGHT_RECONCILIATION_MS = 2 * 60 * 1000;
const MAX_HTML_BYTES = 8 * 1024 * 1024;

export type WebPublicationIntent =
  | 'public-interest'
  | 'popular-science'
  | 'newsletter'
  | 'scholarly-article'
  | 'book-chapter';
export type WebPublicationTargetStatus = 'draft' | 'publish';

interface WebPublicationAssuranceBase {
  model: 'omi-publication-assurance';
  version: '1';
  intent: WebPublicationIntent;
  disclosure: 'visible-and-machine-readable';
}

export interface UnreviewedWebPublicationAssurance
  extends WebPublicationAssuranceBase {
  reviewStatus: 'not-peer-reviewed';
  approvalAuthority: 'authenticated-account-holder';
}

export interface EditorialDecisionEvidence {
  type: 'studio-editorial-decision';
  decisionId: string;
  evidenceDigest: string;
  reviewRound: number;
  decidedAt: string;
}

export interface StudioReviewedWebPublicationAssurance
  extends WebPublicationAssuranceBase {
  reviewStatus: 'peer-reviewed';
  approvalAuthority: 'studio-editorial-decision';
  evidence: EditorialDecisionEvidence;
}

export type WebPublicationAssurance =
  | UnreviewedWebPublicationAssurance
  | StudioReviewedWebPublicationAssurance;

export interface WebPublicationApprovalInput {
  connectionId: string;
  connectionVersion: string;
  manuscriptId: string;
  title: string;
  status: WebPublicationTargetStatus;
  assurance: WebPublicationAssurance;
  artifact: {
    html: string;
    build: unknown;
  };
  idempotencyKey: string;
  confirmation: typeof WEB_PUBLICATION_APPROVAL;
}

export interface WebPublicationReceipt {
  deliveryId: string;
  connectionId: string;
  connectionVersion: string;
  providerId: 'wordpress' | 'web-publishing';
  manuscriptId: string;
  revisionId: string;
  buildId: string;
  externalId: string | null;
  externalUrl: string | null;
  contentDigest: string;
  deliveredContentDigest: string;
  status: WebPublicationTargetStatus;
  assurance: WebPublicationAssurance;
  deliveryState: 'succeeded';
  updatedAt: string;
}

export interface WebPublicationGrantResult {
  grant?: {
    grantId: string;
    deliveryId: string;
    executionToken: string;
    expiresAt: string;
  };
  receipt?: WebPublicationReceipt;
}

interface PublicationBuild {
  model: 'omi-publication-build';
  version: '0.1.0';
  id: string;
  createdAt: string;
  manuscript: {
    id: string;
    revisionId: string;
    stateDigest: {
      algorithm: 'sha256';
      value: string;
      canonicalization: string;
    };
  };
  profile: {
    id: string;
    version: string;
    digest: {
      algorithm: 'sha256';
      value: string;
      canonicalization: 'omi-publication-profile-json-v1';
    };
  };
  output: {
    format: 'html';
    mediaType: string;
    fileName: string;
    byteLength: number;
    digest: { algorithm: 'sha256'; value: string };
  };
  rendererInput?: {
    mediaType: string;
    byteLength: number;
    digest: { algorithm: 'sha256'; value: string };
  };
  generator: {
    application: 'open-manuscript-studio';
    applicationVersion: string;
    applicationBuild?: string;
    applicationCommit?: string;
    renderer: string;
    rendererVersion: string;
  };
}

interface ConfigRecord {
  [key: string]: unknown;
}

interface ExternalDeliveryResult {
  providerId: 'wordpress' | 'web-publishing';
  externalId: string | null;
  externalUrl: string | null;
  deliveredContentDigest: string;
}

export class WebPublicationServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

class RemotePublicationError extends Error {
  constructor(
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

export async function issueWebPublicationApproval(
  userId: string,
  input: WebPublicationApprovalInput,
): Promise<WebPublicationGrantResult> {
  if (input.confirmation !== WEB_PUBLICATION_APPROVAL) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_CONFIRMATION_REQUIRED',
      400,
      'Explicit approval of this exact web-publication artifact is required.',
    );
  }

  const connection = await prisma.userIntegration.findFirst({
    where: {
      id: input.connectionId,
      userId,
      enabled: true,
      providerId: { in: ['wordpress', 'web-publishing'] },
    },
  });
  if (!connection) {
    throw new WebPublicationServiceError(
      'WEB_PUBLISHING_TARGET_NOT_FOUND',
      404,
      'The selected personal web publishing target was not found.',
    );
  }
  assertConnectionVersion(connection.updatedAt, input.connectionVersion);

  const build = validatePublicationArtifact(input);
  await verifyReviewedAssurance(userId, input.manuscriptId, build, input.assurance);
  const contentDigest = digest(input.artifact.html);
  const requestDigest = digest(canonicalJson({
    connectionId: input.connectionId,
    connectionVersion: input.connectionVersion,
    manuscriptId: input.manuscriptId,
    title: input.title,
    status: input.status,
    assurance: input.assurance,
    buildId: build.id,
    contentDigest,
  }));

  const existing = await prisma.webPublicationDelivery.findUnique({
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing && existing.requestDigest !== requestDigest) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_IDEMPOTENCY_CONFLICT',
      409,
      'The idempotency key is already bound to different publication bytes or policy.',
    );
  }
  if (existing?.state === 'SUCCEEDED') {
    return { receipt: receiptFromDelivery(existing, connection.providerId) };
  }

  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
  const artifactBuild = build as unknown as Prisma.InputJsonValue;
  const assurance = input.assurance as unknown as Prisma.InputJsonValue;

  const { delivery, grant } = await prisma.$transaction(async (transaction) => {
    const delivery = await transaction.webPublicationDelivery.upsert({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      update: {},
      create: {
        userId,
        connectionId: connection.id,
        connectionVersion: connection.updatedAt,
        manuscriptId: input.manuscriptId,
        revisionId: build.manuscript.revisionId,
        buildId: build.id,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
        contentDigest,
        title: input.title,
        artifactHtml: input.artifact.html,
        artifactBuild,
        intent: input.assurance.intent,
        assurance,
        targetStatus: input.status.toUpperCase(),
        state: 'PENDING',
      },
    });
    if (delivery.requestDigest !== requestDigest) {
      throw new WebPublicationServiceError(
        'WEB_PUBLICATION_IDEMPOTENCY_CONFLICT',
        409,
        'The idempotency key is already bound to different publication bytes or policy.',
      );
    }
    if (delivery.state === 'SUCCEEDED') {
      return { delivery, grant: null };
    }
    if (!delivery.artifactHtml || !delivery.title) {
      throw new WebPublicationServiceError(
        'WEB_PUBLICATION_PAYLOAD_UNAVAILABLE',
        409,
        'The retained delivery payload is unavailable. Prepare the artifact again.',
      );
    }
    const grant = await transaction.webPublicationApprovalGrant.create({
      data: {
        userId,
        connectionId: connection.id,
        deliveryId: delivery.id,
        tokenHash: digest(rawToken),
        requestDigest,
        expiresAt,
      },
    });
    return { delivery, grant };
  });

  if (!grant) {
    return { receipt: receiptFromDelivery(delivery, connection.providerId) };
  }

  await writeIntegrationAuditEvent({
    id: randomUUID(),
    userId,
    providerId: connection.providerId,
    operation: 'web-publication.approval-grant.issue',
    scope: { kind: 'manuscript', id: input.manuscriptId },
    input: input.artifact.html,
    permissions: ['publication.deliver'],
    directWrite: false,
    status: 'SUCCESS',
    detail: {
      deliveryId: delivery.id,
      buildId: build.id,
      revisionId: build.manuscript.revisionId,
      intent: input.assurance.intent,
      reviewStatus: input.assurance.reviewStatus,
      ...(input.assurance.reviewStatus === 'peer-reviewed'
        ? {
            editorialDecisionId: input.assurance.evidence.decisionId,
            editorialEvidenceDigest: input.assurance.evidence.evidenceDigest,
          }
        : {}),
      targetStatus: input.status,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    grant: {
      grantId: grant.id,
      deliveryId: delivery.id,
      executionToken: rawToken,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export async function executeWebPublicationDelivery(
  userId: string,
  deliveryId: string,
  executionToken: string,
): Promise<WebPublicationReceipt> {
  const tokenHash = digest(executionToken);
  const grant = await prisma.webPublicationApprovalGrant.findFirst({
    where: { userId, deliveryId },
    orderBy: { createdAt: 'desc' },
    include: { delivery: true },
  });
  if (
    !grant ||
    !safeDigestEqual(grant.tokenHash, tokenHash) ||
    grant.expiresAt.getTime() <= Date.now()
  ) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_GRANT_INVALID',
      403,
      'The web-publication execution grant is invalid or expired.',
    );
  }
  const initial = grant.delivery;
  if (initial.requestDigest !== grant.requestDigest) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_GRANT_SCOPE_MISMATCH',
      403,
      'The execution grant is not bound to this delivery payload.',
    );
  }

  const connection = await prisma.userIntegration.findFirst({
    where: {
      id: initial.connectionId,
      userId,
      enabled: true,
      providerId: { in: ['wordpress', 'web-publishing'] },
    },
  });
  if (!connection) {
    throw new WebPublicationServiceError(
      'WEB_PUBLISHING_TARGET_NOT_FOUND',
      404,
      'The selected personal web publishing target was not found.',
    );
  }
  if (connection.updatedAt.getTime() !== initial.connectionVersion.getTime()) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_TARGET_CHANGED',
      409,
      'The selected publishing target changed after approval. Review the target and artifact again.',
    );
  }
  if (initial.state === 'SUCCEEDED') {
    return receiptFromDelivery(initial, connection.providerId);
  }
  const storedAssurance = initial.assurance as unknown as WebPublicationAssurance;
  assertAssurance(storedAssurance);
  await verifyReviewedAssurance(
    userId,
    initial.manuscriptId,
    parsePublicationBuild(initial.artifactBuild),
    storedAssurance,
  );

  const staleBefore = new Date(Date.now() - IN_FLIGHT_RECONCILIATION_MS);
  const acquired = await prisma.webPublicationDelivery.updateMany({
    where: {
      id: initial.id,
      userId,
      OR: [
        { state: { in: ['PENDING', 'FAILED', 'UNKNOWN'] } },
        { state: 'IN_FLIGHT', updatedAt: { lt: staleBefore } },
      ],
    },
    data: {
      state: 'IN_FLIGHT',
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });
  if (!acquired.count) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_DELIVERY_BUSY',
      409,
      'This publication delivery is already in progress.',
    );
  }
  if (!grant.consumedAt) {
    await prisma.webPublicationApprovalGrant.updateMany({
      where: { id: grant.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  const delivery = await prisma.webPublicationDelivery.findUniqueOrThrow({
    where: { id: initial.id },
  });
  const artifactHtml = delivery.artifactHtml;
  const title = delivery.title;
  if (!artifactHtml || !title) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_PAYLOAD_UNAVAILABLE',
      409,
      'The retained publication payload is unavailable.',
    );
  }
  const deliveryInput: DeliveryInput = {
    ...delivery,
    artifactHtml,
    title,
  };

  try {
    const result = connection.providerId === 'wordpress'
      ? await deliverToWordPress(userId, connection, deliveryInput)
      : await deliverToGenericEndpoint(connection, deliveryInput);
    const completedAt = new Date();
    const updated = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.webPublicationDelivery.update({
        where: { id: delivery.id },
        data: {
          state: 'SUCCEEDED',
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          deliveredContentDigest: result.deliveredContentDigest,
          lastError: null,
          completedAt,
          // The durable record retains provenance but not manuscript content.
          artifactHtml: null,
          title: null,
        },
      });
      await transaction.webPublication.upsert({
        where: {
          userId_connectionId_manuscriptId: {
            userId,
            connectionId: connection.id,
            manuscriptId: delivery.manuscriptId,
          },
        },
        update: {
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          contentDigest: delivery.contentDigest,
          status: delivery.targetStatus,
        },
        create: {
          userId,
          connectionId: connection.id,
          manuscriptId: delivery.manuscriptId,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          contentDigest: delivery.contentDigest,
          status: delivery.targetStatus,
        },
      });
      return updated;
    });

    await writeIntegrationAuditEvent({
      id: randomUUID(),
      userId,
      providerId: result.providerId,
      operation: 'web-publication.deliver',
      scope: { kind: 'manuscript', id: delivery.manuscriptId },
      input: artifactHtml,
      permissions: ['publication.deliver'],
      directWrite: true,
      status: 'SUCCESS',
      detail: {
        deliveryId: delivery.id,
        buildId: delivery.buildId,
        revisionId: delivery.revisionId,
        idempotencyKey: delivery.idempotencyKey,
        intent: delivery.intent,
        reviewStatus: storedAssurance.reviewStatus,
        ...(storedAssurance.reviewStatus === 'peer-reviewed'
          ? { editorialDecisionId: storedAssurance.evidence.decisionId }
          : {}),
        targetStatus: delivery.targetStatus.toLowerCase(),
        externalId: result.externalId,
        deliveredContentDigest: result.deliveredContentDigest,
      },
    });

    return receiptFromDelivery(updated, connection.providerId);
  } catch (error) {
    const uncertain = !(error instanceof RemotePublicationError) ||
      error.status === null || error.status >= 500;
    const state = uncertain ? 'UNKNOWN' : 'FAILED';
    const message = safeErrorMessage(error);
    await prisma.webPublicationDelivery.update({
      where: { id: delivery.id },
      data: { state, lastError: message.slice(0, 4000) },
    });
    await writeIntegrationAuditEvent({
      id: randomUUID(),
      userId,
      providerId: connection.providerId,
      operation: 'web-publication.deliver',
      scope: { kind: 'manuscript', id: delivery.manuscriptId },
      input: artifactHtml,
      permissions: ['publication.deliver'],
      directWrite: true,
      status: 'ERROR',
      detail: {
        deliveryId: delivery.id,
        buildId: delivery.buildId,
        idempotencyKey: delivery.idempotencyKey,
        reviewStatus: storedAssurance.reviewStatus,
        ...(storedAssurance.reviewStatus === 'peer-reviewed'
          ? { editorialDecisionId: storedAssurance.evidence.decisionId }
          : {}),
        deliveryState: state.toLowerCase(),
        error: message,
      },
    });
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_DELIVERY_FAILED',
      uncertain ? 502 : 422,
      message,
    );
  }
}

function validatePublicationArtifact(
  input: WebPublicationApprovalInput,
): PublicationBuild {
  assertAssurance(input.assurance);
  const bytes = new TextEncoder().encode(input.artifact.html);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_HTML_BYTES) {
    throw invalidArtifact('The HTML artifact exceeds the allowed size.');
  }
  const build = parsePublicationBuild(input.artifact.build);
  if (build.manuscript.id !== input.manuscriptId) {
    throw invalidArtifact('The publication build belongs to a different manuscript.');
  }
  if (
    build.output.byteLength !== bytes.byteLength ||
    build.output.digest.value.toLowerCase() !== digest(input.artifact.html)
  ) {
    throw invalidArtifact('The HTML bytes do not match the publication build manifest.');
  }
  const identity = { ...build } as Record<string, unknown>;
  delete identity.id;
  delete identity.createdAt;
  const identityDigest = digest(canonicalJson(identity));
  if (build.id !== `urn:omi:publication-build:sha256:${identityDigest}`) {
    throw invalidArtifact('The publication build identifier is invalid.');
  }
  validatePublicationHtml(input.artifact.html, input, build);
  return build;
}

function parsePublicationBuild(value: unknown): PublicationBuild {
  const build = record(value);
  const manuscript = record(build.manuscript);
  const stateDigest = record(manuscript.stateDigest);
  const profile = record(build.profile);
  const profileDigest = record(profile.digest);
  const output = record(build.output);
  const outputDigest = record(output.digest);
  const generator = record(build.generator);
  if (
    build.model !== 'omi-publication-build' ||
    build.version !== '0.1.0' ||
    !isBuildId(build.id) ||
    !isIsoDate(build.createdAt) ||
    typeof manuscript.id !== 'string' || !manuscript.id ||
    typeof manuscript.revisionId !== 'string' || !manuscript.revisionId ||
    stateDigest.algorithm !== 'sha256' || !isSha256(stateDigest.value) ||
    typeof stateDigest.canonicalization !== 'string' || !stateDigest.canonicalization ||
    typeof profile.id !== 'string' || !profile.id ||
    typeof profile.version !== 'string' || !profile.version ||
    profileDigest.algorithm !== 'sha256' || !isSha256(profileDigest.value) ||
    profileDigest.canonicalization !== 'omi-publication-profile-json-v1' ||
    output.format !== 'html' ||
    typeof output.mediaType !== 'string' || !/^text\/html\b/i.test(output.mediaType) ||
    typeof output.fileName !== 'string' || !output.fileName.endsWith('.html') ||
    !Number.isInteger(output.byteLength) || Number(output.byteLength) < 1 ||
    outputDigest.algorithm !== 'sha256' || !isSha256(outputDigest.value) ||
    generator.application !== 'open-manuscript-studio' ||
    typeof generator.applicationVersion !== 'string' || !generator.applicationVersion ||
    generator.renderer !== 'open-manuscript-studio-web-publication' ||
    typeof generator.rendererVersion !== 'string' || !generator.rendererVersion
  ) {
    throw invalidArtifact('The publication build manifest is invalid or is not a web-publication HTML build.');
  }
  return value as PublicationBuild;
}

function validatePublicationHtml(
  html: string,
  input: WebPublicationApprovalInput,
  build: PublicationBuild,
): void {
  const lower = html.toLowerCase();
  if (!lower.startsWith('<!doctype html>') || !lower.includes('<article ')) {
    throw invalidArtifact('The web publication is not a complete semantic HTML artifact.');
  }
  for (const forbidden of ['<script', '<iframe', '<object', '<embed', '<form', '<base', '<link']) {
    if (lower.includes(forbidden)) {
      throw invalidArtifact(`The web publication contains forbidden active content: ${forbidden}.`);
    }
  }
  if (/\son[a-z]+\s*=|javascript\s*:/i.test(html)) {
    throw invalidArtifact('The web publication contains an executable HTML handler or URL.');
  }
  for (const source of html.matchAll(/\s(?:src|poster)=["']([^"']+)["']/gi)) {
    if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(source[1] ?? '')) {
      throw invalidArtifact('The web publication may not load remote embedded resources.');
    }
  }
  for (const cssUrl of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (!/^data:/i.test(cssUrl[1] ?? '')) {
      throw invalidArtifact('The web publication CSS may not load remote resources.');
    }
  }
  if (
    metaContent(html, 'omi-manuscript-id') !== input.manuscriptId ||
    metaContent(html, 'omi-head-revision') !== build.manuscript.revisionId ||
    metaContent(html, 'omi-state-digest-sha256')?.toLowerCase() !==
      build.manuscript.stateDigest.value.toLowerCase() ||
    metaContent(html, 'omi-publication-intent') !== input.assurance.intent ||
    metaContent(html, 'omi-review-status') !== input.assurance.reviewStatus ||
    metaContent(html, 'omi-approval-authority') !== input.assurance.approvalAuthority
  ) {
    throw invalidArtifact('The visible artifact metadata does not match its manuscript, revision, or assurance policy.');
  }
  if (
    !hasVisibleAssuranceDisclosure(html, input.assurance)
  ) {
    throw invalidArtifact(`A visible ${input.assurance.reviewStatus} publication disclosure is required.`);
  }
  if (input.assurance.reviewStatus === 'peer-reviewed') {
    if (
      metaContent(html, 'omi-editorial-decision-id') !==
        input.assurance.evidence.decisionId ||
      metaContent(html, 'omi-editorial-evidence-sha256')?.toLowerCase() !==
        input.assurance.evidence.evidenceDigest.toLowerCase()
    ) {
      throw invalidArtifact('The peer-review seal does not match its editorial-decision evidence.');
    }
  } else if (
    metaContent(html, 'omi-editorial-decision-id') !== undefined ||
    metaContent(html, 'omi-editorial-evidence-sha256') !== undefined
  ) {
    throw invalidArtifact('A non-peer-reviewed artifact may not carry editorial-decision evidence.');
  }
}

function assertAssurance(assurance: WebPublicationAssurance): void {
  const commonInvalid =
    assurance.model !== 'omi-publication-assurance' ||
    assurance.version !== '1' ||
    ![
      'public-interest',
      'popular-science',
      'newsletter',
      'scholarly-article',
      'book-chapter',
    ].includes(assurance.intent) ||
    assurance.disclosure !== 'visible-and-machine-readable';
  const unreviewedValid = assurance.reviewStatus === 'not-peer-reviewed' &&
    assurance.approvalAuthority === 'authenticated-account-holder' &&
    !('evidence' in assurance);
  const reviewedValid = assurance.reviewStatus === 'peer-reviewed' &&
    assurance.approvalAuthority === 'studio-editorial-decision' &&
    validEditorialEvidence(assurance.evidence);
  if (commonInvalid || (!unreviewedValid && !reviewedValid)) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_ASSURANCE_INVALID',
      400,
      'Web publication requires either an explicit non-peer-reviewed disclosure or verified Studio editorial-decision evidence.',
    );
  }
}

async function verifyReviewedAssurance(
  userId: string,
  manuscriptId: string,
  build: PublicationBuild,
  assurance: WebPublicationAssurance,
): Promise<void> {
  if (assurance.reviewStatus !== 'peer-reviewed') return;
  let verified: EditorialDecisionEvidence;
  try {
    verified = await assertEditorialDecisionEvidence({
      userId,
      manuscriptId,
      revisionId: build.manuscript.revisionId,
      stateDigest: build.manuscript.stateDigest.value,
      decisionId: assurance.evidence.decisionId,
      evidenceDigest: assurance.evidence.evidenceDigest,
    });
  } catch (error) {
    const forbidden = error instanceof Error && error.name === 'ForbiddenError';
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_ASSURANCE_INVALID',
      forbidden ? 403 : 409,
      error instanceof Error
        ? error.message
        : 'The Studio editorial-decision evidence could not be verified.',
    );
  }
  if (
    verified.reviewRound !== assurance.evidence.reviewRound ||
    verified.decidedAt !== assurance.evidence.decidedAt
  ) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_ASSURANCE_INVALID',
      409,
      'The supplied editorial-decision metadata does not match the server evidence.',
    );
  }
}

function validEditorialEvidence(value: unknown): value is EditorialDecisionEvidence {
  const evidence = record(value);
  return evidence.type === 'studio-editorial-decision' &&
    typeof evidence.decisionId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidence.decisionId) &&
    isSha256(evidence.evidenceDigest) &&
    Number.isInteger(evidence.reviewRound) && Number(evidence.reviewRound) > 0 &&
    isIsoDate(evidence.decidedAt);
}

function hasVisibleAssuranceDisclosure(
  html: string,
  assurance: WebPublicationAssurance,
): boolean {
  const disclosure = html.match(
    /<aside\b[^>]*class="[^"]*omi-publication-assurance[^"]*"[^>]*>[\s\S]*?<\/aside>/i,
  )?.[0];
  if (!disclosure) return false;
  const opening = disclosure.match(/^<aside\b[^>]*>/i)?.[0];
  const seal = disclosure.match(
    /<span\b[^>]*class="[^"]*omi-publication-assurance__seal[^"]*"[^>]*>([^<]+)<\/span>/i,
  );
  if (!opening || !seal) return false;
  const openingStyle = attribute(opening, 'style')?.toLowerCase() ?? '';
  const sealStyle = attribute(seal[0], 'style')?.toLowerCase() ?? '';
  const expectedSeal = assurance.reviewStatus === 'peer-reviewed'
    ? 'OMI PEER REVIEW VERIFIED'
    : 'OMI PEER REVIEW NOT VERIFIED';
  const hiddenStyle = /(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)|color\s*:\s*transparent|font-size\s*:\s*0|transform\s*:|clip-path\s*:(?!\s*none)|position\s*:\s*(?:absolute|fixed))/i;
  return attribute(opening, 'data-omi-assurance-version') === '1' &&
    attribute(opening, 'data-omi-publication-intent') === assurance.intent &&
    attribute(opening, 'data-omi-review-status') === assurance.reviewStatus &&
    attribute(opening, 'role') === 'note' &&
    !/\shidden(?:\s|=|>)/i.test(opening) &&
    attribute(opening, 'aria-hidden') !== 'true' &&
    openingStyle.includes('display:flex!important') &&
    openingStyle.includes('visibility:visible!important') &&
    sealStyle.includes('display:inline-grid!important') &&
    sealStyle.includes('visibility:visible!important') &&
    !hiddenStyle.test(openingStyle) &&
    !hiddenStyle.test(sealStyle) &&
    (seal[1] ?? '').replace(/\s+/g, ' ').trim() === expectedSeal &&
    (assurance.reviewStatus === 'not-peer-reviewed' ||
      attribute(opening, 'data-omi-editorial-decision-id') === assurance.evidence.decisionId);
}

function attribute(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(
    new RegExp(`\\s${escaped}=["']([^"']*)["']`, 'i'),
  )?.[1];
}

async function deliverToWordPress(
  userId: string,
  connection: {
    id: string;
    providerId: string;
    config: unknown;
    encryptedSecret: string | null;
  },
  delivery: DeliveryInput,
): Promise<ExternalDeliveryResult> {
  const config = configRecord(connection.config);
  const baseUrl = stringConfig(config, 'baseUrl');
  const username = stringConfig(config, 'username');
  const secret = parseEncryptedSecret(connection.encryptedSecret);
  if (!baseUrl || !username || !secret) {
    throw new RemotePublicationError(
      400,
      'WordPress publishing requires a site URL, username, and application password.',
    );
  }
  await assertTrustedIntegrationUrl(baseUrl, baseUrl);
  const previous = await prisma.webPublication.findUnique({
    where: {
      userId_connectionId_manuscriptId: {
        userId,
        connectionId: connection.id,
        manuscriptId: delivery.manuscriptId,
      },
    },
  });
  const slug = `omi-${digest(`${userId}:${connection.id}:${delivery.manuscriptId}`).slice(0, 40)}`;
  let externalId = previous?.externalId ?? await findWordPressPostId(
    baseUrl,
    username,
    secret,
    slug,
  );
  let content = wordpressArticleHtml(delivery.artifactHtml);
  content = await uploadWordPressImages(
    content,
    baseUrl,
    username,
    secret,
    delivery.contentDigest,
  );
  const path = externalId
    ? `wp-json/wp/v2/posts/${encodeURIComponent(externalId)}`
    : 'wp-json/wp/v2/posts';
  const response = await wordpressRequest(baseUrl, path, username, secret, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: delivery.title,
      content,
      status: delivery.targetStatus.toLowerCase(),
      slug,
    }),
  });
  if (!response.ok) {
    throw new RemotePublicationError(
      response.status,
      `WordPress publication failed: ${await responseMessage(response)}`,
    );
  }
  const post = await limitedJson(response) as { id?: number; link?: string };
  if (!Number.isInteger(post.id)) {
    throw new RemotePublicationError(null, 'WordPress did not return a post identifier.');
  }
  externalId = String(post.id);
  return {
    providerId: 'wordpress',
    externalId,
    externalUrl: await trustedReceiptUrl(post.link, baseUrl),
    deliveredContentDigest: digest(content),
  };
}

async function deliverToGenericEndpoint(
  connection: {
    id: string;
    providerId: string;
    authenticationMode: string;
    config: unknown;
    encryptedSecret: string | null;
  },
  delivery: DeliveryInput,
): Promise<ExternalDeliveryResult> {
  const config = configRecord(connection.config);
  const endpoint = stringConfig(config, 'endpoint');
  if (!endpoint) {
    throw new RemotePublicationError(400, 'The generic web publishing endpoint is missing.');
  }
  const trustedEndpoint = await assertTrustedIntegrationUrl(endpoint, endpoint);
  const secret = parseEncryptedSecret(connection.encryptedSecret);
  const headers = genericHeaders(connection.authenticationMode, config, secret);
  headers.set('Idempotency-Key', delivery.idempotencyKey);
  const previous = await prisma.webPublication.findUnique({
    where: {
      userId_connectionId_manuscriptId: {
        userId: delivery.userId,
        connectionId: connection.id,
        manuscriptId: delivery.manuscriptId,
      },
    },
  });
  let response: Response;
  try {
    response = await fetch(trustedEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        protocol: WEB_PUBLICATION_PROTOCOL,
        delivery: {
          id: delivery.id,
          idempotencyKey: delivery.idempotencyKey,
        },
        manuscript: {
          id: delivery.manuscriptId,
          revisionId: delivery.revisionId,
          title: delivery.title,
        },
        publication: {
          targetStatus: delivery.targetStatus.toLowerCase(),
          assurance: delivery.assurance,
        },
        artifact: {
          mediaType: 'text/html;charset=utf-8',
          html: delivery.artifactHtml,
          sha256: delivery.contentDigest,
          build: delivery.artifactBuild,
        },
        previous: previous
          ? {
              externalId: previous.externalId,
              externalUrl: previous.externalUrl,
            }
          : null,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw new RemotePublicationError(null, safeErrorMessage(error));
  }
  if (!response.ok) {
    throw new RemotePublicationError(
      response.status,
      `Web publication failed: ${await responseMessage(response)}`,
    );
  }
  const receipt = await limitedJson(response) as {
    id?: string | number;
    externalId?: string | number;
    url?: string;
    externalUrl?: string;
  };
  const receiptId = receipt.externalId ?? receipt.id;
  return {
    providerId: 'web-publishing',
    externalId: receiptId === undefined
      ? previous?.externalId ?? null
      : String(receiptId),
    externalUrl: await trustedReceiptUrl(
      receipt.externalUrl ?? receipt.url,
      endpoint,
    ) ?? previous?.externalUrl ?? null,
    deliveredContentDigest: digest(delivery.artifactHtml),
  };
}

type DeliveryInput = {
  id: string;
  userId: string;
  manuscriptId: string;
  revisionId: string;
  buildId: string;
  idempotencyKey: string;
  contentDigest: string;
  title: string;
  artifactHtml: string;
  artifactBuild: unknown;
  intent: string;
  assurance: unknown;
  targetStatus: string;
};

async function findWordPressPostId(
  baseUrl: string,
  username: string,
  secret: string,
  slug: string,
): Promise<string | null> {
  const response = await wordpressRequest(
    baseUrl,
    'wp-json/wp/v2/posts',
    username,
    secret,
    { method: 'GET' },
    {
      slug,
      context: 'edit',
      status: 'any',
      per_page: '1',
      _fields: 'id',
    },
  );
  if (!response.ok) {
    throw new RemotePublicationError(
      response.status,
      `WordPress reconciliation failed: ${await responseMessage(response)}`,
    );
  }
  const posts = await limitedJson(response) as Array<{ id?: number }>;
  return Number.isInteger(posts[0]?.id) ? String(posts[0]!.id) : null;
}

async function uploadWordPressImages(
  html: string,
  baseUrl: string,
  username: string,
  applicationPassword: string,
  contentDigest: string,
): Promise<string> {
  let output = html;
  const matches = Array.from(
    html.matchAll(/src=["'](data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+))["']/gi),
  );
  if (matches.length > 64) {
    throw new RemotePublicationError(422, 'A WordPress publication may contain at most 64 embedded images.');
  }

  let index = 0;
  for (const match of matches) {
    const source = match[1];
    const subtype = match[2]?.toLowerCase();
    const payload = match[3];
    if (!source || !subtype || !payload) continue;
    const mediaType = subtype === 'jpeg' ? 'image/jpeg' : `image/${subtype}`;
    const extension = subtype === 'jpeg' ? 'jpg' : subtype;
    const bytes = Buffer.from(payload, 'base64');
    if (bytes.length > 12 * 1024 * 1024) {
      throw new RemotePublicationError(422, 'An embedded image exceeds the 12 MiB WordPress upload limit.');
    }

    index += 1;
    const mediaSlug = `omi-${contentDigest.slice(0, 20)}-${index}`;
    const existing = await wordpressRequest(
      baseUrl,
      'wp-json/wp/v2/media',
      username,
      applicationPassword,
      { method: 'GET' },
      { slug: mediaSlug, context: 'edit', per_page: '1', _fields: 'source_url' },
    );
    if (!existing.ok) {
      throw new RemotePublicationError(
        existing.status,
        `WordPress media reconciliation failed: ${await responseMessage(existing)}`,
      );
    }
    const found = await limitedJson(existing) as Array<{ source_url?: string }>;
    let sourceUrl = found[0]?.source_url;
    if (!sourceUrl) {
      const upload = await wordpressRequest(
        baseUrl,
        'wp-json/wp/v2/media',
        username,
        applicationPassword,
        {
          method: 'POST',
          headers: {
            'Content-Type': mediaType,
            'Content-Disposition': `attachment; filename="${mediaSlug}.${extension}"`,
          },
          body: bytes,
        },
      );
      if (!upload.ok) {
        throw new RemotePublicationError(
          upload.status,
          `WordPress media upload failed: ${await responseMessage(upload)}`,
        );
      }
      const media = await limitedJson(upload) as { source_url?: string };
      sourceUrl = media.source_url;
    }
    if (!sourceUrl) {
      throw new RemotePublicationError(null, 'WordPress media upload did not return a source URL.');
    }
    output = output.replaceAll(source, sourceUrl);
  }
  return output;
}

async function wordpressRequest(
  baseUrl: string,
  path: string,
  username: string,
  applicationPassword: string,
  init: RequestInit,
  search: Record<string, string> = {},
): Promise<Response> {
  const base = new URL(baseUrl);
  const root = base.pathname.replace(/\/+$/, '');
  base.pathname = `${root}/${path.replace(/^\/+/, '')}`;
  base.search = '';
  base.hash = '';
  for (const [key, value] of Object.entries(search)) {
    base.searchParams.set(key, value);
  }
  const trustedUrl = await assertTrustedIntegrationUrl(base.toString(), baseUrl);
  const headers = new Headers(init.headers);
  headers.set(
    'Authorization',
    `Basic ${Buffer.from(`${username}:${applicationPassword}`, 'utf8').toString('base64')}`,
  );
  headers.set('Accept', 'application/json');
  try {
    return await fetch(trustedUrl, {
      ...init,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw new RemotePublicationError(null, safeErrorMessage(error));
  }
}

function genericHeaders(
  authenticationMode: string,
  config: ConfigRecord,
  secret: string | null,
): Headers {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  if (authenticationMode === 'none') return headers;
  if (!secret) {
    throw new RemotePublicationError(400, 'The selected web publishing target has no stored credential.');
  }
  const scheme = stringConfig(config, 'authScheme') || 'bearer';
  if (scheme === 'bearer') {
    headers.set('Authorization', `Bearer ${secret}`);
  } else if (scheme === 'x-api-key') {
    headers.set('X-API-Key', secret);
  } else if (scheme === 'basic') {
    const username = stringConfig(config, 'username');
    if (!username) {
      throw new RemotePublicationError(400, 'Basic authentication requires a username.');
    }
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(`${username}:${secret}`, 'utf8').toString('base64')}`,
    );
  } else {
    throw new RemotePublicationError(400, 'Unsupported web publishing authentication scheme.');
  }
  return headers;
}

function receiptFromDelivery(
  delivery: {
    id: string;
    connectionId: string;
    connectionVersion: Date;
    manuscriptId: string;
    revisionId: string;
    buildId: string;
    externalId: string | null;
    externalUrl: string | null;
    contentDigest: string;
    deliveredContentDigest: string | null;
    targetStatus: string;
    assurance: unknown;
    state: string;
    updatedAt: Date;
  },
  providerId: string,
): WebPublicationReceipt {
  if (
    delivery.state !== 'SUCCEEDED' ||
    (providerId !== 'wordpress' && providerId !== 'web-publishing')
  ) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_RECEIPT_INVALID',
      500,
      'The stored web-publication receipt is invalid.',
    );
  }
  const assurance = delivery.assurance as unknown as WebPublicationAssurance;
  assertAssurance(assurance);
  if (!isSha256(delivery.deliveredContentDigest)) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_RECEIPT_INVALID',
      500,
      'The stored web-publication transport digest is invalid.',
    );
  }
  return {
    deliveryId: delivery.id,
    connectionId: delivery.connectionId,
    connectionVersion: delivery.connectionVersion.toISOString(),
    providerId,
    manuscriptId: delivery.manuscriptId,
    revisionId: delivery.revisionId,
    buildId: delivery.buildId,
    externalId: delivery.externalId,
    externalUrl: delivery.externalUrl,
    contentDigest: delivery.contentDigest,
    deliveredContentDigest: delivery.deliveredContentDigest,
    status: delivery.targetStatus.toLowerCase() as WebPublicationTargetStatus,
    assurance,
    deliveryState: 'succeeded',
    updatedAt: delivery.updatedAt.toISOString(),
  };
}

function configRecord(value: unknown): ConfigRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ConfigRecord
    : {};
}

function stringConfig(config: ConfigRecord, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseEncryptedSecret(value: string | null): string | null {
  if (!value) return null;
  const parsed = JSON.parse(value) as Partial<EncryptedSecret>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
    throw new RemotePublicationError(400, 'Stored integration secret is invalid.');
  }
  return decryptSecret(parsed as EncryptedSecret);
}

function wordpressArticleHtml(html: string): string {
  return html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? html;
}

async function responseMessage(response: Response): Promise<string> {
  const body = await limitedJson(response).catch(() => null) as
    | { message?: string; code?: string; error?: { message?: string } }
    | null;
  return body?.error?.message || body?.message || body?.code || `HTTP ${response.status}`;
}

async function limitedJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > 64 * 1024) {
    throw new RemotePublicationError(null, 'The remote publication response is too large.');
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RemotePublicationError(response.status, 'The remote publication response is not valid JSON.');
  }
}

async function trustedReceiptUrl(
  value: string | undefined,
  baseUrl: string,
): Promise<string | null> {
  if (!value) return null;
  try {
    return (await assertTrustedIntegrationUrl(value, baseUrl)).toString();
  } catch {
    return null;
  }
}

function metaContent(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(
    new RegExp(`<meta\\s+name=["']${escaped}["']\\s+content=["']([^"']*)["']\\s*>`, 'i'),
  )?.[1];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function invalidArtifact(message: string): WebPublicationServiceError {
  return new WebPublicationServiceError('WEB_PUBLICATION_ARTIFACT_INVALID', 400, message);
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeDigestEqual(left: string, right: string): boolean {
  if (!isSha256(left) || !isSha256(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function isBuildId(value: unknown): value is string {
  return typeof value === 'string' && /^urn:omi:publication-build:sha256:[a-f0-9]{64}$/i.test(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function assertConnectionVersion(actual: Date, supplied: string): void {
  const suppliedTime = Date.parse(supplied);
  if (!Number.isFinite(suppliedTime) || actual.getTime() !== suppliedTime) {
    throw new WebPublicationServiceError(
      'WEB_PUBLICATION_TARGET_CHANGED',
      409,
      'The selected publishing target changed. Review the target and artifact again.',
    );
  }
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
      if (!Number.isFinite(value)) throw invalidArtifact('Canonical publication JSON contains a non-finite number.');
      return JSON.stringify(value);
    case 'object': {
      const entry = value as Record<string, unknown>;
      return `{${Object.keys(entry)
        .filter((key) => entry[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(entry[key])}`)
        .join(',')}}`;
    }
    default:
      throw invalidArtifact('Canonical publication JSON contains an unsupported value.');
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'External web publication failed.';
}
