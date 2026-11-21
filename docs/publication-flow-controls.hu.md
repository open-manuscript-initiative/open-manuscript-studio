# Szövegfolytatás, töréspontok és oldalkezelés

A kiadványszerkesztő **Oldalstílusok és szakaszfejlécek** panelján:

- A tanulmányok a fel és le gombokkal átrendezhetők. A tanulmány alárendelt
  szakaszai, jegyzetei, szerzői és állandó azonosítói együtt maradnak.
- A szakasz új oldalra indítható vagy egyben tartható, ha egy teljes oldalon
  elfér. Az egy oldalnál hosszabb szakasz tovább folyik.
- Üres nyomtatási oldal szúrható a kiválasztott bekezdés elé, választott
  oldalstílussal. A beszúrás az állandó blokkazonosítót követi, így a tanulmány
  áthelyezésekor is a megfelelő helyen marad.
- A beszúrt oldal törlése megszünteti az üres lapot és újratördeli a következő
  szöveget. A szükséges automatikus szövegoldalak a szöveg terjedelméhez igazodnak.

A több oldalra kerülő szakasz címe mellett **csak figyelmeztető ikon** jelenik
meg. Az ikon a szerkesztő jelzése, nem kerül az exportált kiadványba.
A külön bekapcsolható **Tördelési ellenőrző** felsorolja a folytatódó,
egyben tartás miatt áthelyezett vagy túl hosszú szakaszokat, a túlméretes
blokkokat, a keretek túlcsorduló szövegét, a hiányzó grafikai forrásokat és az
eltávolított célbekezdéshez tartozó oldalbeszúrásokat. A tételre kattintás az
érintett szakaszhoz, kerethez vagy a javítható beszúráshoz visz.

## Külön szövegkeretek

A **Keretek és oldalstílusok** eszközben bármely szövegfolyamhoz bekapcsolható
az automatikus folytatás, és kiválasztható a folytató oldalak stílusa. A keretek
összekapcsolása és a kézi keretformázás továbbra is használható. Az eltérő
stílusú automatikus oldalak kerete az adott oldal szövegtükréhez igazodik.

A szövegmező kurzoránál kerettörés és oldaltörés szúrható be. A kerettörés a
következő összekapcsolt keretben folytat, az oldaltörés az azonos oldalon levő
kereteket kihagyja. A töréspontok külön eltávolíthatók; a megmaradó szöveghez
kötött pozícióik szerkesztéskor frissülnek. Az OMI-fájl tárolja őket.

A keretoldal törlése megőrzi a szövegfolyamot. A szöveg a megmaradt láncban
újratördelődik; elhelyezhető keret hiányában visszahelyezhető szövegfolyamként
megmarad. Az automatikus oldalszám legfeljebb 100; a fennmaradó túlcsordulás
ellenőrizhető. A kiürült, érintetlen automatikus folytató oldalak eltűnnek.

Az üres lapok és a tördelési szabályok a nyomtatott előnézetet és a PDF-et
érintik. A szemantikus HTML folyószöveges marad. A külön keretek szövege
továbbra is önálló szövegfolyam; a kézirat gazdag formázását a fő kiadványnézet
és annak exportja őrzi meg.
