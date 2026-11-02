import type { Capability } from '../model/conformance';

type Details = Pick<Capability, 'prerequisites' | 'limitations'>;
type Translated = Record<string, Details>;

/**
 * UI translations of human-readable Draft limitations. The exported capability
 * statement preserves the original English protocol-facing declaration.
 * Unknown locales fall back to the canonical English description.
 */
const hu: Translated = {
  'studio.collaboration.scoped-policy': {
    prerequisites: ['Hitelesített, aktív kézirattagság', 'Bekapcsolt, egycsomópontos együttműködési szerver', 'Kompatibilis szervermegvalósítás'],
    limitations: ['A föderált jogosultságok, szegmensszintű fordítói szerepek, delegálás és független titoktartási ellenőrzés még nem támogatott.', 'A helyi nyilatkozat nem igazolja a távoli szerver beállításait.'],
  },
  'studio.exchange.office-import': {
    prerequisites: [],
    limitations: ['Csak DOCX/ODT előkészítési és átvételi jelentések; más importútvonalakról nincs mérés.', 'Nem teljes a funkciók ellenőrzése; a veszteségmentesség és a visszaalakíthatóság nincs igazolva.', 'Az eredeti fájl és a jelentés az importpanelben érhető el; kilépés előtt mentse őket.'],
  },
  'studio.exchange.export-reports': {
    prerequisites: [],
    limitations: ['Csak a szokásos exportpanelen; az egyedi sablonok és az integrációs exportok külön folyamatokat használnak.', 'A kimenet megléte és az ellenőrzőösszeghez kötés vizsgált, nem a teljes szemantikai megfelelőség.', 'Az anonim lektorálás számára biztonságos kimenet nincs igazolva.'],
  },
  'studio.extensions.manifest-registry': {
    prerequisites: ['Hitelesített Stúdió-fiók', 'Aktív integrációs nyilvántartás és kompatibilis API v1 manifesztum'],
    limitations: ['A regisztráció csak nyilatkozat; nem futtat bővítménykódot, és nem ad kézirat-hozzáférést.', 'A bővítmények életciklus-kezelése, függőségi gráfja, elosztott esemény-API-ja és független izolációja még nem valósult meg.'],
  },
  'studio.api.integration-extensions': {
    prerequisites: ['Hitelesített szervermunkamenet', 'Kifejezett API-verzióegyeztetés', 'Felhasználóhoz kötött integrációs bővítménynyilvántartás'],
    limitations: ['Csak az integrációs bővítmények API-részhalmaza támogatott; általános OMI objektum-API nincs.', 'A képességek lekérdezése nem jogosít végrehajtásra, írásra, publikálásra vagy lektorálási hozzáférésre.'],
  },
  'studio.capabilities.disclosure': {
    prerequisites: [],
    limitations: ['A Stúdió saját fogalomkészlete, nem jóváhagyott OMI-séma vagy tesztcsomag.', 'Csak modell-önellenőrzés; a telepített API/WebSocket, a formátumok együttműködése és a független ellenőrzés nem tartozik bele.'],
  },
};
const de: Translated = {
  'studio.collaboration.scoped-policy': {
    prerequisites: ['Authentifizierte aktive Manuskriptmitgliedschaft', 'Aktivierter Collaboration-Server auf einem Knoten', 'Kompatible Serverimplementierung'],
    limitations: ['Föderierte Berechtigungen, segmentbezogene Übersetzerrollen, Delegation und unabhängige Vertraulichkeitsprüfung fehlen.', 'Lokale Angaben bestätigen nicht die Konfiguration eines entfernten Servers.'],
  },
  'studio.exchange.office-import': {
    prerequisites: [],
    limitations: ['Nur DOCX-/ODT-Importkandidaten und Übernahmeberichte; andere Importwege werden nicht geprüft.', 'Die Funktionsprüfung ist unvollständig; kein Nachweis für Verlustfreiheit oder Rückkonvertierung.', 'Original und Bericht sind nur im Importfenster verfügbar; vor dem Verlassen speichern.'],
  },
  'studio.exchange.export-reports': {
    prerequisites: [],
    limitations: ['Nur Standardexport; benutzerdefinierte Vorlagen und Integrationsexporte haben getrennte Abläufe.', 'Nur Ausgabeverfügbarkeit und Prüfsummenbindung; keine vollständige semantische Validierung.', 'Keine bestätigte sichere Ausgabe für anonyme Begutachtung.'],
  },
  'studio.extensions.manifest-registry': {
    prerequisites: ['Authentifiziertes Studio-Konto', 'Aktive Registratur und kompatibles API-v1-Manifest'],
    limitations: ['Registrierung ist deklarativ; sie führt keinen Plug-in-Code aus und gewährt keinen Manuskriptzugriff.', 'Plug-in-Lebenszyklus, Abhängigkeitsgraph, verteilte Ereignis-API und unabhängige Isolation sind nicht implementiert.'],
  },
  'studio.api.integration-extensions': {
    prerequisites: ['Authentifizierte Serversitzung', 'Explizite API-Versionsvereinbarung', 'Benutzergebundene Integrationserweiterungs-Registratur'],
    limitations: ['Nur die API-Teilmenge für Integrationserweiterungen; keine allgemeine OMI-Objekt-API.', 'Die Erkennung berechtigt weder zur Ausführung noch zum Schreiben, Veröffentlichen oder Zugriff auf Begutachtungen.'],
  },
  'studio.capabilities.disclosure': {
    prerequisites: [],
    limitations: ['Studio-eigene Begriffe, kein genehmigtes OMI-Schema oder Prüfverfahren.', 'Nur Modell-Selbstbewertung; bereitgestellte API/WebSocket, Formatinteroperabilität und unabhängige Prüfung bleiben ungeprüft.'],
  },
};
export function translatedCapabilityDetails(locale: string, capability: Capability): Details {
  const language = locale.split('-')[0]?.toLowerCase();
  const translated = language === 'hu' ? hu[capability.id] : language === 'de' ? de[capability.id] : undefined;
  if (!translated ||
      translated.prerequisites.length !== capability.prerequisites.length ||
      translated.limitations.length !== capability.limitations.length) return capability;
  return translated;
}
