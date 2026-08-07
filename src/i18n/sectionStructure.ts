import type { SupportedLocale } from './types';

export interface SectionStructureCopy {
  title: string;
  description: string;
  addTopLevel: string;
  addSubsection: string;
  insertAfter: string;
  dragHint: string;
  dropAsChild: string;
  openSection: string;
  moveUp: string;
  moveDown: string;
  indent: string;
  outdent: string;
  dragSection: string;
  selected: string;
  emptyTitle: string;
  level: string;
  invalidHierarchy: string;
}

const COPY: Record<SupportedLocale, SectionStructureCopy> = {
  en: {
    title: 'Hierarchical document structure',
    description:
      'Build chapters and subsections at any depth. Stable section identities remain unchanged while the outline and generated numbering evolve.',
    addTopLevel: 'Add top-level section',
    addSubsection: 'Add subsection',
    insertAfter: 'Insert sibling after this section',
    dragHint:
      'Drag a section onto another section to make it a subsection. Use the arrows and indent/outdent controls for keyboard- and touch-friendly restructuring.',
    dropAsChild: 'Drop here to make this section a subsection',
    openSection: 'Open section',
    moveUp: 'Move before previous sibling',
    moveDown: 'Move after next sibling',
    indent: 'Make subsection of previous sibling',
    outdent: 'Promote one level',
    dragSection: 'Drag section subtree',
    selected: 'Selected',
    emptyTitle: 'Untitled section',
    level: 'Level',
    invalidHierarchy: 'The section hierarchy contains an invalid parent relationship.',
  },
  hu: {
    title: 'Hierarchikus dokumentumszerkezet',
    description:
      'Tetszőleges mélységű fejezetek és alszakaszok hozhatók létre. A stabil szakaszazonosítók változatlanok maradnak, miközben a szerkezet és az automatikus számozás módosul.',
    addTopLevel: 'Felső szintű szakasz hozzáadása',
    addSubsection: 'Alszakasz hozzáadása',
    insertAfter: 'Azonos szintű szakasz beszúrása utána',
    dragHint:
      'Húzz egy szakaszt egy másikra, hogy annak alszakasza legyen. Billentyűzeten és érintőképernyőn a nyilak, illetve a behúzás/kihúzás gombok használhatók.',
    dropAsChild: 'Ejtsd ide, hogy alszakasz legyen',
    openSection: 'Szakasz megnyitása',
    moveUp: 'Mozgatás az előző testvér elé',
    moveDown: 'Mozgatás a következő testvér után',
    indent: 'Legyen az előző testvér alszakasza',
    outdent: 'Kiemelés egy szinttel',
    dragSection: 'Szakasz és alstruktúrájának húzása',
    selected: 'Kijelölve',
    emptyTitle: 'Névtelen szakasz',
    level: 'Szint',
    invalidHierarchy: 'A szakaszhierarchia érvénytelen szülőkapcsolatot tartalmaz.',
  },
  de: {
    title: 'Hierarchische Dokumentstruktur',
    description:
      'Kapitel und Unterabschnitte können in beliebiger Tiefe aufgebaut werden. Stabile Abschnittskennungen bleiben erhalten, während Gliederung und Nummerierung geändert werden.',
    addTopLevel: 'Abschnitt auf oberster Ebene hinzufügen',
    addSubsection: 'Unterabschnitt hinzufügen',
    insertAfter: 'Gleichrangigen Abschnitt danach einfügen',
    dragHint:
      'Ziehen Sie einen Abschnitt auf einen anderen, um ihn als Unterabschnitt einzuordnen. Pfeil- sowie Ein-/Ausrück-Schaltflächen ermöglichen dieselben Aktionen mit Tastatur oder Touch.',
    dropAsChild: 'Hier ablegen, um einen Unterabschnitt zu erstellen',
    openSection: 'Abschnitt öffnen',
    moveUp: 'Vor das vorherige Geschwister verschieben',
    moveDown: 'Nach das nächste Geschwister verschieben',
    indent: 'Unterabschnitt des vorherigen Geschwisters werden',
    outdent: 'Eine Ebene höher stufen',
    dragSection: 'Abschnitt mit Unterstruktur ziehen',
    selected: 'Ausgewählt',
    emptyTitle: 'Unbenannter Abschnitt',
    level: 'Ebene',
    invalidHierarchy: 'Die Abschnittshierarchie enthält eine ungültige Elternbeziehung.',
  },
};

export function getSectionStructureCopy(
  locale: SupportedLocale,
): SectionStructureCopy {
  return COPY[locale] ?? COPY.en;
}
