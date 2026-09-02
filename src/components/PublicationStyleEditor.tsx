import {
  Copy,
  Download,
  FileCode2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { useTranslation } from '../i18n';
import {
  buildPublicationStyleCss,
  type PublicationStyle,
} from '../services/publicationStyleExport';
import { PublicationDocumentCanvas } from './PublicationDocumentCanvas';
import './PublicationStyleEditor.css';

type Align = 'left' | 'center' | 'right' | 'justify';
type PageOrientation = 'portrait' | 'landscape';

const LEGACY_STORAGE_KEY = 'omi:publication-style:egyhaztorteneti-szemle';
const LIBRARY_STORAGE_KEY = 'omi:publication-style-library:v1';
const ACTIVE_STYLE_KEY = 'omi:publication-style-active:v1';

const PAGE_PRESETS = [
  { id: 'a4', label: 'A4', width: 210, height: 297 },
  { id: 'a5', label: 'A5', width: 148, height: 210 },
  { id: 'b5', label: 'B5', width: 176, height: 250 },
  { id: 'book-156-224', label: '156 × 224 mm', width: 156, height: 224 },
  { id: 'journal-150-240', label: '150 × 240 mm', width: 150, height: 240 },
] as const;

function cloneTemplate(): PublicationStyle {
  return JSON.parse(JSON.stringify(templateJson)) as PublicationStyle;
}

function cloneStyle(style: PublicationStyle): PublicationStyle {
  return JSON.parse(JSON.stringify(style)) as PublicationStyle;
}

function makeStyleId(): string {
  return `publication-style:${crypto.randomUUID()}`;
}

function loadLibrary(): PublicationStyle[] {
  try {
    const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length) {
        return (parsed as PublicationStyle[]).map(withCurrentPageDefaults);
      }
    }
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      return [withCurrentPageDefaults(JSON.parse(legacy) as PublicationStyle)];
    }
  } catch {
    // Fall back to the bundled template.
  }
  return [cloneTemplate()];
}

function loadInitialState(): {
  library: PublicationStyle[];
  activeId: string;
  style: PublicationStyle;
} {
  const library = loadLibrary();
  const requestedId = window.localStorage.getItem(ACTIVE_STYLE_KEY);
  const active = library.find((item) => item.id === requestedId)
    ?? library[0]
    ?? cloneTemplate();
  return {
    library,
    activeId: active.id,
    style: cloneStyle(active),
  };
}

function persistLibrary(library: PublicationStyle[], active: PublicationStyle): void {
  window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
  window.localStorage.setItem(ACTIVE_STYLE_KEY, active.id);
  // Compatibility bridge: the current PDF/HTML readers consume this key.
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(active));
}

function withCurrentPageDefaults(style: PublicationStyle): PublicationStyle {
  const fallback = cloneTemplate();
  return {
    ...fallback,
    ...style,
    page: {
      ...fallback.page,
      ...style.page,
      margins: {
        ...fallback.page.margins,
        ...style.page?.margins,
      },
    },
  };
}

function upsertStyle(
  library: PublicationStyle[],
  activeId: string,
  style: PublicationStyle,
): PublicationStyle[] {
  return library.some((item) => item.id === activeId)
    ? library.map((item) => item.id === activeId ? cloneStyle(style) : item)
    : [...library, cloneStyle(style)];
}

