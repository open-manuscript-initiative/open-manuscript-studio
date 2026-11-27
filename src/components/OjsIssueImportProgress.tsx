import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import './OjsIssueImportProgress.css';

type Phase = 'manifest' | 'metadata' | 'download' | 'convert' | 'article-complete' | 'finalize';
interface Progress { phase: Phase; completed: number; total: number | null; title?: string }
interface Status { state: 'running' | 'ready' | 'failed'; progress: Progress; handoffToken?: string }

const copy = {
  en: ['Importing OJS journal issue', 'Reading issue', 'Reading article metadata', 'Downloading manuscript', 'Converting manuscript', 'Article imported', 'Preparing journal issue', 'Articles imported', 'Import failed or expired. Open the issue again in OJS.', 'Return to Studio'],
  hu: ['OJS-folyóiratszám importálása', 'Lapszám adatainak lekérése', 'Tanulmány metaadatainak lekérése', 'Kézirat letöltése', 'Kézirat feldolgozása', 'Tanulmány átvéve', 'Folyóiratszám előkészítése', 'Átvett tanulmányok', 'Az importálás sikertelen vagy lejárt. Nyissa meg újra a lapszámot az OJS-ben.', 'Vissza a Stúdióba'],
  de: ['OJS-Zeitschriftenausgabe importieren', 'Ausgabe laden', 'Artikelmetadaten laden', 'Manuskript herunterladen', 'Manuskript konvertieren', 'Artikel importiert', 'Ausgabe vorbereiten', 'Importierte Artikel', 'Import fehlgeschlagen oder abgelaufen. Öffnen Sie die Ausgabe erneut in OJS.', 'Zurück zu Studio'],
  fr: ['Import du numéro OJS', 'Lecture du numéro', 'Lecture des métadonnées', 'Téléchargement du manuscrit', 'Conversion du manuscrit', 'Article importé', 'Préparation du numéro', 'Articles importés', 'Import échoué ou expiré. Ouvrez à nouveau le numéro dans OJS.', 'Retour à Studio'],
  it: ['Importazione del numero OJS', 'Lettura del numero', 'Lettura dei metadati', 'Download del manoscritto', 'Conversione del manoscritto', 'Articolo importato', 'Preparazione del numero', 'Articoli importati', 'Importazione fallita o scaduta. Riaprire il numero in OJS.', 'Torna a Studio'],
  es: ['Importación del número OJS', 'Lectura del número', 'Lectura de metadatos', 'Descarga del manuscrito', 'Conversión del manuscrito', 'Artículo importado', 'Preparación del número', 'Artículos importados', 'Importación fallida o caducada. Abra de nuevo el número en OJS.', 'Volver a Studio'],
  nl: ['OJS-tijdschriftnummer importeren', 'Nummer lezen', 'Artikelmetadata lezen', 'Manuscript downloaden', 'Manuscript converteren', 'Artikel geïmporteerd', 'Nummer voorbereiden', 'Geïmporteerde artikelen', 'Import mislukt of verlopen. Open het nummer opnieuw in OJS.', 'Terug naar Studio'],
  pl: ['Import numeru czasopisma OJS', 'Odczyt numeru', 'Odczyt metadanych', 'Pobieranie manuskryptu', 'Konwersja manuskryptu', 'Artykuł zaimportowany', 'Przygotowanie numeru', 'Zaimportowane artykuły', 'Import nieudany lub wygasł. Otwórz ponownie numer w OJS.', 'Wróć do Studio'],
} as const;

