# Közös folyóirat- és könyvkiadó-törzsadat

A kézirat **Kibővített metaadatok** paneljén a folyóirat vagy könyvkiadó a Studio közös, hitelesített törzsadatából választható ki.

## Hitelesítési utak

Egy publikációs hely két független módon válhat hitelesítetté:

1. **OJS / OMP integráció** — aktív, tesztelt PKP-integráció igazolja a folyóiratot vagy kiadót.
2. **DNS TXT domainhitelesítés** — OJS/OMP nélküli folyóirat vagy kiadó a saját DNS-zónájában elhelyezett egyszer használatos TXT-értékkel igazolja a domain feletti rendelkezési jogot.

A DNS-hitelesítés **nem peer-review bizonyíték**, és nem ad automatikusan szerkesztői döntési jogot. Sikeres DNS-ellenőrzéskor a kezdeményező DOMAIN_ADMIN szerepet kap. A domain-admin ezután külön felhatalmazhat már létező Studio-felhasználókat további DOMAIN_ADMIN, EDITOR vagy EDITOR_IN_CHIEF szerepre. A további domain-adminokhoz nem kell új DNS TXT rekord: az ő autoritásuk a már hitelesített venue-n belüli explicit admin-delegálásból származik.

## DNS TXT folyamat

A Studio például ilyen kihívást generál:

~~~text
TXT név:   _omi-publication.folyoirat.hu
TXT érték: omi-publication-verification=<random-token>
~~~

A DNS TXT rekord nyilvános adat. A challenge értéke ezért **nem titkos hitelesítő adat és nem személyazonosító**. A bizonyíték abból áll, hogy a Studio egy friss, előre nem ismert kihívást köt egy konkrét bejelentkezett fiókhoz, és ez a kihívás a megadott DNS-név alatt megjelenik. A Studio a challenge SHA-256 lenyomatát tárolja, és ugyanazt a challenge-et csak a létrehozó fiók, csak PENDING állapotban, egyszer használhatja fel. A nyilvánosan kiolvasható érték más fióknak nem ad DOMAIN_ADMIN vagy EDITOR jogosultságot.

A kihívás 7 napig érvényes. Sikeres ellenőrzés után a domain VERIFIED állapotú lesz. A későbbi DNS-lekérdezés csak azt ellenőrzi, hogy a domain továbbra is nyilvánosan fenntartja ezt a venue-kötést; nem használja a TXT-értéket új fiók vagy szerkesztő hitelesítésére. Új publisher-verified szerkesztői döntés előtt a Studio legfeljebb 24 órás DNS-ellenőrzési eredményt fogad el; régebbi eredménynél újra ellenőrzi a TXT rekordot.

A már rögzített szerkesztői döntés történeti bizonyítékát későbbi DNS- vagy szerepkörváltozás nem írja át: a döntés az akkori venue-autoritás snapshotját őrzi.

## Szerepkörök

- **DOMAIN_ADMIN**: a DNS-sel igazolt publikációs hely adminisztrátora. További domain-adminokat és szerkesztői szerepeket kezelhet, de ettől még nem hozhat tudományos szerkesztői döntést. Minden aktív domain-admin azonos venue-adminisztrációs joggal rendelkezik.
- **EDITOR**: a hitelesített publikációs hely nevében rögzíthet elfogadó döntést, ha a kézirat review-workspace-ében is EDITOR.
- **EDITOR_IN_CHIEF**: ugyanaz a döntési jogosultság, külön megőrzött főszerkesztői szerepkörrel.

A venue-szerepkör és a kézirat-workspace szerepkör szándékosan két külön jogosultsági sík. A Studio nem engedi az utolsó aktív DOMAIN_ADMIN visszavonását; előbb egy második domain-adminisztrátort kell felhatalmazni. Ez a védelem szerveroldali, tranzakciós ellenőrzés.

## Kiválasztható rekordok

- A típus JOURNAL vagy BOOK_PUBLISHER.
- A választó ellenőrzött OJS/OMP-kapcsolathoz vagy VERIFIED DNS-domainhez tartozó rekordokat jelenít meg.
- DNS-hitelesített rekordnál a hordozható publicationVenue metaadat az authority.method = DNS_TXT adatot is megőrzi.
- A meglévő publisherId kompatibilitási mező megmarad.

## API

~~~text
GET  /api/auth/publication-venues?type=JOURNAL&q=...
POST /api/auth/publication-venues

POST /api/auth/publication-venues/domain-claims
POST /api/auth/publication-venues/domain-claims/:claimId/verify
GET  /api/auth/publication-venues/:venueId/authority

POST   /api/auth/publication-venues/:venueId/members
DELETE /api/auth/publication-venues/:venueId/members/:membershipId
~~~

Példa DNS-kihíváskérés:

~~~json
{
  "type": "JOURNAL",
  "name": "Open Manuscript Review",
  "domain": "review.example.org",
  "website": "https://review.example.org",
  "issn": "1234-5678"
}
~~~

A domain-admin csak már létező Studio-fióknak adhat DOMAIN_ADMIN, EDITOR vagy EDITOR_IN_CHIEF szerepet. Egy felhasználó ugyanannál a venue-nál több szereppel is rendelkezhet. DOMAIN_ADMIN kiosztásához nincs új DNS challenge: a meglévő domain-admin delegálja a jogosultságot.

## Peer-review autoritás

DNS-hitelesített folyóirat esetén a Studio-native szerkesztői döntés publicationVenueId mezőt kap. A szerver egyidejűleg ellenőrzi:

- a döntéshozó aktív venue EDITOR / EDITOR_IN_CHIEF szerepét;
- a venue aktuális DNS-hitelesítését;
- a kézirat review-workspace EDITOR jogosultságát;
- a lezárt tudományos lektori fordulót;
- a konkrét revisionId + stateDigest azonosságot;
- az assurance-rétegtől független publicationContentDigest értéket.

A döntés az akkori domain, venue, verification ID, hitelesítési időpont és szerkesztői szerep változtathatatlan authority snapshotját tárolja.

## Telepítés

A funkció az identity és az alkalmazás-adatbázist is érinti:

~~~bash
cd server
npm run prisma:migrate:identity:deploy
npm run prisma:migrate:deploy
~~~

Új migrációk:

- 20260923071500_add_dns_verified_publication_venue_authority
- 20260923072000_bind_editorial_decisions_to_verified_venues

Ezután a szerveralkalmazást újra kell indítani a frissen generált Prisma kliensekkel.

## Studio-native szerkesztőségi workflow

DNS-hitelesített, OJS/OMP nélküli publikációs helynél a Studio a teljes szerkesztőségi folyamatot is kezelheti: szerzői beküldés, szerkesztői inbox, lektor kijelölése, lektori fordulók, javítás kérése, új revízió beküldése, külön szerkesztői elfogadás és végül publikálás.

A szerkesztői `ACCEPT` döntés **nem azonos a publikálással**. Először az exact revízióhoz kötött `EditorialDecision` jön létre; a publikációs réteg ezt később csak felhasználja.

Részletesen: [Studio-native submission and editorial workflow](./studio-native-editorial-workflow.md).
