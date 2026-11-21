import { createNoteBodyDocument, noteBodyPlainText, type NoteCitationStyleOptions, type NoteJsonNode } from '../model/noteRichText';
import { normalizeExternalHref, normalizeInlineLanguageTag } from '../model/richText';
import type { OmiAnnotation, OmiBibliographicRecord, OmiCitationStyleId } from '../types/omi';

export interface PublicationNoteBody {
  text: string;
  html: string;
}

/** Read-only note markup shared by live page measurement, page fragments and exports.
 * Only generated, escaped inline HTML is allowed inside a paged footnote's span.
 */
export function renderPublicationNoteBody(
  note: OmiAnnotation,
  records: readonly OmiBibliographicRecord[],
  citationStyle: OmiCitationStyleId,
  locale: string,
  options: NoteCitationStyleOptions = {},
): PublicationNoteBody {
  const document = createNoteBodyDocument(note, records, citationStyle, locale, options);
  const text = noteBodyPlainText(document);
  return { text, html: render(document) };
}

function render(node: NoteJsonNode): string {
  const children = (separator = '') => (node.content ?? []).map(render).join(separator);
  switch (node.type) {
    case 'text': return applyMarks(escape(node.text ?? '').replace(/\r\n?|\n/g, '<br>'), node.marks ?? []);
    case 'hardBreak': return '<br>';
    case 'omiTab': return '\t';
    case 'omiCitation': return `<span class="citation omi-note-citation">${applyMarks(escape(typeof node.attrs?.label === 'string' ? node.attrs.label : ''), node.marks ?? [])}</span>`;
    case 'doc': case 'listItem': case 'blockquote': return children('<br>');
    case 'bulletList': return (node.content ?? []).map((item) => `• ${render(item)}`).join('<br>');
    case 'orderedList': {
      const start = Number.isSafeInteger(node.attrs?.start) ? Number(node.attrs!.start) : 1;
      return (node.content ?? []).map((item, index) => `${start + index}. ${render(item)}`).join('<br>');
    }
    case 'codeBlock': return `<code>${children()}</code>`;
    default: return children();
  }
}

function applyMarks(text: string, marks: NonNullable<NoteJsonNode['marks']>): string {
  return marks.reduce((html, mark) => {
    switch (mark.type) {
      case 'bold': return `<strong>${html}</strong>`;
      case 'italic': return `<em>${html}</em>`;
      case 'strike': return `<del>${html}</del>`;
      case 'code': return `<code>${html}</code>`;
      case 'underline': case 'omiUnderline': return `<u>${html}</u>`;
      case 'omiSmallCaps': return `<span style="font-variant:small-caps">${html}</span>`;
      case 'omiSuperscript': return `<sup>${html}</sup>`;
      case 'omiSubscript': return `<sub>${html}</sub>`;
      case 'link': case 'omiLink': {
        const href = typeof mark.attrs?.href === 'string' ? normalizeExternalHref(mark.attrs.href) : undefined;
        return href ? `<a href="${escape(href)}" rel="external">${html}</a>` : html;
      }
      case 'omiLanguage': {
        const lang = typeof mark.attrs?.lang === 'string' ? normalizeInlineLanguageTag(mark.attrs.lang) : undefined;
        return lang ? `<span lang="${escape(lang)}">${html}</span>` : html;
      }
      default: return html;
    }
  }, text);
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
