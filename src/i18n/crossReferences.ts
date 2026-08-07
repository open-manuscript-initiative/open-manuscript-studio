import type { SupportedLocale } from './types';

export interface CrossReferenceCopy {
  insert: string;
  insertDescription: string;
  chooseTarget: string;
  searchPlaceholder: string;
  noTargets: string;
  cancel: string;
  display: string;
  displayLabelNumber: string;
  displayNumber: string;
  displayTitle: string;
  displayLabelNumberTitle: string;
  edit: string;
  target: string;
  goToTarget: string;
  deleteReference: string;
  confirmDelete: string;
  unresolved: string;
  numbering: string;
  numberingDescription: string;
  numberingDocument: string;
  numberingSection: string;
  statusTitle: string;
  statusDescription: string;
  statusHealthy: string;
  statusIssues: string;
  missingTarget: string;
  missingAnchor: string;
  section: string;
  figure: string;
  table: string;
  chart: string;
  equation: string;
}

const COPY: Record<SupportedLocale, CrossReferenceCopy> = {
  en: {
    insert: 'Cross-reference',
    insertDescription: 'Link to a section, figure, table, chart or equation by stable object identity.',
    chooseTarget: 'Choose target',
    searchPlaceholder: 'Search document objects…',
    noTargets: 'No matching document objects.',
    cancel: 'Cancel',
    display: 'Display',
    displayLabelNumber: 'Label and number',
    displayNumber: 'Number only',
    displayTitle: 'Title or caption',
    displayLabelNumberTitle: 'Label, number and title',
    edit: 'Edit cross-reference',
    target: 'Target',
    goToTarget: 'Go to target',
    deleteReference: 'Delete reference',
    confirmDelete: 'Delete this internal cross-reference?',
    unresolved: 'The target object no longer exists.',
    numbering: 'Object numbering',
    numberingDescription: 'Choose whether figures, tables, charts and equations are numbered through the manuscript or restart in each section.',
    numberingDocument: 'Continuous through document',
    numberingSection: 'Restart in each section',
    statusTitle: 'Internal references',
    statusDescription: 'Semantic references remain attached to stable object IDs when document order changes.',
    statusHealthy: 'All internal references resolve correctly.',
    statusIssues: 'Internal reference issues',
    missingTarget: 'Missing target',
    missingAnchor: 'Missing text anchor',
    section: 'Sections',
    figure: 'Figures',
    table: 'Tables',
    chart: 'Charts',
    equation: 'Equations',
  },
  hu: {
    insert: 'Kereszthivatkozás',
    insertDescription: 'Hivatkozás szakaszra, ábrára, táblázatra, grafikonra vagy egyenletre stabil objektumazonosítóval.',
    chooseTarget: 'Cél kiválasztása',
    searchPlaceholder: 'Dokumentumobjektum keresése…',
    noTargets: 'Nincs megfelelő dokumentumobjektum.',
    cancel: 'Mégse',
    display: 'Megjelenítés',
    displayLabelNumber: 'Megnevezés és szám',
    displayNumber: 'Csak szám',
    displayTitle: 'Cím vagy képaláírás',
    displayLabelNumberTitle: 'Megnevezés, szám és cím',
    edit: 'Kereszthivatkozás szerkesztése',
    target: 'Cél',
    goToTarget: 'Ugrás a célhoz',
    deleteReference: 'Hivatkozás törlése',
    confirmDelete: 'Törli ezt a belső kereszthivatkozást?',
    unresolved: 'A hivatkozott objektum már nem létezik.',
    numbering: 'Objektumszámozás',
    numberingDescription: 'Az ábrák, táblázatok, grafikonok és egyenletek számozása lehet folyamatos vagy szakaszonként újrainduló.',
    numberingDocument: 'Folyamatos a dokumentumban',
    numberingSection: 'Újrakezdés szakaszonként',
    statusTitle: 'Belső hivatkozások',
    statusDescription: 'A szemantikus hivatkozások átrendezés után is a stabil objektumazonosítóhoz kapcsolódnak.',
    statusHealthy: 'Minden belső hivatkozás helyesen feloldható.',
    statusIssues: 'Belső hivatkozási problémák',
    missingTarget: 'Hiányzó célobjektum',
    missingAnchor: 'Hiányzó szöveghorgony',
    section: 'Szakaszok',
    figure: 'Ábrák',
    table: 'Táblázatok',
    chart: 'Grafikonok',
    equation: 'Egyenletek',
  },
  de: {
    insert: 'Querverweis',
    insertDescription: 'Verknüpft Abschnitte, Abbildungen, Tabellen, Diagramme oder Gleichungen über stabile Objektkennungen.',
    chooseTarget: 'Ziel auswählen',
    searchPlaceholder: 'Dokumentobjekte durchsuchen…',
    noTargets: 'Keine passenden Dokumentobjekte.',
    cancel: 'Abbrechen',
    display: 'Darstellung',
    displayLabelNumber: 'Bezeichnung und Nummer',
    displayNumber: 'Nur Nummer',
    displayTitle: 'Titel oder Beschriftung',
    displayLabelNumberTitle: 'Bezeichnung, Nummer und Titel',
    edit: 'Querverweis bearbeiten',
    target: 'Ziel',
    goToTarget: 'Zum Ziel springen',
    deleteReference: 'Verweis löschen',
    confirmDelete: 'Diesen internen Querverweis löschen?',
    unresolved: 'Das referenzierte Objekt existiert nicht mehr.',
    numbering: 'Objektnummerierung',
    numberingDescription: 'Abbildungen, Tabellen, Diagramme und Gleichungen können durchgehend oder je Abschnitt neu nummeriert werden.',
    numberingDocument: 'Durchgehend im Dokument',
    numberingSection: 'In jedem Abschnitt neu beginnen',
    statusTitle: 'Interne Verweise',
    statusDescription: 'Semantische Verweise bleiben auch nach Umordnungen mit stabilen Objekt-IDs verbunden.',
    statusHealthy: 'Alle internen Verweise sind korrekt aufgelöst.',
    statusIssues: 'Probleme mit internen Verweisen',
    missingTarget: 'Fehlendes Ziel',
    missingAnchor: 'Fehlender Textanker',
    section: 'Abschnitte',
    figure: 'Abbildungen',
    table: 'Tabellen',
    chart: 'Diagramme',
    equation: 'Gleichungen',
  },
};

export function getCrossReferenceCopy(
  locale: string,
): CrossReferenceCopy {
  const language = locale.toLowerCase().split('-')[0] as SupportedLocale;
  return COPY[language] ?? COPY.en;
}
