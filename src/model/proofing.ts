import type {
  OmiAnnotation,
  OmiBlock,
  OmiProofingChange,
  OmiProofingChangeStatus,
  OmiProofingState,
  OmiPublicationCorrection,
  OmiPublicationCorrectionKind,
  OmiSection,
} from '../types/omi';

export interface ProofingTextDiff {
  prefix: string;
  removed: string;
  inserted: string;
  suffix: string;
}

export type ProofingTextChangeKind =
  | 'insertion'
  | 'deletion'
  | 'replacement'
  | 'formatting';

export interface ProofingSelection {
  blockId: string;
  from: number;
  to: number;
  text: string;
}

export function normalizeProofingState(
  value: OmiProofingState | undefined,
): OmiProofingState {
  return {
    trackChanges: value?.trackChanges ?? false,
    changes: Array.isArray(value?.changes)
      ? value.changes.map((change) => ({ ...change }))
      : [],
  };
}

export function setProofingTracking(
  value: OmiProofingState | undefined,
  enabled: boolean,
): OmiProofingState {
  return {
    ...normalizeProofingState(value),
    trackChanges: enabled,
  };
}

export function recordSectionTextChanges(
  previousSections: readonly OmiSection[],
  nextSections: readonly OmiSection[],
  proofing: OmiProofingState | undefined,
  actorAgentId?: string,
  timestamp = new Date().toISOString(),
): OmiProofingState | undefined {
  const current = normalizeProofingState(proofing);
  if (!current.trackChanges) return proofing;

  const previousBlocks = new Map(
    flattenBlocks(previousSections).map((block) => [block.id, block]),
  );
  let changes = current.changes;

  for (const block of flattenBlocks(nextSections)) {
    const previous = previousBlocks.get(block.id);
    if (!previous || previous.content === block.content || block.visual) continue;
    changes = recordBlockTextChange(
      changes,
      block.id,
      previous.content,
      block.content,
      actorAgentId,
      timestamp,
    );
  }

  return { ...current, changes };
}

export function recordBlockTextChange(
  changes: readonly OmiProofingChange[],
  targetBlockId: string,
  before: string,
  after: string,
  actorAgentId?: string,
  timestamp = new Date().toISOString(),
): OmiProofingChange[] {
  const pendingIndex = changes.findIndex(
    (change) => change.targetBlockId === targetBlockId && change.status === 'pending',
  );
  const original = pendingIndex >= 0 ? changes[pendingIndex]!.before : before;

  if (original === after) {
    return pendingIndex < 0
      ? changes.map((change) => ({ ...change }))
      : changes.filter((_change, index) => index !== pendingIndex).map((change) => ({ ...change }));
  }

  const change: OmiProofingChange = {
    id: pendingIndex >= 0 ? changes[pendingIndex]!.id : crypto.randomUUID(),
    targetBlockId,
    before: original,
    after,
    status: 'pending',
    ...(actorAgentId ? { actorAgentId } : {}),
    createdAt: pendingIndex >= 0 ? changes[pendingIndex]!.createdAt : timestamp,
    modifiedAt: timestamp,
  };

  if (pendingIndex < 0) return [...changes.map((item) => ({ ...item })), change];
  return changes.map((item, index) => index === pendingIndex ? change : { ...item });
}

export function decideProofingChange(
  value: OmiProofingState | undefined,
  changeId: string,
  status: Exclude<OmiProofingChangeStatus, 'pending'>,
  timestamp = new Date().toISOString(),
): OmiProofingState {
  const proofing = normalizeProofingState(value);
  return {
    ...proofing,
    changes: proofing.changes.map((change) => change.id === changeId
      ? { ...change, status, modifiedAt: timestamp }
      : { ...change }),
  };
}

export function restoreProofingChange(
  sections: readonly OmiSection[],
  change: OmiProofingChange,
): OmiSection[] {
  return sections.map((section) => ({
    ...section,
    blocks: replaceBlockContent(section.blocks, change.targetBlockId, change.before),
  }));
}

