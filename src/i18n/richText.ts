import type { SupportedLocale } from './types';

export interface RichTextCopy {
  bold: string;
  italic: string;
  superscript: string;
  subscript: string;
  link: string;
  unlink: string;
  more: string;
  strike: string;
  bulletList: string;
  orderedList: string;
  blockquote: string;
  inlineCode: string;
  codeBlock: string;
  hardBreak: string;
  language: string;
  removeLanguage: string;
  languagePlaceholder: string;
  apply: string;
  cancel: string;
  linkAddress: string;
  linkPlaceholder: string;
  invalidLink: string;
  specialCharacters: string;
  clearMarks: string;
  toolbar: string;
}

const COPY: Record<SupportedLocale, RichTextCopy> = {
  en: {
    bold: 'Bold',
    italic: 'Italic',
    superscript: 'Superscript',
    subscript: 'Subscript',
    link: 'External link',
    unlink: 'Remove link',
    more: 'More text tools',
    strike: 'Strikethrough',
    bulletList: 'Bullet list',
    orderedList: 'Numbered list',
    blockquote: 'Block quotation',
    inlineCode: 'Inline code',
    codeBlock: 'Code block',
    hardBreak: 'Line break',
    language: 'Text language',
    removeLanguage: 'Remove language mark',
    languagePlaceholder: 'BCP 47 tag, e.g. la, de, en-GB',
    apply: 'Apply',
    cancel: 'Cancel',
    linkAddress: 'External address',
    linkPlaceholder: 'https://…',
    invalidLink: 'Enter a valid http, https or mailto address.',
    specialCharacters: 'Special characters',
    clearMarks: 'Clear inline formatting',
    toolbar: 'Semantic text tools',
  },
  hu: {
    bold: 'Félkövér',
    italic: 'Dőlt',
    superscript: 'Felső index',
    subscript: 'Alsó index',
    link: 'Külső hivatkozás',
    unlink: 'Hivatkozás eltávolítása',
    more: 'További szövegeszközök',
    strike: 'Áthúzott',
    bulletList: 'Felsorolás',
    orderedList: 'Számozott lista',
    blockquote: 'Blokkidézet',
    inlineCode: 'Sorközi kód',
    codeBlock: 'Kódblokk',
    hardBreak: 'Sortörés',
    language: 'Szövegrész nyelve',
    removeLanguage: 'Nyelvjelölés eltávolítása',
    languagePlaceholder: 'BCP 47 kód, pl. la, de, en-GB',
    apply: 'Alkalmazás',
    cancel: 'Mégse',
    linkAddress: 'Külső cím',
    linkPlaceholder: 'https://…',
    invalidLink: 'Érvényes http, https vagy mailto címet adjon meg.',
    specialCharacters: 'Speciális karakterek',
    clearMarks: 'Sorközi formázás törlése',
    toolbar: 'Szemantikus szövegeszközök',
  },
  de: {
    bold: 'Fett',
    italic: 'Kursiv',
    superscript: 'Hochgestellt',
    subscript: 'Tiefgestellt',
    link: 'Externer Link',
    unlink: 'Link entfernen',
    more: 'Weitere Textwerkzeuge',
    strike: 'Durchgestrichen',
    bulletList: 'Aufzählung',
    orderedList: 'Nummerierte Liste',
    blockquote: 'Blockzitat',
    inlineCode: 'Inline-Code',
    codeBlock: 'Codeblock',
    hardBreak: 'Zeilenumbruch',
    language: 'Textsprache',
    removeLanguage: 'Sprachmarkierung entfernen',
    languagePlaceholder: 'BCP-47-Tag, z. B. la, de, en-GB',
    apply: 'Anwenden',
    cancel: 'Abbrechen',
    linkAddress: 'Externe Adresse',
    linkPlaceholder: 'https://…',
    invalidLink: 'Geben Sie eine gültige http-, https- oder mailto-Adresse ein.',
    specialCharacters: 'Sonderzeichen',
    clearMarks: 'Inline-Formatierung entfernen',
    toolbar: 'Semantische Textwerkzeuge',
  },
};

export function getRichTextCopy(locale: SupportedLocale): RichTextCopy {
  return COPY[locale] ?? COPY.en;
}
