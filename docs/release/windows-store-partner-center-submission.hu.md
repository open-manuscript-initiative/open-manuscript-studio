# Open Manuscript Studio – Microsoft Store / Partner Center beküldési adatlap

## Állapotfrissítés — 2026. november 10.

A Microsoft kiadónak küldött értesítése szerint az **Open Manuscript Studio beküldését feldolgozták, az alkalmazás a Microsoft Store-ban elérhető**, a megjelenés a felhasználóknak akár két órát is igénybe vehet. Az **IARC Live Rating Notice** visszaigazolja, hogy a november 9-én beküldött kérdőív alapján létrejött besorolások érvénybe léptek. Az értesítés nem tartalmazza a pontos korhatárkategóriát.

A kiadó 2026. november 10-én **Microsoft Store-termékoldalt ábrázoló Windows-képernyőképet** is küldött. A termékoldalon **„Megnyitás”** gomb és **PEGI 3** besorolás látható. Ez igazolja az áruházi láthatóságot és azt, hogy a Store a telepítést felismeri, de a program tényleges elindulását, aláírását és automatikus frissítését még nem bizonyítja.

**Üzemeltetői visszaigazolás, 2026. november 10.:** a kiadó közvetlenül a Microsoft Store-ból telepítette az Open Manuscript Studio alkalmazást Windowsra. Egy tényleges áruházi telepítés tehát igazolt. A kiadó ezt követően **a sikeres indítást és bejelentkezést is megerősítette**. A kiadó ezután arról is beszámolt, hogy egy korábban mentett helyi **`.omi` kézirat megnyitása, szerkesztése, mentése és újbóli megnyitása** hibátlanul működött. A csomagaláírás hiteles ellenőrzése, a Store-alapú frissítés és a frissítés közbeni adatmegőrzés még külön tesztelendő.

**A következő adatlap az eredeti beküldés előkészítésének történeti dokumentuma.** A tényleges Store-csomag verzióját, termék-URL-jét, Microsoft-aláírását, Store-alapú frissítését és adatmegőrzését még külön ellenőrizni kell. A Store jóváhagyása nem jelenti a közvetlen EXE/MSI telepítők aláírását, és nem hagyja jóvá automatikusan a stabil 1.0 kiadást.

**A beküldés előtti állapotot rögzítő, történeti tervezet.** A regisztráció és az alkalmazásnév foglalása megtörtént. Az adatlapokat a tényleges Partner Center mezőihez igazítsd; a jogi és tesztelési nyilatkozatokat csak ellenőrzés után jelöld.

## 1. Csomag és azonosító

| Mező | Érték |
| --- | --- |
| App name | Open Manuscript Studio |
| App type | MSIX or PWA app (**MSIX**, nem MSI/EXE) |
| Identity Name | `VargaIstvn.OpenManuscriptStudio` |
| Publisher | `CN=ED26F194-9F12-45EE-A4BC-C7DCD3A00E83` |
| PublisherDisplayName | `Varga István` |
| Architecture | x64 |
| Store MSIX package version | `1.0.0.0` az első jelölt esetén; négy numerikus mező, az utolsó 0 |
| Existing WiX/MSI version | `1.0.0.1` (változatlan; ez NEM a Store-csomag verziója) |
| Workflow | [Windows MSIX candidates (Microsoft Store)](https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/workflows/windows-msix.yml) |
| GitHub artifact | `omi-studio-windows-msix-store-unsigned` → kicsomagolva `Open-Manuscript-Studio-Windows-x64.msix` |

**Ne töltsd fel a 2026. november 8-i buildet:** annak MSIX-verziója `1.0.0.1`. A verziójavítás merge-elése után **új main-ági Run workflow** kell, a három előre beírt Partner Center-azonosság változtatása nélkül. A workflow által készített, aláíratlan MSIX kizárólag a Partner Center számára készült. A Store sikeres tanúsítás után Microsoft-tanúsítvánnyal aláírja; külön Azure vagy közvetlen tanúsítvány nem szükséges.

A GitHub Actions futásból az artifact ZIP-fájlt töltsd le, majd csomagold ki. A Partner Center **Packages** mezőjébe magát az `.msix` fájlt töltsd fel, ne a GitHub ZIP-et.

## 2. Pricing and availability

- **Pricing:** Free (a Studio nyílt forráskódú, a támogatás önkéntes; ne állíts be automatikus vásárlást).
- **Markets:** ténylegesen kívánt országok, a Microsoft fiók és jogi feltételek szerint; első körben érdemes a kívánt fő célpiacokat ellenőrizni.
- **Device family:** Windows.Desktop, x64; ne jelöld Xboxnak vagy Mobile-nak.
- **Trial:** nem szükséges ingyenes alkalmazásnál.
- **Discoverability:** a Store-ban megtalálható, ha a nyilvános közzététel jóváhagyott; tesztpublikálás esetén külön átgondolandó.