export function createProofingComment(
  selection: ProofingSelection,
  body: string,
  visibility: 'author_and_editor' | 'editor_only',
  creatorAgentId?: string,
  timestamp = new Date().toISOString(),
): OmiAnnotation {
  return {
    id: crypto.randomUUID(),
    type: 'comment',
    targetBlockId: selection.blockId,
    targetText: selection.text,
    targetRange: { from: selection.from, to: selection.to },
    body: body.trim(),
    renderingHint: 'popup',
    status: 'open',
    visibility,
    ...(creatorAgentId ? { creatorAgentId } : {}),
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function setProofingCommentResolved(
  annotation: OmiAnnotation,
  resolved: boolean,
  timestamp = new Date().toISOString(),
): OmiAnnotation {
  if (resolved) {
    return {
      ...annotation,
      status: 'resolved',
      modifiedAt: timestamp,
      resolvedAt: timestamp,
    };
  }

  const { resolvedAt: _resolvedAt, ...openAnnotation } = annotation;
  return {
    ...openAnnotation,
    status: 'open',
    modifiedAt: timestamp,
  };
}

export function createPublicationCorrection(
  input: {
    targetBlockId: string;
    kind: OmiPublicationCorrectionKind;
    from?: number;
    to?: number;
    sourceText?: string;
    creatorAgentId?: string;
  },
  timestamp = new Date().toISOString(),
): OmiPublicationCorrection {
  const from = input.from === undefined ? undefined : Math.max(0, Math.trunc(input.from));
  const to = input.to === undefined
    ? undefined
    : Math.max(from ?? 0, Math.trunc(input.to));
  return {
    id: crypto.randomUUID(),
    targetBlockId: input.targetBlockId,
    kind: input.kind,
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(input.sourceText ? { sourceText: input.sourceText } : {}),
    ...(input.creatorAgentId ? { creatorAgentId: input.creatorAgentId } : {}),
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function createProofingTextDiff(before: string, after: string): ProofingTextDiff {
  let prefixLength = 0;
  const maximumPrefix = Math.min(before.length, after.length);
  while (prefixLength < maximumPrefix && before[prefixLength] === after[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maximumSuffix = Math.min(
    before.length - prefixLength,
    after.length - prefixLength,
  );
  while (
    suffixLength < maximumSuffix
    && before[before.length - 1 - suffixLength] === after[after.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return {
    prefix: before.slice(0, prefixLength),
    removed: before.slice(prefixLength, before.length - suffixLength),
    inserted: after.slice(prefixLength, after.length - suffixLength),
    suffix: before.slice(before.length - suffixLength),
  };
}

export function classifyProofingTextChange(
  before: string,
  after: string,
): ProofingTextChangeKind {
  const beforeText = storedContentText(before);
  const afterText = storedContentText(after);
  if (!beforeText && afterText) return 'insertion';
  if (beforeText && !afterText) return 'deletion';
  if (beforeText === afterText) return 'formatting';
  return 'replacement';
}

export function storedContentText(value: string): string {
  if (!value.trim()) return '';
  try {
    return collectJsonText(JSON.parse(value) as unknown).replace(/\s+/gu, ' ').trim();
  } catch {
    return value.replace(/\s+/gu, ' ').trim();
  }
}

export function applyTextPublicationCorrections(
  text: string,
  corrections: readonly OmiPublicationCorrection[],
): string {
  const inlineCorrections = corrections
    .filter((correction) => (
      correction.kind === 'discretionary-hyphen'
      || correction.kind === 'nonbreaking'
      || correction.kind === 'forced-line-break'
    ))
    .filter((correction) => correctionSourceMatches(text, correction));
  const nonbreakingRanges = inlineCorrections.filter(
    (correction) => correction.kind === 'nonbreaking',
  );
  const pointEdits = inlineCorrections
    .filter((correction) => correction.kind !== 'nonbreaking')
    .map((correction) => ({
      correction,
      from: Math.max(0, Math.min(text.length, correction.from ?? 0)),
      to: Math.max(0, Math.min(text.length, correction.to ?? correction.from ?? 0)),
    }))
    .sort((left, right) => right.from - left.from || right.to - left.to);

  let result = text;
  // Range replacements preserve string length, so point offsets remain stable.
  for (const correction of nonbreakingRanges) {
    const from = Math.max(0, Math.min(text.length, correction.from ?? 0));
    const to = Math.max(from, Math.min(text.length, correction.to ?? from));
    const protectedText = result.slice(from, to).replaceAll(' ', '\u00a0');
    result = `${result.slice(0, from)}${protectedText}${result.slice(to)}`;
  }
  for (const { correction, from } of pointEdits) {
    if (correction.kind === 'discretionary-hyphen') {
      result = `${result.slice(0, from)}\u00ad${result.slice(from)}`;
    } else {
      result = `${result.slice(0, from)}\n${result.slice(from)}`;
    }
  }
  return result;
}

/**
 * Applies inline print corrections to a cloned Tiptap payload. The canonical
 * authoring text is never changed; the returned payload is intended only for
 * publication preview/export rendering.
 */
export function applyPublicationCorrectionsToStoredContent(
  content: string,
  corrections: readonly OmiPublicationCorrection[],
): string {
  if (!corrections.length || !content.trim()) return content;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return applyTextPublicationCorrections(content, corrections);
  }

  const sourceText = collectJsonText(parsed);
  const inlineCorrections = corrections
    .filter((correction) => (
      correction.kind === 'discretionary-hyphen'
      || correction.kind === 'nonbreaking'
      || correction.kind === 'forced-line-break'
    ))
    .filter((correction) => correctionSourceMatches(sourceText, correction));
  const nonbreakingRanges = inlineCorrections.filter(
    (correction) => correction.kind === 'nonbreaking',
  );
  const pointCorrections = inlineCorrections
    .filter((correction) => correction.kind !== 'nonbreaking')
    .sort((left, right) => (
      (right.from ?? 0) - (left.from ?? 0)
      || (right.to ?? right.from ?? 0) - (left.to ?? left.from ?? 0)
    ));

  let document = cloneJsonValue(parsed);
  for (const correction of [...nonbreakingRanges, ...pointCorrections]) {
    document = applyInlineCorrection(document, correction);
  }
  return JSON.stringify(document);
}

function correctionSourceMatches(
  text: string,
  correction: OmiPublicationCorrection,
): boolean {
  if (!correction.sourceText) return true;
  const from = Math.max(0, Math.min(text.length, correction.from ?? 0));
  const to = Math.max(from, Math.min(text.length, correction.to ?? from));
  return text.slice(from, to) === correction.sourceText;
}

function flattenBlocks(sections: readonly OmiSection[]): OmiBlock[] {
  const result: OmiBlock[] = [];
  const visit = (blocks: readonly OmiBlock[]) => {
    for (const block of blocks) {
      result.push(block);
      if (block.children?.length) visit(block.children);
    }
  };
  for (const section of sections) visit(section.blocks);
  return result;
}

function replaceBlockContent(
  blocks: readonly OmiBlock[],
  blockId: string,
  content: string,
): OmiBlock[] {
  return blocks.map((block) => ({
    ...block,
    ...(block.id === blockId ? { content } : {}),
    ...(block.children
      ? { children: replaceBlockContent(block.children, blockId, content) }
      : {}),
  }));
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (record.type === 'text' && typeof record.text === 'string') return record.text;
  if (record.type === 'hardBreak') return '\n';
  return Array.isArray(record.content)
    ? record.content.map(collectJsonText).join('')
    : '';
}

function applyInlineCorrection(
  value: unknown,
  correction: OmiPublicationCorrection,
): unknown {
  const from = Math.max(0, Math.trunc(correction.from ?? 0));
  const to = Math.max(from, Math.trunc(correction.to ?? from));
  let offset = 0;
  let appliedBreak = false;

  const visit = (nodeValue: unknown): unknown => {
    if (!nodeValue || typeof nodeValue !== 'object') return nodeValue;
    const node = nodeValue as Record<string, unknown>;

    if (node.type === 'text' && typeof node.text === 'string') {
      const text = node.text;
      const start = offset;
      const end = start + text.length;
      offset = end;

      if (correction.kind === 'discretionary-hyphen') {
        if (from < start || from > end) return { ...node };
        const local = from - start;
        return { ...node, text: `${text.slice(0, local)}\u00ad${text.slice(local)}` };
      }

      if (correction.kind === 'forced-line-break') {
        if (appliedBreak || from < start || from > end) return { ...node };
        appliedBreak = true;
        const local = from - start;
        const left = text.slice(0, local);
        const right = text.slice(local);
        return [
          ...(left ? [{ ...node, text: left }] : []),
          { type: 'hardBreak' },
          ...(right ? [{ ...node, text: right }] : []),
        ];
      }

      if (correction.kind === 'nonbreaking' && to > start && from < end) {
        const localFrom = Math.max(0, from - start);
        const localTo = Math.min(text.length, to - start);
        return {
          ...node,
          text: `${text.slice(0, localFrom)}${text.slice(localFrom, localTo).replaceAll(' ', '\u00a0')}${text.slice(localTo)}`,
        };
      }
      return { ...node };
    }

    if (node.type === 'hardBreak') {
      offset += 1;
      return { ...node };
    }

    if (!Array.isArray(node.content)) return { ...node };
    const content = node.content.flatMap((child) => {
      const next = visit(child);
      return Array.isArray(next) ? next : [next];
    });
    return { ...node, content };
  };

  return visit(value);
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
