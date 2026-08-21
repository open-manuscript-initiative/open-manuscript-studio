const LATEX_TEXT_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\textbackslash{}',
  '#': '\\#',
  '$': '\\$',
  '%': '\\%',
  '&': '\\&',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

const LATEX_URL_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '%5C',
  '{': '%7B',
  '}': '%7D',
  '%': '\\%',
  '#': '\\#',
};

/**
 * Escape plain text for a LaTeX document in one pass. Generated escape
 * sequences are never fed back through another replacement step.
 */
export function escapeLatexText(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (character === '\r') {
      if (value[index + 1] === '\n') index += 1;
      result += '\\\\ ';
      continue;
    }
    if (character === '\n') {
      result += '\\\\ ';
      continue;
    }
    result += LATEX_TEXT_ESCAPES[character] ?? character;
  }
  return result;
}

/** Escape a URL used inside hyperref's braced URL argument. */
export function escapeLatexUrl(value: string): string {
  let result = '';
  for (const character of value) {
    result += LATEX_URL_ESCAPES[character] ?? character;
  }
  return result;
}
