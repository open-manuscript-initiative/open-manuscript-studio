import { sanitizeRichTextPasteHtml } from '../model/richText';

export interface ClipboardPastePayload {
  html: string;
  text: string;
  isWord: boolean;
}

/**
 * Reads clipboard payloads without depending on the async Clipboard API.
 * This keeps paste compatible with browsers, Tauri WebViews and Android's
 * native selection menu.
 */
export function readClipboardPastePayload(
  clipboardData: Pick<DataTransfer, 'getData' | 'types'>,
): ClipboardPastePayload {
  const html = clipboardData.getData('text/html');
  const text = clipboardData.getData('text/plain');
  const types = Array.from(clipboardData.types ?? []);

  return {
    html,
    text,
    isWord: isMicrosoftWordClipboardHtml(html, types),
  };
}

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