function copyFor(locale: string) {
  if (locale === 'hu') return {
    title: 'Vizuális kiadványszerkesztő',
    description: 'A teljes tanulmány vagy kötet szerkeszthető nyomtatási képe. A tartalmi és tipográfiai módosítások azonnal megjelennek, és ugyanezeket az értékeket használja az export.',
    styles: 'Kiadványstílusok', styleName: 'Stílus neve', newStyle: 'Új stílus', duplicate: 'Másolat készítése', deleteStyle: 'Stílus törlése', cannotDeleteLast: 'Legalább egy kiadványstílusnak meg kell maradnia.',
    page: 'Nyomtatási oldal', preset: 'Oldalformátum', custom: 'Egyéni méret', orientation: 'Tájolás', portrait: 'Álló', landscape: 'Fekvő', width: 'Vágott szélesség', height: 'Vágott magasság', pageNumberStart: 'Első oldalszám', margins: 'Margók és nyomdai adatok', top: 'Felső', bottom: 'Alsó', inner: 'Belső', outer: 'Külső', gutter: 'Kötésmargó', bleed: 'Kifutó', mirroredMargins: 'Tükrözött margók páros és páratlan oldalakon', cropMarks: 'Vágójelek kérése a nyomdai exportban', runningHeaders: 'Élőfej megjelenítése', firstPageHeader: 'Élőfej az első oldalon is',
    typography: 'Tipográfia', font: 'Betűcsalád', bodySize: 'Törzsszöveg mérete', bodyLeading: 'Törzsszöveg sorköze', indent: 'Első sor behúzása',
    titleSize: 'Cím mérete', headingSize: 'Címsor mérete', footnoteSize: 'Lábjegyzet mérete', alignment: 'Igazítás', justify: 'Sorkizárt', alignLeft: 'Balra', alignCenter: 'Középre', alignRight: 'Jobbra',
    save: 'Stílus mentése', saved: 'A stílus mentve és aktív', reset: 'Sablonértékek visszaállítása', export: 'Stílus exportálása', exportCss: 'CSS letöltése', defaultNewName: 'Új kiadványstílus', copySuffix: 'másolat', liveApplied: 'A módosítások automatikusan az aktív exportstílusba kerülnek.',
  };
  if (locale === 'de') return {
    title: 'Visueller Publikationseditor', description: 'Die vollständige, bearbeitbare Druckansicht des Beitrags oder Bandes. Inhaltliche und typografische Änderungen erscheinen sofort und werden für den Export verwendet.', styles: 'Publikationsstile', styleName: 'Stilname', newStyle: 'Neuer Stil', duplicate: 'Duplizieren', deleteStyle: 'Stil löschen', cannotDeleteLast: 'Mindestens ein Publikationsstil muss erhalten bleiben.', page: 'Druckseite', preset: 'Seitenformat', custom: 'Benutzerdefiniert', orientation: 'Ausrichtung', portrait: 'Hochformat', landscape: 'Querformat', width: 'Endbreite', height: 'Endhöhe', pageNumberStart: 'Erste Seitenzahl', margins: 'Ränder und Druckdaten', top: 'Oben', bottom: 'Unten', inner: 'Innen', outer: 'Außen', gutter: 'Bundsteg', bleed: 'Beschnitt', mirroredMargins: 'Gespiegelte Ränder für gerade und ungerade Seiten', cropMarks: 'Schnittmarken im Druckexport', runningHeaders: 'Kolumnentitel anzeigen', firstPageHeader: 'Kolumnentitel auch auf der ersten Seite', typography: 'Typografie', font: 'Schriftfamilie', bodySize: 'Grundschrift', bodyLeading: 'Zeilenabstand', indent: 'Erstzeileneinzug', titleSize: 'Titelgröße', headingSize: 'Überschriftgröße', footnoteSize: 'Fußnotengröße', alignment: 'Ausrichtung', justify: 'Blocksatz', alignLeft: 'Links', alignCenter: 'Zentriert', alignRight: 'Rechts', save: 'Stil speichern', saved: 'Stil gespeichert und aktiv', reset: 'Vorlagenwerte zurücksetzen', export: 'Stil exportieren', exportCss: 'CSS herunterladen', defaultNewName: 'Neuer Publikationsstil', copySuffix: 'Kopie', liveApplied: 'Änderungen werden automatisch auf den aktiven Exportstil angewendet.',
  };
  return {
    title: 'Visual publication editor', description: 'The complete editable print view of the article or volume. Content and typography changes appear immediately and drive the same export settings.', styles: 'Publication styles', styleName: 'Style name', newStyle: 'New style', duplicate: 'Duplicate', deleteStyle: 'Delete style', cannotDeleteLast: 'At least one publication style must remain.', page: 'Print page', preset: 'Page format', custom: 'Custom size', orientation: 'Orientation', portrait: 'Portrait', landscape: 'Landscape', width: 'Trim width', height: 'Trim height', pageNumberStart: 'First page number', margins: 'Margins and print data', top: 'Top', bottom: 'Bottom', inner: 'Inner', outer: 'Outer', gutter: 'Gutter', bleed: 'Bleed', mirroredMargins: 'Mirror margins on facing pages', cropMarks: 'Include crop marks in print export', runningHeaders: 'Show running headers', firstPageHeader: 'Show running header on first page', typography: 'Typography', font: 'Font family', bodySize: 'Body size', bodyLeading: 'Body leading', indent: 'First-line indent', titleSize: 'Title size', headingSize: 'Heading size', footnoteSize: 'Footnote size', alignment: 'Alignment', justify: 'Justified', alignLeft: 'Left', alignCenter: 'Center', alignRight: 'Right', save: 'Save style', saved: 'Style saved and active', reset: 'Reset template values', export: 'Export style', exportCss: 'Download CSS', defaultNewName: 'New publication style', copySuffix: 'copy', liveApplied: 'Changes are applied to the active export style automatically.',
  };
}

