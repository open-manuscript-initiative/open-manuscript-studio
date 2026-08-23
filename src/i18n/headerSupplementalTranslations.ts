export interface HeaderSupplementalCopy {
  search: string;
  account: string;
  showOutline: string;
  hideOutline: string;
  manuscript: string;
}

type StudioUiLocale =
  | 'bg' | 'cs' | 'da' | 'de' | 'el' | 'en' | 'es' | 'et'
  | 'fi' | 'fr' | 'ga' | 'hr' | 'hu' | 'it' | 'lt' | 'lv'
  | 'mt' | 'nl' | 'pl' | 'pt' | 'ro' | 'sk' | 'sl' | 'sv';

const headerSupplementalTranslations: Record<StudioUiLocale, HeaderSupplementalCopy> = {
  bg: { search: 'Търсене', account: 'Акаунт', showOutline: 'Показване на структурата на документа', hideOutline: 'Скриване на структурата на документа', manuscript: 'Ръкопис' },
  cs: { search: 'Hledat', account: 'Účet', showOutline: 'Zobrazit osnovu dokumentu', hideOutline: 'Skrýt osnovu dokumentu', manuscript: 'Rukopis' },
  da: { search: 'Søg', account: 'Konto', showOutline: 'Vis dokumentoversigt', hideOutline: 'Skjul dokumentoversigt', manuscript: 'Manuskript' },
  de: { search: 'Suchen', account: 'Konto', showOutline: 'Dokumentstruktur anzeigen', hideOutline: 'Dokumentstruktur ausblenden', manuscript: 'Manuskript' },
  el: { search: 'Αναζήτηση', account: 'Λογαριασμός', showOutline: 'Εμφάνιση διάρθρωσης εγγράφου', hideOutline: 'Απόκρυψη διάρθρωσης εγγράφου', manuscript: 'Χειρόγραφο' },
  en: { search: 'Search', account: 'Account', showOutline: 'Show document outline', hideOutline: 'Hide document outline', manuscript: 'Manuscript' },
  es: { search: 'Buscar', account: 'Cuenta', showOutline: 'Mostrar esquema del documento', hideOutline: 'Ocultar esquema del documento', manuscript: 'Manuscrito' },
  et: { search: 'Otsi', account: 'Konto', showOutline: 'Kuva dokumendi struktuur', hideOutline: 'Peida dokumendi struktuur', manuscript: 'Käsikiri' },
  fi: { search: 'Haku', account: 'Tili', showOutline: 'Näytä asiakirjan rakenne', hideOutline: 'Piilota asiakirjan rakenne', manuscript: 'Käsikirjoitus' },
  fr: { search: 'Rechercher', account: 'Compte', showOutline: 'Afficher le plan du document', hideOutline: 'Masquer le plan du document', manuscript: 'Manuscrit' },
  ga: { search: 'Cuardaigh', account: 'Cuntas', showOutline: 'Taispeáin imlíne an doiciméid', hideOutline: 'Folaigh imlíne an doiciméid', manuscript: 'Lámhscríbhinn' },
  hr: { search: 'Pretraži', account: 'Račun', showOutline: 'Prikaži strukturu dokumenta', hideOutline: 'Sakrij strukturu dokumenta', manuscript: 'Rukopis' },
  hu: { search: 'Keresés', account: 'Fiók', showOutline: 'Dokumentumszerkezet megjelenítése', hideOutline: 'Dokumentumszerkezet elrejtése', manuscript: 'Kézirat' },
  it: { search: 'Cerca', account: 'Account', showOutline: 'Mostra struttura documento', hideOutline: 'Nascondi struttura documento', manuscript: 'Manoscritto' },
  lt: { search: 'Ieškoti', account: 'Paskyra', showOutline: 'Rodyti dokumento struktūrą', hideOutline: 'Slėpti dokumento struktūrą', manuscript: 'Rankraštis' },
  lv: { search: 'Meklēt', account: 'Konts', showOutline: 'Rādīt dokumenta struktūru', hideOutline: 'Paslēpt dokumenta struktūru', manuscript: 'Manuskripts' },
  mt: { search: 'Fittex', account: 'Kont', showOutline: 'Uri l-istruttura tad-dokument', hideOutline: 'Aħbi l-istruttura tad-dokument', manuscript: 'Manuskritt' },
  nl: { search: 'Zoeken', account: 'Account', showOutline: 'Documentoverzicht tonen', hideOutline: 'Documentoverzicht verbergen', manuscript: 'Manuscript' },
  pl: { search: 'Szukaj', account: 'Konto', showOutline: 'Pokaż strukturę dokumentu', hideOutline: 'Ukryj strukturę dokumentu', manuscript: 'Rękopis' },
  pt: { search: 'Pesquisar', account: 'Conta', showOutline: 'Mostrar estrutura do documento', hideOutline: 'Ocultar estrutura do documento', manuscript: 'Manuscrito' },
  ro: { search: 'Căutare', account: 'Cont', showOutline: 'Afișează structura documentului', hideOutline: 'Ascunde structura documentului', manuscript: 'Manuscris' },
  sk: { search: 'Hľadať', account: 'Účet', showOutline: 'Zobraziť osnovu dokumentu', hideOutline: 'Skryť osnovu dokumentu', manuscript: 'Rukopis' },
  sl: { search: 'Iskanje', account: 'Račun', showOutline: 'Prikaži oris dokumenta', hideOutline: 'Skrij oris dokumenta', manuscript: 'Rokopis' },
  sv: { search: 'Sök', account: 'Konto', showOutline: 'Visa dokumentöversikt', hideOutline: 'Dölj dokumentöversikt', manuscript: 'Manuskript' },
};

export function getHeaderSupplementalCopy(locale: string): HeaderSupplementalCopy {
  return headerSupplementalTranslations[locale as StudioUiLocale]
    ?? headerSupplementalTranslations.en;
}
