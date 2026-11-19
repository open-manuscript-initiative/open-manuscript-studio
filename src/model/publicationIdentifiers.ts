import type { OmiTitleMatter } from './frontMatter';

export type PublicationKind = 'volume' | 'journal-issue';
export type PublicationIdentifierField = 'isbn' | 'electronicIsbn' | 'issn' | 'eissn' | 'doi' | 'otherIdentifiers';

const labels = {
  hu: { isbn: 'ISBN (nyomtatott)', electronicIsbn: 'ISBN (elektronikus)', issn: 'ISSN (nyomtatott)', eissn: 'ISSN (elektronikus, eISSN)', doi: 'A teljes kiadvány DOI-ja', otherIdentifiers: 'Egyéb azonosítók (pl. ARK, URN)',
    title: 'Kiadványazonosítók', hint: 'Minden mező választható. ISBN és ISSN egyszerre is megadható. Több azonosítót külön sorba írjon.' },
  en: { isbn: 'ISBN (print)', electronicIsbn: 'ISBN (electronic)', issn: 'ISSN (print)', eissn: 'ISSN (electronic, eISSN)', doi: 'DOI of the whole publication', otherIdentifiers: 'Other identifiers (e.g. ARK, URN)',
    title: 'Publication identifiers', hint: 'All fields are optional. ISBN and ISSN can be supplied together. Put multiple identifiers on separate lines.' },
  de: { isbn: 'ISBN (Druckausgabe)', electronicIsbn: 'ISBN (elektronisch)', issn: 'ISSN (Druckausgabe)', eissn: 'ISSN (elektronisch, eISSN)', doi: 'DOI der gesamten Publikation', otherIdentifiers: 'Weitere Kennungen (z. B. ARK, URN)',
    title: 'Publikationskennungen', hint: 'Alle Felder sind optional. ISBN und ISSN können gemeinsam angegeben werden. Mehrere Kennungen in getrennte Zeilen schreiben.' },
};

export function getPublicationIdentifiersCopy(locale: string) {
  return labels[locale as keyof typeof labels] ?? labels.en;
}

/** Publication kind changes the order, never the set of accepted identifiers. */
export function publicationIdentifierFields(kind: PublicationKind): PublicationIdentifierField[] {
  return kind === 'journal-issue'
    ? ['issn', 'eissn', 'isbn', 'electronicIsbn', 'doi', 'otherIdentifiers']
    : ['isbn', 'electronicIsbn', 'issn', 'eissn', 'doi', 'otherIdentifiers'];
}

export function publicationIdentifierLines(metadata: OmiTitleMatter | undefined): string[] {
  const prefixes: Record<PublicationIdentifierField, string> = {
    isbn: 'ISBN', electronicIsbn: 'ISBN (electronic)', issn: 'ISSN', eissn: 'eISSN', doi: 'DOI', otherIdentifiers: '',
  };
  return publicationIdentifierFields('volume').flatMap((field) =>
    (metadata?.[field] ?? '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
      .map((value) => prefixes[field] ? `${prefixes[field]} ${value}` : value));
}
