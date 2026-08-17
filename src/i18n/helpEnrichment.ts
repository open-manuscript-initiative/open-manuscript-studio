import type { HelpCopy } from './help';

/**
 * Adds a fully localized practical guidance layer to compact help copies and
 * appends the current author-signature workflow where an older detailed copy
 * predates that feature.
 */
const practicalGuidance: Record<string, { label: string; suffix: string }> = {
  bg: { label: 'Практически съвет', suffix: 'Проверете настройките и резултата преди окончателния експорт.' },
  cs: { label: 'Praktický tip', suffix: 'Před konečným exportem zkontrolujte nastavení a výsledný výstup.' },
  da: { label: 'Praktisk tip', suffix: 'Kontrollér indstillingerne og resultatet før den endelige eksport.' },
  de: { label: 'Praktischer Hinweis', suffix: 'Prüfen Sie Einstellungen und Ergebnis vor dem endgültigen Export.' },
  el: { label: 'Πρακτική συμβουλή', suffix: 'Ελέγξτε τις ρυθμίσεις και το αποτέλεσμα πριν από την τελική εξαγωγή.' },
  en: { label: 'Practical tip', suffix: 'Check the settings and result before the final export.' },
  es: { label: 'Consejo práctico', suffix: 'Compruebe la configuración y el resultado antes de la exportación definitiva.' },
  et: { label: 'Praktiline soovitus', suffix: 'Kontrollige seadeid ja tulemust enne lõplikku eksporti.' },
  fi: { label: 'Käytännön vinkki', suffix: 'Tarkista asetukset ja lopputulos ennen lopullista vientiä.' },
  fr: { label: 'Conseil pratique', suffix: 'Vérifiez les réglages et le résultat avant l’exportation définitive.' },
  ga: { label: 'Leid phraiticiúil', suffix: 'Seiceáil na socruithe agus an toradh roimh an easpórtáil deiridh.' },
  hr: { label: 'Praktični savjet', suffix: 'Provjerite postavke i rezultat prije konačnog izvoza.' },
  hu: { label: 'Gyakorlati tipp', suffix: 'A végleges export előtt ellenőrizze a beállításokat és az eredményt.' },
  lt: { label: 'Praktinis patarimas', suffix: 'Prieš galutinį eksportą patikrinkite nustatymus ir rezultatą.' },
  lv: { label: 'Praktisks padoms', suffix: 'Pirms galīgā eksporta pārbaudiet iestatījumus un rezultātu.' },
  mt: { label: 'Parir prattiku', suffix: 'Iċċekkja s-settings u r-riżultat qabel l-esportazzjoni finali.' },
  nl: { label: 'Praktische tip', suffix: 'Controleer de instellingen en het resultaat vóór de definitieve export.' },
  pl: { label: 'Praktyczna wskazówka', suffix: 'Przed końcowym eksportem sprawdź ustawienia i wynik.' },
  pt: { label: 'Sugestão prática', suffix: 'Verifique as definições e o resultado antes da exportação final.' },
  ro: { label: 'Sfat practic', suffix: 'Verificați setările și rezultatul înainte de exportul final.' },
  sk: { label: 'Praktický tip', suffix: 'Pred konečným exportom skontrolujte nastavenia a výsledok.' },
  sl: { label: 'Praktični nasvet', suffix: 'Pred končnim izvozom preverite nastavitve in rezultat.' },
  sv: { label: 'Praktiskt tips', suffix: 'Kontrollera inställningarna och resultatet före den slutliga exporten.' },
};

