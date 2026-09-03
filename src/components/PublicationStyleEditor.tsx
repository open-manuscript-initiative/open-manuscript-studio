import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Copy,
  Download,
  FileCode2,
  FileText,
  Move,
  Palette,
  Pilcrow,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  Trash2,
  Type,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { useTranslation } from '../i18n';
import { getManuscriptLanguageDisplayName } from '../model/manuscriptLanguage';
import type { ProofingSelection } from '../model/proofing';
import {
  paragraphStyleWouldCreateCycle,
  type PublicationParagraphStyleDefinition,
  type PublicationParagraphStyleProperties,
} from '../model/publicationParagraphStyles';
import {
  buildPublicationStyleCss,
  normalizePublicationStyle,
  resolvePublicationParagraphStyle,
  type PublicationStyle,
} from '../services/publicationStyleExport';
import { resolvePrintHyphenationModule } from '../services/printHyphenation';
import type { OmiBlock, OmiPublicationCorrectionKind } from '../types/omi';
import { PublicationDocumentCanvas } from './PublicationDocumentCanvas';
import './PublicationStyleEditor.css';

type PageOrientation = 'portrait' | 'landscape';
type PublicationRibbonPanel = 'styles' | 'paragraphStyles' | 'page' | 'margins' | 'typography' | 'proofing' | 'export' | null;

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

