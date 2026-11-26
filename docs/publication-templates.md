# Kötet- és folyóiratsablonok

Az **Új kötet / folyóiratszám** űrlapon a kiadvány típusának megfelelő sablon választható. A **Kiadványszerkesztő → Kiadványsablonok** részen már meglévő kiadványra is alkalmazható sablon, illetve a jelenlegi beállítások új sablonként menthetők. A mentéskor megadható a sorozat vagy folyóirat neve.

Beépített kezdősablonok:

| Típus | Sablon | Vágott méret |
| --- | --- | --- |
| Kötet, monográfia vagy tanulmánykötet | Könyvsorozat | A5, 148 × 210 mm |
| Folyóiratszám | Folyóirat | 150 × 240 mm |

A saját sablon a jelenlegi lapméretet, margókat, élőfejeket, betűbeállításokat, bekezdésstílusokat és kiadói profilt, valamint a borító és címnegyed oldalait, kereteit, képeit és beírt szövegeit tárolja. Az egyedi oldalstílusok, oldaltartományok, szakaszhozzárendelések, számozási és jegyzékbeállítások is megmaradnak. A szakaszhozzárendelések az eredeti szakaszazonosítókhoz kötődnek; új tanulmányoknál a megfelelő szakaszokra kell aktualizálni őket. A kézirat tanulmányait, szerzőit, törzsszövegét és a törzsszöveghez kötött egyedi kerettörténeteket nem másolja át.

Az alkalmazás lecseréli a célkiadvány formátumát és borító/címnegyed beállításait. A célkiadványban már kitöltött cím, alcím, mottó és címadatmezők elsőbbséget kapnak; az üres mezőket a sablon mentett értékei töltik ki. A folyóiratsablon megőrzi a nyomtatott és elektronikus ISSN-t, a kiadási adatokat, az impresszumot és a többi beírt szöveget. A következő számhoz így elegendő az aktuális adatokat módosítani.

A könyvsorozatok szövegei és beállításai ugyanígy megmaradnak. Az **Új kötet / folyóiratszám → Sorozat címe**, illetve a kötet **Címadatok → Sorozat címe** mezőjében megadható a sorozat neve; ez a sablon része, és a sorozati oldalon, valamint a `{{seriesTitle}}` helyőrzővel is használható. A sablon mentésekor megadott sorozatnév is kitölti ezt az adatot, ha még üres. A könyvek **ISBN-je és elektronikus ISBN-je nem öröklődik**: ezeket az új kötetnél kell megadni. Az új kötethez megadott ISBN-eket a sablon alkalmazása megőrzi. A kötet és folyóiratszám sablonjai külön jelennek meg; a rendszer nem alkalmaz eltérő típusú sablont.

## Változó adatok a borítón

A borító és címnegyed szövegében használható a `{{title}}`, `{{subtitle}}`, illetve bármely címadatmező neve, például `{{publicationYear}}`, `{{isbn}}`, `{{electronicIsbn}}`, `{{doi}}`, `{{publisherName}}`. A helyőrző az alkalmazáskor kapja meg a célkiadvány aktuális értékét; az üres adat üres szöveget eredményez. A beépített sablonok impresszuma az összes aktuális azonosítót külön sorokban állítja elő.

Mentéskor a program az aktuális címet, alcímet, mottót és címadatokat automatikusan helyőrzőkre cseréli a borító és címnegyed szövegcsomópontjaiban; a mentett alapértékek gondoskodnak róla, hogy a szövegek az új kiadványnál is megjelenjenek. A kézi formázás megmarad. Ha az adat több külön szövegcsomópontban, eltérő formázással szerepel, vagy nincs a kiadvány metaadataiban, célszerű mentés előtt kézzel teljes helyőrzőre cserélni. A könyvazonosítókhoz használja a `{{isbn}}` és `{{electronicIsbn}}` helyőrzőt. Az automatikus gerinc megőrzi a papírtípust és a számítási beállításokat. A kézzel megadott oldalszám megmarad; a tördelésből számított oldalszám az új kiadványhoz igazodik.

## Mentés és átvitel

