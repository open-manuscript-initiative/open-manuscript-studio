# Rendszergazdai súgó – saját szerveres telepítés

Ez az útmutató az Open Manuscript Studio webes kiadásának üzemeltetéséhez készült. A telepítő Docker Compose-t, az API-t és a webes felületet indítja el; az adatokat két PostgreSQL-adatbázis tárolja. A meglévő VPS-es kiadási folyamat ettől külön marad.

## Milyen rendszeren fut?

| Környezet | Telepítési mód |
| --- | --- |
| Linux szerver | Docker Engine és Docker Compose plugin, közvetlenül a szerveren |
| Windows Server 2022/2025 | Ubuntu Server virtuális gép Hyper-V alatt; a Compose csomag a virtuális gépen fut |
| Windows 10/11 tesztelésre | Docker Desktop Linux konténerekkel |

A Windows Serverre szánt alkalmazás Linux konténerekből áll. Windows Serveren ne a Windows konténeres Docker Engine-t használd ehhez. A Hyper-V virtuális géphez rendelj állandó IP-címet vagy DHCP-foglalást. Windows 10/11-en a Docker Desktop fejlesztési és kipróbálási célra használható.

## Előfeltételek és hálózat

- Egy telepített Linux szerver vagy Ubuntu Server virtuális gép.
- Docker Engine és a `docker compose` plugin. Az `install.sh` meglétüket ellenőrzi.
- Nyilvános telepítéshez saját DNS-név és TLS-t biztosító fordított proxy (például a már használt Nginx, Caddy vagy Traefik).
- A `PUBLIC_ORIGIN` pontosan egyezzen a böngészőben használt címmel: séma, domain és szükség esetén port, záró perjel nélkül.
- Az adatbázis, az API és a webes konténer belső hálózaton kommunikál. Kifelé csak a fordított proxy HTTPS-portját tedd elérhetővé.

A Studio HTTP portja alapértelmezés szerint `127.0.0.1:8080`-on figyel. Linuxon a fordított proxy innen érje el. A `3001`, `3022` és `5432` portot ne tedd közzé a nyilvános hálózaton.

## Linux telepítése

1. Töltsd le vagy klónozd a teljes Studio forráskód-repozitóriumot. A Docker-képek ebből a forrásból épülnek; csak a `deployment/` könyvtár önmagában nem elég.
2. Menj a telepítő könyvtárába:

   ```sh
   cd open-manuscript-studio/deployment
   ```

3. Másold le a mintakörnyezetet, és állítsd be a saját publikus címedet. Példa:

   ```sh
   cp .env.example .env
   ```

   A `.env` fájlban állítsd a `PUBLIC_ORIGIN` értékét például `https://studio.sajatdomain.hu`-ra. Fordított proxy mögött hagyd a `STUDIO_BIND_ADDRESS=127.0.0.1` értéket. A telepítő véletlenszerű adatbázis-jelszót és integrációs titkosítási kulcsot készít, ha még a mintaértékek szerepelnek.

4. Indítsd el a telepítőt:

   ```sh
   ./install.sh
   ```

   A szkript létrehozza a `deployment/.env` fájlt, beállítja a jogosultságokat, elkészíti az SMTP konfiguráció mintáját, majd felépíti és elindítja a konténereket. Első indításkor szerkeszd a `msmtprc` fájlt valódi levelezési adatokkal; SMTP nélkül a meghívó- és jelszó-visszaállító e-mailek nem működnek.

5. A fordított proxyban a Studio háttércíme legyen `http://127.0.0.1:8080`. A proxy továbbítsa a `Host` fejlécet, állítsa be a `X-Forwarded-Proto: https` fejlécet, és engedje a WebSocket kapcsolatot. A TLS-t a proxy végzi; a Compose csomag nem állít ki tanúsítványt.
6. Nyisd meg a `PUBLIC_ORIGIN` szerinti HTTPS-címet, és végezd el az ellenőrzőlistát.

### SMTP beállítása

Szerkeszd a `deployment/msmtprc` fájlt a szolgáltatód SMTP-szerverének adataival. A fájl jelszót tartalmaz, ezért ne kerüljön Gitbe vagy nyilvános mentésbe. A konténer nem privilegizált `node` felhasználója (UID 1000) olvassa:

```sh
chmod 600 msmtprc
sudo chown 1000:1000 msmtprc
docker compose -f compose.yml restart api
```

Az e-mailes meghívást és jelszó-visszaállítást csak egy tesztlevél sikeres kézbesítése után tekintsd működőnek.

## Windows Server telepítése Hyper-V-vel

1. Hozz létre egy Ubuntu Server virtuális gépet Hyper-V-ben, és adj neki állandó IP-címet vagy DHCP-foglalást.
2. Telepíts Docker Engine-t és Compose plugint a Linux vendégrendszerre. A Studio telepítése a VM-en ugyanazokat a Linuxos lépéseket használja, mint a fenti szakasz.
3. A VM `deployment/.env` fájljában állítsd be:

   ```dotenv
   STUDIO_BIND_ADDRESS=0.0.0.0
   STUDIO_HTTP_PORT=8080
   PUBLIC_ORIGIN=https://studio.sajatdomain.hu
   ```

