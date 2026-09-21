import { Minus, Plus, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n';
import './EditorZoomControl.css';

const STORAGE_KEY = 'omi:editor-zoom';
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const STEP = 10;

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value / STEP) * STEP));
}

function readStoredZoom(): number {
  try {
    return clampZoom(Number(window.localStorage.getItem(STORAGE_KEY) ?? 100));
  } catch {
    return 100;
  }
}

export function EditorZoomControl() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const [zoom, setZoom] = useState(readStoredZoom);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const value = String(zoom / 100);
    document.documentElement.style.setProperty('--omi-editor-zoom', value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoom));
    } catch {
      // Device-local preference persistence is optional.
    }
    return () => {
      document.documentElement.style.removeProperty('--omi-editor-zoom');
    };
  }, [zoom]);

  const applyZoom = (next: number) => setZoom(clampZoom(next));

  return (
    <div className="omi-editor-zoom" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="omi-editor-zoom__toggle"
        aria-label={copy.zoom}
        aria-expanded={open}
        title={copy.zoom}
        onClick={() => setOpen((current) => !current)}
      >
        <ZoomIn size={18} aria-hidden="true" />
        <span>{zoom}%</span>
      </button>

      <div className="omi-editor-zoom__controls" role="group" aria-label={copy.zoom}>
        <button
          type="button"
          aria-label={copy.decrease}
          title={copy.decrease}
          disabled={zoom <= MIN_ZOOM}
          onClick={() => applyZoom(zoom - STEP)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={STEP}
          value={zoom}
          aria-label={copy.slider}
          onChange={(event) => applyZoom(Number(event.target.value))}
        />
        <button
          type="button"
          className="omi-editor-zoom__percent"
          aria-label={copy.reset}
          title={copy.reset}
          onClick={() => setZoom(100)}
        >
          {zoom}%
        </button>
        <button
          type="button"
          aria-label={copy.increase}
          title={copy.increase}
          disabled={zoom >= MAX_ZOOM}
          onClick={() => applyZoom(zoom + STEP)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      zoom: 'Dokumentum nagyítása',
      decrease: 'Kicsinyítés',
      increase: 'Nagyítás',
      slider: 'Nagyítás mértéke',
      reset: 'Visszaállítás 100%-ra',
    };
  }
  if (locale === 'de') {
    return {
      zoom: 'Dokumentzoom',
      decrease: 'Verkleinern',
      increase: 'Vergrößern',
      slider: 'Zoomstufe',
      reset: 'Auf 100 % zurücksetzen',
    };
  }
  return {
    zoom: 'Document zoom',
    decrease: 'Zoom out',
    increase: 'Zoom in',
    slider: 'Zoom level',
    reset: 'Reset to 100%',
  };
}
