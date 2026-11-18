import type { ProductionState } from '../domain/editorialProduction.js';

export interface ProductionRow {
  id: string;
  version: number;
  state: unknown;
}
export interface ProductionAsset {
  assetId: string;
  mediaType: string;
  checksum: string;
  bytes: Uint8Array;
}
export interface ProductionSubmission {
  id: string;
  workspaceId: string;
  manuscriptId: string;
  title: string;
  status: string;
  authorUserId: string;
  publicationVenueId: string;
  publicationVenueName: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  manuscriptStateSnapshot: unknown;
  reviewSnapshot: unknown;
  production: ProductionRow | null;
  assets: ProductionAsset[];
}
export interface ProductionFile {
  id: string;
  productionId: string;
  kind: string;
  revisionId: string;
  stateDigest: string;
  sha256: string;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  createdAt: Date;
  build?: unknown;
}
export type ProductionFileSummary = Omit<
  ProductionFile,
  'productionId' | 'bytes' | 'build'
>;
export interface AcceptedProductionSource {
  title: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  manuscriptStateSnapshot: unknown;
  reviewSnapshot: unknown;
  assets: ProductionAsset[];
}
export interface ProductionAcceptance {
  workspaceId: string;
  manuscriptId: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  publicationVenueId: string;
  reviewRound: number;
  basisAssignmentIds: string[];
}
/** Semantic persistence operations; no ORM, transport or authentication objects. */
export interface EditorialProductionRepository {
  loadSubmission(id: string): Promise<ProductionSubmission | null>;
  lockSubmission(id: string): Promise<ProductionSubmission>;
  listFiles(productionId: string): Promise<ProductionFileSummary[]>;
  findFile(
    productionId: string,
    fileId: string,
  ): Promise<ProductionFile | null>;
  findSourceRevision(
    productionId: string,
    revisionId: string,
  ): Promise<ProductionFile | null>;
  listAssignedSubmissionIds(userId: string): Promise<string[]>;
  findActiveAssignee(email: string): Promise<string | undefined>;
  deliveryStarted(manuscriptId: string, revisionId: string): Promise<boolean>;
  createProduction(
    id: string,
    submissionId: string,
    state: ProductionState,
  ): Promise<void>;
  addFile(file: Omit<ProductionFile, 'createdAt'>): Promise<void>;
  acceptanceBasis(
    workspaceId: string,
    manuscriptId: string,
    revisionId: string,
  ): Promise<{ reviewRound: number; basisAssignmentIds: string[] }>;
  acceptSource(userId: string, input: ProductionAcceptance): Promise<void>;
  replaceAcceptedSource(
    submissionId: string,
    source: AcceptedProductionSource,
  ): Promise<void>;
  compareAndSave(
    id: string,
    version: number,
    state: ProductionState,
  ): Promise<boolean>;
  findPublicationSubmissions(
    manuscriptId: string,
    submissionId?: string,
    venueId?: string,
  ): Promise<ProductionSubmission[]>;
}