export function PublicationStyleEditor() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const initial = useMemo(loadInitialState, []);
  const [library, setLibrary] = useState<PublicationStyle[]>(initial.library);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [style, setStyle] = useState<PublicationStyle>(initial.style);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    persistLibrary(upsertStyle(library, activeId, style), style);
  }, [activeId, library, style]);

  function patchStyle(update: (current: PublicationStyle) => PublicationStyle): void {
    setSaved(false);
    setMessage('');
    setStyle(update);
  }

  function setPage<K extends keyof PublicationStyle['page']>(
    key: K,
    value: PublicationStyle['page'][K],
  ): void {
    patchStyle((current) => ({
      ...current,
      page: { ...current.page, [key]: value },
    }));
  }

  function setMargin(
    key: keyof PublicationStyle['page']['margins'],
    value: number,
  ): void {
    patchStyle((current) => ({
      ...current,
      page: {
        ...current.page,
        margins: { ...current.page.margins, [key]: value },
      },
    }));
  }

  function setStyleValue(
    styleKey: keyof PublicationStyle['styles'],
    property: string,
    value: string | number,
  ): void {
    patchStyle((current) => ({
      ...current,
      styles: {
        ...current.styles,
        [styleKey]: { ...current.styles[styleKey], [property]: value },
      },
    } as PublicationStyle));
  }

  function selectStyle(id: string): void {
    const currentLibrary = upsertStyle(library, activeId, style);
    const next = currentLibrary.find((item) => item.id === id);
    if (!next) return;
    setLibrary(currentLibrary);
    setActiveId(id);
    setStyle(cloneStyle(next));
    setSaved(true);
    setMessage('');
  }

  function updateStyleName(name: string): void {
    patchStyle((current) => ({ ...current, name }));
  }

  function save(): void {
    const cleanName = style.name.trim() || copy.defaultNewName;
    const nextStyle = { ...style, name: cleanName };
    const nextLibrary = upsertStyle(library, activeId, nextStyle);
    setStyle(nextStyle);
    setLibrary(nextLibrary);
    persistLibrary(nextLibrary, nextStyle);
    setSaved(true);
    setMessage('');
  }

  function createStyle(): void {
    const next = cloneTemplate();
    next.id = makeStyleId();
    next.name = copy.defaultNewName;
    const nextLibrary = [...upsertStyle(library, activeId, style), next];
    setLibrary(nextLibrary);
    setActiveId(next.id);
    setStyle(next);
    persistLibrary(nextLibrary, next);
    setSaved(true);
    setMessage('');
  }

  function duplicateStyle(): void {
    const next = cloneStyle(style);
    next.id = makeStyleId();
    next.name = `${style.name || copy.defaultNewName} — ${copy.copySuffix}`;
    const nextLibrary = [...upsertStyle(library, activeId, style), next];
    setLibrary(nextLibrary);
    setActiveId(next.id);
    setStyle(next);
    persistLibrary(nextLibrary, next);
    setSaved(true);
    setMessage('');
  }

  function deleteStyle(): void {
    if (library.length <= 1) {
      setMessage(copy.cannotDeleteLast);
      return;
    }
    const nextLibrary = upsertStyle(library, activeId, style)
      .filter((item) => item.id !== activeId);
    const next = nextLibrary[0] ?? cloneTemplate();
    setLibrary(nextLibrary);
    setActiveId(next.id);
    setStyle(cloneStyle(next));
    persistLibrary(nextLibrary, next);
    setSaved(true);
    setMessage('');
  }

  function reset(): void {
    const next = cloneTemplate();
    next.id = style.id;
    next.name = style.name;
    setStyle(next);
    setSaved(false);
    setMessage('');
  }

  function exportStyle(): void {
    const blob = new Blob(
      [JSON.stringify(style, null, 2)],
      { type: 'application/json;charset=utf-8' },
    );
    downloadBlob(blob, `${fileStem(style)}.omi-publication-style.json`);
  }

  function exportCss(): void {
    const css = `/* OMI publication style: ${style.name} */\n/* Generated from the current editor values. */\n${buildPublicationStyleCss(style, 'print')}`;
    const blob = new Blob([css], { type: 'text/css;charset=utf-8' });
    downloadBlob(blob, `${fileStem(style)}.css`);
  }

  function applyPagePreset(id: string): void {
    const preset = PAGE_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const landscape = pageOrientation(style) === 'landscape';
    patchStyle((current) => ({
      ...current,
      page: {
        ...current.page,
        width: landscape ? preset.height : preset.width,
        height: landscape ? preset.width : preset.height,
      },
    }));
  }

  function setOrientation(orientation: PageOrientation): void {
    if (pageOrientation(style) === orientation) return;
    patchStyle((current) => ({
      ...current,
      page: {
        ...current.page,
        width: current.page.height,
        height: current.page.width,
      },
    }));
  }

  const body = style.styles.body;
  const title = style.styles.articleTitlePrimary;
  const heading = style.styles.heading1;
  const footnote = style.styles.footnote;
  const selectedPreset = pagePresetId(style);

  return (
    <section className="publication-style-editor" aria-labelledby="publication-style-editor-title">
      <div className="publication-profile-section-heading publication-style-editor-heading">
        <div>
          <h4 id="publication-style-editor-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="publication-style-editor-layout">
        <aside className="publication-style-controls" aria-label={copy.page}>
          <fieldset>
            <legend>{copy.styles}</legend>
            <div className="publication-style-grid">
              <label>
                <span>{copy.styles}</span>
                <select value={activeId} onChange={(event) => selectStyle(event.target.value)}>
                  {library.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.styleName}</span>
                <input value={style.name} onChange={(event) => updateStyleName(event.target.value)} />
              </label>
            </div>
            <div className="publication-style-actions">
              <button type="button" className="studio-menu-secondary-action" onClick={createStyle}><Plus size={16} aria-hidden="true" />{copy.newStyle}</button>
              <button type="button" className="studio-menu-secondary-action" onClick={duplicateStyle}><Copy size={16} aria-hidden="true" />{copy.duplicate}</button>
              <button type="button" className="studio-menu-secondary-action" disabled={library.length <= 1} onClick={deleteStyle}><Trash2 size={16} aria-hidden="true" />{copy.deleteStyle}</button>
            </div>
          </fieldset>

          <fieldset>
            <legend>{copy.page}</legend>
            <div className="publication-style-grid">
              <label>
                <span>{copy.preset}</span>
                <select value={selectedPreset} onChange={(event) => applyPagePreset(event.target.value)}>
                  <option value="custom">{copy.custom}</option>
                  {PAGE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.orientation}</span>
                <select value={pageOrientation(style)} onChange={(event) => setOrientation(event.target.value as PageOrientation)}>
                  <option value="portrait">{copy.portrait}</option>
                  <option value="landscape">{copy.landscape}</option>
                </select>
              </label>
              <NumberField label={`${copy.width} (mm)`} value={style.page.width} min={50} onChange={(value) => setPage('width', value)} />
              <NumberField label={`${copy.height} (mm)`} value={style.page.height} min={50} onChange={(value) => setPage('height', value)} />
              <NumberField label={copy.pageNumberStart} value={style.page.pageNumberStart ?? 1} min={0} step={1} onChange={(value) => setPage('pageNumberStart', Math.trunc(value))} />
            </div>
          </fieldset>

          <fieldset>
            <legend>{copy.margins}</legend>
            <div className="publication-style-grid">
              <NumberField label={`${copy.top} (mm)`} value={style.page.margins.top} onChange={(value) => setMargin('top', value)} />
              <NumberField label={`${copy.bottom} (mm)`} value={style.page.margins.bottom} onChange={(value) => setMargin('bottom', value)} />
              <NumberField label={`${copy.inner} (mm)`} value={style.page.margins.inner} onChange={(value) => setMargin('inner', value)} />
              <NumberField label={`${copy.outer} (mm)`} value={style.page.margins.outer} onChange={(value) => setMargin('outer', value)} />
              <NumberField label={`${copy.gutter} (mm)`} value={style.page.gutter ?? 0} step={0.5} onChange={(value) => setPage('gutter', value)} />
              <NumberField label={`${copy.bleed} (mm)`} value={style.page.bleed ?? 0} step={0.5} onChange={(value) => setPage('bleed', value)} />
            </div>
            <label className="publication-style-toggle">
              <input type="checkbox" checked={style.page.mirroredMargins} onChange={(event) => setPage('mirroredMargins', event.target.checked)} />
              <span>{copy.mirroredMargins}</span>
            </label>
            <label className="publication-style-toggle">
              <input type="checkbox" checked={style.page.cropMarks ?? false} onChange={(event) => setPage('cropMarks', event.target.checked)} />
              <span>{copy.cropMarks}</span>
            </label>
            <label className="publication-style-toggle">
              <input
                type="checkbox"
                checked={style.runningHeaders.enabled}
                onChange={(event) => patchStyle((current) => ({
                  ...current,
                  runningHeaders: { ...current.runningHeaders, enabled: event.target.checked },
                }))}
              />
              <span>{copy.runningHeaders}</span>
            </label>
            <label className="publication-style-toggle">
              <input
                type="checkbox"
                checked={style.firstPage.showRunningHeader}
                onChange={(event) => patchStyle((current) => ({
                  ...current,
                  firstPage: { ...current.firstPage, showRunningHeader: event.target.checked },
                }))}
              />
              <span>{copy.firstPageHeader}</span>
            </label>
          </fieldset>

          <fieldset>
            <legend>{copy.typography}</legend>
            <div className="publication-style-grid">
              <label>
                <span>{copy.font}</span>
                <input value={style.fonts.body.family} onChange={(event) => patchStyle((current) => ({
                  ...current,
                  fonts: {
                    ...current.fonts,
                    body: { ...current.fonts.body, family: event.target.value },
                    note: { ...current.fonts.note, family: event.target.value },
                  },
                }))} />
              </label>
              <NumberField label={`${copy.bodySize} (pt)`} value={body.fontSize} step={0.1} onChange={(value) => setStyleValue('body', 'fontSize', value)} />
              <NumberField label={`${copy.bodyLeading} (pt)`} value={body.lineHeight} step={0.1} onChange={(value) => setStyleValue('body', 'lineHeight', value)} />
              <NumberField label={`${copy.indent} (mm)`} value={body.firstLineIndent} step={0.5} onChange={(value) => setStyleValue('body', 'firstLineIndent', value)} />
              <NumberField label={`${copy.titleSize} (pt)`} value={title.fontSize} step={0.1} onChange={(value) => setStyleValue('articleTitlePrimary', 'fontSize', value)} />
              <NumberField label={`${copy.headingSize} (pt)`} value={heading.fontSize} step={0.1} onChange={(value) => setStyleValue('heading1', 'fontSize', value)} />
              <NumberField label={`${copy.footnoteSize} (pt)`} value={footnote.fontSize} step={0.1} onChange={(value) => setStyleValue('footnote', 'fontSize', value)} />
              <label>
                <span>{copy.alignment}</span>
                <select value={body.alignment} onChange={(event) => setStyleValue('body', 'alignment', event.target.value as Align)}>
                  <option value="justify">{copy.justify}</option>
                  <option value="left">{copy.alignLeft}</option>
                  <option value="center">{copy.alignCenter}</option>
                  <option value="right">{copy.alignRight}</option>
                </select>
              </label>
            </div>
          </fieldset>

          <div className="publication-style-actions publication-style-actions--footer">
            <button type="button" className="studio-menu-primary-action" onClick={save}><Save size={16} aria-hidden="true" />{copy.save}</button>
            <button type="button" className="studio-menu-secondary-action" onClick={exportStyle}><Download size={16} aria-hidden="true" />{copy.export}</button>
            <button type="button" className="studio-menu-secondary-action" onClick={exportCss}><FileCode2 size={16} aria-hidden="true" />{copy.exportCss}</button>
            <button type="button" className="studio-menu-secondary-action" onClick={reset}><RotateCcw size={16} aria-hidden="true" />{copy.reset}</button>
          </div>
          <p className="publication-style-live-status">{copy.liveApplied}</p>
          {saved ? <p className="publication-style-saved" role="status">{copy.saved}</p> : null}
          {message ? <p className="publication-style-saved" role="status">{message}</p> : null}
        </aside>

        <PublicationDocumentCanvas style={style} />
      </div>
    </section>
  );
}

function pageOrientation(style: PublicationStyle): PageOrientation {
  return style.page.width > style.page.height ? 'landscape' : 'portrait';
}

function pagePresetId(style: PublicationStyle): string {
  const width = Math.min(style.page.width, style.page.height);
  const height = Math.max(style.page.width, style.page.height);
  return PAGE_PRESETS.find(
    (preset) => Math.abs(preset.width - width) < 0.01
      && Math.abs(preset.height - height) < 0.01,
  )?.id ?? 'custom';
}

function fileStem(style: PublicationStyle): string {
  const value = style.name.trim() || style.id;
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'publication-style';
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
