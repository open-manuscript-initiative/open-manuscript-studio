/** Server-owned production state, separate from portable manuscript semantics. */
export type ProductionStage =
  | 'COPYEDITING'
  | 'LAYOUT'
  | 'PROOFREADING'
  | 'READY';
export type ProductionRole = 'COPYEDITOR' | 'LAYOUT_EDITOR' | 'PROOFREADER';
export interface ProductionSource {
  fileId: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
}
export interface ProductionProof {
  fileId: string;
  revisionId: string;
  stateDigest: string;
  sha256: string;
  buildId: string;
  fileName: string;
  mediaType: string;
}
export interface ProductionState {
  model: 'omi-editorial-production/1';
  stage: ProductionStage;
  acceptedSource: ProductionSource;
  source: ProductionSource;
  sourceApprovals: Partial<
    Record<'AUTHOR' | 'EDITOR', { userId: string; at: string }>
  >;
  assignments: Array<{ userId: string; role: ProductionRole; dueAt?: string }>;
  proof: ProductionProof | null;
  proofApprovals: Partial<
    Record<'AUTHOR' | 'EDITOR', { userId: string; at: string }>
  >;
  corrections: Array<{
    id: string;
    proofFileId: string;
    locator: string;
    note: string;
    userId: string;
    createdAt: string;
    resolution?: { userId: string; note: string; at: string };
  }>;
  events: Array<{
    type: string;
    userId: string;
    at: string;
    reference?: string;
  }>;
}
export interface ProductionActor {
  userId: string;
  author: boolean;
  editor: boolean;
}
export type ProductionAction =
  | { type: 'ASSIGN'; userId: string; role: ProductionRole; dueAt?: string }
  | { type: 'REVOKE'; userId: string; role: ProductionRole }
  | { type: 'SOURCE'; source: ProductionSource }
  | { type: 'APPROVE_SOURCE'; role: 'AUTHOR' | 'EDITOR'; fileId: string }
  | { type: 'LAYOUT' }
  | { type: 'PROOF'; proof: ProductionProof }
  | {
      type: 'CORRECTION';
      id: string;
      fileId: string;
      locator: string;
      note: string;
    }
  | { type: 'RESOLVE'; id: string; note: string }
  | { type: 'APPROVE_PROOF'; role: 'AUTHOR' | 'EDITOR'; fileId: string }
  | { type: 'READY' };

