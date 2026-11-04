# RC1 kézi elfogadás – részleges kitöltés

Felelős: Varga István
Forrás: e1200268ad549c0a40ace8724715cd2405e9d03c
Build: 41741830930

## Üzemeltetői beszámoló

„Mindkettőt telepítettem és minden működik. November 4. 01:23 Windows
November 4. 01:47 Android”

A beszámoló a jelen beszélgetésben feltett, a mostani RC telepítésére/frissítésére és a dokumentumok megőrzésére vonatkozó kérdésekre érkezett. A sikeres működés üzemeltető által közölt eredmény; külön technikai mérést vagy független aláírásellenőrzést nem végeztünk.

| Platform | Magyar idő (CET, UTC+1) | UTC | Működési próba |
| --- | --- | --- | --- |
| Windows | 2026-11-04 01:23 | 2026-11-04T00:23:00Z | Sikeres, üzemeltetői beszámoló |
| Android | 2026-11-04 01:47 | 2026-11-04T00:47:00Z | Sikeres, üzemeltetői beszámoló |

A megadott időpontok perc pontosságúak; a JSON-ban a másodperc 00 a formátum miatt.

## A JSON frissítése

Az owner mező kitöltve; a windows-device és android-device observedAt mezője kitöltve. A forrásazonosító, a build, a workflow-azonosítók és mind a hét fájlhash változatlan. A reviewedAt a végleges elfogadásig üres marad.

A teljes kapuk még pending állapotúak: nincs rögzítve a telepítési/frissítési csatorna és az aláírásazonosság ellenőrzése, valamint az elfogadási feljegyzés HTTPS-hivatkozása. A funkcionális sikert nem terjesztettük ki nem közölt ellenőrzésekre. Az üzemeltető további válasza: „Az Android apk-ból”. Az Android-próba közvetlen APK-telepítésre vonatkozik; Google Play-frissítésről nincs megfigyelés. Az APK aláírásának ellenőrzését az üzemeltető később sikeresként megerősítette. Az ellenőrzési módszer, a tanúsítvány azonossága és a külön csomagazonossági vizsgálat nincs részletezve.

Ez részleges munkapéldány, önmagában nem végleges kiadási jóváhagyás.

## Linux és web – további üzemeltetői válasz

„Jelenleg nincs hozzá tesztkörnyezetem. A webes verzió viszont működik.”

- Korábbi Linux-állapot: a kezdeti beszámoló idején még nem volt tesztkörnyezet. Ezt a későbbi, 2026. november 4-én 11:53-tól végzett sikeres Linux-próba felülírja; lásd a Linux-teszt feljegyzését alább.
- Webes Studio: működik, üzemeltetői beszámoló szerint. Pontos próbaidőpont, telepített commit és részletes műveleti lista nem lett megadva. A webes működés nem igazolja a natív Linux-csomagot, a hálózati tiltások teljes körét vagy a visszaállítást.

Linux továbbra is Preview a jelenlegi RC támogatási körében. A később elvégzett Linux-próba eredménye és kezdő időpontja az alábbi kiegészítésben szerepel; a teljes kiadási elfogadás ettől külön folyamat.

## OJS-verzió pontosítása

Arra a kérdésre, hogy az RC telepítése óta kipróbálta-e az OJS-kapcsolatot, és melyik verzióval, az üzemeltető válasza: „3.5.0-5”.

Az OJS 3.5.0-5 kapcsolat működése üzemeltető által megerősített funkcionális eredmény. Külön műveleti lista, pontos próbaidőpont és a telepített OJS-bővítmény commitazonosítója nem érkezett. Az ojs-3.5.0-5 teljes kapu pending marad a részletes igazolásig. Az OJS 3.5.0-4 verzióra ebből a válaszból nem következik manuális elfogadás. A JSON azonosítói, hash-ei és időpontjai változatlanok.

## OMP-kapcsolat

További üzemeltetői megerősítés: „OMP is jó”. Az OMP-kapcsolat működik az üzemeltető beszámolója szerint. Az üzemeltető további pontosítása: „Szintén 3.5.0-5”, azaz az OMP tesztelt verziója 3.5.0-5. A bővítmény-commit, a végzett műveletek és a próba időpontja nem került megadásra. Az OMP támogatási besorolása továbbra is Preview. Ez a pozitív eredmény nem helyettesíti az OJS 3.5.0-4 vagy más, külön kötelező kapu igazolását. A JSON változatlan.

## Mentésből való visszaállítás – üzemeltetői eredmény

Arra a kérdésre, hogy tesztelt-e már mentésből való visszaállítást, az üzemeltető válasza: „Teszteltem. Működik.”

A mentésből való visszaállítás sikeres az üzemeltető beszámolója szerint. Az üzemeltető pontosítása: „Dokumentumot.” A sikeres próba tehát dokumentum visszaállítására vonatkozott. Az alkalmazásverzió és a hozzá tartozó teljes adatállapot visszaállítására nincs közölt teszteredmény. Az érintett platform és a próba időpontja nincs megadva. A dokumentum-visszaállítás eredményét nem terjesztjük ki a teljes alkalmazás vagy az összes platform helyreállítására. A recovery kapu pending marad; időpontot és HTTPS-hivatkozást nem találtunk ki.

## Hosszabb kézirat próbája

