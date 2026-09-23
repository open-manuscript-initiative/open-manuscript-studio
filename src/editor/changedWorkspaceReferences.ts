import type { Transaction } from '@tiptap/pm/state';

export type WorkspaceReferenceKind = 'note' | 'citation' | 'cross-reference';

const WORKSPACE_REFERENCE_KIND_BY_NODE_NAME: Record<string, WorkspaceReferenceKind> = {
  omiNote: 'note',
  omiCitation: 'citation',
  omiCrossReference: 'cross-reference',
};

export function collectChangedWorkspaceReferences(
  transactions: readonly Transaction[],
): Set<WorkspaceReferenceKind> {
  const changed = new Set<WorkspaceReferenceKind>();

  for (const transaction of transactions) {
    if (!transaction.docChanged) continue;

    transaction.steps.forEach((step, stepIndex) => {
      const before = transaction.docs[stepIndex];
      if (!before) return;
      // Step-map coordinates refer to this step's result, not the final
      // document after all later steps in a paste/move transaction.
      const after = transaction.docs[stepIndex + 1] ?? transaction.doc;
      let hasMappedRange = false;
      step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
        hasMappedRange = true;
        collectReferenceNodesInRange(before, oldStart, oldEnd, changed);
        collectReferenceNodesInRange(after, newStart, newEnd, changed);
      });
      // Attribute-only or custom steps can change reference identifiers with
      // an empty map. Fall back conservatively rather than skip reconciliation.
      if (!hasMappedRange) {
        collectReferenceNodesInRange(before, 0, before.content.size, changed);
        collectReferenceNodesInRange(after, 0, after.content.size, changed);
      }
      if (changed.size === 3) return;
    });

    if (changed.size === 3) break;
  }

  return changed;
}

function collectReferenceNodesInRange(
  document: Transaction['doc'],
  from: number,
  to: number,
  changed: Set<WorkspaceReferenceKind>,
): void {
  let start = Math.max(0, Math.min(document.content.size, from - 1));
  let end = Math.max(start, Math.min(document.content.size, to + 1));
  // Splitting/joining a paragraph moves references outside the narrow step
  // range to a different OMI block. Include the affected top-level blocks.
  const resolvedStart = document.resolve(start);
  const resolvedEnd = document.resolve(end);
  if (resolvedStart.depth > 0) start = resolvedStart.before(1);
  if (resolvedEnd.depth > 0) end = resolvedEnd.after(1);
  document.nodesBetween(start, end, (node) => {
    const kind = WORKSPACE_REFERENCE_KIND_BY_NODE_NAME[node.type.name];
    if (kind) changed.add(kind);
  });

  for (const position of [from, to, from - 1]) {
    if (position < 0 || position > document.content.size) continue;
    const node = document.nodeAt(position);
    const kind = node
      ? WORKSPACE_REFERENCE_KIND_BY_NODE_NAME[node.type.name]
      : undefined;
    if (kind) changed.add(kind);
  }
}
