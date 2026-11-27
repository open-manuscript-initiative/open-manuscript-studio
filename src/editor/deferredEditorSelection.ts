import type { Node } from '@tiptap/pm/model';
import { AllSelection, NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';

/** Restore an inactive view's selection by stable top-level block identity.
 * Prefix/suffix edits within the selected block map its local offset as well.
 * Missing blocks use a bounded nearest valid selection, never an invalid caret.
 */
export function remapDeferredEditorSelection(previous: Node, selection: Selection, next: Node): Selection {
  if (selection instanceof AllSelection) return new AllSelection(next);
  const positions = new Map<string, { node: Node; start: number }>();
  next.forEach((node, offset) => {
    const id = node.attrs.omiBlockId;
    if (typeof id === 'string') positions.set(id, { node, start: offset + 1 });
  });
  const map = (position: number) => {
    const resolved = previous.resolve(position);
    const child = resolved.depth ? undefined : previous.childAfter(position);
    const oldNode = resolved.depth ? resolved.node(1) : child?.node;
    const oldStart = resolved.depth ? resolved.start(1) : (child?.offset ?? position) + 1;
    const target = oldNode && positions.get(oldNode.attrs.omiBlockId);
    if (!oldNode || !target) return Math.max(0, Math.min(next.content.size, position));
    let offset = position - oldStart;
    if (offset >= 0) {
      // Mark/attribute-only formatting changes keep ProseMirror offsets intact.
      const samePositions = oldNode.content.size === target.node.content.size
        && oldNode.textContent === target.node.textContent;
      const start = samePositions ? null : oldNode.content.findDiffStart(target.node.content);
      const end = start === null ? null : oldNode.content.findDiffEnd(target.node.content);
      if (start !== null && end) {
        if (offset > end.a) offset += end.b - end.a;
        else if (offset >= start) offset = end.b;
      }
      offset = Math.min(target.node.content.size, offset);
    }
    return Math.max(0, Math.min(next.content.size, target.start + offset));
  };
  const anchor = map(selection.anchor), head = map(selection.head);
  if (selection instanceof NodeSelection) {
    const node = next.nodeAt(anchor);
    const identityFields = ['omiBlockId', 'noteId', 'anchorId', 'citationId', 'crossReferenceId'];
    if (node && node.type === selection.node.type && NodeSelection.isSelectable(node)
      && identityFields.every(field => selection.node.attrs[field] == null || node.attrs[field] === selection.node.attrs[field]))
      return NodeSelection.create(next, anchor);
    return Selection.near(next.resolve(anchor));
  }
  return TextSelection.between(next.resolve(anchor), next.resolve(head));
}
