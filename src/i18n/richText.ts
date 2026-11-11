import { applyReturnedSupplementalOverlay } from './returnedTranslationOverlay';
import type { CoreLocale, SupportedLocale } from './types';

export interface RichTextCopy {
  bold: string;
  italic: string;
  superscript: string;
  subscript: string;
  smallCaps: string;
  underline: string;
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
  moveToolbar: string;
  resizeToolbar: string;
  pinToolbar: string;
  unpinToolbar: string;
  resetToolbar: string;
}

const COPY: Record<CoreLocale, RichTextCopy> = {
  en: {
    bold: 'Bold / strong',
    italic: 'Italic / emphasis',
    superscript: 'Superscript',
    subscript: 'Subscript',
    smallCaps: 'Small caps',
    underline: 'Underline',
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
    languagePlaceholder: 'BCP 47 tag',
    apply: 'Apply',
    cancel: 'Cancel',
    linkAddress: 'External address',
    linkPlaceholder: 'https://…',
    invalidLink: 'Enter a valid http, https or mailto address.',
    specialCharacters: 'Special characters',
    clearMarks: 'Clear inline formatting',
    toolbar: 'Semantic text tools',
    moveToolbar: 'Move toolbar (drag or use arrow keys)',
    resizeToolbar: 'Resize toolbar (drag or use arrow keys)',
    pinToolbar: 'Pin toolbar position',
    unpinToolbar: 'Follow text selection',
    resetToolbar: 'Reset toolbar size and position',
  },
  hu: {
    bold: 'Félkövér / kiemelt',
    italic: 'Dőlt / hangsúly',
    superscript: 'Felső index',
    subscript: 'Alsó index',
    smallCaps: 'Kiskapitális',
    underline: 'Aláhúzott',
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
    languagePlaceholder: 'BCP 47 kód',
    apply: 'Alkalmazás',
    cancel: 'Mégse',
    linkAddress: 'Külső cím',
    linkPlaceholder: 'https://…',
    invalidLink: 'Érvényes http, https vagy mailto címet adjon meg.',
    specialCharacters: 'Speciális karakterek',
    clearMarks: 'Sorközi formázás törlése',
    toolbar: 'Szemantikus szövegeszközök',
    moveToolbar: 'Menü áthelyezése (húzással vagy nyílbillentyűkkel)',
    resizeToolbar: 'Menü átméretezése (húzással vagy nyílbillentyűkkel)',
    pinToolbar: 'Menü helyének rögzítése',
    unpinToolbar: 'Kijelölés követése',
    resetToolbar: 'Menü méretének és helyének alaphelyzetbe állítása',
  },
  de: {
    bold: 'Fett / stark',
    italic: 'Kursiv / Hervorhebung',
    superscript: 'Hochgestellt',
    subscript: 'Tiefgestellt',
    smallCaps: 'Kapitälchen',
    underline: 'Unterstrichen',
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
    languagePlaceholder: 'BCP-47-Tag',
    apply: 'Anwenden',
    cancel: 'Abbrechen',
    linkAddress: 'Externe Adresse',
    linkPlaceholder: 'https://…',
    invalidLink: 'Geben Sie eine gültige http-, https- oder mailto-Adresse ein.',
    specialCharacters: 'Sonderzeichen',
    clearMarks: 'Inline-Formatierung entfernen',
    toolbar: 'Semantische Textwerkzeuge',
    moveToolbar: 'Werkzeugleiste verschieben (ziehen oder Pfeiltasten)',
    resizeToolbar: 'Werkzeugleiste skalieren (ziehen oder Pfeiltasten)',
    pinToolbar: 'Position der Werkzeugleiste fixieren',
    unpinToolbar: 'Textauswahl folgen',
    resetToolbar: 'Größe und Position der Werkzeugleiste zurücksetzen',
  },
};

export function getRichTextCopy(locale: SupportedLocale): RichTextCopy {
  const current = COPY[locale as CoreLocale] ?? COPY.en;
  return applyReturnedSupplementalOverlay(locale, 'richText', current, COPY.en);
}