export class ProductionError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
    this.name =
      status === 403
        ? 'ForbiddenError'
        : status === 404
          ? 'NotFoundError'
          : status === 409
            ? 'ConflictError'
            : 'ProductionError';
  }
}
export function createProductionState(
  source: ProductionSource,
  actor: ProductionActor,
  at: string,
): ProductionState {
  if (!actor.editor)
    throw new ProductionError('Editorial authority is required.', 403);
  return {
    model: 'omi-editorial-production/1',
    stage: 'COPYEDITING',
    acceptedSource: source,
    source,
    sourceApprovals: {},
    assignments: [],
    proof: null,
    proofApprovals: {},
    corrections: [],
    events: [
      { type: 'STARTED', userId: actor.userId, at, reference: source.fileId },
    ],
  };
}
export function isProductionParticipant(
  state: ProductionState,
  actor: ProductionActor,
): boolean {
  return (
    actor.author ||
    actor.editor ||
    state.assignments.some((item) => item.userId === actor.userId)
  );
}
export function transitionProduction(
  state: ProductionState,
  action: ProductionAction,
  actor: ProductionActor,
  at: string,
): ProductionState {
  if (!isProductionParticipant(state, actor))
    throw new ProductionError('No active production assignment.', 403);
  const next = structuredClone(state);
  const assigned = (role: ProductionRole) =>
    actor.editor ||
    state.assignments.some((a) => a.userId === actor.userId && a.role === role);
  const editor = () => {
    if (!actor.editor)
      throw new ProductionError('Editorial authority is required.', 403);
  };
  const approval = (role: 'AUTHOR' | 'EDITOR') => {
    if (!(role === 'AUTHOR' ? actor.author : actor.editor))
      throw new ProductionError(
        'This approval belongs to a different role.',
        403,
      );
  };
  switch (action.type) {
    case 'ASSIGN':
      editor();
      next.assignments = next.assignments.filter(
        (a) => a.userId !== action.userId || a.role !== action.role,
      );
      next.assignments.push({
        userId: action.userId,
        role: action.role,
        ...(action.dueAt ? { dueAt: action.dueAt } : {}),
      });
      break;
    case 'REVOKE':
      editor();
      next.assignments = next.assignments.filter(
        (a) => a.userId !== action.userId || a.role !== action.role,
      );
      break;
    case 'SOURCE':
      if (!assigned('COPYEDITOR'))
        throw new ProductionError('A copyediting assignment is required.', 403);
      if (action.source.fileId === state.source.fileId) return next;
      if (state.corrections.some((c) => !c.resolution))
        throw new ProductionError(
          'Record a disposition for every correction before replacing the source.',
        );
      next.source = action.source;
      next.stage = 'COPYEDITING';
      next.sourceApprovals = {};
      next.proof = null;
      next.proofApprovals = {};
      break;
    case 'APPROVE_SOURCE':
      approval(action.role);
      if (
        state.stage !== 'COPYEDITING' ||
        action.fileId !== state.source.fileId
      )
        throw new ProductionError(
          'The copyedited source changed. Reload it before approval.',
        );
      next.sourceApprovals[action.role] = { userId: actor.userId, at };
      break;
    case 'LAYOUT':
      editor();
      if (
        state.stage !== 'COPYEDITING' ||
        !state.sourceApprovals.AUTHOR ||
        !state.sourceApprovals.EDITOR
      )
        throw new ProductionError(
          'Author and editor must approve the current copyedited source.',
        );
      next.stage = 'LAYOUT';
      break;
    case 'PROOF':
      if (!assigned('LAYOUT_EDITOR'))
        throw new ProductionError('A layout assignment is required.', 403);
      if (state.stage === 'COPYEDITING')
        throw new ProductionError(
          'Complete copyediting before submitting a proof.',
        );
      if (
        action.proof.revisionId !== state.source.revisionId ||
        action.proof.stateDigest !== state.source.stateDigest
      )
        throw new ProductionError(
          'The proof does not match the approved source.',
        );
      if (
        state.proof?.buildId === action.proof.buildId &&
        state.proof.sha256 === action.proof.sha256
      )
        return next;
      if (state.corrections.some((c) => !c.resolution))
        throw new ProductionError(
          'Record a disposition for every correction before replacing the proof.',
        );
      next.proof = action.proof;
      next.proofApprovals = {};
      next.stage = 'PROOFREADING';
      break;
    case 'CORRECTION':
      if (
        !state.proof ||
        action.fileId !== state.proof.fileId ||
        state.stage !== 'PROOFREADING'
      )
        throw new ProductionError(
          'Corrections must address the current proof.',
        );
      if (!actor.author && !assigned('PROOFREADER'))
        throw new ProductionError(
          'A proofreading assignment is required.',
          403,
        );
      next.corrections.push({
        id: action.id,
        proofFileId: action.fileId,
        locator: action.locator,
        note: action.note,
        userId: actor.userId,
        createdAt: at,
      });
      next.proofApprovals = {};
      break;
    case 'RESOLVE': {
      if (!assigned('LAYOUT_EDITOR'))
        throw new ProductionError('A layout assignment is required.', 403);
      const correction = next.corrections.find((c) => c.id === action.id);
      if (
        !correction ||
        correction.proofFileId !== state.proof?.fileId ||
        state.stage !== 'PROOFREADING'
      )
        throw new ProductionError(
          'The correction is not on the current proof.',
        );
      if (!action.note.trim())
        throw new ProductionError(
          'Explain how the correction was handled.',
          400,
        );
      correction.resolution = { userId: actor.userId, note: action.note, at };
      next.proofApprovals = {};
      break;
    }
    case 'APPROVE_PROOF':
      approval(action.role);
      if (
        !state.proof ||
        action.fileId !== state.proof.fileId ||
        state.stage !== 'PROOFREADING'
      )
        throw new ProductionError(
          'The proof changed. Open the current proof before approval.',
        );
      if (
        state.corrections.some(
          (c) => c.proofFileId === state.proof!.fileId && !c.resolution,
        )
      )
        throw new ProductionError(
          'Resolve all current-proof corrections before approval.',
        );
      next.proofApprovals[action.role] = { userId: actor.userId, at };
      break;
    case 'READY':
      editor();
      if (
        state.stage !== 'PROOFREADING' ||
        !state.proof ||
        !state.proofApprovals.AUTHOR ||
        !state.proofApprovals.EDITOR ||
        state.corrections.some(
          (c) => c.proofFileId === state.proof!.fileId && !c.resolution,
        )
      )
        throw new ProductionError(
          'The current proof requires author and editor approval and no unresolved corrections.',
        );
      next.stage = 'READY';
      break;
  }
  next.events.push({
    type: action.type,
    userId: actor.userId,
    at,
    ...('fileId' in action ? { reference: action.fileId } : {}),
  });
  return next;
}
