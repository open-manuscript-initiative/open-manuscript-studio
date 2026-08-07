import type { SupportedLocale } from './types';

export interface SectionStructureCopy {
  title: string;
  description: string;
  insertHere: string;
  insertFirst: string;
  insertAfterLast: string;
  dragHint: string;
  openSection: string;
  moveUp: string;
  moveDown: string;
  dragSection: string;
  selected: string;
  emptyTitle: string;
}

const COPY: Record<SupportedLocale, SectionStructureCopy> = {
  en: {
    title: 'Flexible section order',
    description:
      'Insert a new section at any position or reorder existing sections without changing their stable identities.',
    insertHere: 'Insert section here',
    insertFirst: 'Insert section at beginning',
    insertAfterLast: 'Insert section at end',
    dragHint:
      'Drag sections between insertion lines, or use the arrow buttons for keyboard and touch-friendly reordering.',
    openSection: 'Open section',
    moveUp: 'Move section up',
    moveDown: 'Move section down',
    dragSection: 'Drag section',
    selected: 'Selected',
    emptyTitle: 'Untitled section',
  },
  hu: {
    title: 'Rugalmas szakaszsorrend',
    description:
      'Új fejezet vagy szakasz bármelyik pozícióba beszúrható, a meglévők pedig stabil azonosítójuk megváltoztatása nélkül átrendezhetők.',
    insertHere: 'Szakasz beszúrása ide',
    insertFirst: 'Szakasz beszúrása az elejére',
    insertAfterLast: 'Szakasz beszúrása a végére',
    dragHint:
      'A szakaszok az elválasztó beszúrási helyek közé húzhatók; billentyűzeten és érintőképernyőn a nyílgombokkal is átrendezhetők.',
    openSection: 'Szakasz megnyitása',
    moveUp: 'Szakasz mozgatása feljebb',
    moveDown: 'Szakasz mozgatása lejjebb',
    dragSection: 'Szakasz húzása',
    selected: 'Kijelölve',
    emptyTitle: 'Névtelen szakasz',
  },
  de: {
    title: 'Flexible Abschnittsreihenfolge',
    description:
      'Neue Kapitel oder Abschnitte können an jeder Position eingefügt und bestehende Abschnitte ohne Änderung ihrer stabilen Identität neu angeordnet werden.',
    insertHere: 'Abschnitt hier einfügen',
    insertFirst: 'Abschnitt am Anfang einfügen',
    insertAfterLast: 'Abschnitt am Ende einfügen',
    dragHint:
      'Abschnitte können zwischen die Einfügelinien gezogen oder mit den Pfeiltasten tastatur- und touchfreundlich verschoben werden.',
    openSection: 'Abschnitt öffnen',
    moveUp: 'Abschnitt nach oben verschieben',
    moveDown: 'Abschnitt nach unten verschieben',
    dragSection: 'Abschnitt ziehen',
    selected: 'Ausgewählt',
    emptyTitle: 'Unbenannter Abschnitt',
  },
};

export function getSectionStructureCopy(
  locale: SupportedLocale,
): SectionStructureCopy {
  return COPY[locale] ?? COPY.en;
}
