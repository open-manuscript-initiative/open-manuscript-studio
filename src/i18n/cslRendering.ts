import type { SupportedLocale } from './types';

export interface CslRenderingCopy {
  styleTitle: string;
  styleDescription: string;
  styleProfileNote: string;
  bibliographyTitle: string;
  bibliographyDescription: string;
  selectedSources: string;
  clusterHint: string;
  addToCluster: string;
  removeFromCluster: string;
  clusterTitle: string;
  clusterDescription: string;
  deleteCluster: string;
  confirmDeleteCluster: string;
  moveUp: string;
  moveDown: string;
  searchStyles: string;
  allStyles: string;
  customStyles: string;
  createCustomStyle: string;
  customStyleName: string;
  baseStyle: string;
  citationPrefix: string;
  citationSuffix: string;
  citationDelimiter: string;
  bibliographyPrefix: string;
  bibliographySuffix: string;
  uppercaseAuthors: string;
  saveCustomStyle: string;
  cancel: string;
  deleteCustomStyle: string;
  customStyleSaved: string;
  customStyleNameRequired: string;
  styleNames: Record<string, string>;
}

const COPY: Record<SupportedLocale, CslRenderingCopy> = {
  en: {
    styleTitle: 'Citation style',
    styleDescription: 'Choose how citations and the bibliography are rendered while authoring. Semantic citation data remain unchanged.',
    styleProfileNote: 'The selector contains the major CSL style families and named publisher/journal profiles. Saved custom styles are reusable and their complete settings travel with the selected manuscript style.',
    bibliographyTitle: 'Formatted bibliography',
    bibliographyDescription: 'Generated from cited bibliographic records using the selected presentation profile.',
    selectedSources: 'Selected sources',
    clusterHint: 'Select one or more works. Multiple selections are inserted as one semantic citation cluster.',
    addToCluster: 'Add to cluster', removeFromCluster: 'Remove from cluster', clusterTitle: 'Citation cluster',
    clusterDescription: 'Each item remains an independent citation occurrence with its own locator, prefix and suffix.',
    deleteCluster: 'Delete cluster', confirmDeleteCluster: 'Delete this complete citation cluster from the manuscript? Bibliographic records remain in the reference library.',
    moveUp: 'Move earlier', moveDown: 'Move later', searchStyles: 'Search citation styles', allStyles: 'All styles',
    customStyles: 'Saved custom styles', createCustomStyle: 'Create custom style', customStyleName: 'Style name', baseStyle: 'Base style',
    citationPrefix: 'Citation opening', citationSuffix: 'Citation closing', citationDelimiter: 'Citation separator',
    bibliographyPrefix: 'Bibliography entry prefix', bibliographySuffix: 'Bibliography entry suffix', uppercaseAuthors: 'Uppercase first author family name',
    saveCustomStyle: 'Save style', cancel: 'Cancel', deleteCustomStyle: 'Delete saved style', customStyleSaved: 'Custom citation style saved.',
    customStyleNameRequired: 'Enter a name for the custom style.',
    styleNames: { 'apa-7': 'APA 7', 'chicago-author-date': 'Chicago Author-Date', 'chicago-notes-bibliography': 'Chicago Notes & Bibliography', 'mla-9': 'MLA 9', 'iso-690': 'ISO 690' },
  },
  hu: {
    styleTitle: 'Hivatkozási stílus',
    styleDescription: 'Válaszd ki, hogyan jelenjenek meg szerkesztés közben a hivatkozások és az irodalomjegyzék. A szemantikus hivatkozási adatok nem változnak.',
    styleProfileNote: 'A választó a fő CSL-stíluscsaládokat, valamint kiadói és folyóiratprofilokat tartalmazza. A névvel mentett egyéni stílusok újra felhasználhatók, és a kiválasztott stílus teljes beállítása a kézirattal együtt hordozható.',
    bibliographyTitle: 'Formázott irodalomjegyzék', bibliographyDescription: 'Az idézett bibliográfiai rekordokból, a kiválasztott megjelenítési profil szerint generálva.',
    selectedSources: 'Kiválasztott források', clusterHint: 'Egy vagy több mű választható ki. Több mű egyetlen szemantikus hivatkozáscsoportként kerül a szövegbe.',
    addToCluster: 'Hozzáadás a csoporthoz', removeFromCluster: 'Eltávolítás a csoportból', clusterTitle: 'Hivatkozáscsoport',
    clusterDescription: 'Minden elem önálló hivatkozási előfordulás marad saját helymegjelöléssel, előtaggal és utótaggal.',
    deleteCluster: 'Csoport törlése', confirmDeleteCluster: 'Törlöd a teljes hivatkozáscsoportot a kéziratból? A bibliográfiai rekordok megmaradnak a hivatkozásjegyzékben.',
    moveUp: 'Előrébb', moveDown: 'Hátrébb', searchStyles: 'Hivatkozási stílus keresése', allStyles: 'Összes stílus',
    customStyles: 'Mentett egyéni stílusok', createCustomStyle: 'Egyéni stílus létrehozása', customStyleName: 'Stílus neve', baseStyle: 'Alapstílus',
    citationPrefix: 'Hivatkozás nyitójele', citationSuffix: 'Hivatkozás zárójele', citationDelimiter: 'Hivatkozások elválasztója',
    bibliographyPrefix: 'Bibliográfiai tétel előtagja', bibliographySuffix: 'Bibliográfiai tétel utótagja', uppercaseAuthors: 'Az első szerző vezetékneve nagybetűs',
    saveCustomStyle: 'Stílus mentése', cancel: 'Mégse', deleteCustomStyle: 'Mentett stílus törlése', customStyleSaved: 'Az egyéni hivatkozási stílus elmentve.',
    customStyleNameRequired: 'Adj nevet az egyéni stílusnak.',
    styleNames: { 'apa-7': 'APA 7', 'chicago-author-date': 'Chicago szerző–év', 'chicago-notes-bibliography': 'Chicago jegyzetek és bibliográfia', 'mla-9': 'MLA 9', 'iso-690': 'ISO 690' },
  },
  de: {
    styleTitle: 'Zitierstil',
    styleDescription: 'Wählen Sie die Darstellung von Zitaten und Literaturverzeichnis während des Schreibens. Die semantischen Zitationsdaten bleiben unverändert.',
    styleProfileNote: 'Die Auswahl enthält die wichtigsten CSL-Stilfamilien sowie Verlags- und Zeitschriftenprofile. Benannte benutzerdefinierte Stile können wiederverwendet werden; ihre vollständigen Einstellungen reisen mit dem gewählten Manuskriptstil.',
    bibliographyTitle: 'Formatiertes Literaturverzeichnis', bibliographyDescription: 'Aus den zitierten bibliografischen Datensätzen mit dem gewählten Darstellungsprofil erzeugt.',
    selectedSources: 'Ausgewählte Quellen', clusterHint: 'Wählen Sie ein oder mehrere Werke. Mehrere Auswahlen werden als ein semantischer Zitationscluster eingefügt.',
    addToCluster: 'Zum Cluster hinzufügen', removeFromCluster: 'Aus Cluster entfernen', clusterTitle: 'Zitationscluster',
    clusterDescription: 'Jeder Eintrag bleibt ein eigenständiges Zitationsvorkommen mit eigenem Locator, Präfix und Suffix.',
    deleteCluster: 'Cluster löschen', confirmDeleteCluster: 'Den gesamten Zitationscluster aus dem Manuskript löschen? Die bibliografischen Datensätze bleiben in der Referenzbibliothek erhalten.',
    moveUp: 'Nach vorn', moveDown: 'Nach hinten', searchStyles: 'Zitierstile suchen', allStyles: 'Alle Stile',
    customStyles: 'Gespeicherte eigene Stile', createCustomStyle: 'Eigenen Stil erstellen', customStyleName: 'Stilname', baseStyle: 'Basisstil',
    citationPrefix: 'Zitationsanfang', citationSuffix: 'Zitationsende', citationDelimiter: 'Zitationstrennzeichen',
    bibliographyPrefix: 'Präfix des Literaturverzeichniseintrags', bibliographySuffix: 'Suffix des Literaturverzeichniseintrags', uppercaseAuthors: 'Nachname des ersten Autors in Großbuchstaben',
    saveCustomStyle: 'Stil speichern', cancel: 'Abbrechen', deleteCustomStyle: 'Gespeicherten Stil löschen', customStyleSaved: 'Eigener Zitierstil gespeichert.',
    customStyleNameRequired: 'Geben Sie einen Namen für den eigenen Stil ein.',
    styleNames: { 'apa-7': 'APA 7', 'chicago-author-date': 'Chicago Autor-Datum', 'chicago-notes-bibliography': 'Chicago Fußnoten & Bibliografie', 'mla-9': 'MLA 9', 'iso-690': 'ISO 690' },
  },
};

export function getCslRenderingCopy(locale: SupportedLocale): CslRenderingCopy {
  return COPY[locale] ?? COPY.en;
}