A saját sablonok az eszköz IndexedDB-tárában maradnak meg. Új sablon menthető, a kijelölt saját sablon frissíthető vagy törölhető. A beépített sablonokból saját másolat készíthető.

A **Sablon exportálása** egy `.omi-template.json` fájlt készít a borítóképekkel együtt. A **Sablon importálása** ezt ellenőrzés után új példányként menti el. A képek méretét, típusát, hivatkozásait és SHA-256 ellenőrzőösszegét is ellenőrzi a program. A hordozható sablon legfeljebb 24 MiB lehet. Hiányzó kép vagy sikertelen mentés esetén a művelet hibával megáll.

Az alkalmazott formátum önálló pillanatképként bekerül a célkiadvány `.omi` adataiba. A sablon későbbi módosítása vagy törlése nem változtatja meg a már elkészült kiadványokat. A további tipográfiai szerkesztés a kiadvány saját formátumát frissíti; a HTML/PDF és IDML kiadványexport is ezt a mentett formátumot használja.

## Címnegyed – dinamikus adatmezők (shortcode-ok)

Nyissa meg: Publikálás → Kiadványszerkesztő → Borítók és címnegyed. Válasszon oldalt vagy szövegkeretet, helyezze el a kurzort, majd válassza az Adatmező beszúrása menüt. A shortcode kézzel is beírható. Egy kódon belül ne váltson formázást. Az Adatmezők előnézete a behelyettesített szöveget mutatja; kikapcsolásával a kódok szerkeszthetők.

| Shortcode | Tartalom |
| --- | --- |
| `[omi:imprint]` | Impresszum (kolofon vagy kiadó/cím/kapcsolattartó, copyright és elérhető azonosítók) |
| `[omi:editorial-board]` | Szerkesztőbizottság – natív nyilvános névsor szerepkörönként |
| `[omi:authors]` | A kiadvány szerzői |
| `[omi:contents]` | Tartalomjegyzék: tanulmányok szerzői és címei |
| `[omi:journal]` | Folyóirat vagy sorozat neve |
| `[omi:publisher]` | Kiadó |
| `[omi:address]` | Postacím vagy kiadási hely |
| `[omi:contact]` | Kapcsolattartó neve |
| `[omi:title]` | Kiadvány címe |
| `[omi:volume]` | Évfolyam vagy kötet |
| `[omi:number]` | Lapszám |
| `[omi:year]` | Kiadás éve |
| `[omi:issn]` | Nyomtatott ISSN |
| `[omi:eissn]` | Elektronikus ISSN |
| `[omi:isbn]` | ISBN |
| `[omi:doi]` | DOI |

Mentse a formátumot kiadványsablonként: a kódok megmaradnak, és az aktuális kiadvány adataira oldódnak fel az előnézetben, valamint a HTML/PDF-kimenetben.

Már importált lapszámot nyisson meg ismét az OJS-ből, majd válassza az Impresszum és szerkesztőbizottság frissítése műveletet. A szöveg és a tördelés megmarad. A natív OJS-névsorhoz kompatibilis plugin szükséges; egyedi szerkesztőbizottsági bővítményhez további illesztés kellhet.

A hiányzó vagy ismeretlen mező kódja látható marad, és exportálási hibajelzést eredményez. Ellenőrizze a PDF-et és a keretek túlcsordulását. A tartalomjegyzék szerzőket és címeket tartalmaz, oldalszámokat nem. Az IDML, DOCX és ODT shortcode-feloldása még nem igazolt.

```text
IMPRESSZUM
[omi:imprint]

Szerkesztőbizottság
[omi:editorial-board]

[omi:journal] [omi:volume]/[omi:number] ([omi:year])
```

### Többnyelvű címnegyed

A `[omi:journal:hu]` és `[omi:journal:en]`, illetve a `[omi:editorial-board:hu]` és `[omi:editorial-board:en]` egymás mellett is használható. A nyelvi utótag a sablon része; hiányában a keret, majd a dokumentum nyelve érvényes. A hiányzó OJS-nyelvi változatot nem fordítjuk le automatikusan. A megfelelő adatokat az OJS-ben kell kitölteni, majd a lapszám impresszumát frissíteni.
