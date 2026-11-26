/**
 * Encodes a CSS string that will be embedded in an HTML <style> element.
 * Escaping angle brackets is essential: HTML's raw-text parser recognizes a
 * literal </style sequence even when CSS itself would treat it as string data.
 */
export function cssStringLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/</g, '\\3c ')
    .replace(/>/g, '\\3e ');
  return `"${escaped}"`;
}

/** The source face stays available even when a publication projects another face.
 * CSS font matching selects a fallback per supported character/shaping cluster.
 */
export const AUTHOR_FONT_FALLBACKS = '"Noto Serif", "Noto Sans", "Noto Sans Hebrew", "Noto Naskh Arabic", "Noto Sans CJK SC", "Noto Sans CJK JP", "Noto Sans CJK KR", serif';
export function authorFontStyle(family: string): string {
  const source = cssStringLiteral(family);
  return `--omi-author-font-family:${source};font-family:${source}, ${AUTHOR_FONT_FALLBACKS}`;
}
