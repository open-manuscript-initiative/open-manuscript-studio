import { sanitizeRichTextPasteHtml } from '../model/richText';



export function normalizeClipboardHtml(html: string): string {
  return sanitizeRichTextPasteHtml(html);
}

export function isMicrosoftWordClipboardHtml(
  html: string,
  types: readonly string[] = [],
): boolean {
  if (!html) return false;
  const normalized = html.toLowerCase();
  return (
    normalized.includes('mso-') ||
    normalized.includes('urn:schemas-microsoft-com:office') ||
    normalized.includes('xmlns:w=') ||
    normalized.includes('class="msonormal"') ||
    types.some((type) => type.toLowerCase().includes('msword'))
  );
}

/** Converts plain clipboard text into HTML paragraphs suitable for Tiptap. */
export function plainTextToPasteHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);

  return paragraphs
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph).replace(/\n/g, '<br>');
      return `<p>${escaped || '<br>'}</p>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
