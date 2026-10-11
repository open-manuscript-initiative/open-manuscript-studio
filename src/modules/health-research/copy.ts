export const healthFieldLabels: Record<string, Record<string, string>> = {
  "title": {
    "hu": "Kutatás címe",
    "en": "Study title",
    "de": "Studientitel"
  },
  "question": {
    "hu": "Kutatási kérdés és terv",
    "en": "Research question and design",
    "de": "Forschungsfrage und Design"
  },
  "registration": {
    "hu": "Előzetes regisztráció / protokollazonosító",
    "en": "Preregistration / protocol identifier",
    "de": "Präregistrierung / Protokollkennung"
  },
  "population": {
    "hu": "Célpopuláció és beválasztási szabályok",
    "en": "Population and eligibility criteria",
    "de": "Population und Einschlusskriterien"
  },
  "method": {
    "hu": "Módszertan és mintavétel",
    "en": "Methods and sampling",
    "de": "Methoden und Stichprobe"
  },
  "analysis": {
    "hu": "Elemzési terv / statisztikai munkatér hivatkozása",
    "en": "Analysis plan / statistics workspace reference",
    "de": "Analyseplan / Verweis auf Statistikarbeitsbereich"
  },
  "ethics": {
    "hu": "Etikai engedély és bizottság",
    "en": "Ethics approval and committee",
    "de": "Ethikvotum und Kommission"
  },
  "consent": {
    "hu": "Beleegyezés és publikálási engedély",
    "en": "Consent and publication permission",
    "de": "Einwilligung und Veröffentlichungserlaubnis"
  },
  "sharing": {
    "hu": "Adatmegosztási és hozzáférési nyilatkozat",
    "en": "Data sharing and access statement",
    "de": "Erklärung zur Datenfreigabe"
  },
  "publicSummary": {
    "hu": "Megosztható, anonimizált módszertani összefoglaló",
    "en": "Shareable anonymized methods summary",
    "de": "Freigabefähige anonymisierte Methodenzusammenfassung"
  },
  "source": {
    "hu": "Összefoglaló forrása / protokollhivatkozás",
    "en": "Summary source / protocol reference",
    "de": "Quelle der Zusammenfassung / Protokollverweis"
  },
  "instrument": {
    "hu": "Mérőeszköz, verzió és nyelv",
    "en": "Instrument, version and language",
    "de": "Messinstrument, Version und Sprache"
  },
  "rights": {
    "hu": "Mérőeszköz forrása és felhasználási jog",
    "en": "Instrument source and usage rights",
    "de": "Instrumentquelle und Nutzungsrechte"
  },
  "scoring": {
    "hu": "Pontozás, fordított tételek és hiányzó válaszok szabályai",
    "en": "Scoring, reversed items and missing response rules",
    "de": "Auswertung, umgepolte Items und fehlende Antworten"
  },
  "psychometrics": {
    "hu": "Pszichometriai eredmények és becslési módszer",
    "en": "Psychometric results and estimation method",
    "de": "Psychometrische Ergebnisse und Schätzmethode"
  },
  "studyType": {
    "hu": "Vizsgálat típusa / esetismertetés",
    "en": "Study type / case report",
    "de": "Studientyp / Fallbericht"
  },
  "intervention": {
    "hu": "Beavatkozás, összehasonlítás és követés",
    "en": "Intervention, comparator and follow-up",
    "de": "Intervention, Vergleich und Nachbeobachtung"
  },
  "endpoints": {
    "hu": "Elsődleges és másodlagos végpontok",
    "en": "Primary and secondary endpoints",
    "de": "Primäre und sekundäre Endpunkte"
  },
  "outcomes": {
    "hu": "Összesített eredmények és nemkívánatos események",
    "en": "Aggregate outcomes and adverse events",
    "de": "Aggregierte Ergebnisse und unerwünschte Ereignisse"
  }
};
export const healthCopy = {
 hu: { psychology: 'Pszichológia', 'medical-sciences': 'Orvostudomány és egészségtudomány', export: 'Munkatér exportálása JSON-ként', notice: 'Csak anonimizált vagy összesített kutatási leírást tároljon. Ez a munkatér a böngésző helyi tárhelyére ment, nem védett betegnyilvántartás. Ne adjon meg nevet, elérhetőséget, betegazonosítót vagy azonosítható esettörténetet.', shared: 'A meglévő Statisztikai elemzés modulban készíthet elemzést és kísérlettervet; annak hivatkozását itt rögzítse. A pontozási mező szabályleírás, nem automatikus skálakiértékelés.', projection: 'A Beszúrás menü kizárólag a külön megosztható összefoglalót ajánlja fel. Forrás és előnézet-jóváhagyás szükséges. Ellenőrizze kézzel az anonimitást; ez nem automatikus anonimizáló vagy diagnosztikai eszköz.' },
 en: { psychology: 'Psychology', 'medical-sciences': 'Medical and Health Sciences', export: 'Export workspace as JSON', notice: 'Store only anonymized or aggregate research descriptions. This workspace saves to browser local storage; it is not a protected patient record system. Do not enter names, contact details, patient identifiers or identifiable case histories.', shared: 'Use the existing Statistical Analysis module for analyses and experimental design, and record its reference here. Scoring fields describe rules; they do not automatically score instruments.', projection: 'Insert offers only the separate shareable summary, with a source and explicit preview approval. Manually check anonymity; this is not an automatic anonymizer or diagnostic tool.' },
 de: { psychology: 'Psychologie', 'medical-sciences': 'Medizin und Gesundheitswissenschaften', export: 'Arbeitsbereich als JSON exportieren', notice: 'Nur anonymisierte oder aggregierte Forschungsbeschreibungen speichern. Der Arbeitsbereich nutzt lokalen Browserspeicher und ist keine geschützte Patientenakte. Keine Namen, Kontaktdaten, Patientenkennungen oder identifizierbaren Fallgeschichten eingeben.', shared: 'Analysen und Versuchsplanung im vorhandenen Statistikmodul erstellen und hier referenzieren. Auswertungsfelder beschreiben Regeln; Instrumente werden nicht automatisch ausgewertet.', projection: 'Einfügen bietet nur die separate freigabefähige Zusammenfassung an, mit Quelle und ausdrücklicher Vorschaufreigabe. Anonymität manuell prüfen; kein automatischer Anonymisierer oder diagnostisches Werkzeug.' },
} as const;
