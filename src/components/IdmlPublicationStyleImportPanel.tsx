import { FileUp } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { useTranslation } from '../i18n';
import {
  importPublicationStyleFromIdml,
  type IdmlPublicationStyleImportResult,
  type IdmlStylePatch,
} from '../services/idmlPublicationStyleImport';

type PublicationStyle = typeof templateJson;

const LEGACY_STORAGE_KEY = 'omi:publication-style:egyhaztorteneti-szemle';
const LIBRARY_STORAGE_KEY = 'omi:publication-style-library:v1';
const ACTIVE_STYLE_KEY = 'omi:publication-style-active:v1';

interface IdmlPublicationStyleImportPanelProps {
  onImported?: () => void;
  compact?: boolean;
}

export function IdmlPublicationStyleImportPanel({
  onImported,
  compact = false,
}: IdmlPublicationStyleImportPanelProps) {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    setMessage(copy.reading);
    try {
      const imported = await importPublicationStyleFromIdml(file);
      const next = createPublicationStyle(imported);
      const library = loadLibrary().filter((item) => item.id !== next.id);
      const nextLibrary = [...library, next];
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(nextLibrary));
      window.localStorage.setItem(ACTIVE_STYLE_KEY, next.id);
      window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(next));
      const mapped = imported.mappedStyles.length;
      const unmapped = imported.unmappedStyles.length;
      setMessage(copy.imported.replace('{mapped}', String(mapped)).replace('{unmapped}', String(unmapped)));
      onImported?.();
    } catch {
      // Do not render parser/package error text derived from an untrusted IDML file.
      setMessage(copy.failed);
    } finally {
      setBusy(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".idml,application/vnd.adobe.indesign-idml-package"
      hidden
      onChange={(event) => void handleFile(event)}
    />
  );

  const button = (
    <button
      type="button"
      className="studio-menu-secondary-action"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      title={copy.description}
    >
      <FileUp size={16} aria-hidden="true" />
      {busy ? copy.reading : copy.action}
    </button>
  );

  if (compact) {
    return (
      <>
        {input}
        {button}
        {message ? <span className="publication-style-saved" role="status">{message}</span> : null}
      </>
    );
  }

  return (
    <section className="publication-profile-export" aria-labelledby="idml-style-import-title">
      <div>
        <strong id="idml-style-import-title">{copy.title}</strong>
        <p>{copy.description}</p>
        {message ? <p className="publication-style-saved" role="status">{message}</p> : null}
      </div>
      {input}
      {button}
    </section>
  );
}

function createPublicationStyle(imported: IdmlPublicationStyleImportResult): PublicationStyle {
  const next = JSON.parse(JSON.stringify(templateJson)) as PublicationStyle;
  next.id = `publication-style:idml:${crypto.randomUUID()}`;
  next.name = imported.sourceName;
  next.description = `Imported from Adobe InDesign IDML: ${imported.sourceName}`;

  if (imported.page?.width !== undefined) next.page.width = imported.page.width;
  if (imported.page?.height !== undefined) next.page.height = imported.page.height;
  const margins = imported.page?.margins;
  if (margins?.top !== undefined) next.page.margins.top = margins.top;
  if (margins?.bottom !== undefined) next.page.margins.bottom = margins.bottom;
  if (margins?.inner !== undefined) next.page.margins.inner = margins.inner;
  if (margins?.outer !== undefined) next.page.margins.outer = margins.outer;

  let bodyFont: string | undefined;
  let noteFont: string | undefined;
  for (const [key, patch] of Object.entries(imported.styles) as Array<[keyof PublicationStyle['styles'], IdmlStylePatch]>) {
    if (!(key in next.styles)) continue;
    const { fontFamily, ...stylePatch } = patch;
    Object.assign(next.styles[key] as object, stylePatch);
    if (fontFamily) {
      if (key === 'footnote') noteFont = fontFamily;
      else bodyFont ??= fontFamily;
    }
  }

  if (bodyFont) {
    next.fonts.body.family = bodyFont;
    if (!noteFont) next.fonts.note.family = bodyFont;
  }
  if (noteFont) next.fonts.note.family = noteFont;
  return next;
}

function loadLibrary(): PublicationStyle[] {
  try {
    const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : undefined;
    if (Array.isArray(parsed)) return parsed as PublicationStyle[];
  } catch {
    // Start a new local library if previous data cannot be parsed.
  }
  return [];
}

function copyFor(locale: string) {
  if (locale === 'hu') return {
    title: 'InDesign stíluskészlet importálása',
    description: 'IDML-fájlból beolvassa az oldalgeometriát és a felismerhető bekezdésstílusokat. A kézirat szemantikája nem változik; az import új kiadványstílust hoz létre.',
    action: 'InDesign / IDML importálása', reading: 'IDML feldolgozása…', failed: 'Az IDML stíluskészlet nem importálható.',
    imported: 'Az InDesign stíluskészlet importálva: {mapped} stílus automatikusan megfeleltetve, {unmapped} egyedi stílus nem lett hozzárendelve.',
  };
  if (locale === 'de') return {
    title: 'InDesign-Stilsatz importieren',
    description: 'Liest Seitengeometrie und erkennbare Absatzformate aus einer IDML-Datei. Die Manuskriptsemantik bleibt unverändert; der Import erstellt einen neuen Publikationsstil.',
    action: 'InDesign / IDML importieren', reading: 'IDML wird verarbeitet…', failed: 'Der IDML-Stilsatz konnte nicht importiert werden.',
    imported: 'InDesign-Stilsatz importiert: {mapped} Formate automatisch zugeordnet, {unmapped} benutzerdefinierte Formate nicht zugeordnet.',
  };
  return {
    title: 'Import InDesign style set',
    description: 'Reads page geometry and recognizable paragraph styles from an IDML file. Manuscript semantics stay unchanged; the import creates a new publication style.',
    action: 'Import InDesign / IDML', reading: 'Processing IDML…', failed: 'The IDML style set could not be imported.',
    imported: 'InDesign style set imported: {mapped} styles mapped automatically, {unmapped} custom styles left unmapped.',
  };
}