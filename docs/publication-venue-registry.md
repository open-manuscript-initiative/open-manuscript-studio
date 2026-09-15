# Közös folyóirat- és könyvkiadó-törzsadat

A kézirat **Kibővített metaadatok** paneljén a folyóirat vagy könyvkiadó kiválasztható a közös legördülő listából. A listát a Studio szerver identitás-adatbázisa tárolja, ezért ugyanazon telepítés minden bejelentkezett felhasználója látja.

## Működés

- A bejegyzés típusa `JOURNAL` (folyóirat) vagy `BOOK_PUBLISHER` (könyvkiadó).
- A név típusként egyszer, kis-/nagybetűtől és fölösleges szóközöktől függetlenül vehető fel.
- Bármelyik bejelentkezett felhasználó új bejegyzést regisztrálhat.
- A regisztráció után a bejegyzés azonnal kiválasztható és a többi felhasználó listájában is megjelenik.
- A kézirat a kiválasztott rekord hordozható hivatkozását is menti (`id`, `type`, `name` és a megadott azonosítók), ezért exportált vagy offline dokumentumban sem vész el a megjelenített név.
- A meglévő `publisherId` metaadat-mező kompatibilitási okból megmarad; a közös lista külön `publicationVenue` mezőt használ.

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
  "issn": "1234-5678"
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
