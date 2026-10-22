import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';

/**
 * Removes an empty heading block when the author presses Backspace or Delete.
 * ProseMirror keeps an empty heading valid as a node, which otherwise leaves
 * a visible blank line after its text has been erased.
 */
export function removeEmptyHeadingTransaction(
  state: EditorState,
  key: string,
): Transaction | null {
  if (key !== 'Backspace' && key !== 'Delete') return null;
  const { selection, doc, schema } = state;
  if (!selection.empty) return null;

  const { $from } = selection;
  const heading = $from.parent;
  if (
    $from.depth !== 1
    || heading.type.name !== 'heading'
    || heading.content.size !== 0
  ) return null;

  const start = $from.before(1);
  const end = $from.after(1);
  const transaction = state.tr;

  if (doc.childCount === 1) {
    // A ProseMirror document must retain a block. Keep the line editable as a
    // normal paragraph when this is the only remaining block.
    const paragraph = schema.nodes.paragraph;
    if (!paragraph) return null;
    transaction.replaceWith(start, end, paragraph.create());
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(start + 1)));
    return transaction;
  }

  transaction.delete(start, end);
  transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(Math.min(start, transaction.doc.content.size)), -1),
  );
  return transaction;
}
