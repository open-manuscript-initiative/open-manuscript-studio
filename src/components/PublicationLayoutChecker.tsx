import { useEffect, useRef, useState } from 'react';
import { publicationPaginationCopy } from '../i18n/publicationPagination';
import type { PublicationLayoutIssue } from '../model/publicationLayoutDiagnostics';
import type { OmiManuscript } from '../types/omi';
import { checkLocalPublicationFontCoverage, collectPublicationCharacters, type FontCoverageResult } from '../services/publicationFontCoverage';

const FONT_COPY: Record<string, readonly string[]> = {
  en: ['Check installed font coverage', 'Reading local fonts…', 'No missing Unicode mapping found in the inspected local fonts.', 'No mapping found in the inspected local font inventory', 'Coverage uncertain: some font files could not be read.', 'Local font inspection unavailable or not permitted.', 'Local inventory only; shaping, web fonts and PDF-server fonts are not verified.', 'More occurrences are not shown.'],
  hu: ['Telepített betűtípusok karakterlefedettségének ellenőrzése', 'Helyi betűtípusok vizsgálata…', 'A vizsgált helyi betűtípusokban nem találtunk hiányzó Unicode-leképezést.', 'Nincs leképezés a vizsgált helyi betűtípusokban', 'Bizonytalan lefedettség: néhány betűfájl nem olvasható.', 'A helyi betűtípusok vizsgálata nem érhető el vagy nincs engedélyezve.', 'Csak helyi betűkészlet: a karakteralakítás, webfontok és a PDF-szerver betűtípusai nincsenek ellenőrizve.', 'További előfordulások nincsenek megjelenítve.'],
  de: ['Zeichenabdeckung installierter Schriften prüfen', 'Lokale Schriften werden geprüft…', 'Keine fehlende Unicode-Zuordnung in den geprüften lokalen Schriften gefunden.', 'Keine Zuordnung in den geprüften lokalen Schriften', 'Abdeckung ungewiss: Einige Schriftdateien konnten nicht gelesen werden.', 'Lokale Schriftprüfung nicht verfügbar oder nicht erlaubt.', 'Nur lokale Schriften; Zeichenformung, Webfonts und PDF-Server nicht geprüft.', 'Weitere Vorkommen werden nicht angezeigt.'],
  fr: ['Vérifier la couverture des polices installées', 'Analyse des polices locales…', 'Aucune correspondance Unicode manquante dans les polices examinées.', 'Aucune correspondance dans les polices locales examinées', 'Couverture incertaine : fichiers de police illisibles.', 'Inspection locale indisponible ou non autorisée.', 'Polices locales uniquement ; mise en forme, webfonts et serveur PDF non vérifiés.', 'Autres occurrences non affichées.'],
  it: ['Verifica copertura dei caratteri installati', 'Analisi dei caratteri locali…', 'Nessuna mappatura Unicode mancante nei caratteri esaminati.', 'Nessuna mappatura nei caratteri locali esaminati', 'Copertura incerta: alcuni file non leggibili.', 'Analisi locale non disponibile o non autorizzata.', 'Solo caratteri locali; shaping, webfont e server PDF non verificati.', 'Altre occorrenze non visualizzate.'],
  es: ['Comprobar cobertura de fuentes instaladas', 'Analizando fuentes locales…', 'No faltan asignaciones Unicode en las fuentes examinadas.', 'Sin asignación en las fuentes locales examinadas', 'Cobertura incierta: algunos archivos no se pudieron leer.', 'Inspección local no disponible o no autorizada.', 'Solo fuentes locales; composición, fuentes web y servidor PDF no verificados.', 'Otras apariciones no se muestran.'],
  nl: ['Tekenbereik van geïnstalleerde lettertypen controleren', 'Lokale lettertypen onderzoeken…', 'Geen ontbrekende Unicode-toewijzing gevonden.', 'Geen toewijzing in onderzochte lokale lettertypen', 'Dekking onzeker: sommige bestanden zijn onleesbaar.', 'Lokale inspectie niet beschikbaar of niet toegestaan.', 'Alleen lokale lettertypen; shaping, webfonts en PDF-server niet gecontroleerd.', 'Meer vindplaatsen worden niet getoond.'],
  pl: ['Sprawdź pokrycie znaków w zainstalowanych czcionkach', 'Sprawdzanie lokalnych czcionek…', 'Nie znaleziono brakujących mapowań Unicode.', 'Brak mapowania w sprawdzonych lokalnych czcionkach', 'Pokrycie niepewne: niektóre pliki są nieczytelne.', 'Sprawdzanie lokalne niedostępne lub niedozwolone.', 'Tylko lokalne czcionki; kształtowanie, fonty webowe i serwer PDF niesprawdzone.', 'Pozostałe wystąpienia nie są wyświetlane.'],
};

