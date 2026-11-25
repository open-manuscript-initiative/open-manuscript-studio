import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { editorMemoryPool, type CacheMode } from '../model/derivedMemoryCache';
import { getEditorCacheDiagnostics, getEditorCacheMode, setEditorCacheMode } from '../services/editorMemoryPreferences';

const labels = {
  en: ['Editor memory', 'Only derived cache data is affected; the manuscript and undo history are unchanged. Values are estimates, not total application RAM.', 'Memory mode', 'Economy', 'Balanced', 'Performance', 'Estimated cache', 'Cache budget', 'Device RAM (reported)', 'Available RAM (reported)', 'Clear cache', 'Unavailable'],
  hu: ['Szerkesztő memóriahasználata', 'Csak a származtatott gyorsítótár adatait érinti; a kézirat és a visszavonási előzmények változatlanok. Az értékek becslések, nem a teljes alkalmazás RAM-használata.', 'Memóriaüzemmód', 'Takarékos', 'Kiegyensúlyozott', 'Nagy teljesítményű', 'Becsült gyorsítótár', 'Gyorsítótár kerete', 'Készülék RAM-ja (jelentett)', 'Elérhető RAM (jelentett)', 'Gyorsítótár ürítése', 'Nem elérhető'],
  de: ['Editorspeicher', 'Nur abgeleitete Cache-Daten sind betroffen; Manuskript und Rückgängig-Verlauf bleiben unverändert. Die Werte sind Schätzungen, nicht der gesamte RAM-Verbrauch.', 'Speichermodus', 'Sparsam', 'Ausgewogen', 'Leistung', 'Geschätzter Cache', 'Cache-Budget', 'Geräte-RAM (gemeldet)', 'Verfügbarer RAM (gemeldet)', 'Cache leeren', 'Nicht verfügbar'],
  fr: ['Mémoire de l’éditeur', 'Seules les données dérivées du cache sont concernées ; le manuscrit et l’historique restent intacts. Les valeurs sont des estimations, pas la RAM totale utilisée.', 'Mode mémoire', 'Économie', 'Équilibré', 'Performance', 'Cache estimé', 'Budget du cache', 'RAM de l’appareil (signalée)', 'RAM disponible (signalée)', 'Vider le cache', 'Indisponible'],
  it: ['Memoria dell’editor', 'Vengono modificati solo i dati derivati della cache; il manoscritto e la cronologia di annullamento restano intatti. I valori sono stime, non la RAM totale utilizzata.', 'Modalità memoria', 'Risparmio', 'Bilanciata', 'Prestazioni', 'Cache stimata', 'Budget della cache', 'RAM del dispositivo (rilevata)', 'RAM disponibile (rilevata)', 'Svuota cache', 'Non disponibile'],
  es: ['Memoria del editor', 'Solo se ven afectados los datos derivados de la caché; el manuscrito y el historial de deshacer no cambian. Los valores son estimaciones, no la RAM total utilizada.', 'Modo de memoria', 'Ahorro', 'Equilibrado', 'Rendimiento', 'Caché estimada', 'Presupuesto de caché', 'RAM del dispositivo (indicada)', 'RAM disponible (indicada)', 'Vaciar caché', 'No disponible'],
  nl: ['Editorgeheugen', 'Alleen afgeleide cachegegevens worden beïnvloed; manuscript en ongedaangeschiedenis blijven behouden. De waarden zijn schattingen, niet het totale RAM-gebruik.', 'Geheugenmodus', 'Zuinig', 'Gebalanceerd', 'Prestaties', 'Geschatte cache', 'Cachebudget', 'Apparaat-RAM (gemeld)', 'Beschikbaar RAM (gemeld)', 'Cache wissen', 'Niet beschikbaar'],
  pl: ['Pamięć edytora', 'Zmiany dotyczą tylko danych pochodnych w pamięci podręcznej; rękopis i historia cofania pozostają nienaruszone. Wartości są szacunkowe, nie oznaczają całkowitego użycia RAM.', 'Tryb pamięci', 'Oszczędny', 'Zrównoważony', 'Wydajność', 'Szacowana pamięć podręczna', 'Limit pamięci podręcznej', 'RAM urządzenia (zgłoszona)', 'Dostępna RAM (zgłoszona)', 'Wyczyść pamięć podręczną', 'Niedostępne'],
} as const;
const modes: CacheMode[] = ['economy', 'balanced', 'performance'];

export function EditorMemorySettings() {
  const { locale } = useTranslation();
  const language = locale.toLowerCase().split(/[-_]/)[0] as keyof typeof labels;
  const copy = labels[language] ?? labels.en;
  const [mode, setMode] = useState(getEditorCacheMode);
  const [diagnostics, setDiagnostics] = useState(getEditorCacheDiagnostics);
  const formatter = new Intl.NumberFormat(locale.replace('_', '-'), { maximumFractionDigits: 1 });
  const formatMiB = (value: number | undefined) => value === undefined ? copy[11] : formatter.format(value) + ' MiB';
  useEffect(() => {
    const timer = window.setInterval(() => setDiagnostics(getEditorCacheDiagnostics()), 1500);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="studio-settings-card">
      <div className="studio-settings-card-header"><div><h4>{copy[0]}</h4><p>{copy[1]}</p></div></div>
      <label>
        {copy[2]}
        <select value={mode} onChange={(event) => {
          const value = modes.find((candidate) => candidate === event.target.value);
          if (!value) return;
          setEditorCacheMode(value); setMode(value); setDiagnostics(getEditorCacheDiagnostics());
        }}>
          {modes.map((value, index) => <option key={value} value={value}>{copy[index + 3]}</option>)}
        </select>
      </label>
      <dl>
        <dt>{copy[6]}</dt><dd>{formatMiB(diagnostics.estimatedMiB)}</dd>
        <dt>{copy[7]}</dt><dd>{formatMiB(diagnostics.budgetMiB)}</dd>
        <dt>{copy[8]}</dt><dd>{formatMiB(diagnostics.ramGiB === undefined ? undefined : diagnostics.ramGiB * 1024)}</dd>
        <dt>{copy[9]}</dt><dd>{formatMiB(diagnostics.availableMiB)}</dd>
      </dl>
      <button type="button" onClick={() => { editorMemoryPool.clear(); setDiagnostics(getEditorCacheDiagnostics()); }}>{copy[10]}</button>
    </section>
  );
}
