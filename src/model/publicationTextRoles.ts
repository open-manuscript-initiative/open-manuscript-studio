import type { PublicationParagraphStyleCollection, PublicationParagraphStyleDefinition } from './publicationParagraphStyles';

export const PUBLICATION_TEXT_ROLES = ['body', 'title', 'subtitle', 'author', 'motto', 'abstract', 'keywords', 'heading1', 'heading2', 'quote', 'note', 'citation', 'note-citation', 'bibliography', 'figure-caption', 'table-caption'] as const;
export type PublicationTextRole = typeof PUBLICATION_TEXT_ROLES[number];

const NAMES: Record<string, Record<PublicationTextRole, string>> = {
  en: { body: 'Body text', title: 'Title', subtitle: 'Subtitle', author: 'Author', motto: 'Motto', abstract: 'Abstract', keywords: 'Keywords', heading1: 'Heading 1', heading2: 'Heading 2', quote: 'Quotation', note: 'Note', citation: 'Citation', 'note-citation': 'Citation in notes', bibliography: 'Bibliography', 'figure-caption': 'Figure caption', 'table-caption': 'Table caption' },
  hu: { body: 'Törzsszöveg', title: 'Cím', subtitle: 'Alcím', author: 'Szerző', motto: 'Mottó', abstract: 'Absztrakt', keywords: 'Kulcsszavak', heading1: 'Címsor 1', heading2: 'Címsor 2', quote: 'Idézet', note: 'Jegyzet', citation: 'Hivatkozás', 'note-citation': 'Hivatkozás a jegyzetben', bibliography: 'Irodalomjegyzék', 'figure-caption': 'Képaláírás', 'table-caption': 'Táblázatfelirat' },
  de: { body: 'Fließtext', title: 'Titel', subtitle: 'Untertitel', author: 'Autor', motto: 'Motto', abstract: 'Zusammenfassung', keywords: 'Schlüsselwörter', heading1: 'Überschrift 1', heading2: 'Überschrift 2', quote: 'Zitat', note: 'Anmerkung', citation: 'Literaturverweis', 'note-citation': 'Literaturverweis in Anmerkungen', bibliography: 'Literaturverzeichnis', 'figure-caption': 'Abbildungsbeschriftung', 'table-caption': 'Tabellenbeschriftung' },
};

export function publicationTextRoleName(role: PublicationTextRole, locale: string): string {
  return (NAMES[locale.split('-')[0]!] ?? NAMES.en!)[role];
}

export function publicationParagraphStyleName(definition: PublicationParagraphStyleDefinition, locale: string): string {
  return definition.role && definition.automaticName ? publicationTextRoleName(definition.role, locale) : definition.name;
}

/** Migrate saved libraries without replacing custom names, formatting or IDs. */
export function withPublicationTextRoles(collection: PublicationParagraphStyleCollection): PublicationParagraphStyleCollection {
  const items = collection.items.map((item) => ({ ...item }));
  for (const [id, role] of [[collection.defaultStyleId, 'body'], ['quotation', 'quote']] as const) {
    const legacy = items.find((item) => item.id === id);
    if (legacy && !legacy.role && !items.some((item) => item.role === role)) {
      legacy.role = role;
      legacy.automaticName = Object.values(NAMES).some((names) => names[role] === legacy.name);
    }
  }
  for (const role of PUBLICATION_TEXT_ROLES) {
    if (items.some((item) => item.role === role)) continue;
    let id = `semantic-${role}`;
    while (items.some((item) => item.id === id)) id += '-1';
    items.push({ id, role, automaticName: true, name: publicationTextRoleName(role, 'en'),
      basedOnId: role === 'citation' ? null : role === 'note-citation' ? items.find((item) => item.role === 'citation')!.id : collection.defaultStyleId,
      nextStyleId: collection.defaultStyleId, properties: {} });
  }
  return { ...collection, items };
}

export const EXPORT_TEXT_ROLE_SELECTORS: Record<PublicationTextRole, string[]> = {
  body: [], title: ['.article-front h1'], subtitle: ['.article-front .article-subtitle', '.article-front .subtitle'], author: ['.article-front .contributor-name', '.article-front .author-name'],
  motto: ['.article-motto'], abstract: ['.article-abstract > p', '.abstract > p'], keywords: ['.article-keywords li'],
  heading1: ['.article-body h2:not([data-omi-paragraph-style-id])'], heading2: ['.article-body :is(h3, h4, h5, h6):not([data-omi-paragraph-style-id])'],
  quote: ['.article-body .text-block:not([data-omi-paragraph-style-id]) > blockquote:not([data-omi-paragraph-style-id])', '.article-body .text-block:not([data-omi-paragraph-style-id]) > blockquote:not([data-omi-paragraph-style-id]) > p', '.article-body blockquote[data-omi-block-id]:not([data-omi-paragraph-style-id])', '.article-body blockquote[data-omi-block-id]:not([data-omi-paragraph-style-id]) > p'],
  note: ['.article-notes > ol > li', '.omi-page-footnote', '.omi-local-note'],
  citation: ['.citation'], 'note-citation': ['.article-notes .omi-note-citation', '.omi-page-footnote .omi-note-citation', '.omi-local-note .omi-note-citation'],
  bibliography: ['.bibliography p', '.references li', '.article-bibliography li'], 'figure-caption': ['figcaption'], 'table-caption': ['table caption'],
};

export const LIVE_TEXT_ROLE_SELECTORS: Record<PublicationTextRole, string[]> = {
  body: [], title: ['.publication-document-title'], subtitle: ['.publication-document-subtitle'], author: ['.publication-document-authors'], motto: ['.publication-document-motto'],
  abstract: ['.publication-document-abstract'], keywords: ['.publication-document-keywords'],
  heading1: ['.omi-continuous-tiptap-editor > h1:not([data-paragraph-style-id])'], heading2: ['.omi-continuous-tiptap-editor > :is(h2, h3, h4, h5, h6):not([data-paragraph-style-id])'],
  quote: ['.omi-continuous-tiptap-editor > blockquote:not([data-paragraph-style-id])', '.omi-continuous-tiptap-editor > blockquote:not([data-paragraph-style-id]) > p'],
  note: ['.publication-page-note', '.publication-document-notes > ol > li'], citation: ['.citation'], 'note-citation': ['.omi-publication-note-body .omi-note-citation'],
  bibliography: ['.publication-document-bibliography li'], 'figure-caption': ['figcaption'], 'table-caption': ['table caption'],
};