function makeParagraphStyleId(): string {
  return `paragraph-style:${crypto.randomUUID()}`;
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
  return normalizePublicationStyle(style);
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
    title: 'Élő kiadványszerkesztő',
    description: 'A teljes tanulmány vagy kötet szerkeszthető nyomtatási képe. A tartalmi és tipográfiai módosítások azonnal megjelennek, és ugyanezeket az értékeket használja az export.',
    styles: 'Kiadványstílusok', styleName: 'Stílus neve', newStyle: 'Új stílus', duplicate: 'Másolat készítése', deleteStyle: 'Stílus törlése', cannotDeleteLast: 'Legalább egy kiadványstílusnak meg kell maradnia.',
    page: 'Nyomtatási oldal', preset: 'Oldalformátum', custom: 'Egyéni méret', orientation: 'Tájolás', portrait: 'Álló', landscape: 'Fekvő', width: 'Vágott szélesség', height: 'Vágott magasság', pageNumberStart: 'Első oldalszám', margins: 'Margók és nyomdai adatok', top: 'Felső', bottom: 'Alsó', inner: 'Belső', outer: 'Külső', gutter: 'Kötésmargó', bleed: 'Kifutó', mirroredMargins: 'Tükrözött margók páros és páratlan oldalakon', cropMarks: 'Vágójelek kérése a nyomdai exportban', runningHeaders: 'Élőfej megjelenítése', firstPageHeader: 'Élőfej az első oldalon is',
    typography: 'Tipográfia', font: 'Betűcsalád', bodySize: 'Törzsszöveg mérete', bodyLeading: 'Törzsszöveg sorköze', indent: 'Első sor behúzása', hyphenation: 'Automatikus elválasztás a nyomtatható változatokban', hyphenationModule: 'Nyelvi modul', hyphenationInline: 'A nyelvjelölt szövegrészek automatikusan a saját moduljukat használják.', hyphenationFallback: 'Ehhez a nyelvhez nincs beépített minta; a nyomtató böngésző elválasztási szótára használható.',
    titleSize: 'Cím mérete', headingSize: 'Címsor mérete', footnoteSize: 'Lábjegyzet mérete', alignment: 'Igazítás', justify: 'Sorkizárt', alignLeft: 'Balra', alignCenter: 'Középre', alignRight: 'Jobbra',
    save: 'Stílus mentése', saved: 'A stílus mentve és aktív', reset: 'Sablonértékek visszaállítása', export: 'Stílus exportálása', exportCss: 'CSS letöltése', defaultNewName: 'Új kiadványstílus', copySuffix: 'másolat', liveApplied: 'A módosítások automatikusan az aktív exportstílusba kerülnek.', proofing: 'Tördelési korrektúra', proofingHelp: 'A javítások csak a nyomtatási elrendezést módosítják; a kézirat szövege változatlan marad.', selectedText: 'Kijelölés', placeCursor: 'Helyezze a kurzort vagy jelöljön ki szöveget a nyomtatási képen.', optionalHyphen: 'Feltételes elválasztójel', nonbreaking: 'Egyben tartott kijelölés', forcedLineBreak: 'Kényszerített sortörés', pageBreakBefore: 'Oldaltörés elé', keepTogether: 'Bekezdés egyben tartása', keepWithNext: 'Együtt a következővel', corrections: 'Aktív tördelési javítások', noCorrections: 'Még nincs kézi tördelési javítás.', removeCorrection: 'Javítás eltávolítása', correctionAdded: 'A tördelési javítás hozzáadva.', selectRange: 'Ehhez a művelethez jelöljön ki szöveget.',
    paragraphStyles: 'Bekezdésstílusok', paragraphStylesHelp: 'Az InDesignhoz hasonlóan az „Alapja” örökíti a formázást, a „Következő stílus” pedig új bekezdés létrehozásakor lép életbe.', selectedParagraphStyle: 'Kijelölt bekezdés stílusa', noParagraphSelected: 'Kattintson egy bekezdésbe a hozzárendeléshez.', paragraphStyleName: 'Stílus neve', newParagraphStyle: 'Új bekezdésstílus', deleteParagraphStyle: 'Bekezdésstílus törlése', defaultParagraphStyle: 'Az alapértelmezett stílus nem törölhető.', basedOn: 'Alapja', nextStyle: 'Következő stílus', noBaseStyle: '[Nincs bekezdésstílus]', characterFormatting: 'Alapvető karakterformátumok', paragraphFormatting: 'Behúzások és térközök', fontWeight: 'Betűvastagság', fontStyle: 'Betűstílus', normal: 'Normál', italic: 'Dőlt', leftIndent: 'Bal behúzás', rightIndent: 'Jobb behúzás', spaceBefore: 'Térköz előtte', spaceAfter: 'Térköz utána', widows: 'Fattyúsorok', orphans: 'Árvasorok', clearOverrides: 'Helyi felülírások törlése', styleApplied: 'A bekezdésstílus alkalmazva.', inheritedValues: 'A nem felülírt tulajdonságok az alapstílusból öröklődnek.',
  };
  if (locale === 'de') return {
    title: 'Live-Publikationseditor', description: 'Die vollständige, bearbeitbare Druckansicht des Beitrags oder Bandes. Inhaltliche und typografische Änderungen erscheinen sofort und werden für den Export verwendet.', styles: 'Publikationsstile', styleName: 'Stilname', newStyle: 'Neuer Stil', duplicate: 'Duplizieren', deleteStyle: 'Stil löschen', cannotDeleteLast: 'Mindestens ein Publikationsstil muss erhalten bleiben.', page: 'Druckseite', preset: 'Seitenformat', custom: 'Benutzerdefiniert', orientation: 'Ausrichtung', portrait: 'Hochformat', landscape: 'Querformat', width: 'Endbreite', height: 'Endhöhe', pageNumberStart: 'Erste Seitenzahl', margins: 'Ränder und Druckdaten', top: 'Oben', bottom: 'Unten', inner: 'Innen', outer: 'Außen', gutter: 'Bundsteg', bleed: 'Beschnitt', mirroredMargins: 'Gespiegelte Ränder für gerade und ungerade Seiten', cropMarks: 'Schnittmarken im Druckexport', runningHeaders: 'Kolumnentitel anzeigen', firstPageHeader: 'Kolumnentitel auch auf der ersten Seite', typography: 'Typografie', font: 'Schriftfamilie', bodySize: 'Grundschrift', bodyLeading: 'Zeilenabstand', indent: 'Erstzeileneinzug', hyphenation: 'Automatische Silbentrennung in Druckausgaben', hyphenationModule: 'Sprachmodul', hyphenationInline: 'Sprachmarkierte Textteile verwenden automatisch ihr eigenes Modul.', hyphenationFallback: 'Für diese Sprache ist kein Muster eingebaut; das Wörterbuch des Druckbrowsers kann verwendet werden.', titleSize: 'Titelgröße', headingSize: 'Überschriftgröße', footnoteSize: 'Fußnotengröße', alignment: 'Ausrichtung', justify: 'Blocksatz', alignLeft: 'Links', alignCenter: 'Zentriert', alignRight: 'Rechts', save: 'Stil speichern', saved: 'Stil gespeichert und aktiv', reset: 'Vorlagenwerte zurücksetzen', export: 'Stil exportieren', exportCss: 'CSS herunterladen', defaultNewName: 'Neuer Publikationsstil', copySuffix: 'Kopie', liveApplied: 'Änderungen werden automatisch auf den aktiven Exportstil angewendet.', proofing: 'Satzkorrektur', proofingHelp: 'Korrekturen ändern nur den Drucksatz; der Manuskripttext bleibt unverändert.', selectedText: 'Auswahl', placeCursor: 'Setzen Sie den Cursor oder markieren Sie Text im Druckbild.', optionalHyphen: 'Bedingter Trennstrich', nonbreaking: 'Auswahl zusammenhalten', forcedLineBreak: 'Erzwungener Zeilenumbruch', pageBreakBefore: 'Seitenumbruch davor', keepTogether: 'Absatz zusammenhalten', keepWithNext: 'Mit nächstem zusammenhalten', corrections: 'Aktive Satzkorrekturen', noCorrections: 'Noch keine manuellen Satzkorrekturen.', removeCorrection: 'Korrektur entfernen', correctionAdded: 'Satzkorrektur hinzugefügt.', selectRange: 'Markieren Sie für diese Aktion Text.', paragraphStyles: 'Absatzformate', paragraphStylesHelp: 'Wie in InDesign vererbt „Basiert auf“ die Formatierung; „Nächstes Format“ wird beim Erstellen eines neuen Absatzes angewendet.', selectedParagraphStyle: 'Format des ausgewählten Absatzes', noParagraphSelected: 'Klicken Sie zum Zuweisen in einen Absatz.', paragraphStyleName: 'Formatname', newParagraphStyle: 'Neues Absatzformat', deleteParagraphStyle: 'Absatzformat löschen', defaultParagraphStyle: 'Das Standardformat kann nicht gelöscht werden.', basedOn: 'Basiert auf', nextStyle: 'Nächstes Format', noBaseStyle: '[Kein Absatzformat]', characterFormatting: 'Grundlegende Zeichenformate', paragraphFormatting: 'Einzüge und Abstände', fontWeight: 'Schriftstärke', fontStyle: 'Schriftschnitt', normal: 'Normal', italic: 'Kursiv', leftIndent: 'Linker Einzug', rightIndent: 'Rechter Einzug', spaceBefore: 'Abstand davor', spaceAfter: 'Abstand danach', widows: 'Schusterjungen', orphans: 'Hurenkinder', clearOverrides: 'Lokale Überschreibungen löschen', styleApplied: 'Absatzformat angewendet.', inheritedValues: 'Nicht überschriebene Eigenschaften werden vom Basisformat geerbt.',
  };
  return {
    title: 'Live publication editor', description: 'The complete editable print view of the article or volume. Content and typography changes appear immediately and drive the same export settings.', styles: 'Publication styles', styleName: 'Style name', newStyle: 'New style', duplicate: 'Duplicate', deleteStyle: 'Delete style', cannotDeleteLast: 'At least one publication style must remain.', page: 'Print page', preset: 'Page format', custom: 'Custom size', orientation: 'Orientation', portrait: 'Portrait', landscape: 'Landscape', width: 'Trim width', height: 'Trim height', pageNumberStart: 'First page number', margins: 'Margins and print data', top: 'Top', bottom: 'Bottom', inner: 'Inner', outer: 'Outer', gutter: 'Gutter', bleed: 'Bleed', mirroredMargins: 'Mirror margins on facing pages', cropMarks: 'Include crop marks in print export', runningHeaders: 'Show running headers', firstPageHeader: 'Show running header on first page', typography: 'Typography', font: 'Font family', bodySize: 'Body size', bodyLeading: 'Body leading', indent: 'First-line indent', hyphenation: 'Automatic hyphenation in printable versions', hyphenationModule: 'Language module', hyphenationInline: 'Language-tagged passages automatically use their own module.', hyphenationFallback: 'No built-in pattern is available for this language; the print browser dictionary may be used.', titleSize: 'Title size', headingSize: 'Heading size', footnoteSize: 'Footnote size', alignment: 'Alignment', justify: 'Justified', alignLeft: 'Left', alignCenter: 'Center', alignRight: 'Right', save: 'Save style', saved: 'Style saved and active', reset: 'Reset template values', export: 'Export style', exportCss: 'Download CSS', defaultNewName: 'New publication style', copySuffix: 'copy', liveApplied: 'Changes are applied to the active export style automatically.', proofing: 'Typesetting proofing', proofingHelp: 'Corrections affect only the print layout; the manuscript text remains unchanged.', selectedText: 'Selection', placeCursor: 'Place the cursor or select text in the print view.', optionalHyphen: 'Optional hyphen', nonbreaking: 'Keep selection together', forcedLineBreak: 'Forced line break', pageBreakBefore: 'Page break before', keepTogether: 'Keep paragraph together', keepWithNext: 'Keep with next', corrections: 'Active typesetting corrections', noCorrections: 'No manual typesetting corrections yet.', removeCorrection: 'Remove correction', correctionAdded: 'Typesetting correction added.', selectRange: 'Select text for this action.', paragraphStyles: 'Paragraph styles', paragraphStylesHelp: 'As in InDesign, “Based on” inherits formatting and “Next style” applies when a new paragraph is created.', selectedParagraphStyle: 'Selected paragraph style', noParagraphSelected: 'Click inside a paragraph to assign a style.', paragraphStyleName: 'Style name', newParagraphStyle: 'New paragraph style', deleteParagraphStyle: 'Delete paragraph style', defaultParagraphStyle: 'The default style cannot be deleted.', basedOn: 'Based on', nextStyle: 'Next style', noBaseStyle: '[No paragraph style]', characterFormatting: 'Basic character formats', paragraphFormatting: 'Indents and spacing', fontWeight: 'Font weight', fontStyle: 'Font style', normal: 'Regular', italic: 'Italic', leftIndent: 'Left indent', rightIndent: 'Right indent', spaceBefore: 'Space before', spaceAfter: 'Space after', widows: 'Widow lines', orphans: 'Orphan lines', clearOverrides: 'Clear local overrides', styleApplied: 'Paragraph style applied.', inheritedValues: 'Properties without overrides inherit from the based-on style.',
  };
}

