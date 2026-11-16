# Adatvédelem: üzemeltetői beállítások és eljárások

Előkészítve: 2026. november 7. Ez az útmutató az önálló OMI-szerverekre vonatkozik.
A forráskód beolvasztása nem tölti ki az adatkezelő adatait, nem állítja be a VPS
mentéseit, és nem jelent jogi megfelelőségi tanúsítást.

## A hivatalos OMI e-mail-cím módosítása (2026. november 16.)

Az Open Manuscript Initiative hivatalos projektkapcsolati e-mail-címe:
**contact@openmanuscript.org**. A projekt nyilvános kapcsolati és adatvédelmi
elérhetőségein ne személyes Gmail-cím jelenjen meg.

A hivatalos Studio éles adatvédelmi tájékoztatójának kapcsolati címe nem a
GitHub-repóból, hanem a VPS-en lévő üzemeltetői JSON-fájlból származik. A
jogosult üzemeltetőnek az `OMI_PRIVACY_CONFIG_PATH` által megadott fájlban
(jellemzően `/etc/omi/privacy-notice.json`) a `controller.email` értékét
`contact@openmanuscript.org` címre kell állítania, miközben a tényleges
adatkezelő jogi adatai változatlanul helyesek maradnak. Ezt követően a
`server` könyvtárban `npm run privacy:check`, az API szabályos újraindítása,
az `/api/v1/privacy` válasz és a `/?privacy=1` oldal ellenőrzése szükséges.
A postafiók kézbesítését és rendszeres felügyeletét is tesztelni kell.

A forráskódbeli dokumentáció módosítása **önmagában nem írja át az éles
üzemeltetői konfigurációt**. A független intézményi szervereken továbbra is
az adott intézmény adatkezelői címét kell használni. A jelszó-visszaállító
levelek `MAIL_FROM` feladója (például `no-reply@openmanuscript.org`) más
célú beállítás, azt nem szükséges a kapcsolattartási címmel azonosítani.

## A szerver tájékoztatójának beállítása

1. Másolja a Studio repó `deployment/privacy/privacy-notice.example.json` fájlját
   a forráskódon kívüli, üzemeltető által kezelt helyre, például
   `/etc/omi/privacy-notice.json`. A fájl minden tartalma nyilvános lesz.
2. Töltse ki a tényleges adatkezelő jogi nevét, postai címét és figyelt adatvédelmi
   e-mail-címét. Adatvédelmi tisztviselőt csak tényleges kijelölés esetén nevezzen meg.
3. Adja meg a teljes, közzétett HTTPS-tájékoztató címét és az illetékes felügyeleti
   hatóság nevét, honlapját. Az OMI projekt neve nem helyettesíti az adatkezelőt.
4. A `processing` listába célonként kerüljön be az adatkör, konkrét jogalap,
   megőrzési idő vagy kritérium, címzett és a nemzetközi adattovábbítás garanciája,
   illetve annak ténye, ha ilyen továbbítás nem történik.
5. Töltse ki a joggyakorlást, adatforrásokat, kötelező adatok hiányának következményét,
   automatizált döntéshozatalt, sütiket/eszköztárolást, mentéseket és törlést leíró
   részeket. Jogos érdeknél az érdeket, hozzájárulásnál a visszavonást is ismertesse.
6. A tényszerű ellenőrzés után állítsa az `operatorReviewed` mezőt `true` értékre.
   A példafájl szándékosan hiányos, ezért az ellenőrző parancs elutasítja.
7. Az API környezetében állítsa be:
   `OMI_PRIVACY_CONFIG_PATH=/etc/omi/privacy-notice.json`.
   A `server` könyvtárból futtassa: `npm run privacy:check`.
8. A szokásos telepítési eljárással történő aktiválás után ellenőrizze a
   `/?privacy=1` oldalt, az `/api/v1/privacy` választ, a regisztrációs és Fiók felületet,
   valamint a kiválasztott szervert az Android/asztali kliensben.

Az ellenőrzés a fájl szerkezetét vizsgálja, nem a jogalap helyességét. Hiányzó
konfigurációnál a felület jelzi, hogy az üzemeltető nem adott meg tájékoztatást.
A teljes tájékoztató elkészüléséig ne nyisson nyilvános regisztrációt. A jogi szöveg
nyelvét a fájl `language` mezője adja meg; a felület nem fordítja át automatikusan.

## Érintetti kérelmek

