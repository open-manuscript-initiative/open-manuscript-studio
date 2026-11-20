# Kötet- és folyóiratsablonok

Az **Új kötet / folyóiratszám** űrlapon a kiadvány típusának megfelelő sablon választható. A **Kiadványszerkesztő → Kiadványsablonok** részen már meglévő kiadványra is alkalmazható sablon, illetve a jelenlegi beállítások új sablonként menthetők. A mentéskor megadható a sorozat vagy folyóirat neve.

Beépített kezdősablonok:

| Típus | Sablon | Vágott méret |
| --- | --- | --- |
| Kötet, monográfia vagy tanulmánykötet | Könyvsorozat | A5, 148 × 210 mm |
| Folyóiratszám | Folyóirat | 150 × 240 mm |

A saját sablon a jelenlegi lapméretet, margókat, élőfejeket, betűbeállításokat, bekezdésstílusokat és kiadói profilt, valamint a borító és címnegyed oldalait, kereteit és képeit tárolja. A kézirat tanulmányait, szerzőit, szövegét és a törzsszöveghez kötött egyedi kerettörténeteket nem másolja át.

Az alkalmazás lecseréli a célkiadvány formátumát és borító/címnegyed beállításait. A cím, a kiadvány saját metaadatai és a tartalma megmaradnak. A kiadó neve, a kiadás helye, az ISSN/eISSN, a szerzői jogi közlés és a kolofon csak üres célmezőket tölt ki. Az ISBN, eISBN, DOI, év és kiadási adatok nem válnak új kiadványok alapértelmezett értékeivé. A kötet és folyóiratszám sablonjai külön jelennek meg; a rendszer nem alkalmaz eltérő típusú sablont.

## Változó adatok a borítón

A borító és címnegyed szövegében használható a `{{title}}`, `{{subtitle}}`, illetve bármely címadatmező neve, például `{{publicationYear}}`, `{{isbn}}`, `{{electronicIsbn}}`, `{{doi}}`, `{{publisherName}}`. A helyőrző az alkalmazáskor kapja meg a célkiadvány aktuális értékét; az üres adat üres szöveget eredményez. A beépített sablonok impresszuma az összes aktuális azonosítót külön sorokban állítja elő.

Mentéskor a program az aktuális címet, alcímet és egyedi címadatokat automatikusan helyőrzőkre cseréli a borító és címnegyed szövegcsomópontjaiban. A kézi formázás megmarad. Ha az adat több külön szövegcsomópontban, eltérő formázással szerepel, vagy nincs a kiadvány metaadataiban, célszerű mentés előtt kézzel teljes helyőrzőre cserélni. Az automatikus gerinc megtartja a papírtípust, és az új kiadvány tördeléséből számolja az oldalszámot.

## Mentés és átvitel

A saját sablonok az eszköz IndexedDB-tárában maradnak meg. Új sablon menthető, a kijelölt saját sablon frissíthető vagy törölhető. A beépített sablonokból saját másolat készíthető.

A **Sablon exportálása** egy `.omi-template.json` fájlt készít a borítóképekkel együtt. A **Sablon importálása** ezt ellenőrzés után új példányként menti el. A képek méretét, típusát, hivatkozásait és SHA-256 ellenőrzőösszegét is ellenőrzi a program. A hordozható sablon legfeljebb 24 MiB lehet. Hiányzó kép vagy sikertelen mentés esetén a művelet hibával megáll.

Az alkalmazott formátum önálló pillanatképként bekerül a célkiadvány `.omi` adataiba. A sablon későbbi módosítása vagy törlése nem változtatja meg a már elkészült kiadványokat. A további tipográfiai szerkesztés a kiadvány saját formátumát frissíti; a HTML/PDF és IDML kiadványexport is ezt a mentett formátumot használja.