export function PublicationStyleEditor() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const manuscriptLanguage = manuscript.locale;
  const publicationCorrections = manuscript.publicationCorrections ?? [];
  const addPublicationCorrection = useStudioStore(
    (state) => state.addPublicationCorrection,
  );
  const removePublicationCorrection = useStudioStore(
    (state) => state.removePublicationCorrection,
  );
  const setBlockParagraphStyle = useStudioStore(
    (state) => state.setBlockParagraphStyle,
  );
  const clearParagraphStyleAssignments = useStudioStore(
    (state) => state.clearParagraphStyleAssignments,
  );
  const copy = copyFor(locale);
  const initial = useMemo(loadInitialState, []);
  const [library, setLibrary] = useState<PublicationStyle[]>(initial.library);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [style, setStyle] = useState<PublicationStyle>(initial.style);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [openPanel, setOpenPanel] = useState<PublicationRibbonPanel>(null);
  const [proofingSelection, setProofingSelection] = useState<ProofingSelection | null>(null);
  const [activeParagraphStyleId, setActiveParagraphStyleId] = useState(
    initial.style.paragraphStyles.defaultStyleId,
  );
  const ribbonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    persistLibrary(upsertStyle(library, activeId, style), style);
  }, [activeId, library, style]);

  useEffect(() => {
    if (!openPanel) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!ribbonRef.current?.contains(event.target as Node)) setOpenPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpenPanel(null);
    };
    document.addEventListener('pointerdown', closeOnPointerDown, true);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown, true);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [openPanel]);

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
    value: string | number | boolean,
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
    setActiveParagraphStyleId(next.paragraphStyles.defaultStyleId);
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
    setActiveParagraphStyleId(next.paragraphStyles.defaultStyleId);
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
    setActiveParagraphStyleId(next.paragraphStyles.defaultStyleId);
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
    setActiveParagraphStyleId(next.paragraphStyles.defaultStyleId);
    persistLibrary(nextLibrary, next);
    setSaved(true);
    setMessage('');
  }

  function reset(): void {
    const next = cloneTemplate();
    next.id = style.id;
    next.name = style.name;
    setStyle(next);
    setActiveParagraphStyleId(next.paragraphStyles.defaultStyleId);
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

  function addCorrection(kind: OmiPublicationCorrectionKind): void {
    if (!proofingSelection) {
      setMessage(copy.placeCursor);
      return;
    }
    if (kind === 'nonbreaking' && !proofingSelection.text.trim()) {
      setMessage(copy.selectRange);
      return;
    }
    if (
      (kind === 'discretionary-hyphen' || kind === 'forced-line-break')
      && proofingSelection.from !== proofingSelection.to
    ) {
      setMessage(copy.placeCursor);
      return;
    }
    addPublicationCorrection(kind, proofingSelection);
    setMessage(copy.correctionAdded);
  }

  function patchParagraphStyle(
    styleId: string,
    update: (definition: PublicationParagraphStyleDefinition) => PublicationParagraphStyleDefinition,
  ): void {
    patchStyle((current) => ({
      ...current,
      paragraphStyles: {
        ...current.paragraphStyles,
        items: current.paragraphStyles.items.map((definition) => (
          definition.id === styleId ? update(definition) : definition
        )),
      },
    }));
  }

  function setParagraphStyleProperty<K extends keyof PublicationParagraphStyleProperties>(
    property: K,
    value: PublicationParagraphStyleProperties[K],
  ): void {
    patchParagraphStyle(activeParagraphStyleId, (definition) => ({
      ...definition,
      properties: { ...definition.properties, [property]: value },
    }));
  }

  function createParagraphStyle(): void {
    const id = makeParagraphStyleId();
    const ordinal = style.paragraphStyles.items.length + 1;
    const definition: PublicationParagraphStyleDefinition = {
      id,
      name: `${copy.newParagraphStyle} ${ordinal}`,
      basedOnId: activeParagraphStyleId || style.paragraphStyles.defaultStyleId,
      nextStyleId: style.paragraphStyles.defaultStyleId,
      properties: {},
    };
    patchStyle((current) => ({
      ...current,
      paragraphStyles: {
        ...current.paragraphStyles,
        items: [...current.paragraphStyles.items, definition],
      },
    }));
    setActiveParagraphStyleId(id);
  }

  function duplicateParagraphStyle(): void {
    const source = style.paragraphStyles.items.find(
      (definition) => definition.id === activeParagraphStyleId,
    );
    if (!source) return;
    const id = makeParagraphStyleId();
    const definition: PublicationParagraphStyleDefinition = {
      ...source,
      id,
      name: `${source.name} — ${copy.copySuffix}`,
      properties: { ...source.properties },
    };
    patchStyle((current) => ({
      ...current,
      paragraphStyles: {
        ...current.paragraphStyles,
        items: [...current.paragraphStyles.items, definition],
      },
    }));
    setActiveParagraphStyleId(id);
  }

  function deleteParagraphStyle(): void {
    const collection = style.paragraphStyles;
    if (activeParagraphStyleId === collection.defaultStyleId) {
      setMessage(copy.defaultParagraphStyle);
      return;
    }
    const removed = collection.items.find(
      (definition) => definition.id === activeParagraphStyleId,
    );
    if (!removed) return;
    patchStyle((current) => ({
      ...current,
      paragraphStyles: {
        ...current.paragraphStyles,
        items: current.paragraphStyles.items
          .filter((definition) => definition.id !== activeParagraphStyleId)
          .map((definition) => ({
            ...definition,
            basedOnId: definition.basedOnId === activeParagraphStyleId
              ? removed.basedOnId
              : definition.basedOnId,
            nextStyleId: definition.nextStyleId === activeParagraphStyleId
              ? current.paragraphStyles.defaultStyleId
              : definition.nextStyleId,
          })),
      },
    }));
    clearParagraphStyleAssignments(activeParagraphStyleId);
    setActiveParagraphStyleId(collection.defaultStyleId);
  }

  function assignParagraphStyle(styleId: string): void {
    if (!selectedParagraphBlock || !paragraphStyleAssignable) {
      setMessage(copy.noParagraphSelected);
      return;
    }
    const storedStyleId = styleId === style.paragraphStyles.defaultStyleId
      ? undefined
      : styleId;
    setBlockParagraphStyle(selectedParagraphBlock.id, storedStyleId);
    setActiveParagraphStyleId(styleId);
    setMessage(copy.styleApplied);
  }

  function clearParagraphStyleOverrides(): void {
    patchParagraphStyle(activeParagraphStyleId, (definition) => ({
      ...definition,
      properties: {},
    }));
  }

  const body = style.styles.body;
  const title = style.styles.articleTitlePrimary;
  const heading = style.styles.heading1;
  const footnote = style.styles.footnote;
  const selectedPreset = pagePresetId(style);
  const hyphenationModule = resolvePrintHyphenationModule(manuscriptLanguage);
  const manuscriptLanguageName = getManuscriptLanguageDisplayName(manuscriptLanguage, locale);
  const selectedParagraphBlock = proofingSelection
    ? findManuscriptBlock(
        manuscript.sections.flatMap((section) => section.blocks),
        proofingSelection.blockId,
      )
    : undefined;
  const paragraphStyleAssignable = selectedParagraphBlock?.type === 'paragraph'
    || selectedParagraphBlock?.type === 'quote';
  const assignedParagraphStyleId = selectedParagraphBlock?.paragraphStyleId;
  const selectedParagraphStyleId = style.paragraphStyles.items.some(
    (definition) => definition.id === assignedParagraphStyleId,
  )
    ? assignedParagraphStyleId!
    : style.paragraphStyles.defaultStyleId;
  const activeParagraphStyle = style.paragraphStyles.items.find(
    (definition) => definition.id === activeParagraphStyleId,
  ) ?? style.paragraphStyles.items[0];
  const resolvedParagraphStyle = resolvePublicationParagraphStyle(
    style,
    activeParagraphStyle?.id,
  );

  useEffect(() => {
    if (!paragraphStyleAssignable) return;
    setActiveParagraphStyleId(selectedParagraphStyleId);
  }, [paragraphStyleAssignable, proofingSelection?.blockId, selectedParagraphStyleId]);

  return (
    <section className="publication-style-editor" aria-labelledby="publication-style-editor-title">
      <div className="publication-profile-section-heading publication-style-editor-heading">
        <div>
          <h4 id="publication-style-editor-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="publication-style-ribbon" ref={ribbonRef}>
        <div className="publication-style-ribbon-row">
          <div className="publication-style-ribbon-actions" role="toolbar" aria-label={copy.title}>
            <PublicationRibbonMenuButton
              panelId="styles"
              label={copy.styles}
              icon={<Palette size={18} aria-hidden="true" />}
              open={openPanel === 'styles'}
              onToggle={() => setOpenPanel((current) => current === 'styles' ? null : 'styles')}
            />
            <PublicationRibbonMenuButton
              panelId="paragraphStyles"
              label={copy.paragraphStyles}
              icon={<Pilcrow size={18} aria-hidden="true" />}
              open={openPanel === 'paragraphStyles'}
              onToggle={() => setOpenPanel((current) => current === 'paragraphStyles' ? null : 'paragraphStyles')}
            />
            <PublicationRibbonMenuButton
              panelId="page"
              label={copy.page}
              icon={<FileText size={18} aria-hidden="true" />}
              open={openPanel === 'page'}
              onToggle={() => setOpenPanel((current) => current === 'page' ? null : 'page')}
            />
            <PublicationRibbonMenuButton
              panelId="margins"
              label={copy.margins}
              icon={<Move size={18} aria-hidden="true" />}
              open={openPanel === 'margins'}
              onToggle={() => setOpenPanel((current) => current === 'margins' ? null : 'margins')}
            />
            <PublicationRibbonMenuButton
              panelId="typography"
              label={copy.typography}
              icon={<Type size={18} aria-hidden="true" />}
              open={openPanel === 'typography'}
              onToggle={() => setOpenPanel((current) => current === 'typography' ? null : 'typography')}
            />
            <PublicationRibbonMenuButton
              panelId="proofing"
              label={copy.proofing}
              icon={<Scissors size={18} aria-hidden="true" />}
              open={openPanel === 'proofing'}
              onToggle={() => setOpenPanel((current) => current === 'proofing' ? null : 'proofing')}
            />
            <span className="publication-style-ribbon-separator" aria-hidden="true" />
            <PublicationRibbonActionButton label={copy.save} onClick={() => { save(); setOpenPanel(null); }}>
              <Save size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
            <PublicationRibbonMenuButton
              panelId="export"
              label={copy.export}
              icon={<Download size={18} aria-hidden="true" />}
              open={openPanel === 'export'}
              onToggle={() => setOpenPanel((current) => current === 'export' ? null : 'export')}
            />
            <PublicationRibbonActionButton label={copy.reset} onClick={() => { reset(); setOpenPanel(null); }}>
              <RotateCcw size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
          </div>
          <div className="publication-style-ribbon-status" aria-live="polite">
            <strong title={style.name}>{style.name || copy.defaultNewName}</strong>
            <span>{message || (saved ? copy.saved : copy.liveApplied)}</span>
          </div>
        </div>

        {openPanel === 'styles' ? (
          <div id="publication-style-ribbon-panel-styles" className="publication-style-ribbon-panel" role="dialog" aria-label={copy.styles}>
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
          </div>
        ) : null}

        {openPanel === 'paragraphStyles' && activeParagraphStyle ? (
          <div id="publication-style-ribbon-panel-paragraphStyles" className="publication-style-ribbon-panel publication-style-ribbon-panel--paragraph-styles" role="dialog" aria-label={copy.paragraphStyles}>
            <fieldset>
              <legend>{copy.paragraphStyles}</legend>
              <p className="publication-paragraph-style-help">{copy.paragraphStylesHelp}</p>
              <label className="publication-paragraph-style-assignment">
                <span>{copy.selectedParagraphStyle}</span>
                <select
                  value={selectedParagraphStyleId}
                  disabled={!paragraphStyleAssignable}
                  onChange={(event) => assignParagraphStyle(event.target.value)}
                >
                  {style.paragraphStyles.items.map((definition) => (
                    <option key={definition.id} value={definition.id}>{definition.name}</option>
                  ))}
                </select>
                {!paragraphStyleAssignable ? <small>{copy.noParagraphSelected}</small> : null}
              </label>

              <div className="publication-paragraph-style-workspace">
                <div className="publication-paragraph-style-list-column">
                  <div className="publication-paragraph-style-list" role="listbox" aria-label={copy.paragraphStyles}>
                    {style.paragraphStyles.items.map((definition) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={definition.id === activeParagraphStyle.id}
                        className={definition.id === activeParagraphStyle.id ? 'is-active' : ''}
                        key={definition.id}
                        onClick={() => setActiveParagraphStyleId(definition.id)}
                      >
                        <Pilcrow size={14} aria-hidden="true" />
                        <span>{definition.name}</span>
                        {definition.id === style.paragraphStyles.defaultStyleId ? <small>¶</small> : null}
                      </button>
                    ))}
                  </div>
                  <div className="publication-paragraph-style-icon-actions">
                    <button type="button" title={copy.newParagraphStyle} aria-label={copy.newParagraphStyle} onClick={createParagraphStyle}><Plus size={16} /></button>
                    <button type="button" title={copy.duplicate} aria-label={copy.duplicate} onClick={duplicateParagraphStyle}><Copy size={16} /></button>
                    <button type="button" title={copy.deleteParagraphStyle} aria-label={copy.deleteParagraphStyle} disabled={activeParagraphStyle.id === style.paragraphStyles.defaultStyleId} onClick={deleteParagraphStyle}><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="publication-paragraph-style-settings">
                  <div className="publication-style-grid">
                    <label>
                      <span>{copy.paragraphStyleName}</span>
                      <input value={activeParagraphStyle.name} onChange={(event) => patchParagraphStyle(activeParagraphStyle.id, (definition) => ({ ...definition, name: event.target.value }))} />
                    </label>
                    <label>
                      <span>{copy.basedOn}</span>
                      <select
                        value={activeParagraphStyle.basedOnId ?? ''}
                        onChange={(event) => patchParagraphStyle(activeParagraphStyle.id, (definition) => ({ ...definition, basedOnId: event.target.value || null }))}
                      >
                        <option value="">{copy.noBaseStyle}</option>
                        {style.paragraphStyles.items
                          .filter((definition) => !paragraphStyleWouldCreateCycle(style.paragraphStyles, activeParagraphStyle.id, definition.id))
                          .map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>{copy.nextStyle}</span>
                      <select value={activeParagraphStyle.nextStyleId ?? style.paragraphStyles.defaultStyleId} onChange={(event) => patchParagraphStyle(activeParagraphStyle.id, (definition) => ({ ...definition, nextStyleId: event.target.value }))}>
                        {style.paragraphStyles.items.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
                      </select>
                    </label>
                  </div>

                  <h5>{copy.characterFormatting}</h5>
                  <div className="publication-style-grid">
                    <label>
                      <span>{copy.font}</span>
                      <input value={resolvedParagraphStyle.fontFamily} onChange={(event) => setParagraphStyleProperty('fontFamily', event.target.value)} />
                    </label>
                    <NumberField label={`${copy.bodySize} (pt)`} value={resolvedParagraphStyle.fontSize} step={0.1} onChange={(value) => setParagraphStyleProperty('fontSize', value)} />
                    <NumberField label={`${copy.bodyLeading} (pt)`} value={resolvedParagraphStyle.lineHeight} step={0.1} onChange={(value) => setParagraphStyleProperty('lineHeight', value)} />
                    <label>
                      <span>{copy.fontWeight}</span>
                      <select value={String(resolvedParagraphStyle.fontWeight)} onChange={(event) => setParagraphStyleProperty('fontWeight', Number(event.target.value))}>
                        <option value="300">300</option><option value="400">400</option><option value="500">500</option><option value="600">600</option><option value="700">700</option>
                      </select>
                    </label>
                    <label>
                      <span>{copy.fontStyle}</span>
                      <select value={resolvedParagraphStyle.fontStyle} onChange={(event) => setParagraphStyleProperty('fontStyle', event.target.value as PublicationParagraphStyleProperties['fontStyle'])}>
                        <option value="normal">{copy.normal}</option>
                        <option value="italic">{copy.italic}</option>
                      </select>
                    </label>
                    <div className="publication-style-alignment" role="group" aria-label={copy.alignment}>
                      <span>{copy.alignment}</span>
                      <div>
                        <AlignmentButton label={copy.justify} active={resolvedParagraphStyle.alignment === 'justify'} onClick={() => setParagraphStyleProperty('alignment', 'justify')}><AlignJustify size={17} aria-hidden="true" /></AlignmentButton>
                        <AlignmentButton label={copy.alignLeft} active={resolvedParagraphStyle.alignment === 'left'} onClick={() => setParagraphStyleProperty('alignment', 'left')}><AlignLeft size={17} aria-hidden="true" /></AlignmentButton>
                        <AlignmentButton label={copy.alignCenter} active={resolvedParagraphStyle.alignment === 'center'} onClick={() => setParagraphStyleProperty('alignment', 'center')}><AlignCenter size={17} aria-hidden="true" /></AlignmentButton>
                        <AlignmentButton label={copy.alignRight} active={resolvedParagraphStyle.alignment === 'right'} onClick={() => setParagraphStyleProperty('alignment', 'right')}><AlignRight size={17} aria-hidden="true" /></AlignmentButton>
                      </div>
                    </div>
                  </div>

                  <h5>{copy.paragraphFormatting}</h5>
                  <div className="publication-style-grid">
                    <NumberField label={`${copy.indent} (mm)`} value={resolvedParagraphStyle.firstLineIndent} step={0.5} onChange={(value) => setParagraphStyleProperty('firstLineIndent', value)} />
                    <NumberField label={`${copy.leftIndent} (mm)`} value={resolvedParagraphStyle.leftIndent} step={0.5} onChange={(value) => setParagraphStyleProperty('leftIndent', value)} />
                    <NumberField label={`${copy.rightIndent} (mm)`} value={resolvedParagraphStyle.rightIndent} step={0.5} onChange={(value) => setParagraphStyleProperty('rightIndent', value)} />
                    <NumberField label={`${copy.spaceBefore} (pt)`} value={resolvedParagraphStyle.spaceBefore} step={0.5} onChange={(value) => setParagraphStyleProperty('spaceBefore', value)} />
                    <NumberField label={`${copy.spaceAfter} (pt)`} value={resolvedParagraphStyle.spaceAfter} step={0.5} onChange={(value) => setParagraphStyleProperty('spaceAfter', value)} />
                    <NumberField label={copy.widows} value={resolvedParagraphStyle.widows} min={1} step={1} onChange={(value) => setParagraphStyleProperty('widows', Math.trunc(value))} />
                    <NumberField label={copy.orphans} value={resolvedParagraphStyle.orphans} min={1} step={1} onChange={(value) => setParagraphStyleProperty('orphans', Math.trunc(value))} />
                  </div>
                  <div className="publication-style-toggle-grid">
                    <label className="publication-style-toggle"><input type="checkbox" checked={resolvedParagraphStyle.hyphenation} onChange={(event) => setParagraphStyleProperty('hyphenation', event.target.checked)} /><span>{copy.hyphenation}</span></label>
                    <label className="publication-style-toggle"><input type="checkbox" checked={resolvedParagraphStyle.keepTogether} onChange={(event) => setParagraphStyleProperty('keepTogether', event.target.checked)} /><span>{copy.keepTogether}</span></label>
                    <label className="publication-style-toggle"><input type="checkbox" checked={resolvedParagraphStyle.keepWithNext} onChange={(event) => setParagraphStyleProperty('keepWithNext', event.target.checked)} /><span>{copy.keepWithNext}</span></label>
                  </div>
                  <div className="publication-style-actions">
                    <button type="button" className="studio-menu-secondary-action" disabled={!Object.keys(activeParagraphStyle.properties).length} onClick={clearParagraphStyleOverrides}><RotateCcw size={16} />{copy.clearOverrides}</button>
                    <small className="publication-paragraph-style-inheritance-note">{copy.inheritedValues}</small>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        ) : null}

        {openPanel === 'page' ? (
          <div id="publication-style-ribbon-panel-page" className="publication-style-ribbon-panel" role="dialog" aria-label={copy.page}>
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
          </div>
        ) : null}

        {openPanel === 'margins' ? (
          <div id="publication-style-ribbon-panel-margins" className="publication-style-ribbon-panel" role="dialog" aria-label={copy.margins}>
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
              <div className="publication-style-toggle-grid">
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
              </div>
            </fieldset>
          </div>
        ) : null}

        {openPanel === 'typography' ? (
          <div id="publication-style-ribbon-panel-typography" className="publication-style-ribbon-panel" role="dialog" aria-label={copy.typography}>
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
                <div className="publication-style-alignment" role="group" aria-label={copy.alignment}>
                  <span>{copy.alignment}</span>
                  <div>
                    <AlignmentButton label={copy.justify} active={body.alignment === 'justify'} onClick={() => setStyleValue('body', 'alignment', 'justify')}><AlignJustify size={17} aria-hidden="true" /></AlignmentButton>
                    <AlignmentButton label={copy.alignLeft} active={body.alignment === 'left'} onClick={() => setStyleValue('body', 'alignment', 'left')}><AlignLeft size={17} aria-hidden="true" /></AlignmentButton>
                    <AlignmentButton label={copy.alignCenter} active={body.alignment === 'center'} onClick={() => setStyleValue('body', 'alignment', 'center')}><AlignCenter size={17} aria-hidden="true" /></AlignmentButton>
                    <AlignmentButton label={copy.alignRight} active={body.alignment === 'right'} onClick={() => setStyleValue('body', 'alignment', 'right')}><AlignRight size={17} aria-hidden="true" /></AlignmentButton>
                  </div>
                </div>
              </div>
              <label className="publication-style-toggle">
                <input
                  type="checkbox"
                  checked={body.hyphenation}
                  onChange={(event) => setStyleValue('body', 'hyphenation', event.target.checked)}
                />
                <span>{copy.hyphenation}</span>
              </label>
              <p className="publication-style-hyphenation-module">
                {hyphenationModule
                  ? `${copy.hyphenationModule}: ${manuscriptLanguageName} (${hyphenationModule}). ${copy.hyphenationInline}`
                  : `${copy.hyphenationModule}: ${manuscriptLanguageName}. ${copy.hyphenationFallback}`}
              </p>
            </fieldset>
          </div>
        ) : null}

        {openPanel === 'export' ? (
          <div id="publication-style-ribbon-panel-export" className="publication-style-ribbon-panel publication-style-ribbon-panel--compact" role="dialog" aria-label={copy.export}>
            <div className="publication-style-actions">
              <button type="button" className="studio-menu-secondary-action" onClick={() => { exportStyle(); setOpenPanel(null); }}><Download size={16} aria-hidden="true" />{copy.export}</button>
              <button type="button" className="studio-menu-secondary-action" onClick={() => { exportCss(); setOpenPanel(null); }}><FileCode2 size={16} aria-hidden="true" />{copy.exportCss}</button>
            </div>
          </div>
        ) : null}

        {openPanel === 'proofing' ? (
          <div id="publication-style-ribbon-panel-proofing" className="publication-style-ribbon-panel publication-style-ribbon-panel--proofing" role="dialog" aria-label={copy.proofing}>
            <fieldset>
              <legend>{copy.proofing}</legend>
              <p className="publication-proofing-help">{copy.proofingHelp}</p>
              <div className={`publication-proofing-selection${proofingSelection ? '' : ' is-empty'}`}>
                <strong>{copy.selectedText}:</strong>{' '}
                {proofingSelection
                  ? proofingSelection.text.trim()
                    ? `“${proofingSelection.text.trim().slice(0, 160)}”`
                    : `${proofingSelection.blockId} · ${proofingSelection.from}`
                  : copy.placeCursor}
              </div>
              <div className="publication-proofing-actions">
                <button type="button" disabled={!proofingSelection || proofingSelection.from !== proofingSelection.to} onClick={() => addCorrection('discretionary-hyphen')}><Scissors size={16} />{copy.optionalHyphen}</button>
                <button type="button" disabled={!proofingSelection?.text.trim()} onClick={() => addCorrection('nonbreaking')}><LinkIcon />{copy.nonbreaking}</button>
                <button type="button" disabled={!proofingSelection || proofingSelection.from !== proofingSelection.to} onClick={() => addCorrection('forced-line-break')}><CornerIcon />{copy.forcedLineBreak}</button>
                <button type="button" disabled={!proofingSelection} onClick={() => addCorrection('page-break-before')}><FileText size={16} />{copy.pageBreakBefore}</button>
                <button type="button" disabled={!proofingSelection} onClick={() => addCorrection('keep-together')}><AlignJustify size={16} />{copy.keepTogether}</button>
                <button type="button" disabled={!proofingSelection} onClick={() => addCorrection('keep-with-next')}><Move size={16} />{copy.keepWithNext}</button>
              </div>
              <div className="publication-proofing-corrections">
                <h5>{copy.corrections} <span>{publicationCorrections.length}</span></h5>
                {publicationCorrections.length ? (
                  <ol>
                    {publicationCorrections.map((correction) => (
                      <li key={correction.id}>
                        <span><strong>{publicationCorrectionLabel(correction.kind, copy)}</strong><small>{correction.sourceText?.trim() ? `“${correction.sourceText.trim().slice(0, 72)}”` : correction.targetBlockId}</small></span>
                        <button type="button" onClick={() => removePublicationCorrection(correction.id)} aria-label={copy.removeCorrection} title={copy.removeCorrection}><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ol>
                ) : <p>{copy.noCorrections}</p>}
              </div>
            </fieldset>
          </div>
        ) : null}
      </div>

      <div className="publication-style-editor-layout">
        <PublicationDocumentCanvas style={style}
          onProofingSelection={setProofingSelection}
        />
      </div>
    </section>
  );
}

function LinkIcon() {
  return <span className="publication-proofing-symbol" aria-hidden="true">↔</span>;
}

function CornerIcon() {
  return <span className="publication-proofing-symbol" aria-hidden="true">↵</span>;
}

function publicationCorrectionLabel(
  kind: OmiPublicationCorrectionKind,
  copy: ReturnType<typeof copyFor>,
): string {
  if (kind === 'discretionary-hyphen') return copy.optionalHyphen;
  if (kind === 'nonbreaking') return copy.nonbreaking;
  if (kind === 'forced-line-break') return copy.forcedLineBreak;
  if (kind === 'page-break-before') return copy.pageBreakBefore;
  if (kind === 'keep-together') return copy.keepTogether;
  return copy.keepWithNext;
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

function findManuscriptBlock(
  blocks: readonly OmiBlock[],
  blockId: string,
): OmiBlock | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    const nested = block.children
      ? findManuscriptBlock(block.children, blockId)
      : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function PublicationRibbonMenuButton({
  panelId,
  label,
  icon,
  open,
  onToggle,
}: {
  panelId: Exclude<PublicationRibbonPanel, null>;
  label: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="publication-style-ribbon-menu-button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={`publication-style-ribbon-panel-${panelId}`}
      title={label}
      onClick={onToggle}
    >
      {icon}
      <span>{label}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
  );
}

function PublicationRibbonActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="publication-style-ribbon-action-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function AlignmentButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
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
