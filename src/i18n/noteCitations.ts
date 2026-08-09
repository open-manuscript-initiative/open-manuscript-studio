import type { SupportedLocale } from './types';

export interface NoteCitationCopy {
  addCitation: string;
  citations: string;
  noCitations: string;
  removeCitation: string;
  citationHint: string;
}

const COPY: Record<SupportedLocale, NoteCitationCopy> = {
  en: {
    addCitation: 'Insert reference',
    citations: 'References in this note',
    noCitations: 'No bibliographic references have been added to this note yet.',
    removeCitation: 'Remove reference',
    citationHint: 'Choose from the manuscript bibliography. Page, chapter, section and other locators are supported.',
  },
  hu: {
    addCitation: 'Hivatkozás beszúrása',
    citations: 'A jegyzet hivatkozásai',
    noCitations: 'Ehhez a jegyzethez még nincs bibliográfiai hivatkozás.',
    removeCitation: 'Hivatkozás eltávolítása',
    citationHint: 'Válasszon a kézirat hivatkozásjegyzékéből. Oldal-, fejezet-, szakasz- és más helymegjelölés is megadható.',
  },
  de: {
    addCitation: 'Literaturverweis einfügen',
    citations: 'Literaturverweise in dieser Anmerkung',
    noCitations: 'Dieser Anmerkung wurde noch kein Literaturverweis hinzugefügt.',
    removeCitation: 'Literaturverweis entfernen',
    citationHint: 'Wählen Sie aus dem Literaturverzeichnis des Manuskripts. Seiten-, Kapitel-, Abschnitts- und weitere Locator-Angaben werden unterstützt.',
  },
};

export function getNoteCitationCopy(locale: SupportedLocale): NoteCitationCopy {
  return COPY[locale] ?? COPY.en;
}
