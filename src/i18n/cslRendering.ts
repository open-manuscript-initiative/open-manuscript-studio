import type { SupportedLocale } from './types';
import type { OmiCitationStyleId } from '../types/omi';

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
  styleNames: Record<OmiCitationStyleId, string>;
}

const COPY: Record<SupportedLocale, CslRenderingCopy> = {
  en: {
    styleTitle: 'Citation style',
    styleDescription:
      'Choose how citations and the bibliography are rendered while authoring. The semantic citation data remain unchanged.',
    styleProfileNote:
      'Studio currently uses CSL-JSON-compatible built-in profiles. A publication profile may override this presentation preference later.',
    bibliographyTitle: 'Formatted bibliography',
    bibliographyDescription:
      'Generated from cited bibliographic records using the selected presentation profile.',
    selectedSources: 'Selected sources',
    clusterHint:
      'Select one or more works. Multiple selections are inserted as one semantic citation cluster.',
    addToCluster: 'Add to cluster',
    removeFromCluster: 'Remove from cluster',
    clusterTitle: 'Citation cluster',
    clusterDescription:
      'Each item remains an independent citation occurrence with its own locator, prefix and suffix.',
    deleteCluster: 'Delete cluster',
    confirmDeleteCluster:
      'Delete this complete citation cluster from the manuscript? Bibliographic records remain in the reference library.',
    moveUp: 'Move earlier',
    moveDown: 'Move later',
    styleNames: {
      'apa-7': 'APA 7',
      'chicago-author-date': 'Chicago Author-Date',
      'chicago-notes-bibliography': 'Chicago Notes & Bibliography',
      'mla-9': 'MLA 9',
      'iso-690': 'ISO 690',
    },
  },
  hu: {
    styleTitle: 'Hivatkozási stílus',
    styleDescription:
      'Válaszd ki, hogyan jelenjenek meg szerkesztés közben a hivatkozások és az irodalomjegyzék. A szemantikus hivatkozási adatok nem változnak.',
    styleProfileNote:
      'A Studio jelenleg CSL-JSON-kompatibilis beépített profilokat használ. A publikációs profil később felülírhatja ezt a megjelenítési beállítást.',
    bibliographyTitle: 'Formázott irodalomjegyzék',
    bibliographyDescription:
      'Az idézett bibliográfiai rekordokból, a kiválasztott megjelenítési profil szerint generálva.',
    selectedSources: 'Kiválasztott források',
    clusterHint:
      'Egy vagy több mű választható ki. Több mű egyetlen szemantikus hivatkozáscsoportként kerül a szövegbe.',
    addToCluster: 'Hozzáadás a csoporthoz',
    removeFromCluster: 'Eltávolítás a csoportból',
    clusterTitle: 'Hivatkozáscsoport',
    clusterDescription:
      'Minden elem önálló hivatkozási előfordulás marad saját helymegjelöléssel, előtaggal és utótaggal.',
    deleteCluster: 'Csoport törlése',
    confirmDeleteCluster:
      'Törlöd a teljes hivatkozáscsoportot a kéziratból? A bibliográfiai rekordok megmaradnak a hivatkozásjegyzékben.',
    moveUp: 'Előrébb',
    moveDown: 'Hátrébb',
    styleNames: {
      'apa-7': 'APA 7',
      'chicago-author-date': 'Chicago szerző–év',
      'chicago-notes-bibliography': 'Chicago jegyzetek és bibliográfia',
      'mla-9': 'MLA 9',
      'iso-690': 'ISO 690',
    },
  },
  de: {
    styleTitle: 'Zitierstil',
    styleDescription:
      'Wählen Sie die Darstellung von Zitaten und Literaturverzeichnis während des Schreibens. Die semantischen Zitationsdaten bleiben unverändert.',
    styleProfileNote:
      'Studio verwendet derzeit integrierte CSL-JSON-kompatible Profile. Ein Publikationsprofil kann diese Darstellungspräferenz später überschreiben.',
    bibliographyTitle: 'Formatiertes Literaturverzeichnis',
    bibliographyDescription:
      'Aus den zitierten bibliografischen Datensätzen mit dem gewählten Darstellungsprofil erzeugt.',
    selectedSources: 'Ausgewählte Quellen',
    clusterHint:
      'Wählen Sie ein oder mehrere Werke. Mehrere Auswahlen werden als ein semantischer Zitationscluster eingefügt.',
    addToCluster: 'Zum Cluster hinzufügen',
    removeFromCluster: 'Aus Cluster entfernen',
    clusterTitle: 'Zitationscluster',
    clusterDescription:
      'Jeder Eintrag bleibt ein eigenständiges Zitationsvorkommen mit eigenem Locator, Präfix und Suffix.',
    deleteCluster: 'Cluster löschen',
    confirmDeleteCluster:
      'Den gesamten Zitationscluster aus dem Manuskript löschen? Die bibliografischen Datensätze bleiben in der Referenzbibliothek erhalten.',
    moveUp: 'Nach vorn',
    moveDown: 'Nach hinten',
    styleNames: {
      'apa-7': 'APA 7',
      'chicago-author-date': 'Chicago Autor-Datum',
      'chicago-notes-bibliography': 'Chicago Fußnoten & Bibliografie',
      'mla-9': 'MLA 9',
      'iso-690': 'ISO 690',
    },
  },
};

export function getCslRenderingCopy(locale: SupportedLocale): CslRenderingCopy {
  return COPY[locale] ?? COPY.en;
}
