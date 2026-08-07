export interface StateDigestCopy {
  integrity: string;
  verified: string;
  missing: string;
  mismatch: string;
  unsupported: string;
  digest: string;
  canonicalization: string;
  scope: string;
  summary: string;
  importVerified: string;
  importLegacy: string;
  importInvalid: string;
}

const COPY: Record<'en' | 'hu' | 'de', StateDigestCopy> = {
  en: {
    integrity: 'Revision state integrity',
    verified: 'Verified',
    missing: 'Digest not recorded',
    mismatch: 'Digest mismatch',
    unsupported: 'Unsupported digest profile',
    digest: 'State digest',
    canonicalization: 'Canonicalization',
    scope: 'Committed manuscript snapshot',
    summary: 'Canonical SHA-256 evidence for immutable manuscript revisions.',
    importVerified: 'All declared revision state digests are verified.',
    importLegacy: 'This package contains revisions without state digests. They can be backfilled locally after import.',
    importInvalid: 'The package contains an invalid or incompatible revision state digest.',
  },
  hu: {
    integrity: 'Revízióállapot integritása',
    verified: 'Ellenőrzött',
    missing: 'Nincs rögzített digest',
    mismatch: 'Digest-eltérés',
    unsupported: 'Nem támogatott digestprofil',
    digest: 'Állapotdigest',
    canonicalization: 'Kanonizálás',
    scope: 'Commitolt kézirat-pillanatkép',
    summary: 'Kanonikus SHA-256 integritási bizonyíték az immutable kéziratrevíziókhoz.',
    importVerified: 'Minden deklarált revízióállapot-digest ellenőrzése sikeres.',
    importLegacy: 'A csomag olyan korábbi revíziókat tartalmaz, amelyekhez nincs állapotdigest. Import után helyben pótolhatók.',
    importInvalid: 'A csomag hibás vagy nem kompatibilis revízióállapot-digestet tartalmaz.',
  },
  de: {
    integrity: 'Integrität des Revisionszustands',
    verified: 'Verifiziert',
    missing: 'Kein Digest gespeichert',
    mismatch: 'Digest stimmt nicht überein',
    unsupported: 'Nicht unterstütztes Digest-Profil',
    digest: 'Zustands-Digest',
    canonicalization: 'Kanonisierung',
    scope: 'Festgeschriebener Manuskript-Snapshot',
    summary: 'Kanonischer SHA-256-Integritätsnachweis für unveränderliche Manuskriptrevisionen.',
    importVerified: 'Alle deklarierten Zustands-Digests der Revisionen sind verifiziert.',
    importLegacy: 'Das Paket enthält ältere Revisionen ohne Zustands-Digest. Sie können nach dem Import lokal ergänzt werden.',
    importInvalid: 'Das Paket enthält einen ungültigen oder inkompatiblen Zustands-Digest.',
  },
};

export function getStateDigestCopy(locale: string): StateDigestCopy {
  const language = locale.trim().toLowerCase().split('-')[0];
  return language === 'hu' || language === 'de' ? COPY[language] : COPY.en;
}