Arra a kérdésre, hogy hosszabb kézirattal is kipróbálta-e az RC-t, és megfelelő volt-e a betöltés, görgetés és szerkesztés sebessége, az üzemeltető válasza: „Mindegyiken próbáltam.”

A korábban tesztelt Windows, Android és webes felületeken hosszabb kézirattal is történt próba. A hosszú kéziratra vonatkozó korábbi „mindegyiken” válasz a Windows, Android és webes próbákat fedte le. A későbbi Linux-próbáról külön kiegészítés készült; annak eredményéből nem következik önálló 46 oldalas Linux-teljesítménymérés. Az üzemeltető további válasza: „Igen, 46 oldalas volt a tördelt pdf export. Azonnal reagált, nem volt késlekedés.” A tesztelt kézirat tördelt PDF-exportja 46 oldal volt. A betöltés, görgetés és szerkesztés sebességére vonatkozó kérdésre a Windows, Android és webes változaton megfelelő, érzékelhető késlekedés nélküli működést jelentett. Ez kvalitatív üzemeltetői megfigyelés; milliszekundumos időmérést vagy a PDF exportálásának időtartamát nem állítjuk. Új pontos próbaidőpont nem érkezett. A performance kapuhoz rögzített pozitív működési eredmény rendelkezésre áll; a teljes kapu státusza az időpont és a megfelelő HTTPS-feljegyzéshivatkozás hiányában egyelőre pending marad.

## Billentyűzetes és mobil kezelhetőségi próba

Arra a kérdésre, hogy Windowson billentyűzettel is elérhetők-e a fő funkciók, illetve Androidon jól olvashatók-e a feliratok és elérhetők-e a gombok, az üzemeltető válasza: „Igen, mindkettő.”

- Windows: a fő funkciók billentyűzettel elérhetők, üzemeltetői megerősítés.
- Android: a feliratok olvashatók, a gombok elérhetők, üzemeltetői megerősítés.

Ezek a konkrét kezelhetőségi próbák sikeresek. Képernyőolvasós, teljes WCAG-megfelelőségi vagy minden funkciót átfogó független akadálymentességi vizsgálatot nem állítunk. A próba pontos időpontja nem lett megadva. Az accessibility kapuhoz a pozitív részmegfigyelést rögzítettük; a végleges JSON-kapu jóváhagyása az időpont, a megfelelő bizonyítékhivatkozás és az elfogadási kör egyeztetéséig pending marad.

## Aláírás-ellenőrzés – új üzemeltetői beszámoló

Az üzemeltető válasza az aláírási igazolásokra: „Az aláirást is teszteltem. Sikeres volt.”

Az üzemeltető további pontosítása: „Android”. A sikeres aláírás-ellenőrzés tehát az Android APK-ra vonatkozik. Az ellenőrzési eljárás, az aláíró tanúsítvány azonossága és a külön próbaidőpont nem lett megadva. Az eredményt nem terjesztjük ki Windows-telepítőre, Google Play aláírási láncra vagy automatikus frissítési csomagra. Az Android aláírás-ellenőrzése sikeres üzemeltetői eredményként rögzítve. Az üzemeltető későbbi pontosítása szerint a Windows-telepítőhöz még nincs aláírás; ez ismert hiány, nem sikeres aláírás-ellenőrzés. A JSON kapustátuszai változatlanok.

## Windows-telepítő aláírása – pontosítás

Arra a kérdésre, hogy a Windows-telepítő aláírását is ellenőrizte-e, az üzemeltető válasza: „Ahhoz még nincs aláírás.”

Aktuális állapot: a Windows-telepítő nincs aláírva az üzemeltető közlése szerint. Ez nem egy most végrehajtott Authenticode-parancs eredménye; NotSigned parancskimenetet nem állítunk. A korábban sikeresen megfigyelt Windows-telepítés és működés eredménye megmarad. A Windows kódaláírási feltétel nincs teljesítve; ez nem terjeszthető ki az Android APK-ra, amelynek aláírás-ellenőrzését az üzemeltető sikeresként jelezte.

A Windows teljes kiadási kapuját nem jelöltük sikeresnek. Nem állítottunk ki tanúsítványt, nem írtunk alá binárist, nem módosítottuk a kiadási szabályt és nem publikáltunk RC-t. A receipt JSON azonosítói, ellenőrzőösszegei, korábban rögzített próbaidőpontjai és kapustátuszai változatlanok.

## Linux test 2026-11-04

Az üzemeltető új beszámolója: „linuxon is tesztelve 2026.11.04-én 11:53-tól. Minden működik.”

**Eredmény: sikeres Linux-próba az üzemeltető beszámolója alapján; minden működik.** A próba kezdete **2026. november 4. 11:53 magyar idő (CET, UTC+1)**, azaz **2026-11-04T10:53:00Z**. Az időpont a próba kezdetét jelöli, nem a végét; a megadott pontosság egy perc.

Ez az új eredmény felülírja a korábbi „nincs Linux-tesztkörnyezet / még nem tesztelt” állapotot. A Linux-disztribúció és verziója, a használt csomag típusa és ellenőrzőösszege, a részletes műveleti lista és a próba befejezési ideje nem lett megadva; ezeket nem egészítettük ki feltételezéssel. A meglévő RC-rekord jelöltazonosítóit és hash-eit nem változtattuk meg. A Linux Preview-besorolása és az örökölt GLib-korlátozás továbbra is megmarad.
