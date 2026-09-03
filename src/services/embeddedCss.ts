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
