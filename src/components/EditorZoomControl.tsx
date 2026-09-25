import { Minus, Pilcrow, Plus, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  NON_PRINTING_MARKS_CLASS,
  NON_PRINTING_MARKS_STORAGE_KEY,
  readStoredNonPrintingMarks,
} from '../editor/nonPrintingMarks';
import {
  clampEditorZoom,
  dispatchEditorZoomChange,
  EDITOR_ZOOM_STEP,
  EDITOR_ZOOM_STORAGE_KEY,
  MAX_EDITOR_ZOOM,
  MIN_EDITOR_ZOOM,
  readStoredEditorZoom,
} from '../editor/editorZoom';
import { useTranslation } from '../i18n';
import './EditorZoomControl.css';

export function EditorZoomControl() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const [zoom, setZoom] = useState(readStoredEditorZoom);
  const [showNonPrintingMarks, setShowNonPrintingMarks] = useState(readStoredNonPrintingMarks);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const value = String(zoom / 100);
    document.documentElement.style.setProperty('--omi-editor-zoom', value);
    try {
      window.localStorage.setItem(EDITOR_ZOOM_STORAGE_KEY, String(zoom));
    } catch {
      // Device-local preference persistence is optional.
    }
    dispatchEditorZoomChange(zoom);
    return () => {
      document.documentElement.style.removeProperty('--omi-editor-zoom');
    };
  }, [zoom]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      NON_PRINTING_MARKS_CLASS,
      showNonPrintingMarks,
    );
    try {
      window.localStorage.setItem(
        NON_PRINTING_MARKS_STORAGE_KEY,
        String(showNonPrintingMarks),
      );
    } catch {
      // Device-local preference persistence is optional.
    }
    return () => {
      document.documentElement.classList.remove(NON_PRINTING_MARKS_CLASS);
    };
  }, [showNonPrintingMarks]);

  const applyZoom = (next: number) => setZoom(clampEditorZoom(next));

  return (
    <div className="omi-editor-zoom" data-open={open ? 'true' : 'false'}>
      <div className="omi-editor-zoom__quick-actions">
        <button
          type="button"
          className="omi-editor-nonprinting-toggle"
          aria-label={copy.nonPrintingMarks}
          aria-pressed={showNonPrintingMarks}
          title={copy.nonPrintingMarks}
          onClick={() => setShowNonPrintingMarks((current) => !current)}
        >
          <Pilcrow size={18} aria-hidden="true" />
        </button>
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
      </div>

      <div className="omi-editor-zoom__controls" role="group" aria-label={copy.zoom}>
        <button
          type="button"
          aria-label={copy.decrease}
          title={copy.decrease}
          disabled={zoom <= MIN_EDITOR_ZOOM}
          onClick={() => applyZoom(zoom - EDITOR_ZOOM_STEP)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <input
          type="range"
          min={MIN_EDITOR_ZOOM}
          max={MAX_EDITOR_ZOOM}
          step={EDITOR_ZOOM_STEP}
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
          disabled={zoom >= MAX_EDITOR_ZOOM}
          onClick={() => applyZoom(zoom + EDITOR_ZOOM_STEP)}
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
      nonPrintingMarks: 'Nem nyomtatható jelek',
    };
  }
  if (locale === 'de') {
    return {
      zoom: 'Dokumentzoom',
      decrease: 'Verkleinern',
      increase: 'Vergrößern',
      slider: 'Zoomstufe',
      reset: 'Auf 100 % zurücksetzen',
      nonPrintingMarks: 'Nicht druckbare Zeichen',
    };
  }
  return {
    zoom: 'Document zoom',
    decrease: 'Zoom out',
    increase: 'Zoom in',
    slider: 'Zoom level',
    reset: 'Reset to 100%',
    nonPrintingMarks: 'Non-printing marks',
  };
}
