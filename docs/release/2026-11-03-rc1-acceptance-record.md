# OMI Studio 1.0 — RC1 végső elfogadási és GO/NO-GO jegyzőkönyv

> Historical worksheet. For the 7 November OJS/OMP -4/-5/-6 matrix and the current 14-gate receipt, follow [current acceptance](2026-11-04-rc1-final-acceptance.md) and [ADR-033](../architecture/adr-033-pkp-support-and-release-evidence.md). This notice does not change any historical observation or approval.


> **Állapot: ELŐKÉSZÍTETT / NO-GO — nem kiadási engedély.**  
> Ellenőrzés napja: **2026-11-03** (Europe/Budapest).  
> Kiadási cél: `v1.0.0-rc.1`.  
> Ellenőrzött GitHub-`main` pillanatkép: `76eb11fac62881dd4a917e1f44c5fe4193ade8c3` (#844 utáni főág).  
> **Végleges RC-jelölt SHA:** még nincs jóváhagyva. Az itt megadott pillanatkép **nem** automatikusan a kiadási jelölt.  
> **Kiadás, tag, aláírt csomag és tulajdonosi GO-döntés:** ebben a jegyzőkönyvben **nincs jóváhagyva**.

Ez a dokumentum a [#390 Route A stabilizálási feladat](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390) dátumhoz kötött **technikai bizonyíték- és elfogadási nyilvántartása**. A már igazolt próbákat felhasználja, nem ír elő indokolatlan teljes ismétlést. Nem helyettesíti a [kötelező blokkolópolitikát](./1.0-blocker-policy.md), az [E02 pontos commitú bizonyítékot](./rc-e02-evidence.md) és a [gépi RC-elfogadási bizonylatot](./rc-evidence.md).

## 1. Rögzített döntési keret

| Megnevezés | Megállapítás |
| --- | --- |
| Pillanatnyi döntés | **NO-GO**, amíg az alábbi kötelező feltételek nem teljesülnek |
| Bizonyíték kategóriája | GitHub-PR/CI, helyszíni üzemeltetői terminálmegfigyelés, fizikai klienspróba, kiadási tulajdonosi nyilatkozat |
| Stable célok (Route A) | Web; Windows 11 x86-64; Ubuntu 22.04/24.04 x86-64; Android 10+; OJS 3.5.0-4 és 3.5.0-5 |
| Preview | OMP 3.5.x és macOS csomagok |
| Experimental | iOS/iPadOS |
| Üzemeltetői elfogadás | Csak a jelölt **azonos SHA-jához**, buildjéhez és a kapcsolódó ellenőrzött bizonyítékhoz kötve érvényes |
| Adatvédelem | Valódi kézirat, cím, fájlútvonal, tartalom, titok, hozzáférési token és privát mérési napló nem kerül a nyilvános PR-be/CI-be |

**Állapotszabály:** egy sikeres technikai próba nem egyenlő a `RC_MANUAL_GATES` egyik `pass` bejegyzésével. Hiányzó bizonyíték = **PENDING**, nem `pass`; futó / queued / skipped workflow = **nem sikeres bizonyíték**. A döntés csak azonos commitra és valódi jóváhagyásra alapozható.

## 2. Újrahasznosítható bizonyítékok — ellenőrzött eredmények

| Terület | Már dokumentált eredmény | Korlát és bizonyíték |
| --- | --- | --- |
| Windows és Android kezelői próba | **63 perc**, 2026-11-03, 13:02–14:05 CET; a vizsgált funkciók rendben. Egy ~55 másodperces validáció állapotjelzése hiányzott; az azt kezelő [#838](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/838) beolvadt. | [#390 tulajdonosi megfigyelés](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390#issuecomment-6604998297). A kézi próba megelőzte a későbbi kódváltozásokat; nem bizonyít önmagában teljes *azonos SHA-jú* eszköz-elfogadást. |
| API üzem és cgroup | API-cgroup egyezése, aktív szolgáltatás, ingress/egress BPF csatolás, helyi és nyilvános `/api/health` HTTP 200. | [#765 BPF-megfigyelés](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6607661842). A BPF jelenléte önmagában nem bizonyít minden éles kapcsolati tiltást. |
| DNS-rebinding és SSRF forrásvédelem | Nyolc forrásregressziós próba: **8 sikeres / 0 hibás**; címellenőrzés és connection-pinned transport. | [#765 regressziós eredmény](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6608027104). Szimulált DNS és kódút, nem önálló élő end-to-end teszt. |
| #765 izolált hálózati próba | Külön systemd-cgroupban **BASELINE PASS + FILTERED PASS**. Az elérhető szintetikus RFC1918/link-local IPv4 és ULA IPv6 célokat a második, az API szabályait használó cgroup elutasította; localhost v4/v6 működött. | [#765 üzemeltetői bizonyíték](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6611443455). **Nem** magában az éles API-cgroupban végrehajtott negatív próba; nem bizonyít minden konténer-/DNS-átirányítási változatot. |
| #774 worker izoláció és alapműködés | Nem root worker, külön Unix-socket és cgroup, OS erőforráskorlátok; szintetikus PDF render/import, forrás-tesztek, telepített modulok összevetése korábban igazolt. | [#774 munkaszál](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774), [host elfogadási eljárás](../server/765-774-live-host-acceptance.md). A konfigurációs vizsgálat és a mintafeldolgozás nem teljes terheléses/security audit. |
| #774 időtúllépés és helyreállítás | Telepített PDF-subprocess modul külön worker-UID systemd-egységben: mesterséges szülő- és gyermekfolyamat lezárása **PASS**, következő feladat **PASS**. | [#774 terminálmegfigyelés](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774#issuecomment-6611480403). Nem az éles worker kényszerleállítása. |
| #774 API fail-closed | A külön staging API valódi fordított útvonala + AF_UNIX transport, szintetikus worker: hiányzó worker **503**, visszatérő **200**, kieső **503**, újrainduló **200**; a vizsgálat **1/1 PASS**, `0 failed`. Nem történt éles szolgáltatásleállítás. | [#774 staging megfigyelés](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774#issuecomment-6612835626); forrás #843 `c5c153e0bbb78c2c96b62b1d88e1756811cc3f60`, külön indító #844 `76eb11fac62881dd4a917e1f44c5fe4193ade8c3`. Nem tesztelte az éles worker kiesését, valódi hitelesítést/adatbázist vagy teljes Vivliostyle renderelést. |
| PDF-végtermék vizuális megítélése | Korábbi tényleges PDF-exportot az üzemeltető elfogadott; build-provenance sidecar is keletkezett. | [#390 PDF-próba](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390#issuecomment-6559258434). A mostani RC-csomaghoz kapcsolódó aláírt build bizonyítéka külön szükséges. |

**#774 státuszeltérés:** a [#774](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774) 2026-11-03-án lezárult (completed), de továbbra is `release-blocker` és `manual-test` címkéket hordoz. A lezárás **nem** állít elő `host-pdf-sandbox` RC-bizonylatot. Az üzemeltetőnek ki kell mondania, mely fennmaradó feltételeket fogadja el, és az RC-bizonyítékot a kijelölt SHA-hoz kell kötnie. Nyitott/lezárt hibajegy állapotából nem következtetünk automatikus GO-ra.

## 3. Jelenleg hiányzó kötelező döntések

### A. #765 — nyitott kiadásblokkoló

A [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765) **OPEN, `release-blocker` + `manual-test`**. Szükséges a tényleges API-folyamathoz/környezethez kapcsolt negatív IPv4/IPv6, metadata/loopback, redirect/rebinding és engedélyezett pozitív OJS/OMP/OIDC/WebDAV/cloud/proxy/integrációs útvonalak **tartalommentes, üzemeltetői elfogadása**. A már sikeres izolált canary-t nem kell újrafuttatni; a hiányzó *élő környezeti hatókört* kell igazolni, kontrollált és engedélyezett módon. A `host-egress` gate: **PENDING**.

### B. #774 — lezárt ticket, még szükséges RC-bizonyíték

A kijelölt RC SHA és a deployed module hashes, a korábbi host/worker-eredmények, a staging fail-closed teszt és a maradék korlátok/üzemeltetői elfogadás összekapcsolása a `host-pdf-sandbox` gate-ben: **PENDING**. Ha a kiadási tulajdonos az OS sandbox, globális kvóták, extrém PDF méret vagy folyamatfa-izoláció valamely korábbi hiányosságát a Stable scope-ban kötelezőnek ítéli, azt fel kell oldani vagy a kiadást visszatartani; a jelen jegyzőkönyv nem ad felmentést.

### C. #271 — Linux GLib tanúsítható kivétel vagy célmódosítás

A [#271](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271) nyitott `external-dependency`. A legutóbbi rögzített Linux GTK3/Tauri láncban `glib 0.18.5` szerepel; a figyelmeztetés **nem javított**. Az [1.0 blocker policy](./1.0-blocker-policy.md) szerint kivételhez **mind az öt** kell: nincs kompatibilis javított kiadás; nincs ismert elérhető alkalmazásút; enyhítések be vannak kapcsolva; megnevezett felelős + következő felülvizsgálat dátuma; nyilvános támogatási korlát egyértelmű közlése. Ha bármelyik hiányzik, a Linux Stable megjelölését el kell halasztani vagy átminősíteni **külön tulajdonosi döntéssel**. Sem automatizmus, sem ez a dokumentum nem jelölheti a sérülékenységet megoldottnak.

### D. Build, platform és publikálási követelmények

- Pontos RC main SHA kijelölése, feature freeze, aláírt és ellenőrzött Windows/Android/Linux artifactok, fájlonkénti SHA-256, SBOM, signed update és **tényleges rollback** megfigyelés.
- Kijelölt Windows build/CPU dokumentálása; fizikai Windows, Android és Linux elfogadás a jelölt csomagokra, a már dokumentált, sikeres próba **delta-ellenőrzésével**, nem az összes korábbi teszt újraindításával.
- OJS 3.5.0-4 és 3.5.0-5 **külön** Stable acceptance; pontos külső plugin-commitok/felhatalmazás, anonim bírálati adatvédelem és publikációs provenance.
- Akadálymentesség, kéziratmegőrzés, mentés–újranyitás, lábjegyzet, médiák, hivatkozások és publikációs kimenetek ellenőrzött, dátumozott és tartalommentes elfogadása.
- GitHub branch protection és a publikus kiadási scope döntésének dokumentálása.
- A próbaidőszak **2–4 hét**, a 2026-11-09 – 2026-12-06 dátum jelenleg **csak előzetes terv**, automatikus indulás nincs.

## 4. Az RC-bizonylat mind a 13 manuális kapuja

A `scripts/rc-evidence.mjs` fájl `RC_MANUAL_GATES` listája az irányadó. **Jelenleg egyetlen alábbi sor sem állítható ki `pass` állapotban az itt megjelölt, még nem jóváhagyott RC SHA-ra.** A meglévő megfigyelések továbbra is felhasználható részleges bizonyítékok.

| Kapu azonosítója | Meglévő kiinduló bizonyíték | RC státusz / következő bizonyítás |
| --- | --- | --- |
| `host-egress` | #765 BPF + 8/8 DNS regresszió + elkülönített v4/v6 PASS | **BLOCKED** — #765 tényleges API és pozitív provider elfogadás |
| `host-pdf-sandbox` | #774 sandbox, parent/grandchild, fail-closed staging PASS | **PENDING** — pontos SHA/deploy és tulajdonosi aláírás |
| `private-manuscript-preservation` | 2026-11-03 helyi Windows/Android teszt, PDF elfogadás | **PENDING** — pontos RC-részek, redaktált delta-bizonylat |
| `windows-device` | Helyszíni 63 perces próba része | **PENDING** — jelölt build, telepítés/aláírt frissítés/rollback |
| `linux-device` | Linux build/worker infrastruktúra és automatikus tesztek | **PENDING** — natív kliens, Linux scope és #271 döntés |
| `android-device` | Helyszíni próba, korábbi Play teszt | **PENDING** — azonos build/versionCode és signed update/rollback |
| `ojs-3.5.0-4` | Korábbi OJS integrációs és működési bizonyítékok | **PENDING** — jelölt SHA, jogosultság és OJS-verzióhoz kötött bizonyíték |
| `ojs-3.5.0-5` | Korábbi integrációs tesztrendszer | **PENDING** — külön pontos verziós elfogadás |
| `security-review` | CodeQL, #765/#774 vizsgálatok és kontrollok | **PENDING** — összes érvényes alert, blokkoló, #271 kivétel |
| `accessibility` | Korábbi regressziók | **PENDING** — jelölt buildre elfogadott platformteszt |
| `performance` | Nagy kézirat optimalizálás, validáció láthatósága #838 | **PENDING** — elfogadott jelölt mérések/korlátok |
| `recovery` | PDF subprocess és stage API helyreállítás PASS | **PENDING** — tartalommegőrző frissítés/rollback és storage recovery |
| `owner-go-no-go` | Nincs felhatalmazás; #390 nyitott | **NO-GO** — minden kapu és aláírt tulajdonosi döntés után |

A gépi végső `omi-studio-rc-evidence` JSON-ban mind a 13 gate-hez ugyanaz a **jóváhagyott 40 karakteres sourceSha**, valódi `observedAt`, HTTPS `evidenceRef`, és csak tényleges döntés után `status: "pass"` tartozhat. A JSON-t **nem** generáljuk előre hamis `pass` sorokkal.

## 5. Kiadási workflow-ellenőrzés — exact SHA / E02

A 2026-11-03-án vizsgált `76eb11fac62881dd4a917e1f44c5fe4193ade8c3` `main` commiton:

| GitHub workflow | Lekérdezéskor |
| --- | --- |
| `OMI-SPEC-320 conformance` | **SUCCESS** |
| `1.0 Readiness` | **SUCCESS, de nem bizonyított strict RC approval** |
| `CodeQL` | **SUCCESS** |
| `OMI Studio CI/CD` | **IN PROGRESS** |
| `Tauri Builds and Releases` | **QUEUED** |
| `PKP integration environment` | Ezen a SHA-n **nem azonosított, teljes sikerű run** az ellenőrzött listában; E02-vizsgálat szükséges |

**Mindegyik nem kész / hiányzó workflow jelenleg NEM PASS.** A `1.0 Readiness` normál zöld futása nem helyettesíti a `--strict-release` manuális kaput. A végleges RC-kijelölés **után** az [E02](./rc-e02-evidence.md) gyűjtővel azonos commiton ellenőrizni kell az összes workflow-t és kötelező Windows/Linux/macOS/Android build-jobot, a PKP mátrixot, a legfrissebb futásokat és az artifact archívumok SHA-256 hashét. A natív binárisok valódi fájlhashét, aláírását, telepítését külön kell igazolni.

**Címke előtt** a strict release gate-ben nem maradhat nyitott `release-blocker`, és a [blokkolópolitika](./1.0-blocker-policy.md) szerinti RC-kötelezettségeket sem szabad megkerülni. **Külön feloldandó adminisztratív ellentmondás:** a #390 tracker `rc-required` címkés, miközben maga tartalmazza az RC *utáni* feladatokat is. A kiadási tulajdonos dokumentáltan válassza szét az RC-előfeltételeket és az RC-utáni megfigyelést (külön issue vagy indokolt címke-/scope-módosítás); nem változtatunk címkét automatikusan csak a gate átengedéséért.

## 6. Kiadási döntés — nem kitöltendő sikernek álcázott sablon

| Döntési elem | Jelenlegi érték |
| --- | --- |
| RC jelölt SHA | **NINCS KIJELÖLVE** |
| Jóváhagyott native build run ID | **NINCS RÖGZÍTVE** |
| Release artifact SHA-256 és signature | **NINCS ELFOGADVA** |
| Strict RC / E02 exact SHA | **NINCS TELJESÍTETT JÓVÁHAGYÁS** |
| #765 / `host-egress` | **NYITOTT / NEM ELFOGADOTT** |
| #774 / `host-pdf-sandbox` | **Technikai próbák jók; tulajdonosi gate nincs jóváhagyva** |
| #271 Linux upstream kivétel | **NINCS ALÁÍRT KIVÉTEL / SCOPE DÖNTÉS** |
| Signed update + rollback | **NINCS CANDIDATE-SPECIFIKUS IGAZOLÁS** |
| Owner nyilatkozat (felelős, UTC időpont, végső artifact-ref) | **MÉG NEM KÉSZÜLT EL** |
| **RC döntés** | **NO-GO** |

### Csak az alábbiak után változtatható GO-ra

1. Egyetlen immutábilis, jóváhagyott main-SHA és azonos SHA-jú, aláírt native artifact-digests/build run.
2. Az összes kötelező exact-commit CI, PKP, Tauri, CodeQL, SPEC-320, Readiness, E02 és **strict-release** sikeres, nem pending/skipped.
3. A #765 és valamennyi kötelező release-blokkoló érdemben megoldott; #774 valódi host elfogadása a korábbi bizonyítékokhoz kötve.
4. #271 szabályos, nyilvános és időhatáros Linux-kivételi döntés **vagy** módosított Stable-scope.
5. Tényleges Windows/Android/Linux eszköz-, aláírt update/rollback-, OJS mindkét verzió-, akadálymentesség-, megőrzés-, teljesítmény- és recovery-elfogadás, amennyiben nincs már azonos SHA-jú elfogadott bizonyíték.
6. Mind a 13 `RC_MANUAL_GATES` kapu dokumentált, pontos SHA-ra kötött, hiteles megfigyeléssel és tulajdonosi jóváhagyással ellátott; nincs nyitott ütközés a `rc-required` policyval.
7. Külön emberi **GO** döntés után, a dokumentált manuális kiadási workflow `APPROVE_1_0_RELEASE` jóváhagyásával kezdhető tag/publikáció. Előtte nincs RC-tag, release, installercsere vagy honlapon GA/Stable állítás.

**A hiányzó kötelező feladatok műveleti csomagja:** [#765 cgroup-hatókör, #271 Linux GLib-döntés, #390 aláírt frissítés és rollback](./2026-11-03-rc1-final-operator-actions.md). A kapcsolódó 2026-11-03-i eredmények elfogadható részleges bizonyítékok, nem automatikus `pass`/GO. A dokumentum naplózott pillanatképét nem írjuk át újabb GH Actions állapotokra.

## 7. Aláírandó döntési rekord — kitöltés nélkül

- **Kiadási jelölt / main SHA:** `[jóváhagyandó]`
- **Natív build run ID és per-file hash manifest:** `[jóváhagyandó]`
- **E02 / strict-release és elfogadási JSON hivatkozás:** `[jóváhagyandó]`
- **Host-egress és host-pdf-sandbox elfogadó / időpont / korlát:** `[jóváhagyandó]`
- **GLib kockázati kivétel vagy Linux scope módosítás; felelős és felülvizsgálati dátum:** `[jóváhagyandó]`
- **Signed update/rollback bizonyíték:** `[jóváhagyandó]`
- **Elfogadó kiadási tulajdonos és UTC döntési idő:** `[jóváhagyandó]`
- **Döntés:** **NO-GO / NINCS ALÁÍRVA**

Az RC1 közzétételét követően indulhat a külön, tervezett **2–4 hetes RC-megfigyelés**. A stabil `v1.0.0` önálló későbbi GO/NO-GO döntést igényel.

---

**Kapcsolódó nyilvántartások:** [#390](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390), [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765), [#774](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774), [#271](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271), [RC-bizonylat](./rc-evidence.md), [E02](./rc-e02-evidence.md), [1.0 Route A hatókör](./1.0-scope.md).  
**E jegyzőkönyv nem végez módosítást az éles szerveren és nem szolgál címkézésre alkalmas automatikus jóváhagyásként.**