## 3. Properties

- **Category:** Productivity.
- **Website:** https://openmanuscript.org/
- **Privacy policy / software overview:** https://openmanuscript.org/docs/governance/privacy-policy
- **Central Studio's actual server-specific privacy notice:** https://studio.openmanuscript.org/?privacy=1 — ellenőrizd, hogy ténylegesen a kitöltött tájékoztató nyílik-e meg.
- **Support:** https://github.com/open-manuscript-initiative/open-manuscript-studio/issues (projekt hibabejelentés); a kötelező kapcsolattartási mezőkbe a ténylegesen figyelt, jogosult kapcsolati adatokat add meg.
- **Age ratings:** a valós funkciók alapján töltsd ki az IARC kérdőívet; a besorolást a Microsoft állapítja meg, ne jelöld előre igazoltnak.
- **Capabilities:** `runFullTrust` teljes értékű desktop alkalmazáshoz; `openmanuscript:` egyéni protokoll a belépési visszatéréshez. Ne állíts be nem használt eszközcsaládokat/szenzorokat.
- **Accessibility declarations:** kizárólag a ténylegesen teljesített és tesztelt szabványt jelöld.

## 4. Store listing – English (copy-ready)

**Product name**

Open Manuscript Studio

**Short description**

Free, open-source workspace for scholarly writing, structured manuscripts, review and publishing.

**Description**

Open Manuscript Studio is a free, open-source desktop workspace for preparing structured scholarly manuscripts. Write and edit text, manage document structure, notes and references, and prepare files for review and publication.

The editor is built around the Open Manuscript Initiative's portable, open document model. It supports document import and export and optional connections to scholarly publishing platforms such as OJS and OMP.

Documents can be worked on locally, with optional connected workflows where available. Online accounts, cloud services and third-party integrations are used only when the relevant features are selected and configured.

Open Manuscript Studio is free to use. Voluntary support for continued development is welcome but not required.

**Features** (enter as separate Partner Center rows)

- Structured scholarly manuscript editing
- Notes, references and document organisation
- Import, export and portable document formats
- Review and editorial workflows
- Optional OJS and OMP publishing integration
- Local document work with optional online services
- Open-source, multilingual interface

**What's new**

Initial Microsoft Store release candidate for Windows desktop. Includes structured manuscript editing, research and editorial tools, and document import/export workflows.

**Copyright and license**

Copyright © 2026 Open Manuscript Initiative. Licensed under the MIT License. https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/LICENSE

**Search terms** (if Partner Center offers these fields)

scholarly writing; academic publishing; manuscript editor; OJS; OMP; research; structured documents

## 5. Magyar megjelenítés – javaslat

**Rövid leírás**

Ingyenes, nyílt forráskódú munkakörnyezet tudományos kéziratok írásához, szerkesztéséhez, lektorálásához és publikálásához.

**Leírás**

Az Open Manuscript Studio ingyenes, nyílt forráskódú asztali alkalmazás tudományos kéziratok előkészítésére. Támogatja a strukturált szövegszerkesztést, a jegyzeteket, a hivatkozásokat, a dokumentumok importálását és exportálását, valamint a szerkesztőségi munkafolyamatokat.

Az Open Manuscript Initiative nyílt dokumentummodellje segíti a kéziratok hordozhatóságát. A Studio opcionálisan OJS- és OMP-rendszerekhez és más kutatási szolgáltatásokhoz is kapcsolódhat.

Az alapvető szerkesztési feladatokhoz nem szükséges fizetős licenc. A fejlesztés önkéntes támogatással segíthető.

## 6. Képek és tanúsítás

- Legalább **egy valós Windows-alkalmazásképernyőkép** szükséges; ajánlott legalább négy. Asztali méret: legalább 1366 × 768 PNG; képenként max. 50 MB. Valós Studio-felületet mutass, ne promóciós montázst vagy személyes kéziratot.
- Javasolt képek: kéziratszerkesztés; stílusok/tördelés; jegyzetek/hivatkozások; export/publikálás.
- Az alkalmazásikon a csomagban szerepel, a Store-hoz opcionális 300 × 300-as PNG külön is készíthető.
- A Microsoft Store-ban minden szükséges adatlap kitöltése után **Save**. A **Submit for certification** műveletet csak akkor indítsd, ha a csomag feltöltése validált és a Windows x64 valós eszköztesztek elfogadhatók.
- A Windows App Certification Kit vizsgálata és Windows 11 telepítési/indítási, WebView2-, ORCID-protokoll-, fájlmegnyitási, helyi adatmegőrzési és frissítési tesztek továbbra is szükségesek.

Hivatkozások: Microsoft MSIX csomagszabályok, Store submission és Store listing:
https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements
https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/create-app-submission?pivots=store-installer-msix
https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info
https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/screenshots-and-images
