export interface AccountPanelCopy {
  title: string;
  subtitle: string;
  personal: string;
  institutional: string;
  central: string;
  personalDescription: string;
  name: string;
  orcid: string;
  bio: string;
  preferences: string;
  timezone: string;
  timezoneHint: string;
  identity: string;
  verified: string;
  unverified: string;
  save: string;
  saved: string;
  logout: string;
}

export const accountPanelTranslations: Record<string, AccountPanelCopy> = {
  bg: {
    title: 'Профил', subtitle: 'Лична идентичност, институционални роли и начини за вход', personal: 'Личен профил', institutional: 'Институционални профили', central: 'Централна администрация',
    personalDescription: 'Вашата устойчива научна идентичност. Принадлежностите към конкретни организации се управляват отделно.', name: 'Пълно име', orcid: 'ORCID iD', bio: 'Кратка биография', preferences: 'Лични настройки', timezone: 'Часова зона',
    timezoneHint: 'Стандартен IANA идентификатор за часова зона; текущото UTC отместване е показано за справка.', identity: 'Идентичност на профила', verified: 'Потвърден имейл', unverified: 'Имейлът не е потвърден', save: 'Запазване на личния профил', saved: 'Личният профил е запазен.', logout: 'Изход',
  },
  cs: {
    title: 'Účet', subtitle: 'Osobní identita, institucionální role a způsoby přihlášení', personal: 'Osobní profil', institutional: 'Institucionální profily', central: 'Centrální správa',
    personalDescription: 'Vaše trvalá odborná identita. Příslušnosti ke konkrétním organizacím se spravují samostatně.', name: 'Celé jméno', orcid: 'ORCID iD', bio: 'Krátký životopis', preferences: 'Osobní nastavení', timezone: 'Časové pásmo',
    timezoneHint: 'Standardní identifikátor časového pásma IANA; aktuální posun UTC je uveden pro orientaci.', identity: 'Identita účtu', verified: 'Ověřený e-mail', unverified: 'E-mail není ověřen', save: 'Uložit osobní profil', saved: 'Osobní profil byl uložen.', logout: 'Odhlásit se',
  },
  da: {
    title: 'Konto', subtitle: 'Personlig identitet, institutionelle roller og loginmetoder', personal: 'Personlig profil', institutional: 'Institutionelle profiler', central: 'Central administration',
    personalDescription: 'Din varige akademiske identitet. Organisationsspecifikke tilknytninger administreres separat.', name: 'Fulde navn', orcid: 'ORCID iD', bio: 'Kort biografi', preferences: 'Personlige indstillinger', timezone: 'Tidszone',
    timezoneHint: 'Standard IANA-tidszone-id; den aktuelle UTC-forskydning vises som reference.', identity: 'Kontoidentitet', verified: 'Bekræftet e-mail', unverified: 'E-mail ikke bekræftet', save: 'Gem personlig profil', saved: 'Den personlige profil er gemt.', logout: 'Log ud',
  },
  de: {
    title: 'Konto', subtitle: 'Persönliche Identität, institutionelle Rollen und Anmeldemethoden', personal: 'Persönliches Profil', institutional: 'Institutionelle Profile', central: 'Zentrale Administration',
    personalDescription: 'Ihre dauerhafte wissenschaftliche Identität. Organisationsbezogene Zugehörigkeiten werden separat verwaltet.', name: 'Vollständiger Name', orcid: 'ORCID iD', bio: 'Kurzbiografie', preferences: 'Persönliche Einstellungen', timezone: 'Zeitzone',
    timezoneHint: 'Standardisierte IANA-Zeitzone; der aktuelle UTC-Versatz wird zur Orientierung angezeigt.', identity: 'Kontoidentität', verified: 'Bestätigte E-Mail-Adresse', unverified: 'E-Mail-Adresse nicht bestätigt', save: 'Persönliches Profil speichern', saved: 'Persönliches Profil gespeichert.', logout: 'Abmelden',
  },
  el: {
    title: 'Λογαριασμός', subtitle: 'Προσωπική ταυτότητα, ιδρυματικοί ρόλοι και τρόποι σύνδεσης', personal: 'Προσωπικό προφίλ', institutional: 'Ιδρυματικά προφίλ', central: 'Κεντρική διαχείριση',
    personalDescription: 'Η διαχρονική επιστημονική σας ταυτότητα. Οι συνδέσεις με συγκεκριμένους οργανισμούς διαχειρίζονται χωριστά.', name: 'Ονοματεπώνυμο', orcid: 'ORCID iD', bio: 'Σύντομο βιογραφικό', preferences: 'Προσωπικές προτιμήσεις', timezone: 'Ζώνη ώρας',
    timezoneHint: 'Τυπικό αναγνωριστικό ζώνης ώρας IANA· η τρέχουσα απόκλιση UTC εμφανίζεται για αναφορά.', identity: 'Ταυτότητα λογαριασμού', verified: 'Επαληθευμένο e-mail', unverified: 'Το e-mail δεν έχει επαληθευτεί', save: 'Αποθήκευση προσωπικού προφίλ', saved: 'Το προσωπικό προφίλ αποθηκεύτηκε.', logout: 'Αποσύνδεση',
  },
  en: {
    title: 'Account', subtitle: 'Personal identity, institutional roles and sign-in methods', personal: 'Personal profile', institutional: 'Institutional profiles', central: 'Central administration',
    personalDescription: 'Your durable scholarly identity. Organization-specific affiliations are managed separately.', name: 'Full name', orcid: 'ORCID iD', bio: 'Short biography', preferences: 'Personal preferences', timezone: 'Time zone',
    timezoneHint: 'Standard IANA time-zone identifier; the current UTC offset is shown for reference.', identity: 'Account identity', verified: 'Verified e-mail', unverified: 'E-mail not verified', save: 'Save personal profile', saved: 'Personal profile saved.', logout: 'Sign out',
  },
  es: {
    title: 'Cuenta', subtitle: 'Identidad personal, funciones institucionales y métodos de inicio de sesión', personal: 'Perfil personal', institutional: 'Perfiles institucionales', central: 'Administración central',
    personalDescription: 'Su identidad académica duradera. Las afiliaciones específicas de cada organización se gestionan por separado.', name: 'Nombre completo', orcid: 'ORCID iD', bio: 'Breve biografía', preferences: 'Preferencias personales', timezone: 'Zona horaria',
    timezoneHint: 'Identificador estándar de zona horaria IANA; se muestra el desfase UTC actual como referencia.', identity: 'Identidad de la cuenta', verified: 'Correo verificado', unverified: 'Correo no verificado', save: 'Guardar perfil personal', saved: 'Perfil personal guardado.', logout: 'Cerrar sesión',
  },
  et: {
    title: 'Konto', subtitle: 'Isiklik identiteet, asutuse rollid ja sisselogimisviisid', personal: 'Isiklik profiil', institutional: 'Asutuse profiilid', central: 'Keskhaldus',
    personalDescription: 'Teie püsiv teadusidentiteet. Organisatsioonipõhiseid seoseid hallatakse eraldi.', name: 'Täisnimi', orcid: 'ORCID iD', bio: 'Lühike elulugu', preferences: 'Isiklikud eelistused', timezone: 'Ajavöönd',
    timezoneHint: 'Standardne IANA ajavööndi tunnus; praegune UTC nihe on näidatud viiteks.', identity: 'Konto identiteet', verified: 'Kinnitatud e-post', unverified: 'E-post ei ole kinnitatud', save: 'Salvesta isiklik profiil', saved: 'Isiklik profiil on salvestatud.', logout: 'Logi välja',
  },
  fi: {
    title: 'Tili', subtitle: 'Henkilökohtainen identiteetti, organisaatioroolit ja kirjautumistavat', personal: 'Henkilökohtainen profiili', institutional: 'Organisaatioprofiilit', central: 'Keskushallinta',
    personalDescription: 'Pysyvä tieteellinen identiteettisi. Organisaatiokohtaisia sidoksia hallitaan erikseen.', name: 'Koko nimi', orcid: 'ORCID iD', bio: 'Lyhyt elämäkerta', preferences: 'Henkilökohtaiset asetukset', timezone: 'Aikavyöhyke',
    timezoneHint: 'IANA-standardin mukainen aikavyöhyketunnus; nykyinen UTC-siirtymä näytetään viitteeksi.', identity: 'Tilin identiteetti', verified: 'Vahvistettu sähköposti', unverified: 'Sähköpostia ei ole vahvistettu', save: 'Tallenna henkilökohtainen profiili', saved: 'Henkilökohtainen profiili tallennettu.', logout: 'Kirjaudu ulos',
  },
  fr: {
    title: 'Compte', subtitle: 'Identité personnelle, rôles institutionnels et méthodes de connexion', personal: 'Profil personnel', institutional: 'Profils institutionnels', central: 'Administration centrale',
    personalDescription: 'Votre identité scientifique durable. Les affiliations propres à chaque organisation sont gérées séparément.', name: 'Nom complet', orcid: 'ORCID iD', bio: 'Courte biographie', preferences: 'Préférences personnelles', timezone: 'Fuseau horaire',
    timezoneHint: 'Identifiant de fuseau horaire IANA standard ; le décalage UTC actuel est affiché à titre indicatif.', identity: 'Identité du compte', verified: 'E-mail vérifié', unverified: 'E-mail non vérifié', save: 'Enregistrer le profil personnel', saved: 'Profil personnel enregistré.', logout: 'Se déconnecter',
  },
  ga: {
    title: 'Cuntas', subtitle: 'Aitheantas pearsanta, róil institiúideacha agus modhanna sínithe isteach', personal: 'Próifíl phearsanta', institutional: 'Próifílí institiúideacha', central: 'Riarachán lárnach',
    personalDescription: 'D’aitheantas scolártha buan. Déantar cleamhnachtaí a bhaineann le heagraíochtaí ar leith a bhainistiú ar leithligh.', name: 'Ainm iomlán', orcid: 'ORCID iD', bio: 'Beathaisnéis ghearr', preferences: 'Sainroghanna pearsanta', timezone: 'Crios ama',
    timezoneHint: 'Aitheantóir caighdeánach crios ama IANA; taispeántar an fritháireamh UTC reatha mar thagairt.', identity: 'Aitheantas an chuntais', verified: 'Ríomhphost fíoraithe', unverified: 'Ríomhphost gan fíorú', save: 'Sábháil an phróifíl phearsanta', saved: 'Sábháladh an phróifíl phearsanta.', logout: 'Sínigh amach',
  },
  hr: {
    title: 'Račun', subtitle: 'Osobni identitet, institucijske uloge i načini prijave', personal: 'Osobni profil', institutional: 'Institucijski profili', central: 'Središnja administracija',
    personalDescription: 'Vaš trajni znanstveni identitet. Pripadnosti pojedinim organizacijama upravljaju se odvojeno.', name: 'Puno ime', orcid: 'ORCID iD', bio: 'Kratka biografija', preferences: 'Osobne postavke', timezone: 'Vremenska zona',
    timezoneHint: 'Standardni IANA identifikator vremenske zone; trenutačni UTC pomak prikazan je radi orijentacije.', identity: 'Identitet računa', verified: 'Potvrđena e-pošta', unverified: 'E-pošta nije potvrđena', save: 'Spremi osobni profil', saved: 'Osobni profil je spremljen.', logout: 'Odjava',
  },
  hu: {
    title: 'Fiók', subtitle: 'Személyes identitás, intézményi szerepek és bejelentkezési módok', personal: 'Személyes profil', institutional: 'Intézményi profilok', central: 'Központi adminisztráció',
    personalDescription: 'A tartós személyes tudományos identitásod. Az intézményi affiliációk külön kezelhetők.', name: 'Teljes név', orcid: 'ORCID iD', bio: 'Rövid bemutatkozás', preferences: 'Személyes beállítások', timezone: 'Időzóna',
    timezoneHint: 'Szabványos IANA-időzóna; tájékoztatásként az aktuális UTC-eltolás is látható.', identity: 'Fiókazonosság', verified: 'Ellenőrzött e-mail-cím', unverified: 'Nem ellenőrzött e-mail-cím', save: 'Személyes profil mentése', saved: 'A személyes profil elmentve.', logout: 'Kijelentkezés',
  },
  it: {
    title: 'Account', subtitle: 'Identità personale, ruoli istituzionali e metodi di accesso', personal: 'Profilo personale', institutional: 'Profili istituzionali', central: 'Amministrazione centrale',
    personalDescription: 'La tua identità accademica duratura. Le affiliazioni specifiche delle organizzazioni sono gestite separatamente.', name: 'Nome completo', orcid: 'ORCID iD', bio: 'Breve biografia', preferences: 'Preferenze personali', timezone: 'Fuso orario',
    timezoneHint: 'Identificatore standard IANA del fuso orario; l’attuale scostamento UTC è mostrato come riferimento.', identity: 'Identità dell’account', verified: 'E-mail verificata', unverified: 'E-mail non verificata', save: 'Salva profilo personale', saved: 'Profilo personale salvato.', logout: 'Esci',
  },
  lt: {
    title: 'Paskyra', subtitle: 'Asmeninė tapatybė, instituciniai vaidmenys ir prisijungimo būdai', personal: 'Asmeninis profilis', institutional: 'Instituciniai profiliai', central: 'Centrinis administravimas',
    personalDescription: 'Jūsų ilgalaikė mokslinė tapatybė. Su konkrečiomis organizacijomis susijusios afiliacijos tvarkomos atskirai.', name: 'Vardas ir pavardė', orcid: 'ORCID iD', bio: 'Trumpa biografija', preferences: 'Asmeniniai nustatymai', timezone: 'Laiko juosta',
    timezoneHint: 'Standartinis IANA laiko juostos identifikatorius; dabartinis UTC poslinkis rodomas informacijai.', identity: 'Paskyros tapatybė', verified: 'Patvirtintas el. paštas', unverified: 'El. paštas nepatvirtintas', save: 'Išsaugoti asmeninį profilį', saved: 'Asmeninis profilis išsaugotas.', logout: 'Atsijungti',
  },
  lv: {
    title: 'Konts', subtitle: 'Personiskā identitāte, institucionālās lomas un pierakstīšanās veidi', personal: 'Personiskais profils', institutional: 'Institucionālie profili', central: 'Centrālā administrēšana',
    personalDescription: 'Jūsu pastāvīgā akadēmiskā identitāte. Konkrētu organizāciju piederības tiek pārvaldītas atsevišķi.', name: 'Pilns vārds', orcid: 'ORCID iD', bio: 'Īsa biogrāfija', preferences: 'Personiskie iestatījumi', timezone: 'Laika josla',
    timezoneHint: 'Standarta IANA laika joslas identifikators; pašreizējā UTC nobīde parādīta uzziņai.', identity: 'Konta identitāte', verified: 'Apstiprināts e-pasts', unverified: 'E-pasts nav apstiprināts', save: 'Saglabāt personisko profilu', saved: 'Personiskais profils saglabāts.', logout: 'Izrakstīties',
  },
  mt: {
    title: 'Kont', subtitle: 'Identità personali, rwoli istituzzjonali u metodi ta’ dħul', personal: 'Profil personali', institutional: 'Profili istituzzjonali', central: 'Amministrazzjoni ċentrali',
    personalDescription: 'L-identità akkademika dejjiema tiegħek. Affiljazzjonijiet ma’ organizzazzjonijiet speċifiċi jiġu ġestiti separatament.', name: 'Isem sħiħ', orcid: 'ORCID iD', bio: 'Bijografija qasira', preferences: 'Preferenzi personali', timezone: 'Żona tal-ħin',
    timezoneHint: 'Identifikatur standard IANA taż-żona tal-ħin; id-differenza UTC kurrenti tidher bħala referenza.', identity: 'Identità tal-kont', verified: 'E-mail ivverifikata', unverified: 'E-mail mhux ivverifikata', save: 'Issejvja l-profil personali', saved: 'Il-profil personali ġie ssejvjat.', logout: 'Oħroġ',
  },
  nl: {
    title: 'Account', subtitle: 'Persoonlijke identiteit, institutionele rollen en aanmeldmethoden', personal: 'Persoonlijk profiel', institutional: 'Institutionele profielen', central: 'Centrale administratie',
    personalDescription: 'Je duurzame wetenschappelijke identiteit. Organisatiespecifieke affiliaties worden afzonderlijk beheerd.', name: 'Volledige naam', orcid: 'ORCID iD', bio: 'Korte biografie', preferences: 'Persoonlijke voorkeuren', timezone: 'Tijdzone',
    timezoneHint: 'Standaard IANA-tijdzone-id; de huidige UTC-afwijking wordt ter referentie weergegeven.', identity: 'Accountidentiteit', verified: 'Geverifieerd e-mailadres', unverified: 'E-mailadres niet geverifieerd', save: 'Persoonlijk profiel opslaan', saved: 'Persoonlijk profiel opgeslagen.', logout: 'Afmelden',
  },
  pl: {
    title: 'Konto', subtitle: 'Tożsamość osobista, role instytucjonalne i metody logowania', personal: 'Profil osobisty', institutional: 'Profile instytucjonalne', central: 'Administracja centralna',
    personalDescription: 'Twoja trwała tożsamość naukowa. Afiliacje związane z konkretnymi organizacjami są zarządzane oddzielnie.', name: 'Imię i nazwisko', orcid: 'ORCID iD', bio: 'Krótki biogram', preferences: 'Ustawienia osobiste', timezone: 'Strefa czasowa',
    timezoneHint: 'Standardowy identyfikator strefy czasowej IANA; bieżące przesunięcie UTC jest pokazane informacyjnie.', identity: 'Tożsamość konta', verified: 'Zweryfikowany e-mail', unverified: 'E-mail niezweryfikowany', save: 'Zapisz profil osobisty', saved: 'Profil osobisty zapisany.', logout: 'Wyloguj się',
  },
  pt: {
    title: 'Conta', subtitle: 'Identidade pessoal, funções institucionais e métodos de início de sessão', personal: 'Perfil pessoal', institutional: 'Perfis institucionais', central: 'Administração central',
    personalDescription: 'A sua identidade académica duradoura. As afiliações específicas de cada organização são geridas separadamente.', name: 'Nome completo', orcid: 'ORCID iD', bio: 'Breve biografia', preferences: 'Preferências pessoais', timezone: 'Fuso horário',
    timezoneHint: 'Identificador padrão de fuso horário IANA; o desvio UTC atual é mostrado como referência.', identity: 'Identidade da conta', verified: 'E-mail verificado', unverified: 'E-mail não verificado', save: 'Guardar perfil pessoal', saved: 'Perfil pessoal guardado.', logout: 'Terminar sessão',
  },
  ro: {
    title: 'Cont', subtitle: 'Identitate personală, roluri instituționale și metode de autentificare', personal: 'Profil personal', institutional: 'Profiluri instituționale', central: 'Administrare centrală',
    personalDescription: 'Identitatea dvs. academică durabilă. Afilierile specifice organizațiilor sunt gestionate separat.', name: 'Nume complet', orcid: 'ORCID iD', bio: 'Biografie scurtă', preferences: 'Preferințe personale', timezone: 'Fus orar',
    timezoneHint: 'Identificator standard IANA pentru fusul orar; decalajul UTC curent este afișat pentru referință.', identity: 'Identitatea contului', verified: 'E-mail verificat', unverified: 'E-mail neverificat', save: 'Salvează profilul personal', saved: 'Profilul personal a fost salvat.', logout: 'Deconectare',
  },
  sk: {
    title: 'Účet', subtitle: 'Osobná identita, inštitucionálne roly a spôsoby prihlásenia', personal: 'Osobný profil', institutional: 'Inštitucionálne profily', central: 'Centrálna správa',
    personalDescription: 'Vaša trvalá vedecká identita. Príslušnosti ku konkrétnym organizáciám sa spravujú samostatne.', name: 'Celé meno', orcid: 'ORCID iD', bio: 'Krátky životopis', preferences: 'Osobné nastavenia', timezone: 'Časové pásmo',
    timezoneHint: 'Štandardný identifikátor časového pásma IANA; aktuálny posun UTC sa zobrazuje pre orientáciu.', identity: 'Identita účtu', verified: 'Overený e-mail', unverified: 'E-mail nie je overený', save: 'Uložiť osobný profil', saved: 'Osobný profil bol uložený.', logout: 'Odhlásiť sa',
  },
  sl: {
    title: 'Račun', subtitle: 'Osebna identiteta, institucionalne vloge in načini prijave', personal: 'Osebni profil', institutional: 'Institucionalni profili', central: 'Centralno upravljanje',
    personalDescription: 'Vaša trajna znanstvena identiteta. Povezave s posameznimi organizacijami se upravljajo ločeno.', name: 'Polno ime', orcid: 'ORCID iD', bio: 'Kratek življenjepis', preferences: 'Osebne nastavitve', timezone: 'Časovni pas',
    timezoneHint: 'Standardni identifikator časovnega pasu IANA; trenutni odmik UTC je prikazan za orientacijo.', identity: 'Identiteta računa', verified: 'Potrjen e-poštni naslov', unverified: 'E-poštni naslov ni potrjen', save: 'Shrani osebni profil', saved: 'Osebni profil je shranjen.', logout: 'Odjava',
  },
  sv: {
    title: 'Konto', subtitle: 'Personlig identitet, institutionella roller och inloggningsmetoder', personal: 'Personlig profil', institutional: 'Institutionella profiler', central: 'Central administration',
    personalDescription: 'Din varaktiga akademiska identitet. Organisationsspecifika tillhörigheter hanteras separat.', name: 'Fullständigt namn', orcid: 'ORCID iD', bio: 'Kort biografi', preferences: 'Personliga inställningar', timezone: 'Tidszon',
    timezoneHint: 'Standardiserat IANA-id för tidszon; aktuell UTC-förskjutning visas som referens.', identity: 'Kontoidentitet', verified: 'Verifierad e-post', unverified: 'E-post inte verifierad', save: 'Spara personlig profil', saved: 'Personlig profil sparad.', logout: 'Logga ut',
  },
};

export function getAccountPanelCopy(locale: string): AccountPanelCopy {
  return accountPanelTranslations[locale] ?? accountPanelTranslations.en;
}
