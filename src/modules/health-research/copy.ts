import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
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
export const healthCopy = getResearchModuleCopyByLocale('health-research-copy/healthCopy') as const;
