import type { Transaction } from '@tiptap/pm/state';

/**
 * Detects edits that add or remove content represented by non-printing
 * decorations. Removed content must be read from each step's old document:
 * mapped decorations can sit on a deletion boundary and otherwise survive as
 * stale visible markers.
 */
export function transactionChangesNonPrintingContent(
  transaction: Transaction,
): boolean {
  for (let index = 0; index < transaction.steps.length; index += 1) {
    const step = transaction.steps[index];
    if (!step) continue;

    const stepJson = step.toJSON();
    if (containsStructuralNode(stepJson) || containsNonPrintingWhitespaceText(stepJson)) {
      return true;
    }

    const oldDoc = transaction.docs[index] ?? transaction.doc;
    let removesMarkedContent = false;
    step.getMap().forEach((oldFrom, oldTo) => {
      if (oldTo <= oldFrom) return;
      const removedContent = oldDoc.slice(oldFrom, oldTo).content.toJSON();
      if (
        containsStructuralNode(removedContent)
        || containsNonPrintingWhitespaceText(removedContent)
      ) {
        removesMarkedContent = true;
      }
    });
    if (removesMarkedContent) return true;
  }

  return false;
}

function containsStructuralNode(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsStructuralNode);

  const record = value as Record<string, unknown>;
  if (record.type === 'paragraph' || record.type === 'heading' || record.type === 'hardBreak') {
    return true;
  }
  return Object.values(record).some(containsStructuralNode);
}

function containsNonPrintingWhitespaceText(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsNonPrintingWhitespaceText);

  const record = value as Record<string, unknown>;
  if (record.type === 'text' && typeof record.text === 'string' && /[\\t \\p{Zs}]/u.test(record.text)) {
    return true;
  }
  return Object.values(record).some(containsNonPrintingWhitespaceText);
}
