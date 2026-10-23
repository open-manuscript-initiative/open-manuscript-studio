import { chainCommands, joinBackward, joinForward, selectNodeBackward, selectNodeForward } from '@tiptap/pm/commands';
import type { EditorState, Transaction } from '@tiptap/pm/state';

export type ContinuousDeletionDirection = 'backward' | 'forward';

/**
 * Applies deletion input received from mobile beforeinput events directly to
 * ProseMirror. Android WebViews can emit deleteContentBackward/Forward without
 * producing the keyboard events the legacy editor used to normalize.
 */
export function applyContinuousDeletionInput(
  state: EditorState,
  direction: ContinuousDeletionDirection,
  dispatch?: (transaction: Transaction) => void,
): boolean {
  const { selection } = state;
  if (!selection.empty) {
    dispatch?.(state.tr.deleteSelection());
    return true;
  }

  const resolved = selection.$from;
  if (!resolved.parent.isTextblock) return false;

  const neighbor = direction === 'backward'
    ? resolved.nodeBefore
    : resolved.nodeAfter;
  if (neighbor) {
    const amount = neighbor.isText
      ? graphemeLengthAtEdge(neighbor.text ?? '', direction)
      : neighbor.nodeSize;
    if (amount <= 0) return false;

    const from = direction === 'backward' ? selection.from - amount : selection.from;
    const to = direction === 'backward' ? selection.from : selection.from + amount;
    dispatch?.(state.tr.delete(from, to));
    return true;
  }

  // At a paragraph or heading edge, retain ProseMirror's native join/select
  // behavior so the continuous document can update its OMI structure.
  const boundaryCommand = direction === 'backward'
    ? chainCommands(joinBackward, selectNodeBackward)
    : chainCommands(joinForward, selectNodeForward);
  return boundaryCommand(state, dispatch);
}

function graphemeLengthAtEdge(
  text: string,
  direction: ContinuousDeletionDirection,
): number {
  if (!text) return 0;
  if (typeof Intl.Segmenter === 'function') {
    const segments = Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    );
    return segments[direction === 'backward' ? segments.length - 1 : 0]?.segment.length ?? 0;
  }

  const codePoints = Array.from(text);
  const last = direction === 'backward'
    ? codePoints[codePoints.length - 1]
    : codePoints[0];
  return last?.length ?? 0;
}