const volumeCopy = {
  en: ['Importing OMP volume', 'Reading volume', 'Reading volume metadata', 'Downloading manuscript', 'Converting manuscript', 'Source imported', 'Preparing volume', 'Sources imported', 'Import failed or expired. Open the volume again in OMP.', 'Return to Studio'],
  hu: ['OMP-kötet importálása', 'Kötet adatainak lekérése', 'Kötet metaadatainak lekérése', 'Kézirat letöltése', 'Kézirat feldolgozása', 'Forrás átvéve', 'Kötet előkészítése', 'Átvett források', 'Az importálás sikertelen vagy lejárt. Nyissa meg újra a kötetet az OMP-ben.', 'Vissza a Stúdióba'],
  de: ['OMP-Band importieren', 'Band laden', 'Bandmetadaten laden', 'Manuskript herunterladen', 'Manuskript konvertieren', 'Quelle importiert', 'Band vorbereiten', 'Importierte Quellen', 'Import fehlgeschlagen oder abgelaufen. Öffnen Sie den Band erneut in OMP.', 'Zurück zu Studio'],
  fr: ['Import du volume OMP', 'Lecture du volume', 'Lecture des métadonnées', 'Téléchargement du manuscrit', 'Conversion du manuscrit', 'Source importée', 'Préparation du volume', 'Sources importées', 'Import échoué ou expiré. Ouvrez à nouveau le volume dans OMP.', 'Retour à Studio'],
  it: ['Importazione del volume OMP', 'Lettura del volume', 'Lettura dei metadati', 'Download del manoscritto', 'Conversione del manoscritto', 'Fonte importata', 'Preparazione del volume', 'Fonti importate', 'Importazione fallita o scaduta. Riaprire il volume in OMP.', 'Torna a Studio'],
  es: ['Importación del volumen OMP', 'Lectura del volumen', 'Lectura de metadatos', 'Descarga del manuscrito', 'Conversión del manuscrito', 'Fuente importada', 'Preparación del volumen', 'Fuentes importadas', 'Importación fallida o caducada. Abra de nuevo el volumen en OMP.', 'Volver a Studio'],
  nl: ['OMP-volume importeren', 'Volume lezen', 'Metadata lezen', 'Manuscript downloaden', 'Manuscript converteren', 'Bron geïmporteerd', 'Volume voorbereiden', 'Geïmporteerde bronnen', 'Import mislukt of verlopen. Open het volume opnieuw in OMP.', 'Terug naar Studio'],
  pl: ['Import tomu OMP', 'Odczyt tomu', 'Odczyt metadanych', 'Pobieranie manuskryptu', 'Konwersja manuskryptu', 'Źródło zaimportowane', 'Przygotowanie tomu', 'Zaimportowane źródła', 'Import nieudany lub wygasł. Otwórz ponownie tom w OMP.', 'Wróć do Studio'],
} as const;

const phaseIndex: Record<Phase, number> = { manifest: 1, metadata: 2, download: 3, convert: 4, 'article-complete': 5, finalize: 6 };
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function getOjsIssueProgressToken(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('omiOjsIssueProgress');
  return token && tokenPattern.test(token) ? token : null;
}

export function getOmpVolumeProgressToken(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('omiOmpVolumeProgress');
  return token && tokenPattern.test(token) ? token : null;
}

export function OjsIssueImportProgress({ token, platform = 'ojs' }: { token: string; platform?: 'ojs' | 'omp' }) {
  const { locale } = useTranslation();
  const catalog = platform === 'omp' ? volumeCopy : copy;
  const labels = catalog[locale as keyof typeof catalog] ?? catalog.en;
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timeout: number | undefined;
    let failures = 0;
    const poll = async () => {
      try {
        const response = await fetch(`/integrations/${platform === 'omp' ? 'omp/volume-progress' : 'ojs/issue-progress'}/${encodeURIComponent(token)}`, {
          cache: 'no-store', credentials: 'same-origin', referrerPolicy: 'no-referrer', signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 410) { setFailed(true); return; }
        if (!response.ok) throw new Error('Issue status unavailable');
        const next = await response.json() as Status;
        if (controller.signal.aborted) return;
        if (!next.progress || !Object.hasOwn(phaseIndex, next.progress.phase) ||
          !Number.isInteger(next.progress.completed) || next.progress.completed < 0 ||
          (next.progress.total !== null && (!Number.isInteger(next.progress.total) || next.progress.total < next.progress.completed)) ||
          !['running', 'ready', 'failed'].includes(next.state)) throw new Error('Invalid issue status');
        failures = 0;
        setStatus(next);
        if (next.state === 'failed') { setFailed(true); return; }
        if (next.state === 'ready') {
          if (!next.handoffToken || !tokenPattern.test(next.handoffToken)) { setFailed(true); return; }
          window.location.replace(`/?${platform === 'omp' ? 'omiOmpVolumeLaunch' : 'omiOjsIssueLaunch'}=${encodeURIComponent(next.handoffToken)}`);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        if (++failures >= 5) { setFailed(true); return; }
      }
      timeout = window.setTimeout(() => void poll(), 1000);
    };
    void poll();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [token, platform]);
  const progress = status?.progress;
  const total = progress?.total ?? null;
  const completed = progress?.completed ?? 0;
  return <main className="ojs-issue-progress" aria-busy={!failed}>
    <section>
      <h1>{labels[0]}</h1>
      <div role="status" aria-live="polite">
        <p>{progress ? labels[phaseIndex[progress.phase]] : labels[1]}</p>
        {progress?.title ? <p className="ojs-issue-progress-title">{progress.title}</p> : null}
        {total !== null ? <p>{labels[7]}: {completed} / {total}</p> : null}
      </div>
      {!failed ? total === null ? <progress aria-label={labels[0]} /> : <progress aria-label={labels[7]} max={Math.max(1, total)} value={total === 0 ? (status?.state === 'ready' ? 1 : 0) : completed} /> : null}
      {failed ? <><p role="alert">{labels[8]}</p><a href="/">{labels[9]}</a></> : null}
    </section>
  </main>;
}
