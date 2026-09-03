export interface CurrentStudyNotesCopy {
  show: string;
  hide: string;
  empty: string;
}

type StudioUiLocale =
  | 'bg' | 'cs' | 'da' | 'de' | 'el' | 'en' | 'es' | 'et'
  | 'fi' | 'fr' | 'ga' | 'hr' | 'hu' | 'it' | 'lt' | 'lv'
  | 'mt' | 'nl' | 'pl' | 'pt' | 'ro' | 'sk' | 'sl' | 'sv';

const currentStudyNotesTranslations: Record<StudioUiLocale, CurrentStudyNotesCopy> = {
  bg: { show: 'Показване на бележките към текущата част', hide: 'Скриване на бележките към текущата част', empty: 'Текущата част няма бележки.' },
  cs: { show: 'Zobrazit poznámky k aktuální části', hide: 'Skrýt poznámky k aktuální části', empty: 'Aktuální část nemá žádné poznámky.' },
  da: { show: 'Vis noter til den aktuelle del', hide: 'Skjul noter til den aktuelle del', empty: 'Den aktuelle del har ingen noter.' },
  de: { show: 'Anmerkungen zum aktuellen Teil anzeigen', hide: 'Anmerkungen zum aktuellen Teil ausblenden', empty: 'Der aktuelle Teil enthält keine Anmerkungen.' },
  el: { show: 'Εμφάνιση σημειώσεων για το τρέχον μέρος', hide: 'Απόκρυψη σημειώσεων για το τρέχον μέρος', empty: 'Το τρέχον μέρος δεν έχει σημειώσεις.' },
  en: { show: 'Show notes for the current part', hide: 'Hide notes for the current part', empty: 'The current part has no notes.' },
  es: { show: 'Mostrar las notas de la parte actual', hide: 'Ocultar las notas de la parte actual', empty: 'La parte actual no tiene notas.' },
  et: { show: 'Kuva praeguse osa märkused', hide: 'Peida praeguse osa märkused', empty: 'Praegusel osal pole märkusi.' },
  fi: { show: 'Näytä nykyisen osan muistiinpanot', hide: 'Piilota nykyisen osan muistiinpanot', empty: 'Nykyisessä osassa ei ole muistiinpanoja.' },
  fr: { show: 'Afficher les notes de la partie actuelle', hide: 'Masquer les notes de la partie actuelle', empty: 'La partie actuelle ne contient aucune note.' },
  ga: { show: 'Taispeáin nótaí don chuid reatha', hide: 'Folaigh nótaí don chuid reatha', empty: 'Níl aon nótaí sa chuid reatha.' },
  hr: { show: 'Prikaži bilješke za trenutačni dio', hide: 'Sakrij bilješke za trenutačni dio', empty: 'Trenutačni dio nema bilješki.' },
  hu: { show: 'Az aktuális rész jegyzeteinek megjelenítése', hide: 'Az aktuális rész jegyzeteinek elrejtése', empty: 'Az aktuális részhez nem tartozik jegyzet.' },
  it: { show: 'Mostra le note della parte corrente', hide: 'Nascondi le note della parte corrente', empty: 'La parte corrente non contiene note.' },
  lt: { show: 'Rodyti dabartinės dalies pastabas', hide: 'Slėpti dabartinės dalies pastabas', empty: 'Dabartinėje dalyje pastabų nėra.' },
  lv: { show: 'Rādīt pašreizējās daļas piezīmes', hide: 'Paslēpt pašreizējās daļas piezīmes', empty: 'Pašreizējai daļai nav piezīmju.' },
  mt: { show: 'Uri n-noti għat-taqsima attwali', hide: 'Aħbi n-noti għat-taqsima attwali', empty: 'It-taqsima attwali ma għandhiex noti.' },
  nl: { show: 'Noten bij het huidige deel tonen', hide: 'Noten bij het huidige deel verbergen', empty: 'Het huidige deel bevat geen noten.' },
  pl: { show: 'Pokaż przypisy do bieżącej części', hide: 'Ukryj przypisy do bieżącej części', empty: 'Bieżąca część nie zawiera przypisów.' },
  pt: { show: 'Mostrar as notas da parte atual', hide: 'Ocultar as notas da parte atual', empty: 'A parte atual não contém notas.' },
  ro: { show: 'Afișează notele părții curente', hide: 'Ascunde notele părții curente', empty: 'Partea curentă nu conține note.' },
  sk: { show: 'Zobraziť poznámky k aktuálnej časti', hide: 'Skryť poznámky k aktuálnej časti', empty: 'Aktuálna časť nemá žiadne poznámky.' },
  sl: { show: 'Prikaži opombe za trenutni del', hide: 'Skrij opombe za trenutni del', empty: 'Trenutni del nima opomb.' },
  sv: { show: 'Visa noter för den aktuella delen', hide: 'Dölj noter för den aktuella delen', empty: 'Den aktuella delen har inga noter.' },
};

export function getCurrentStudyNotesCopy(locale: string): CurrentStudyNotesCopy {
  return currentStudyNotesTranslations[locale as StudioUiLocale]
    ?? currentStudyNotesTranslations.en;
}
