# Oldalstílusok és szakaszonkénti futó fejlécek

Elérés: **Publikálás → Kiadványszerkesztő → Oldalstílusok és szakaszfejlécek**.

## Oldalpáros tördelés

A **Kiadványszerkesztő → Nyomtatási oldal → Oldalpáros elrendezés** kapcsolóval
választható az oldalpáros munkanézet. Az első oldal önálló páratlan jobb oldal;
utána páros bal és páratlan jobb oldalak alkotnak egy oldalpárt (1; 2–3; 4–5).
Páros kezdőoldalszám megadásakor a következő páratlan szám lesz a kezdőoldal.
A nyitóoldal bal oldalán nincs üres dokumentumoldal: az a munkaterület része.

A nagyítás az egész oldalpár szélességéhez igazítható. A bekezdések,
táblázatsorok és lábjegyzetek a megfelelő oldalon folytatódnak, a szakaszonkénti
fejlécek és az egyedi oldalstílusok ugyanúgy érvényesülnek. Eltérő méretű
oldalstílusok a közös gerinchez igazodnak. A keretalapú nézet is oldalpáros lesz.
A belső/külső margók váltakozását a **Tükrözött margók** beállítás szabályozza.

A kapcsoló a kiadványstílus része: OMI-mentés és újrafelhasználható sablon is
megőrzi. Az IDML-export átadja az oldalpáros dokumentumbeállítást. A nyomdai
PDF továbbra is különálló, olvasási sorrendű oldalakat tartalmaz; az oldalpáros
munkanézet nem nyomdai kilövés. Kikapcsolva visszatér az egymás alatti nézet.

## Egyháztörténeti Szemle: egy folyóiratszám előkészítése

1. A tanulmányokat önálló felső szintű szakaszként kezeld. Az alszakaszok a
   tanulmány oldalstílusát és fejlécét öröklik, amíg saját beállítást nem kapnak.
2. A **Mentett oldalstílusok** részben mentsd el az aktuális oldalbeállításokat,
   majd adj beszédes nevet: például „Tanulmány”, „Nyitóoldal” vagy „Képmelléklet”.
   Beállítható az oldalméret, a négy margó, a kötésmargó, a kifutó, a tükrözés és
   a vágójel. A méretek mm-ben, pontban vagy picában adhatók meg a közös
   mértékegység-választó szerint.
3. A **Szakasz beállításai** részben válaszd ki a tanulmányt és szükség esetén
   az oldalstílusát. Kapcsold be az **Egyéni futó fejléc használata a szakaszban**
   lehetőséget. A fejlécben közvetlenül megadható a szerző neve vagy a rövid cím.
4. A páros és páratlan oldalak bal/jobb fejlécmezői külön szerkeszthetők.
   A **Fejléc a szakasz első oldalán is** kapcsolóval dönthetsz a nyitóoldalról.
   A fejléc betűmérete és az alatta húzott vonal is beállítható.
5. Példa: páros oldal bal mezője `{{pageNumber}}`, jobb mezője a szerző neve;
   páratlan oldal bal mezője `{{shortSectionTitle}}`, jobb mezője
   `{{pageNumber}}`. A `{{sectionTitle}}` a szakasz címe, az
   `{{articleTitle}}` a teljes dokumentum címe. További mezők:
   `{{shortArticleTitle}}`, `{{journalTitle}}`, `{{volume}}`, `{{issue}}`,
   `{{year}}`.
6. Egyetlen nyitóoldalhoz válaszd a „Nyitóoldal” mentett stílust, és a **Stílus
   alkalmazása oldalakra** részben írd ugyanazt az oldalszámot a kezdő és záró
   mezőbe. Egy összefüggő oldaltartomány is megadható.

Az egyedi fejlécet vagy oldalstílust kapó szakasz új oldalon kezdődik. A szakasz
beállításai a szöveggel együtt mozognak. Az oldalszámhoz rendelt kivétel viszont
az adott nyomtatott oldalszámon marad akkor is, ha változik a szöveg terjedelme.
A számozás a belív kezdő oldalszámából indul; a borító és az előzékoldalak nem
számítanak bele az oldal-hozzárendelésbe.

## Elsőbbség, mentés és törlés

Az egyedi oldal-hozzárendelés felülírja a szakasz beállításait, beleértve a mentett
stílus fejlécét is. Átfedő tartományoknál a később alkalmazott hozzárendelés nyer.
Eltávolításakor újra a szakasz vagy a kiadvány alapbeállítása érvényesül.

A mentett oldalstílus módosítása minden hozzá rendelt oldalt frissít. Másolással
független stílus készíthető. Törléskor megszűnnek az adott stílus hozzárendelései;
a külön megadott szakaszfejlécek megmaradnak.

A munkapéldány az OMI-fájlban és a verziótörténetben is megőrzi az oldalstílusokat,
a szakaszfejléceket és az oldal-hozzárendeléseket. Egy új kiadványhoz készített
újrafelhasználható sablon a mentett oldalstílusokat viszi tovább, az előző szám
szakaszazonosítóit és oldalszámhoz kötött kivételeit nem.

## Nyomdai ellenőrzés

A végső ellenőrzést a Stúdió által készített PDF-ben végezd. Az élő szerkesztő
oldalszáma becslés: ha egy bekezdés eltérő szélességű szövegtükrök között folytatódik,
az előnézet a bekezdés kezdő szélességét tartja meg. A PDF minden oldalon a tényleges
szövegtükörre tördeli a tartalmat. Az egyszerű böngészős nyomtatás nem feltétlenül
ismeri a szakaszkezdő oldalakhoz és az egyedi oldalszámokhoz szükséges tördelési
szabályokat. A folyamatos HTML-nézetet az oldalstílusok nem darabolják oldalakra.