export function PublicationLayoutChecker({ locale, enabled, onEnabled, issues, onNavigate, manuscript }: {
  locale: string; enabled: boolean; onEnabled: (enabled: boolean) => void;
  issues: readonly PublicationLayoutIssue[]; onNavigate: (issue: PublicationLayoutIssue) => void;
  manuscript: OmiManuscript;
}) {
  const copy = publicationPaginationCopy(locale);
  const fontCopy = FONT_COPY[locale.split(/[-_]/)[0]!] ?? FONT_COPY.en!;
  const [coverage, setCoverage] = useState<FontCoverageResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const request = useRef<AbortController | null>(null);
  // Any edit or disabled checker invalidates the snapshot; do not retain stale warnings.
  useEffect(() => {
    setCoverage(null); setScanning(false);
    return () => { request.current?.abort(); request.current = null; };
  }, [manuscript, enabled]);
  async function scan() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setScanning(true); setCoverage(null);
    try {
      const result = await checkLocalPublicationFontCoverage(collectPublicationCharacters(manuscript), controller.signal);
      if (!controller.signal.aborted) setCoverage(result);
    } catch {
      if (!controller.signal.aborted) setCoverage({ status: 'unavailable', missing: [], checked: 0, unreadable: 0, total: 0 });
    } finally {
      if (!controller.signal.aborted) setScanning(false);
    }
  }
  return <fieldset className="publication-layout-checker"><legend>{copy.checker}</legend>
    <label className="publication-style-toggle"><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} /><span>{copy.enableChecker}</span></label>
    {enabled ? <>
      {issues.length ? <ul>{issues.map((issue) => <li key={issue.id}><button type="button" data-layout-issue={issue.id} onClick={() => onNavigate(issue)}><span aria-hidden="true">⚠ </span>{issue.message}</button></li>)}</ul> : <p role="status">{copy.noIssues}</p>}
      <button type="button" onClick={() => void scan()} disabled={scanning}>{scanning ? fontCopy[1] : fontCopy[0]}</button>
      <small>{fontCopy[6]}</small>
      {coverage ? <div aria-live="polite">
        <p>{coverage.status === 'unavailable' ? fontCopy[5] : coverage.status === 'partial' ? fontCopy[4] : coverage.missing.length ? fontCopy[3] : fontCopy[2]}</p>
        {coverage.missing.length > 0 ? <ul>{coverage.missing.slice(0, 100).map((occurrence, index) => {
          const message = `${coverage.status === 'partial' ? '?' : '⚠'} ${occurrence.character} (U+${occurrence.codePoint.toString(16).toUpperCase().padStart(4, '0')})`;
          return <li key={index}>{occurrence.blockId || occurrence.sectionId
            ? <button type="button" onClick={() => onNavigate({ id: 'font-coverage-' + index, message, blockId: occurrence.blockId, sectionId: occurrence.sectionId })}>{message}</button>
            : <span>{message}</span>}</li>;
        })}</ul> : null}
        {coverage.missing.length > 100 ? <p>{fontCopy[7]} ({coverage.missing.length - 100})</p> : null}
      </div> : null}
    </> : null}
  </fieldset>;
}
