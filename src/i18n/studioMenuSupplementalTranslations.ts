import { applyReturnedSupplementalOverlay } from './returnedTranslationOverlay';
export interface StudioMenuSupplementalCopy {
  home: string;
  assignments: string;
  editorialWorkspace: string;
  publicationEditor: string;
  signatures: string;
  manuscriptGroup: string;
  editorialGroup: string;
  publicationGroup: string;
  toolsGroup: string;
  preferencesGroup: string;
  tools: string;
}

type StudioUiLocale =
  | 'bg'
  | 'cs'
  | 'da'
  | 'de'
  | 'el'
  | 'en'
  | 'es'
  | 'et'
  | 'fi'
  | 'fr'
  | 'ga'
  | 'hr'
  | 'hu'
  | 'it'
  | 'lt'
  | 'lv'
  | 'mt'
  | 'nl'
  | 'pl'
  | 'pt'
  | 'ro'
  | 'sk'
  | 'sl'
  | 'sv';

const studioMenuSupplementalTranslations: Record<StudioUiLocale, StudioMenuSupplementalCopy> = {
  bg: { home: 'Начало', assignments: 'Задания', editorialWorkspace: 'Редакционен работен процес', publicationEditor: 'Редактор на публикации', signatures: 'Подписи', manuscriptGroup: 'Ръкопис', editorialGroup: 'Редакционна работа', publicationGroup: 'Публикуване', toolsGroup: 'Инструменти и интеграции', preferencesGroup: 'Настройки и помощ', tools: 'Инструменти' },
  cs: { home: 'Domů', assignments: 'Úkoly', editorialWorkspace: 'Redakční pracovní postup', publicationEditor: 'Editor publikace', signatures: 'Podpisy', manuscriptGroup: 'Rukopis', editorialGroup: 'Redakční práce', publicationGroup: 'Publikování', toolsGroup: 'Nástroje a integrace', preferencesGroup: 'Nastavení a nápověda', tools: 'Nástroje' },
  da: { home: 'Hjem', assignments: 'Opgaver', editorialWorkspace: 'Redaktionelt workflow', publicationEditor: 'Publikationseditor', signatures: 'Signaturer', manuscriptGroup: 'Manuskript', editorialGroup: 'Redaktionelt arbejde', publicationGroup: 'Udgivelse', toolsGroup: 'Værktøjer og integrationer', preferencesGroup: 'Indstillinger og hjælp', tools: 'Værktøjer' },
  de: { home: 'Startseite', assignments: 'Aufträge', editorialWorkspace: 'Redaktionsbereich', publicationEditor: 'Publikationseditor', signatures: 'Signaturen', manuscriptGroup: 'Manuskript', editorialGroup: 'Redaktion', publicationGroup: 'Publikation', toolsGroup: 'Werkzeuge und Integrationen', preferencesGroup: 'Einstellungen und Hilfe', tools: 'Werkzeuge' },
  el: { home: 'Αρχική', assignments: 'Αναθέσεις', editorialWorkspace: 'Ροή εργασίας σύνταξης', publicationEditor: 'Επεξεργαστής δημοσίευσης', signatures: 'Υπογραφές', manuscriptGroup: 'Χειρόγραφο', editorialGroup: 'Σύνταξη', publicationGroup: 'Δημοσίευση', toolsGroup: 'Εργαλεία και διασυνδέσεις', preferencesGroup: 'Ρυθμίσεις και βοήθεια', tools: 'Εργαλεία' },
  en: { home: 'Home', assignments: 'Assignments', editorialWorkspace: 'Editorial workflow', publicationEditor: 'Publication editor', signatures: 'Signatures', manuscriptGroup: 'Manuscript', editorialGroup: 'Editorial work', publicationGroup: 'Publishing', toolsGroup: 'Tools and integrations', preferencesGroup: 'Settings and help', tools: 'Tools' },
  es: { home: 'Inicio', assignments: 'Asignaciones', editorialWorkspace: 'Flujo editorial', publicationEditor: 'Editor de publicaciones', signatures: 'Firmas', manuscriptGroup: 'Manuscrito', editorialGroup: 'Trabajo editorial', publicationGroup: 'Publicación', toolsGroup: 'Herramientas e integraciones', preferencesGroup: 'Ajustes y ayuda', tools: 'Herramientas' },
  et: { home: 'Avaleht', assignments: 'Ülesanded', editorialWorkspace: 'Toimetusvoog', publicationEditor: 'Väljaande redaktor', signatures: 'Allkirjad', manuscriptGroup: 'Käsikiri', editorialGroup: 'Toimetajatöö', publicationGroup: 'Avaldamine', toolsGroup: 'Tööriistad ja integratsioonid', preferencesGroup: 'Seaded ja abi', tools: 'Tööriistad' },
  fi: { home: 'Etusivu', assignments: 'Tehtävät', editorialWorkspace: 'Toimituksellinen työnkulku', publicationEditor: 'Julkaisueditori', signatures: 'Allekirjoitukset', manuscriptGroup: 'Käsikirjoitus', editorialGroup: 'Toimitustyö', publicationGroup: 'Julkaiseminen', toolsGroup: 'Työkalut ja integraatiot', preferencesGroup: 'Asetukset ja ohje', tools: 'Työkalut' },
  fr: { home: 'Accueil', assignments: 'Attributions', editorialWorkspace: 'Flux éditorial', publicationEditor: 'Éditeur de publication', signatures: 'Signatures', manuscriptGroup: 'Manuscrit', editorialGroup: 'Travail éditorial', publicationGroup: 'Publication', toolsGroup: 'Outils et intégrations', preferencesGroup: 'Paramètres et aide', tools: 'Outils' },
  ga: { home: 'Baile', assignments: 'Sannacháin', editorialWorkspace: 'Sreabhadh oibre eagarthóireachta', publicationEditor: 'Eagarthóir foilseacháin', signatures: 'Sínithe', manuscriptGroup: 'Lámhscríbhinn', editorialGroup: 'Obair eagarthóireachta', publicationGroup: 'Foilsiú', toolsGroup: 'Uirlisí agus comhtháthaithe', preferencesGroup: 'Socruithe agus cabhair', tools: 'Uirlisí' },
  hr: { home: 'Početna', assignments: 'Zaduženja', editorialWorkspace: 'Urednički tijek rada', publicationEditor: 'Uređivač publikacije', signatures: 'Potpisi', manuscriptGroup: 'Rukopis', editorialGroup: 'Urednički rad', publicationGroup: 'Objava', toolsGroup: 'Alati i integracije', preferencesGroup: 'Postavke i pomoć', tools: 'Alati' },
  hu: { home: 'Főoldal', assignments: 'Megbízások', editorialWorkspace: 'Szerkesztőségi munkatér', publicationEditor: 'Kiadványszerkesztő', signatures: 'Aláírások', manuscriptGroup: 'Kézirat', editorialGroup: 'Szerkesztőségi munka', publicationGroup: 'Publikálás', toolsGroup: 'Eszközök és integrációk', preferencesGroup: 'Beállítások és súgó', tools: 'Eszközök' },
  it: { home: 'Pagina iniziale', assignments: 'Incarichi', editorialWorkspace: 'Flusso editoriale', publicationEditor: 'Editor di pubblicazione', signatures: 'Firme', manuscriptGroup: 'Manoscritto', editorialGroup: 'Lavoro editoriale', publicationGroup: 'Pubblicazione', toolsGroup: 'Strumenti e integrazioni', preferencesGroup: 'Impostazioni e guida', tools: 'Strumenti' },
  lt: { home: 'Pradžia', assignments: 'Užduotys', editorialWorkspace: 'Redakcinė darbo eiga', publicationEditor: 'Leidinio redaktorius', signatures: 'Parašai', manuscriptGroup: 'Rankraštis', editorialGroup: 'Redakcinis darbas', publicationGroup: 'Publikavimas', toolsGroup: 'Įrankiai ir integracijos', preferencesGroup: 'Nustatymai ir pagalba', tools: 'Įrankiai' },
  lv: { home: 'Sākums', assignments: 'Uzdevumi', editorialWorkspace: 'Redakcijas darbplūsma', publicationEditor: 'Publikācijas redaktors', signatures: 'Paraksti', manuscriptGroup: 'Manuskripts', editorialGroup: 'Redakcionālais darbs', publicationGroup: 'Publicēšana', toolsGroup: 'Rīki un integrācijas', preferencesGroup: 'Iestatījumi un palīdzība', tools: 'Rīki' },
  mt: { home: 'Paġna ewlenija', assignments: 'Assenjazzjonijiet', editorialWorkspace: 'Fluss tax-xogħol editorjali', publicationEditor: 'Editur tal-pubblikazzjoni', signatures: 'Firem', manuscriptGroup: 'Manuskritt', editorialGroup: 'Xogħol editorjali', publicationGroup: 'Pubblikazzjoni', toolsGroup: 'Għodod u integrazzjonijiet', preferencesGroup: 'Settings u għajnuna', tools: 'Għodod' },
  nl: { home: 'Start', assignments: 'Toewijzingen', editorialWorkspace: 'Redactionele workflow', publicationEditor: 'Publicatie-editor', signatures: 'Handtekeningen', manuscriptGroup: 'Manuscript', editorialGroup: 'Redactioneel werk', publicationGroup: 'Publicatie', toolsGroup: 'Hulpmiddelen en integraties', preferencesGroup: 'Instellingen en hulp', tools: 'Hulpmiddelen' },
  pl: { home: 'Strona główna', assignments: 'Przydziały', editorialWorkspace: 'Przepływ redakcyjny', publicationEditor: 'Edytor publikacji', signatures: 'Podpisy', manuscriptGroup: 'Manuskrypt', editorialGroup: 'Praca redakcyjna', publicationGroup: 'Publikowanie', toolsGroup: 'Narzędzia i integracje', preferencesGroup: 'Ustawienia i pomoc', tools: 'Narzędzia' },
  pt: { home: 'Início', assignments: 'Atribuições', editorialWorkspace: 'Fluxo editorial', publicationEditor: 'Editor de publicação', signatures: 'Assinaturas', manuscriptGroup: 'Manuscrito', editorialGroup: 'Trabalho editorial', publicationGroup: 'Publicação', toolsGroup: 'Ferramentas e integrações', preferencesGroup: 'Definições e ajuda', tools: 'Ferramentas' },
  ro: { home: 'Acasă', assignments: 'Sarcini', editorialWorkspace: 'Flux editorial', publicationEditor: 'Editor de publicație', signatures: 'Semnături', manuscriptGroup: 'Manuscris', editorialGroup: 'Activitate editorială', publicationGroup: 'Publicare', toolsGroup: 'Instrumente și integrări', preferencesGroup: 'Setări și ajutor', tools: 'Instrumente' },
  sk: { home: 'Domov', assignments: 'Priradenia', editorialWorkspace: 'Redakčný pracovný postup', publicationEditor: 'Editor publikácie', signatures: 'Podpisy', manuscriptGroup: 'Rukopis', editorialGroup: 'Redakčná práca', publicationGroup: 'Publikovanie', toolsGroup: 'Nástroje a integrácie', preferencesGroup: 'Nastavenia a pomoc', tools: 'Nástroje' },
  sl: { home: 'Domov', assignments: 'Dodelitve', editorialWorkspace: 'Uredniški potek dela', publicationEditor: 'Urejevalnik publikacije', signatures: 'Podpisi', manuscriptGroup: 'Rokopis', editorialGroup: 'Uredniško delo', publicationGroup: 'Objavljanje', toolsGroup: 'Orodja in integracije', preferencesGroup: 'Nastavitve in pomoč', tools: 'Orodja' },
  sv: { home: 'Hem', assignments: 'Uppdrag', editorialWorkspace: 'Redaktionellt arbetsflöde', publicationEditor: 'Publikationsredigerare', signatures: 'Signaturer', manuscriptGroup: 'Manuskript', editorialGroup: 'Redaktionellt arbete', publicationGroup: 'Publicering', toolsGroup: 'Verktyg och integrationer', preferencesGroup: 'Inställningar och hjälp', tools: 'Verktyg' },
};

export function getStudioMenuSupplementalCopy(
  locale: string,
): StudioMenuSupplementalCopy {
  const current =
    studioMenuSupplementalTranslations[locale as StudioUiLocale]
    ?? studioMenuSupplementalTranslations.en;
  return applyReturnedSupplementalOverlay(
    locale,
    'studioMenu',
    current,
    studioMenuSupplementalTranslations.en,
  );
}