const signatureTopic: Record<string, { title: string; body: string; tips: string[] }> = {
  bg: { title: 'Криптографски подпис на автора', body: 'Регистрираните автори могат да подпишат конкретна ревизия с WebAuthn/passkey, свързан със сигурно удостоверена самоличност, например ORCID. Подписът е обвързан с криптографския digest на ревизията.', tips: ['Ръчно въведен ORCID не е равностоен на удостоверена ORCID самоличност.', 'След промяна на ръкописа новата ревизия трябва да бъде подписана отново.'] },
  cs: { title: 'Kryptografický podpis autora', body: 'Registrovaní autoři mohou podepsat konkrétní revizi pomocí WebAuthn/passkey propojeného s bezpečně ověřenou identitou, například ORCID. Podpis je svázán s kryptografickým digestem revize.', tips: ['Ručně zadané ORCID není totéž jako ověřená identita ORCID.', 'Po změně rukopisu je nutné novou revizi podepsat znovu.'] },
  da: { title: 'Kryptografisk forfattersignatur', body: 'Registrerede forfattere kan signere en bestemt revision med WebAuthn/passkey knyttet til en sikkert verificeret identitet, f.eks. ORCID. Signaturen bindes til revisionens kryptografiske digest.', tips: ['Et manuelt indtastet ORCID er ikke det samme som en autentificeret ORCID-identitet.', 'Efter ændringer skal den nye revision signeres igen.'] },
  de: { title: 'Kryptografische Autorensignatur', body: 'Registrierte Autorinnen und Autoren können eine konkrete Revision mit einer WebAuthn/passkey-Anmeldeinformation signieren, die mit einer sicher verifizierten Identität wie ORCID verbunden ist. Die Signatur ist an den kryptografischen Digest genau dieser Revision gebunden.', tips: ['Eine manuell eingetragene ORCID ist nicht gleichbedeutend mit einer authentifizierten ORCID-Identität.', 'Nach einer Manuskriptänderung muss die neue Revision erneut signiert werden.', 'Bei mehreren Autorinnen und Autoren kann jede Person dieselbe Revision separat signieren.'] },
  el: { title: 'Κρυπτογραφική υπογραφή συγγραφέα', body: 'Οι εγγεγραμμένοι συγγραφείς μπορούν να υπογράψουν συγκεκριμένη αναθεώρηση με WebAuthn/passkey συνδεδεμένο με ασφαλώς επαληθευμένη ταυτότητα, όπως ORCID. Η υπογραφή συνδέεται με το κρυπτογραφικό αποτύπωμα της αναθεώρησης.', tips: ['Ένα ORCID που πληκτρολογήθηκε χειροκίνητα δεν ισοδυναμεί με επαληθευμένη ταυτότητα ORCID.', 'Μετά από αλλαγή του χειρογράφου η νέα αναθεώρηση πρέπει να υπογραφεί ξανά.'] },
  en: { title: 'Cryptographic author signatures', body: 'Registered authors can sign a specific manuscript revision with a WebAuthn/passkey credential linked to a securely verified identity such as ORCID. The signature is bound to the cryptographic digest of that exact revision.', tips: ['A manually entered ORCID is not the same as an authenticated ORCID identity.', 'After manuscript changes, the new revision must be signed again.', 'Each co-author can sign the same revision independently.'] },
  es: { title: 'Firma criptográfica del autor', body: 'Los autores registrados pueden firmar una revisión concreta mediante WebAuthn/passkey vinculado a una identidad verificada de forma segura, como ORCID. La firma queda ligada al resumen criptográfico de la revisión.', tips: ['Un ORCID introducido manualmente no equivale a una identidad ORCID autenticada.', 'Si cambia el manuscrito, la nueva revisión debe firmarse de nuevo.'] },
  et: { title: 'Autori krüptograafiline allkiri', body: 'Registreeritud autor saab konkreetse revisjoni allkirjastada WebAuthn/passkey abil, mis on seotud turvaliselt kinnitatud identiteediga, näiteks ORCID-iga. Allkiri seotakse revisjoni krüptograafilise räsiga.', tips: ['Käsitsi sisestatud ORCID ei võrdu autentitud ORCID-identiteediga.', 'Pärast käsikirja muutmist tuleb uus revisjon uuesti allkirjastada.'] },
  fi: { title: 'Tekijän kryptografinen allekirjoitus', body: 'Rekisteröity tekijä voi allekirjoittaa tietyn version WebAuthn/passkey-tunnisteella, joka on liitetty turvallisesti varmennettuun identiteettiin, kuten ORCIDiin. Allekirjoitus sidotaan version kryptografiseen tiivisteeseen.', tips: ['Käsin syötetty ORCID ei vastaa todennettua ORCID-identiteettiä.', 'Käsikirjoituksen muuttuessa uusi versio on allekirjoitettava uudelleen.'] },
  fr: { title: 'Signature cryptographique de l’auteur', body: 'Un auteur enregistré peut signer une révision précise avec WebAuthn/passkey lié à une identité vérifiée de manière sûre, par exemple ORCID. La signature est liée à l’empreinte cryptographique de la révision.', tips: ['Un ORCID saisi manuellement ne constitue pas une identité ORCID authentifiée.', 'Après modification du manuscrit, la nouvelle révision doit être signée à nouveau.'] },
  ga: { title: 'Síniú cripteagrafach an údair', body: 'Is féidir le húdar cláraithe leasú sonrach a shíniú le WebAuthn/passkey atá ceangailte le haitheantas fíoraithe slán, mar ORCID. Ceanglaítear an síniú le digest cripteagrafach an leasaithe.', tips: ['Ní hionann ORCID a iontráiltear de láimh agus aitheantas ORCID fíordheimhnithe.', 'Tar éis athrú ar an lámhscríbhinn caithfear an leasú nua a shíniú arís.'] },
  hr: { title: 'Kriptografski potpis autora', body: 'Registrirani autor može potpisati određenu reviziju pomoću WebAuthn/passkey vjerodajnice povezane sa sigurno potvrđenim identitetom, primjerice ORCID-om. Potpis je vezan uz kriptografski sažetak revizije.', tips: ['Ručno upisan ORCID nije isto što i autentificirani ORCID identitet.', 'Nakon izmjene rukopisa novu reviziju treba ponovno potpisati.'] },
  hu: { title: 'Kriptográfiai szerzői aláírás', body: 'A regisztrált szerzők egy konkrét kéziratrevíziót WebAuthn/passkey hitelesítő adattal írhatnak alá, amely biztonságosan ellenőrzött személyazonossághoz, például ORCID-hoz kapcsolódik. Az aláírás pontosan az adott revízió kriptográfiai lenyomatához kötődik.', tips: ['A metaadatok közé kézzel beírt ORCID nem azonos a hitelesített ORCID-identitással.', 'A kézirat módosítása után az új revíziót újra alá kell írni.', 'Többszerzős kéziratnál minden szerző külön aláírhatja ugyanazt a revíziót.'] },
  lt: { title: 'Kriptografinis autoriaus parašas', body: 'Registruotas autorius gali pasirašyti konkrečią reviziją naudodamas WebAuthn/passkey, susietą su saugiai patvirtinta tapatybe, pvz., ORCID. Parašas susiejamas su revizijos kriptografine santrauka.', tips: ['Rankiniu būdu įvestas ORCID nėra tas pats, kas autentifikuota ORCID tapatybė.', 'Pakeitus rankraštį naują reviziją reikia pasirašyti iš naujo.'] },
  lv: { title: 'Autora kriptogrāfiskais paraksts', body: 'Reģistrēts autors var parakstīt konkrētu revīziju ar WebAuthn/passkey, kas saistīts ar droši pārbaudītu identitāti, piemēram, ORCID. Paraksts tiek piesaistīts revīzijas kriptogrāfiskajam digestam.', tips: ['Manuāli ievadīts ORCID nav tas pats, kas autentificēta ORCID identitāte.', 'Pēc manuskripta izmaiņām jaunā revīzija jāparaksta atkārtoti.'] },
  mt: { title: 'Firma kriptografika tal-awtur', body: 'Awtur irreġistrat jista’ jiffirma reviżjoni speċifika b’WebAuthn/passkey marbut ma’ identità verifikata b’mod sigur, bħal ORCID. Il-firma tintrabat mad-digest kriptografiku tar-reviżjoni.', tips: ['ORCID imdaħħal manwalment mhuwiex l-istess bħal identità ORCID awtentikata.', 'Wara bidla fil-manuskritt ir-reviżjoni l-ġdida trid tiġi ffirmata mill-ġdid.'] },
  nl: { title: 'Cryptografische auteurs­handtekening', body: 'Een geregistreerde auteur kan een specifieke revisie ondertekenen met WebAuthn/passkey gekoppeld aan een veilig geverifieerde identiteit, zoals ORCID. De handtekening wordt gebonden aan de cryptografische digest van de revisie.', tips: ['Een handmatig ingevoerd ORCID is niet hetzelfde als een geauthenticeerde ORCID-identiteit.', 'Na wijziging van het manuscript moet de nieuwe revisie opnieuw worden ondertekend.'] },
  pl: { title: 'Kryptograficzny podpis autora', body: 'Zarejestrowany autor może podpisać konkretną rewizję za pomocą WebAuthn/passkey powiązanego z bezpiecznie zweryfikowaną tożsamością, np. ORCID. Podpis jest związany z kryptograficznym skrótem rewizji.', tips: ['ORCID wpisany ręcznie nie jest tym samym co uwierzytelniona tożsamość ORCID.', 'Po zmianie manuskryptu nową rewizję należy podpisać ponownie.'] },
  pt: { title: 'Assinatura criptográfica do autor', body: 'Um autor registado pode assinar uma revisão específica com WebAuthn/passkey associado a uma identidade verificada de forma segura, como ORCID. A assinatura fica ligada ao resumo criptográfico da revisão.', tips: ['Um ORCID introduzido manualmente não equivale a uma identidade ORCID autenticada.', 'Após alterar o manuscrito, a nova revisão deve ser assinada novamente.'] },
  ro: { title: 'Semnătura criptografică a autorului', body: 'Un autor înregistrat poate semna o anumită revizie folosind WebAuthn/passkey asociat unei identități verificate în siguranță, de exemplu ORCID. Semnătura este legată de digestul criptografic al reviziei.', tips: ['Un ORCID introdus manual nu este echivalent cu o identitate ORCID autentificată.', 'După modificarea manuscrisului, noua revizie trebuie semnată din nou.'] },
  sk: { title: 'Kryptografický podpis autora', body: 'Registrovaný autor môže podpísať konkrétnu revíziu pomocou WebAuthn/passkey prepojeného s bezpečne overenou identitou, napríklad ORCID. Podpis je viazaný na kryptografický digest revízie.', tips: ['Ručne zadané ORCID nie je to isté ako autentifikovaná ORCID identita.', 'Po zmene rukopisu treba novú revíziu podpísať znova.'] },
  sl: { title: 'Kriptografski podpis avtorja', body: 'Registrirani avtor lahko podpiše določeno revizijo z WebAuthn/passkey, povezanim z varno preverjeno identiteto, na primer ORCID. Podpis je vezan na kriptografski povzetek revizije.', tips: ['Ročno vneseni ORCID ni enak preverjeni identiteti ORCID.', 'Po spremembi rokopisa je treba novo revizijo ponovno podpisati.'] },
  sv: { title: 'Kryptografisk författarsignatur', body: 'En registrerad författare kan signera en viss revision med WebAuthn/passkey kopplad till en säkert verifierad identitet, exempelvis ORCID. Signaturen binds till revisionens kryptografiska digest.', tips: ['Ett manuellt angivet ORCID är inte samma sak som en autentiserad ORCID-identitet.', 'Efter en ändring av manuskriptet måste den nya revisionen signeras igen.'] },
};

export function enrichAdditionalHelp(locale: string, copy: HelpCopy): HelpCopy {
  const guidance = practicalGuidance[locale];
  const signature = signatureTopic[locale];
  if (!guidance) return copy;

  const topics = copy.topics.map((topic) => ({
    ...topic,
    tips: topic.tips?.length
      ? topic.tips
      : [`${guidance.label}: ${guidance.suffix}`],
  }));

  if (signature && !topics.some((topic) => topic.title === signature.title)) {
    topics.push(signature);
  }

  return { ...copy, topics };
}
