export type OmiInlineSemanticKind =
  | 'strong'
  | 'emphasis'
  | 'strike'
  | 'underline'
  | 'small-caps'
  | 'superscript'
  | 'subscript'
  | 'code';

export interface OmiInlineMarkLike {
  type?: string;
  attrs?: Record<string, unknown>;
}

export interface OmiInlineRun {
  text: string;
  semantics: OmiInlineSemanticKind[];
  language?: string;
  link?: string;
}

interface JsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: OmiInlineMarkLike[];
  content?: JsonNode[];
}

export const OMI_CHARACTER_STYLE_NAMES: Record<OmiInlineSemanticKind, string> = {
  strong: 'OMI Strong',
  emphasis: 'OMI Emphasis',
  strike: 'OMI Strike',
  underline: 'OMI Underline',
  'small-caps': 'OMI Small Caps',
  superscript: 'OMI Superscript',
  subscript: 'OMI Subscript',
  code: 'OMI Code',
};

/**
 * Converts editor-specific Tiptap marks into the portable OMI inline semantic
 * vocabulary. The vocabulary describes meaning/role, not a particular font.
 */
export function semanticKindsFromMarks(
  marks: readonly OmiInlineMarkLike[] | undefined,
): OmiInlineSemanticKind[] {
  const result: OmiInlineSemanticKind[] = [];
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        result.push('strong');
        break;
      case 'italic':
        result.push('emphasis');
        break;
      case 'strike':
        result.push('strike');
        break;
      case 'omiUnderline':
        result.push('underline');
        break;
      case 'omiSmallCaps':
        result.push('small-caps');
        break;
      case 'omiSuperscript':
        result.push('superscript');
        break;
      case 'omiSubscript':
        result.push('subscript');
        break;
      case 'code':
        result.push('code');
        break;
    }
  }
  return Array.from(new Set(result));
}

export function inlineLanguageFromMarks(
  marks: readonly OmiInlineMarkLike[] | undefined,
): string | undefined {
  const mark = (marks ?? []).find((item) => item.type === 'omiLanguage');
  const value = mark?.attrs?.lang;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function inlineLinkFromMarks(
  marks: readonly OmiInlineMarkLike[] | undefined,
): string | undefined {
  const mark = (marks ?? []).find((item) => item.type === 'omiLink');
  const value = mark?.attrs?.href;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Extracts semantic text runs from one stored OMI/Tiptap block. */
export function extractOmiInlineRuns(content: string): OmiInlineRun[] {
  const input = content.trim();
  if (!input) return [];

  let root: JsonNode;
  try {
    root = JSON.parse(input) as JsonNode;
  } catch {
    return [{ text: content, semantics: [] }];
  }

  const runs: OmiInlineRun[] = [];
  walk(root, runs);
  return coalesceRuns(runs);
}

export function omiCharacterStyleName(
  semantics: readonly OmiInlineSemanticKind[],
): string | undefined {
  if (semantics.length === 0) return undefined;
  if (semantics.length === 1) return OMI_CHARACTER_STYLE_NAMES[semantics[0]!];

  // Preserve common compound emphasis as one reusable named style in DTP.
  if (semantics.includes('strong') && semantics.includes('emphasis')) {
    return 'OMI Strong Emphasis';
  }

  return OMI_CHARACTER_STYLE_NAMES[semantics[0]!];
}

function walk(node: JsonNode, runs: OmiInlineRun[]): void {
  if (typeof node.text === 'string') {
    runs.push({
      text: node.text,
      semantics: semanticKindsFromMarks(node.marks),
      language: inlineLanguageFromMarks(node.marks),
      link: inlineLinkFromMarks(node.marks),
    });
    return;
  }

  if (node.type === 'hardBreak') {
    runs.push({ text: '\n', semantics: [] });
    return;
  }

  // Atomic semantic objects keep their visible label when one is available.
  if (node.type === 'omiCitation' || node.type === 'omiCrossReference' || node.type === 'omiNote') {
    const label = node.attrs?.label;
    if (typeof label === 'string' && label) runs.push({ text: label, semantics: [] });
    return;
  }

  for (const child of node.content ?? []) walk(child, runs);

  if (
    (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'codeBlock') &&
    runs.length > 0 &&
    runs.at(-1)?.text !== '\n'
  ) {
    runs.push({ text: '\n', semantics: [] });
  }
}

function coalesceRuns(runs: readonly OmiInlineRun[]): OmiInlineRun[] {
  const result: OmiInlineRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = result.at(-1);
    if (
      previous &&
      previous.language === run.language &&
      previous.link === run.link &&
      previous.semantics.join('|') === run.semantics.join('|')
    ) {
      previous.text += run.text;
    } else {
      result.push({ ...run, semantics: [...run.semantics] });
    }
  }
  while (result.at(-1)?.text === '\n') result.pop();
  return result;
}