A felület a megadott adatvédelmi címre nyit levelet. A felhasználó küldi el;
a rendszer nem hoz létre automatikus ügyet. A cím figyelését és a bejelentkezés
nélküli ügyintézést az üzemeltetőnek ténylegesen biztosítania kell.

Zárt ügyregiszter: ügyazonosító, beérkezés, kérelemtípus, arányos azonosítás,
felelős, egy naptári hónapos határidő, érintett rendszerek, döntés, válasz és lezárás.
Bonyolult vagy nagyszámú kérelemnél indokolt, legfeljebb két további hónapos
hosszabbításról az eredeti határidőn belül értesíteni kell az érintettet.
Elutasításnál indoklást, panasz- és jogorvoslati tájékoztatást kell adni.
Személyi igazolványt ne kérjen automatikusan.

A Fiókban letölthető JSON csak kiválasztott profil-, belépési és tagsági adatokat
ad ki, jelszó és token nélkül. Nem teljes körű GDPR-hozzáférési válasz és nem
kéziratmentés. Teljes kérelemnél a kéziratokat, bírálatokat, közös előzményeket,
naplókat és érintett adatfeldolgozókat is fel kell mérni, mások jogainak és a
bírálói titkosságnak a védelmével. A hordozhatóság feltételeit külön vizsgálni kell.

## Törlés, megőrzés és mentés-visszaállítás

A meglévő fióktörlés eltávolítja az élő Identity-fiókot és a hitelesítő adatokat,
a Studio résztvevőjét pedig álnevesíti. A megmaradó belső azonosító és közös tartalom
személyes adat lehet. Az álnevesítés nem anonimizálás; a tudományos eredetkövetés
nem általános felhatalmazás minden adat örökös tárolására. A kivételeket egyedileg
kell vizsgálni. Az utolsó tulajdonos törlési akadályánál üzemeltetői szerepátadást
vagy más ellenőrzött megoldást kell biztosítani, határidőben.

Adatkörönként legyen megőrzési rend: cél, jogalap, felelős, kezdő esemény,
megőrzési idő/kritérium, törlés/anonimizálás, jogszerű zárolás és ellenőrzés.
A mentések minden példányát és szolgáltatóját vegye számba. A korábban vállalt,
például 30 napos korlátot jogszerű módosításáig teljesíteni kell.

A Stúdió technikai auditnaplóira a rekord létrejöttétől számított
**90 napos** megőrzési alapértelmezés vonatkozik az integrációs műveletek
(`integration_audit_events`, pl. DeepL bemeneti/kimeneti lenyomatok) és a
kutatási modulok műveletei (`studio_module_audit_events`) esetén. A központi
és intézményi adminisztráció jogosultsági műveletei
(`admin_audit_events`), továbbá az együttműködési meghívások és szerepkörök
változásainak naplója (`collaboration_audit_events`) **180 napig** tartható
meg az elhúzódó biztonsági kivizsgálás érdekében. Ezek nem jogszabályban
előírt egységes időtartamok: az adatkezelőnek az alkalmazott jogalapot,
szükségességet és időtartamot külön dokumentálnia kell. A lenyomat és
álnevesítés nem jelent automatikus anonimitást.

A `server` könyvtár `npm run privacy:cleanup` parancsa alapból csak előnézet:
a lejárt hitelesítések és a fenti négy auditkategória darabszámát mutatja.
A `npm run privacy:cleanup -- --apply` korlátozott méretű kötegekben törli az
időhatáron túli rekordokat. A jelentés nem tartalmaz e-mail-címet, IP-címet,
felhasználói azonosítót vagy szöveglenyomatot. A rutinnak nincs hatása a
kéziratokra, a bírálati/tudományos eredetkövetésre, a szerkesztői döntések
eseményeire vagy a külön tárolt fordítási változatokra; ezekre saját, indokolt
megőrzési szabály szükséges. Jogi igényhez vagy incidenshez szükséges bizonyíték
külön, dokumentált és hozzáférés-védett megőrzést igényel: a program nem
tartalmaz automatikus rekordonkénti zárolást.

A migráció futtatása, a próbaüzem, majd az üzemeltető által jóváhagyott napi
systemd timer telepítése szükséges. A minták:
`deployment/systemd/omi-privacy-cleanup.service.example` és
`deployment/systemd/omi-privacy-cleanup.timer.example`. A nem root felhasználót,
a Node elérési útját és az API-val azonos adatbázis-konfigurációt előzetesen
ellenőrizni kell; a GitHub-módosítás **nem telepít és nem indít el éles
ütemezést**. A 7 napos systemd/Plesk rotáció a DB auditadatait nem törli,
ezért külön ellenőrizendő.

