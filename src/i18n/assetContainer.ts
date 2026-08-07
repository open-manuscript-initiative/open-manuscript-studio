export interface AssetContainerCopy {
  title: string;
  description: string;
  assets: string;
  embedded: string;
  prepare: string;
  preparing: string;
  prepared: string;
  download: string;
  downloading: string;
  ready: string;
  blocked: string;
  diagnostics: string;
  noDiagnostics: string;
  integrity: string;
  format: string;
  privacyNote: string;
}

const COPY: Record<'en' | 'hu' | 'de', AssetContainerCopy> = {
  en: {
    title: 'OMI package',
    description:
      'Externalize binary resources and package the manuscript, history, publication profile, checksums, assets and valid JATS output as a portable .omi container.',
    assets: 'registered assets',
    embedded: 'embedded images awaiting externalization',
    prepare: 'Prepare assets',
    preparing: 'Preparing assets…',
    prepared: 'Embedded image payloads are registered as stable assets.',
    download: 'Download .omi package',
    downloading: 'Building package…',
    ready: 'The container passed Studio integrity checks.',
    blocked: 'The package has blocking integrity errors.',
    diagnostics: 'Container diagnostics',
    noDiagnostics: 'No container-specific diagnostics.',
    integrity: 'SHA-256 integrity',
    format: 'OMI-SPEC-320 / OMI-SPEC-330 Draft package',
    privacyNote:
      'Authoring preview data is removed from portable document.json when a stable asset reference exists. Binary payloads are stored separately under media/.',
  },
  hu: {
    title: 'OMI-csomag',
    description:
      'A bináris erőforrások külső assetté alakítása, majd a kézirat, revíziótörténet, publikációs profil, ellenőrzőösszegek, assetek és az érvényes JATS-kimenet hordozható .omi konténerbe csomagolása.',
    assets: 'regisztrált asset',
    embedded: 'külső assetté alakítandó beágyazott kép',
    prepare: 'Assetek előkészítése',
    preparing: 'Assetek előkészítése…',
    prepared: 'A beágyazott képek stabil assetként regisztrálva vannak.',
    download: '.omi csomag letöltése',
    downloading: 'Csomag készítése…',
    ready: 'A konténer átment a Studio integritás-ellenőrzésén.',
    blocked: 'A csomag blokkoló integritási hibákat tartalmaz.',
    diagnostics: 'Konténerdiagnosztika',
    noDiagnostics: 'Nincs konténer-specifikus diagnosztika.',
    integrity: 'SHA-256 integritás',
    format: 'OMI-SPEC-320 / OMI-SPEC-330 Draft csomag',
    privacyNote:
      'Ha stabil asset-hivatkozás létezik, a hordozható document.json nem tartalmazza a szerkesztői Base64-előnézetet. A bináris payload külön, a media/ könyvtárba kerül.',
  },
  de: {
    title: 'OMI-Paket',
    description:
      'Binäre Ressourcen werden als Assets externalisiert und Manuskript, Versionshistorie, Publikationsprofil, Prüfsummen, Assets sowie gültiges JATS in einen portablen .omi-Container gepackt.',
    assets: 'registrierte Assets',
    embedded: 'eingebettete Bilder zur Externalisierung',
    prepare: 'Assets vorbereiten',
    preparing: 'Assets werden vorbereitet…',
    prepared: 'Eingebettete Bilddaten sind als stabile Assets registriert.',
    download: '.omi-Paket herunterladen',
    downloading: 'Paket wird erstellt…',
    ready: 'Der Container hat die Integritätsprüfungen von Studio bestanden.',
    blocked: 'Das Paket enthält blockierende Integritätsfehler.',
    diagnostics: 'Container-Diagnostik',
    noDiagnostics: 'Keine containerspezifische Diagnostik.',
    integrity: 'SHA-256-Integrität',
    format: 'OMI-SPEC-320 / OMI-SPEC-330 Draft-Paket',
    privacyNote:
      'Bei stabiler Asset-Referenz werden Base64-Autorenvorschauen aus portablem document.json entfernt. Binäre Payloads liegen separat unter media/.',
  },
};

export function getAssetContainerCopy(locale: string): AssetContainerCopy {
  const language = locale.trim().toLowerCase().split('-')[0];
  return language === 'hu' || language === 'de' ? COPY[language] : COPY.en;
}