4. Engedélyezd a `8080/tcp` portot a VM tűzfalán, de forrásként korlátozd a Windows-gépre vagy az upstream fordított proxy címére. Ne engedd elérni az egész internetről.
5. A Windows-gépen vagy külön proxy gépen futó fordított proxy a VM `8080`-as portjára továbbítson, TLS-sel. Ha Windows-gépen állítod be a proxyt, annak Linux VM hálózati címét használd háttércímként.
6. Ellenőrizd, hogy a domain DNS-rekordja a TLS-proxy nyilvános címére mutat. A böngészőben a publikus HTTPS-címet nyisd meg, ne a VM HTTP-portját.

A Docker Desktop Windows Serveren nem támogatott futtatási mód ehhez a csomaghoz.

## Első indítás utáni ellenőrzés

A deployment könyvtárban futtasd:

```sh
docker compose -f compose.yml ps
docker compose -f compose.yml logs --tail=100 api
docker compose -f compose.yml logs --tail=100 web
docker compose -f compose.yml exec postgres pg_isready -U omi_studio -d omi_studio
```

Ellenőrizd böngészőből és a saját munkafolyamatoddal:

- Betölt-e a webes felület a publikus HTTPS-címen.
- Eléri-e az API-t; az API egészségvégpontja `/api/health`.
- Kézbesül-e egy meghívó vagy jelszó-visszaállító e-mail az SMTP beállítása után.
- Működik-e a kollaborációs WebSocket, ha a valós idejű együttműködés engedélyezett.
- Működnek-e a külső szolgáltatások, ha az opcionális OJS/OMP, identitás, ORCID, felhőtárhely vagy katalógus integrációk be vannak állítva.

Az opcionális szolgáltatások környezeti változóit a `server/.env.example` dokumentálja. A hitelesítési adatok a szerver saját `deployment/.env` fájljába kerüljenek; ne commitold őket.

## Mentés és visszaállítás

Frissítés előtt, valamint rendszeres időközönként készíts mentést mindkét adatbázisról:

```sh
docker compose -f compose.yml exec -T postgres pg_dump -U omi_studio -d omi_studio --format=custom > omi_studio.dump
docker compose -f compose.yml exec -T postgres pg_dump -U omi_studio -d omi_identity --format=custom > omi_identity.dump
```

A `.env` fájlt és a mentéseket a szervertől elkülönített, hozzáférés-védett helyen tárold. A `INTEGRATION_MASTER_KEY` nélkül a korábban elmentett külső szolgáltatási hitelesítő adatok nem fejthetők vissza. A `msmtprc` is titkot tartalmazhat.

A visszaállítás előtt állítsd le az API-t és a webet, majd csak megfelelően előkészített adatbázisokba töltsd vissza a mentést. A visszaállítási parancsokat és a teljes példát a [telepítési README](README.md#backup-and-restore) tartalmazza. Rendszeres karbantartás részeként próbálj ki egy visszaállítást külön tesztkörnyezetben.

## Frissítés

1. Készíts adatbázis- és konfigurációmentést.
2. Válts a kívánt, ellenőrzött Studio kiadás forrására; tartsd meg a meglévő `.env`, `msmtprc` és PostgreSQL adatokat.
3. A `deployment/` könyvtárból építsd újra és indítsd el a szolgáltatásokat:

   ```sh
   docker compose -f compose.yml up --build -d
   docker compose -f compose.yml ps
   ```

Az API az indulás során futtatja az adatbázis-migrációkat. Egy időben csak egy API-példányt futtass. Ha az új verzió ellenőrzése hibát mutat, nézd át az API naplóját, és a mentésből állítsd vissza az adatbázist a verzió visszaállításával összehangoltan.

## Hibaelhárítás

| Jelenség | Ellenőrzés |
| --- | --- |
| A weboldal nem érhető el | `docker compose ps`; ellenőrizd a portot, DNS-t, proxy célcímét és a tűzfalat |
| A proxy 502-t ad | `docker compose logs --tail=100 api web`; az API lehet, hogy még migrál vagy nem egészséges |
| Bejelentkezési vagy CORS hiba | A `PUBLIC_ORIGIN` pontosan egyezzen a böngésző HTTPS-címével; változtatás után építsd újra a web konténert |
| Nem érkezik e-mail | Ellenőrizd a `msmtprc` host, port, TLS, felhasználó és feladó értékeit, majd a fájl jogosultságát és az API naplóját |
| WebSocketes együttműködés nem csatlakozik | A fordított proxyn engedélyezd a WebSocket upgrade-et; a domain és a `PUBLIC_ORIGIN` egyezzen |
| Windows Serverről nem érhető el a VM | Ellenőrizd a VM stabil IP-címét, a `STUDIO_BIND_ADDRESS=0.0.0.0` beállítást, valamint a VM tűzfalának proxyra korlátozott szabályát |

Hasznos naplók:

```sh
docker compose -f compose.yml logs --tail=200 api
docker compose -f compose.yml logs --tail=200 web
docker compose -f compose.yml logs --tail=100 postgres
```

## A telepítés hatóköre

Ez a csomag a saját szerveren futó webes felületet és API-t biztosítja. A natív asztali és mobil kliensek a bejelentkezési képernyőn vagy a Fiók beállításaiban választhatnak saját Studio-szervert. Csak a szerver alapcímét adja meg (például https://studio.pelda.hu), HTTPS használatával. Szerverváltáskor a kliens kijelentkeztet az előző szerverről, és törli annak helyi munkamenet-tokenjét; a szervereken tárolt adatok változatlanok maradnak.