Mentés visszaállításakor az éles forgalom megnyitása előtt újra kell érvényesíteni
az időközbeni törléseket és korlátozásokat, és érvényteleníteni az elavult belépéseket.
Ehhez minimális, hozzáférés-védett és határidővel törlendő nyilvántartás kell.
A próbát szintetikus fiókkal végezze. Külső OJS/OMP- és felhőpéldányokat a megfelelő
adatkezelő eljárásában kell rendezni.

## Adatvédelmi incidens

Legyen kijelölt felelős és helyettes. Minden személyesadat-incidenst dokumentálni
kell, a bejelentést nem igénylő eset indokával együtt. Rögzítse a tudomásszerzés
idejét, érintett rendszereket, adatköröket, hozzávetőleges személy-/rekordszámot,
következményt, intézkedéseket, kockázatot, értesítési döntést és időpontokat.

Az adatfeldolgozó indokolatlan késedelem nélkül értesíti az adatkezelőt.
Az adatkezelő bejelentésköteles esetben indokolatlan késedelem nélkül, lehetőség
szerint a tudomásszerzéstől számított 72 órán belül értesíti az illetékes hatóságot.
Valószínűsíthetően magas kockázatnál az érintetteket is késedelem nélkül tájékoztatja,
a jogszabályi kivételek figyelembevételével. Privát napló vagy kézirat nem kerülhet
nyilvános GitHub-ügybe. Gyakorlattal ellenőrizze az eljárást.

## Külső szolgáltatók és feltételes előírások

Rögzítse az adatkezelői/adatfeldolgozói szerepeket és szükséges szerződéseket.
Vegye számba a tárhelyet, levelezést, Office-t, felhőt, bejelentkezést, fordítást,
kutatási és egyéb szolgáltatókat, adattovábbításokat és garanciákat. Az adatkezelési
nyilvántartást, hatásvizsgálatot, különleges adatok feltételeit és tisztviselői
kötelezettséget az adott működés alapján kell vizsgálni.

| Terület | Vizsgálandó feltétel |
| --- | --- |
| Sütik/eszköztárolás | A tényleges működéshez szükséges tárolás tájékoztatása; opcionális követés előtt megfelelő választás, elutasítás és visszavonás. A fejlesztés nem ad hozzá követést. |
| NIS2/magyar kiberbiztonsági törvény | Az üzemeltető ágazata, mérete és esetleges kijelölése; ebből következhet nyilvántartás, audit és további incidenskezelés. |
| CRA | Kereskedelmi szoftvergyártó, nem kereskedelmi FOSS vagy közreműködő szervezet eltérő szerepe. Az érintett gyártók bejelentési előírásai 2026. szeptember 11-től, a fő követelmények 2027. december 11-től alkalmazandók; a steward bejelentési előírása utóbbi dátumtól. |
| Akadálymentesség | A közszférabeli üzemeltetőre vonatkozó, illetve külön az EAA szerinti hatály; szükség esetén valós teszt, nyilatkozat és visszajelzési eljárás. |

A részletes forrásokat és teendőket az angol üzemeltetési útmutató tartalmazza.
Jogszabály: [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

## API-kompatibilitás és felelősségi határok

Az új kliens az `/api/v1/privacy` és `/api/v1/account/data` végpontot használja.
A régi `/api/privacy` és `/api/account/data` cím ugyanazt a handlert, hitelesítést
és közös kvótát használó kompatibilitási útvonal marad. Deprecation fejléc és
kizárólag a rögzített útvonal nevét tartalmazó használati esemény segíti az átállást;
eltávolítási határidő még nincs. Előbb az API-t, utána a klienseket telepítse.

A JSON csak részleges fiókáttekintés; nem helyettesíti a teljes érintetti választ.
A kiválasztott szerver tényleges üzemeltetője adja meg az adatkezelő tényeit;
a tájékoztató nem ad identity-, szerkesztői vagy publikációs jogosultságot.
Az [ADR-034](../architecture/adr-034-privacy-api-and-account-overview.md) rögzíti
a DTO/OpenAPI-, repository- és release-gate határt. A `npm run test:privacy` a
meglévő kötelező CI-ellenőrzés része, de nem helyettesít éles elfogadást vagy jogi
ellenőrzést. A javítás nem vezet be adatbázis-migrációt vagy szerkesztési korlátot.
