# Közös folyóirat- és könyvkiadó-törzsadat

A kézirat **Kibővített metaadatok** paneljén a folyóirat vagy könyvkiadó kiválasztható a közös legördülő listából. A listát a Studio szerver identitás-adatbázisa tárolja, ezért ugyanazon telepítés minden bejelentkezett felhasználója látja.

## Működés

- A bejegyzés típusa `JOURNAL` (folyóirat) vagy `BOOK_PUBLISHER` (könyvkiadó).
- A név típusként egyszer, kis-/nagybetűtől és fölösleges szóközöktől függetlenül vehető fel.
- A választó kizárólag már regisztrált, ellenőrzött integrációhoz tartozó rekordokat jelenít meg.
- A név szerinti kereső csak a regisztrált lista szűrője; szabadon beírt név nem válik kiválasztható értékké.
- Új rekord regisztrációjához a felhasználónak aktív, tesztelt OJS- vagy OMP-kapcsolatot kell kiválasztania.
- A szerver a regisztráció előtt ellenőrzi a kapcsolat telepítését, a megfelelő platformot és az `omi-direct-submission/1` végpontot. A rekord neve a távoli integráció által jelentett névvel egyezik.
- A regisztráció után a rekord azonnal kiválasztható és a többi felhasználó listájában is megjelenik, amíg a kapcsolódó integráció aktív.
- A kézirat a kiválasztott rekord hordozható hivatkozását is menti (`id`, `type`, `name` és a megadott azonosítók), ezért exportált vagy offline dokumentumban sem vész el a megjelenített név.
- A meglévő `publisherId` metaadat-mező kompatibilitási okból megmarad; a közös lista külön `publicationVenue` mezőt használ.
- A korábbi, integráció nélkül létrehozott rekordok rejtve maradnak; ellenőrzött kapcsolat kiválasztása után ugyanazzal a névvel újraregisztrálhatók és felminősíthetők.

## API

A végpontok bejelentkezést igényelnek:

```
GET  /api/auth/publication-venues?type=JOURNAL&q=...
POST /api/auth/publication-venues
```

A létrehozási kérés törzse:

```json
{
  "type": "JOURNAL",
  "name": "Open Manuscript Review",
  "website": "https://example.org",
  "issn": "1234-5678",
  "integrationConnectionId": "<user-connection-uuid>"
}
```

Könyvkiadónál az `isbnPrefix` mező használható az ISSN helyett.

## Telepítés

A séma módosítása után az identitás-adatbázis migrációját a szerveren is le kell futtatni:

```bash
cd server
npm run prisma:migrate:identity:deploy
```

Ezután újra kell indítani a szerveralkalmazást, hogy a frissen generált Prisma klienssel és az új API-végponttal fusson.
