import { withoutPublicationPageAssignments } from '../model/publicationPageStyles';
import { PublicationLayoutChecker } from './PublicationLayoutChecker';
import { PUBLICATION_REVEAL_FRAME_EVENT, type PublicationLayoutIssue } from '../model/publicationLayoutDiagnostics';
import { cssStringLiteral } from '../services/embeddedCss';
import { PublicationMeasurementSelector, usePublicationMeasurementUnit } from './PublicationMeasurementControls';
import { MatterNumber } from './PublicationMatterControls';
import { OjsPublicationTransferPanel } from './OjsPublicationTransferPanel';
import { ojsPublicationCopy } from '../i18n/ojsPublication';
import { PublicationFrameEditor } from './PublicationFrameEditor';
import { PublicationMatterEditor } from './PublicationMatterEditor';
import { PublicationTemplatePanel } from './PublicationTemplatePanel';
import { PublicationTableStylesPanel } from './PublicationTableStylesPanel';
import { PublicationPageStylesPanel } from './PublicationPageStylesPanel';
import { publicationPageStylesCopy } from '../i18n/publicationPageStyles';
import { getAppliedPublicationTemplate } from '../model/publicationTemplates';
import { stageAppliedPublicationStyle } from '../app/publicationTemplateActions';
import { getPublicationMatter } from '../model/publicationMatter';
import { synchronizePublicationSpine } from '../model/publicationSpine';
import { stagePublicationMatter } from '../app/publicationMatterActions';
import { getPublicationSpineCopy } from '../i18n/publicationSpine';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { getDocumentStructureProfile } from '../model/documentProfile';
import { getPublicationFramesCopy } from '../i18n/publicationFrames';
import { usePublicationPreview } from './PublicationPreviewContext';
import { getVisualElementsCopy } from '../i18n/visualElements';
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
  Eye,
  Maximize2,
  Minimize2,
  Move,
  Palette,
  Pilcrow,
  Plus,
  PanelsLeftBottom,
  Ruler,
  DraftingCompass,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  SquareDashed,
  X,
  Trash2,
  Type,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { publicationParagraphStyleName } from '../model/publicationTextRoles';
import { CITATION_STYLE_CATALOG } from '../model/cslRendering';
import { PublicationPointInput } from './PublicationPointInput';
import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { useTranslation } from '../i18n';
import { getManuscriptLanguageDisplayName } from '../model/manuscriptLanguage';
import type { ProofingSelection } from '../model/proofing';
import {
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
import {
  ensureSystemFontFamilies,
  fallbackSystemFontFamilies,
  preferredSystemFontFace,
  queryInstalledSystemFonts,
  supportsLocalFontAccess,
  systemFontFaceCount,
  systemFontFacesForFamily,
  systemFontFaceValue,
  type SystemFontCssStyle,
  type SystemFontFace,
  type SystemFontFamily,
} from '../services/systemFonts';
import type { OmiBlock, OmiPublicationCorrectionKind, OmiManuscript } from '../types/omi';
import { InDesignParagraphStyleSettings } from './InDesignParagraphStyleSettings';
import { ProofingColorLegend } from './ProofingColorLegend';
import {
  PublicationDocumentCanvas,
  type PublicationDocumentViewMode,
} from './PublicationDocumentCanvas';
import { NON_PRINTING_MARKS_EVENT, readStoredNonPrintingMarks, setNonPrintingMarksVisibility } from '../editor/nonPrintingMarks';
import { PublicationGraphicsContext, readPublicationViewOptions, savePublicationViewOptions, type PublicationViewOptions } from './publicationViewOptions';
import './PublicationStyleEditor.css';

type PageOrientation = 'portrait' | 'landscape';
type PublicationRibbonPanel = 'styles' | 'paragraphStyles' | 'tableStyles' | 'pageStyles' | 'page' | 'margins' | 'typography' | 'proofing' | 'export' | 'thumbnails' | 'units' | 'view' | null;
type SystemFontLoadStatus = 'fallback' | 'loading' | 'loaded' | 'unsupported' | 'denied' | 'error';

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
  return normalizePublicationStyle(JSON.parse(JSON.stringify(templateJson)) as PublicationStyle);
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

function loadInitialState(manuscript: OmiManuscript): {
  library: PublicationStyle[];
  activeId: string;
  style: PublicationStyle;
} {
  const library = loadLibrary();
  const applied = getAppliedPublicationTemplate(manuscript);
  if (applied?.style) {
    const style = withCurrentPageDefaults(cloneStyle(applied.style));
    return { library: upsertStyle(library, style.id, style), activeId: style.id, style };
  }
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
  window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library.map(withoutPublicationPageAssignments)));
  window.localStorage.setItem(ACTIVE_STYLE_KEY, active.id);
  // Compatibility bridge: the current PDF/HTML readers consume this key.
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(withoutPublicationPageAssignments(active)));
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
    title: 'Kiadványszerkesztő', contentWorkspace: 'A kiadvány tartalma',
    description: 'A teljes tanulmány vagy kötet szerkeszthető nyomtatási képe. A tartalmi és tipográfiai módosítások azonnal megjelennek, és ugyanezeket az értékeket használja az export.',
    htmlDescription: 'A teljes tanulmány vagy kötet folyamatos, reszponzív HTML5-képe. Ugyanaz a strukturált kézirat szerkeszthető oldalak, élőfejek és oldaltörések nélkül.',
    styles: 'Kiadványstílusok', styleName: 'Stílus neve', newStyle: 'Új stílus', duplicate: 'Másolat készítése', deleteStyle: 'Stílus törlése', cannotDeleteLast: 'Legalább egy kiadványstílusnak meg kell maradnia.',
    page: 'Nyomtatási oldal', preset: 'Oldalformátum', custom: 'Egyéni méret', orientation: 'Tájolás', portrait: 'Álló', landscape: 'Fekvő', width: 'Vágott szélesség', height: 'Vágott magasság', pageNumberStart: 'Első oldalszám', margins: 'Margók és nyomdai adatok', top: 'Felső', bottom: 'Alsó', inner: 'Belső', outer: 'Külső', gutter: 'Kötésmargó', bleed: 'Kifutó', mirroredMargins: 'Tükrözött margók páros és páratlan oldalakon', cropMarks: 'Vágójelek kérése a nyomdai exportban', runningHeaders: 'Élőfej megjelenítése', firstPageHeader: 'Élőfej az első oldalon is',
    typography: 'Tipográfia', font: 'Betűcsalád', fontVariant: 'Betűváltozat', fontSample: 'Árvíztűrő tükörfúrógép', searchFonts: 'Betűcsalád keresése', noMatchingFonts: 'Nincs ilyen betűcsalád.', loadSystemFonts: 'Rendszerbetűk betöltése', refreshSystemFonts: 'Rendszerbetűk frissítése', loadingSystemFonts: 'A telepített betűk beolvasása…', systemFontsFallback: 'Alaplista látható. A telepített betűk és valódi változataik a frissítés ikonnal tölthetők be.', systemFontsUnsupported: 'Ez a böngésző nem engedi a telepített betűk felsorolását; a kibővített alaplista használható.', systemFontsDenied: 'A betűlistához nem kapott engedélyt a szerkesztő; az alaplista maradt aktív.', systemFontsError: 'A telepített betűk nem olvashatók be; az alaplista maradt aktív.', systemFontsLoaded: (families: number, faces: number) => `${families} betűcsalád, ${faces} elérhető változat betöltve.`, bodySize: 'Törzsszöveg mérete', bodyLeading: 'Törzsszöveg sorköze', indent: 'Első sor behúzása', hyphenation: 'Automatikus elválasztás a nyomtatható változatokban', hyphenationModule: 'Nyelvi modul', hyphenationInline: 'A nyelvjelölt szövegrészek automatikusan a saját moduljukat használják.', hyphenationFallback: 'Ehhez a nyelvhez nincs beépített minta; a nyomtató böngésző elválasztási szótára használható.',
    titleSize: 'Cím mérete', headingSize: 'Címsor mérete', footnoteSize: 'Lábjegyzet mérete', authorNameParts: 'Szerzőnév részeinek formázása', givenNameStyle: 'Keresztnév vastagsága', familyNameStyle: 'Családnév vastagsága', givenNameVariant: 'Keresztnév stílusa', familyNameVariant: 'Családnév stílusa', givenNameSmallCaps: 'Keresztnév kiskapitális', familyNameSmallCaps: 'Családnév kiskapitális', givenNameUppercase: 'Keresztnév nagybetűs', familyNameUppercase: 'Családnév nagybetűs', regular: 'Normál', medium: 'Közepes', semiBold: 'Félkövér', bold: 'Kövér', alignment: 'Igazítás', justify: 'Sorkizárt', alignLeft: 'Balra', alignCenter: 'Középre', alignRight: 'Jobbra',
    save: 'Stílus mentése', saved: 'A stílus mentve és aktív', reset: 'Sablonértékek visszaállítása', export: 'Stílus exportálása', exportCss: 'CSS letöltése', defaultNewName: 'Új kiadványstílus', copySuffix: 'másolat', liveApplied: 'A módosítások automatikusan az aktív exportstílusba kerülnek.', proofing: 'Tördelési korrektúra', proofingHelp: 'A javítások csak a nyomtatási elrendezést módosítják; a kézirat szövege változatlan marad.', selectedText: 'Kijelölés', placeCursor: 'Helyezze a kurzort vagy jelöljön ki szöveget a nyomtatási képen.', optionalHyphen: 'Feltételes elválasztójel', nonbreaking: 'Egyben tartott kijelölés', forcedLineBreak: 'Kényszerített sortörés', pageBreakBefore: 'Oldaltörés elé', keepTogether: 'Bekezdés egyben tartása', keepWithNext: 'Együtt a következővel', corrections: 'Aktív tördelési javítások', noCorrections: 'Még nincs kézi tördelési javítás.', removeCorrection: 'Javítás eltávolítása', correctionAdded: 'A tördelési javítás hozzáadva.', selectRange: 'Ehhez a művelethez jelöljön ki szöveget.',
    paragraphStyles: 'Bekezdésstílusok', paragraphStylesHelp: 'A cím, mottó, absztrakt, kulcsszavak, idézet és jegyzet automatikusan a saját stílusát kapja. Az „Alapja” örökíti a formázást és a nyelvet; egyéni stílus is készíthető.', selectedParagraphStyle: 'Kijelölt bekezdés stílusa', noParagraphSelected: 'Kattintson egy bekezdésbe a hozzárendeléshez.', paragraphStyleName: 'Stílus neve', newParagraphStyle: 'Új bekezdésstílus', deleteParagraphStyle: 'Bekezdésstílus törlése', defaultParagraphStyle: 'Az alapértelmezett stílus nem törölhető.', basedOn: 'Alapja', nextStyle: 'Következő stílus', noBaseStyle: '[Nincs bekezdésstílus]', characterFormatting: 'Alapvető karakterformátumok', paragraphFormatting: 'Behúzások és térközök', fontWeight: 'Betűvastagság', fontStyle: 'Betűstílus', normal: 'Normál', italic: 'Dőlt', leftIndent: 'Bal behúzás', rightIndent: 'Jobb behúzás', spaceBefore: 'Térköz előtte', spaceAfter: 'Térköz utána', widows: 'Fattyúsorok', orphans: 'Árvasorok', clearOverrides: 'Helyi felülírások törlése', styleApplied: 'A bekezdésstílus alkalmazva.', inheritedValues: 'A nem felülírt tulajdonságok az alapstílusból öröklődnek.',
  };
  if (locale === 'de') return {
    title: 'Publikationseditor', contentWorkspace: 'Publikationsinhalt', description: 'Die vollständige, bearbeitbare Druckansicht des Beitrags oder Bandes. Inhaltliche und typografische Änderungen erscheinen sofort und werden für den Export verwendet.', htmlDescription: 'Die fortlaufende, responsive HTML5-Ansicht des vollständigen Beitrags oder Bandes. Dasselbe strukturierte Manuskript bleibt ohne Seiten, Kolumnentitel oder Seitenumbrüche bearbeitbar.', styles: 'Publikationsstile', styleName: 'Stilname', newStyle: 'Neuer Stil', duplicate: 'Duplizieren', deleteStyle: 'Stil löschen', cannotDeleteLast: 'Mindestens ein Publikationsstil muss erhalten bleiben.', page: 'Druckseite', preset: 'Seitenformat', custom: 'Benutzerdefiniert', orientation: 'Ausrichtung', portrait: 'Hochformat', landscape: 'Querformat', width: 'Endbreite', height: 'Endhöhe', pageNumberStart: 'Erste Seitenzahl', margins: 'Ränder und Druckdaten', top: 'Oben', bottom: 'Unten', inner: 'Innen', outer: 'Außen', gutter: 'Bundsteg', bleed: 'Beschnitt', mirroredMargins: 'Gespiegelte Ränder für gerade und ungerade Seiten', cropMarks: 'Schnittmarken im Druckexport', runningHeaders: 'Kolumnentitel anzeigen', firstPageHeader: 'Kolumnentitel auch auf der ersten Seite', typography: 'Typografie', font: 'Schriftfamilie', fontVariant: 'Schriftschnitt', fontSample: 'Falsches Üben quält jeden größeren Zwerg', searchFonts: 'Schriftfamilie suchen', noMatchingFonts: 'Keine passende Schriftfamilie.', loadSystemFonts: 'Systemschriften laden', refreshSystemFonts: 'Systemschriften aktualisieren', loadingSystemFonts: 'Installierte Schriften werden eingelesen…', systemFontsFallback: 'Die Grundliste ist sichtbar. Installierte Schriften und ihre echten Schnitte lassen sich mit dem Aktualisieren-Symbol laden.', systemFontsUnsupported: 'Dieser Browser kann installierte Schriften nicht auflisten; die erweiterte Grundliste bleibt verfügbar.', systemFontsDenied: 'Der Zugriff auf die Schriftliste wurde nicht erlaubt; die Grundliste bleibt aktiv.', systemFontsError: 'Installierte Schriften konnten nicht gelesen werden; die Grundliste bleibt aktiv.', systemFontsLoaded: (families: number, faces: number) => `${families} Schriftfamilien mit ${faces} verfügbaren Schnitten geladen.`, bodySize: 'Grundschrift', bodyLeading: 'Zeilenabstand', indent: 'Erstzeileneinzug', hyphenation: 'Automatische Silbentrennung in Druckausgaben', hyphenationModule: 'Sprachmodul', hyphenationInline: 'Sprachmarkierte Textteile verwenden automatisch ihr eigenes Modul.', hyphenationFallback: 'Für diese Sprache ist kein Muster eingebaut; das Wörterbuch des Druckbrowsers kann verwendet werden.', titleSize: 'Titelgröße', headingSize: 'Überschriftgröße', footnoteSize: 'Fußnotengröße', authorNameParts: 'Formatierung der Namensbestandteile', givenNameStyle: 'Stärke des Vornamens', familyNameStyle: 'Stärke des Familiennamens', givenNameVariant: 'Stil des Vornamens', familyNameVariant: 'Stil des Familiennamens', givenNameSmallCaps: 'Vorname in Kapitälchen', familyNameSmallCaps: 'Familienname in Kapitälchen', givenNameUppercase: 'Vorname in Versalien', familyNameUppercase: 'Familienname in Versalien', regular: 'Normal', medium: 'Medium', semiBold: 'Halbfett', bold: 'Fett', alignment: 'Ausrichtung', justify: 'Blocksatz', alignLeft: 'Links', alignCenter: 'Zentriert', alignRight: 'Rechts', save: 'Stil speichern', saved: 'Stil gespeichert und aktiv', reset: 'Vorlagenwerte zurücksetzen', export: 'Stil exportieren', exportCss: 'CSS herunterladen', defaultNewName: 'Neuer Publikationsstil', copySuffix: 'Kopie', liveApplied: 'Änderungen werden automatisch auf den aktiven Exportstil angewendet.', proofing: 'Satzkorrektur', proofingHelp: 'Korrekturen ändern nur den Drucksatz; der Manuskripttext bleibt unverändert.', selectedText: 'Auswahl', placeCursor: 'Setzen Sie den Cursor oder markieren Sie Text im Druckbild.', optionalHyphen: 'Bedingter Trennstrich', nonbreaking: 'Auswahl zusammenhalten', forcedLineBreak: 'Erzwungener Zeilenumbruch', pageBreakBefore: 'Seitenumbruch davor', keepTogether: 'Absatz zusammenhalten', keepWithNext: 'Mit nächstem zusammenhalten', corrections: 'Aktive Satzkorrekturen', noCorrections: 'Noch keine manuellen Satzkorrekturen.', removeCorrection: 'Korrektur entfernen', correctionAdded: 'Satzkorrektur hinzugefügt.', selectRange: 'Markieren Sie für diese Aktion Text.', paragraphStyles: 'Absatzformate', paragraphStylesHelp: 'Wie in InDesign vererbt „Basiert auf“ die Formatierung; „Nächstes Format“ wird beim Erstellen eines neuen Absatzes angewendet.', selectedParagraphStyle: 'Format des ausgewählten Absatzes', noParagraphSelected: 'Klicken Sie zum Zuweisen in einen Absatz.', paragraphStyleName: 'Formatname', newParagraphStyle: 'Neues Absatzformat', deleteParagraphStyle: 'Absatzformat löschen', defaultParagraphStyle: 'Das Standardformat kann nicht gelöscht werden.', basedOn: 'Basiert auf', nextStyle: 'Nächstes Format', noBaseStyle: '[Kein Absatzformat]', characterFormatting: 'Grundlegende Zeichenformate', paragraphFormatting: 'Einzüge und Abstände', fontWeight: 'Schriftstärke', fontStyle: 'Schriftschnitt', normal: 'Normal', italic: 'Kursiv', leftIndent: 'Linker Einzug', rightIndent: 'Rechter Einzug', spaceBefore: 'Abstand davor', spaceAfter: 'Abstand danach', widows: 'Schusterjungen', orphans: 'Hurenkinder', clearOverrides: 'Lokale Überschreibungen löschen', styleApplied: 'Absatzformat angewendet.', inheritedValues: 'Nicht überschriebene Eigenschaften werden vom Basisformat geerbt.',
  };
  return {
    title: 'Publication editor', contentWorkspace: 'Publication content', description: 'The complete editable print view of the article or volume. Content and typography changes appear immediately and drive the same export settings.', htmlDescription: 'The continuous, responsive HTML5 view of the complete article or volume. The same structured manuscript remains editable without pages, running headers, or page breaks.', styles: 'Publication styles', styleName: 'Style name', newStyle: 'New style', duplicate: 'Duplicate', deleteStyle: 'Delete style', cannotDeleteLast: 'At least one publication style must remain.', page: 'Print page', preset: 'Page format', custom: 'Custom size', orientation: 'Orientation', portrait: 'Portrait', landscape: 'Landscape', width: 'Trim width', height: 'Trim height', pageNumberStart: 'First page number', margins: 'Margins and print data', top: 'Top', bottom: 'Bottom', inner: 'Inner', outer: 'Outer', gutter: 'Gutter', bleed: 'Bleed', mirroredMargins: 'Mirror margins on facing pages', cropMarks: 'Include crop marks in print export', runningHeaders: 'Show running headers', firstPageHeader: 'Show running header on first page', typography: 'Typography', font: 'Font family', fontVariant: 'Font style', fontSample: 'Sphinx of black quartz, judge my vow', searchFonts: 'Search font families', noMatchingFonts: 'No matching font family.', loadSystemFonts: 'Load system fonts', refreshSystemFonts: 'Refresh system fonts', loadingSystemFonts: 'Reading installed fonts…', systemFontsFallback: 'The starter list is shown. Use the refresh icon to load installed fonts and their actual styles.', systemFontsUnsupported: 'This browser cannot list installed fonts; the expanded starter list remains available.', systemFontsDenied: 'Font-list access was not allowed; the starter list remains active.', systemFontsError: 'Installed fonts could not be read; the starter list remains active.', systemFontsLoaded: (families: number, faces: number) => `${families} font families and ${faces} available styles loaded.`, bodySize: 'Body size', bodyLeading: 'Body leading', indent: 'First-line indent', hyphenation: 'Automatic hyphenation in printable versions', hyphenationModule: 'Language module', hyphenationInline: 'Language-tagged passages automatically use their own module.', hyphenationFallback: 'No built-in pattern is available for this language; the print browser dictionary may be used.', titleSize: 'Title size', headingSize: 'Heading size', footnoteSize: 'Footnote size', authorNameParts: 'Author name part formatting', givenNameStyle: 'Given-name weight', familyNameStyle: 'Family-name weight', givenNameVariant: 'Given-name style', familyNameVariant: 'Family-name style', givenNameSmallCaps: 'Given name small caps', familyNameSmallCaps: 'Family name small caps', givenNameUppercase: 'Given name uppercase', familyNameUppercase: 'Family name uppercase', regular: 'Regular', medium: 'Medium', semiBold: 'Semi-bold', bold: 'Bold', alignment: 'Alignment', justify: 'Justified', alignLeft: 'Left', alignCenter: 'Center', alignRight: 'Right', save: 'Save style', saved: 'Style saved and active', reset: 'Reset template values', export: 'Export style', exportCss: 'Download CSS', defaultNewName: 'New publication style', copySuffix: 'copy', liveApplied: 'Changes are applied to the active export style automatically.', proofing: 'Typesetting proofing', proofingHelp: 'Corrections affect only the print layout; the manuscript text remains unchanged.', selectedText: 'Selection', placeCursor: 'Place the cursor or select text in the print view.', optionalHyphen: 'Optional hyphen', nonbreaking: 'Keep selection together', forcedLineBreak: 'Forced line break', pageBreakBefore: 'Page break before', keepTogether: 'Keep paragraph together', keepWithNext: 'Keep with next', corrections: 'Active typesetting corrections', noCorrections: 'No manual typesetting corrections yet.', removeCorrection: 'Remove correction', correctionAdded: 'Typesetting correction added.', selectRange: 'Select text for this action.', paragraphStyles: 'Paragraph styles', paragraphStylesHelp: 'Titles, mottos, abstracts, keywords, quotations and notes automatically use their own styles. “Based on” inherits formatting and language; custom styles can also be created.', selectedParagraphStyle: 'Selected paragraph style', noParagraphSelected: 'Click inside a paragraph to assign a style.', paragraphStyleName: 'Style name', newParagraphStyle: 'New paragraph style', deleteParagraphStyle: 'Delete paragraph style', defaultParagraphStyle: 'The default style cannot be deleted.', basedOn: 'Based on', nextStyle: 'Next style', noBaseStyle: '[No paragraph style]', characterFormatting: 'Basic character formats', paragraphFormatting: 'Indents and spacing', fontWeight: 'Font weight', fontStyle: 'Font style', normal: 'Regular', italic: 'Italic', leftIndent: 'Left indent', rightIndent: 'Right indent', spaceBefore: 'Space before', spaceAfter: 'Space after', widows: 'Widow lines', orphans: 'Orphan lines', clearOverrides: 'Clear local overrides', styleApplied: 'Paragraph style applied.', inheritedValues: 'Properties without overrides inherit from the based-on style.',
  };
}

export function PublicationStyleEditor() {
  const id = useStudioStore((state) => state.manuscript.id);
  return <PublicationStyleEditorWorkspace key={id} />;
}

function PublicationStyleEditorWorkspace() {
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
  const previewOnly = usePublicationPreview();
  const [frameToolsOpen, setFrameToolsOpen] = useState(false);
  const [matterToolsOpen, setMatterToolsOpen] = useState(false);
  const [paginationSummary, setPaginationSummary] = useState<{ id: string; count: number }>();
  const [spineCalculationError, setSpineCalculationError] = useState(false);
  const handlePageCount = useCallback((id: string, count: number) => setPaginationSummary((previous) => previous?.id === id && previous.count === count ? previous : { id, count }), []);
  const bodyPageCount = paginationSummary?.id === manuscript.id ? paginationSummary.count : undefined;
  useEffect(() => {
    const model = getPublicationMatter(manuscript);
    if (!model || !bodyPageCount) { setSpineCalculationError(false); return; }
    try {
      const next = synchronizePublicationSpine(model, bodyPageCount);
      if (next !== model) stagePublicationMatter(next, undefined, manuscript.id);
      setSpineCalculationError(false);
    } catch { setSpineCalculationError(true); }
  }, [manuscript, bodyPageCount]);
  useEffect(() => { setMatterToolsOpen(false); }, [manuscript.id, manuscript.documentStructure?.kind]);
  const [ojsTransferOpen, setOjsTransferOpen] = useState(false);
  const frameCopy = getPublicationFramesCopy(locale);
  const noteCitationLabels = locale === 'hu' ? { first: 'Első hivatkozás stílusa', subsequent: 'Ismételt hivatkozás stílusa' }
    : locale === 'de' ? { first: 'Erster Literaturverweis', subsequent: 'Weitere Literaturverweise' }
      : { first: 'First citation style', subsequent: 'Subsequent citation style' };
  const [initial] = useState(() => loadInitialState(manuscript));
  const [library, setLibrary] = useState<PublicationStyle[]>(initial.library);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [style, setStyle] = useState<PublicationStyle>(initial.style);
  const appliedStyle = getAppliedPublicationTemplate(manuscript)?.style;
  const synchronizedStyleRef = useRef(appliedStyle);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [openPanel, setOpenPanel] = useState<PublicationRibbonPanel>(null);
  const [rulerVisible, setRulerVisible] = useState(true);
  const [viewOptions, setViewOptions] = useState<PublicationViewOptions>(readPublicationViewOptions);
  const [showNonPrintingMarks, setShowNonPrintingMarks] = useState(readStoredNonPrintingMarks);
  const [presentation, setPresentation] = useState(false);
  const viewCopy = locale === 'hu'
    ? { view: 'Nézet', graphics: 'Grafikus elemek', full: 'Teljes megjelenítés', simplified: 'Gyors, egyszerűsített nézet',
      outlines: 'Csak grafikai keretek', aids: 'Szerkesztési segédjelek', nonPrintingMarks: 'Nem nyomtatható jelek',
      marginBoundaries: 'Margóhatárok', alignmentGuides: 'Igazítóvonalak', presentation: 'Teljes képernyős bemutató', exit: 'Kilépés a bemutatóból' }
    : locale === 'de'
      ? { view: 'Ansicht', graphics: 'Grafische Elemente', full: 'Vollständige Darstellung', simplified: 'Schnelle vereinfachte Ansicht',
        outlines: 'Nur Grafikrahmen', aids: 'Bearbeitungshilfen', nonPrintingMarks: 'Nicht druckbare Zeichen',
        marginBoundaries: 'Randbegrenzungen', alignmentGuides: 'Hilfslinien', presentation: 'Vollbildpräsentation', exit: 'Präsentation beenden' }
      : { view: 'View', graphics: 'Graphics', full: 'Full rendering', simplified: 'Fast simplified view',
        outlines: 'Graphic outlines only', aids: 'Editing aids', nonPrintingMarks: 'Non-printing marks',
        marginBoundaries: 'Margin boundaries', alignmentGuides: 'Alignment guides', presentation: 'Fullscreen presentation', exit: 'Exit presentation' };
  useEffect(() => { savePublicationViewOptions(viewOptions); }, [viewOptions]);
  useEffect(() => { setNonPrintingMarksVisibility(showNonPrintingMarks); }, [showNonPrintingMarks]);
  useEffect(() => {
    const sync = (event: Event) => setShowNonPrintingMarks((event as CustomEvent<boolean>).detail);
    window.addEventListener(NON_PRINTING_MARKS_EVENT, sync);
    return () => window.removeEventListener(NON_PRINTING_MARKS_EVENT, sync);
  }, []);
  useEffect(() => {
    if (!presentation) return;
    const onFullscreenChange = () => {
      if (document.fullscreenElement && document.fullscreenElement !== editorRoot.current) setPresentation(false);
      else if (!document.fullscreenElement && document.fullscreenEnabled) setPresentation(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresentation(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [presentation]);
  const onDisplayOptionChange = (key: 'nonPrintingMarks' | 'showMarginBoundaries' | 'showAlignmentGuides', value: boolean) => {
    if (key === 'nonPrintingMarks') setShowNonPrintingMarks(value);
    else setViewOptions((current) => ({ ...current, [key]: value }));
  };
  const enterPresentation = () => {
    setOpenPanel(null);
    setFrameToolsOpen(false);
    setMatterToolsOpen(false);
    setPresentation(true);
    const element = editorRoot.current;
    if (element?.requestFullscreen) void element.requestFullscreen().catch(() => {
      // CSS fullscreen fallback stays available when the API is blocked.
    });
  };
  const exitPresentation = () => {
    setPresentation(false);
    if (document.fullscreenElement === editorRoot.current) void document.exitFullscreen().catch(() => undefined);
  };
  const [thumbnailsTarget, setThumbnailsTarget] = useState<HTMLDivElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const resizingSidebar = useRef(false);
  const minSidebarWidth = 194;
  const maxSidebarWidth = 680;
  const sidebarCopy = locale === 'hu'
    ? { thumbnails: 'Oldalminiatűrök', ruler: 'Vonalzó', units: 'Mértékegységek', resize: 'Oldalsó panel szélessége' }
    : locale === 'de'
      ? { thumbnails: 'Seitenminiaturen', ruler: 'Lineal', units: 'Maßeinheiten', resize: 'Breite des Seitenbereichs' }
      : { thumbnails: 'Page thumbnails', ruler: 'Ruler', units: 'Measurement units', resize: 'Sidebar width' };
  function toggleSidebarPanel(panel: Exclude<PublicationRibbonPanel, null>) {
    setFrameToolsOpen(false);
    setOpenPanel((current) => current === panel ? null : panel);
  }
  const [documentViewMode, setDocumentViewMode] = useState<PublicationDocumentViewMode>(
    'print',
  );
  const [proofingSelection, setProofingSelection] = useState<ProofingSelection | null>(null);
  const [activeParagraphStyleId, setActiveParagraphStyleId] = useState(
    initial.style.paragraphStyles.defaultStyleId,
  );
  const [systemFontCatalog, setSystemFontCatalog] = useState<SystemFontFamily[]>(
    () => fallbackSystemFontFamilies(collectPublicationFontFamilies(initial.style)),
  );
  const [systemFontLoadStatus, setSystemFontLoadStatus] = useState<SystemFontLoadStatus>('fallback');
  const ribbonRef = useRef<HTMLDivElement>(null);
  const editorRoot = useRef<HTMLElement>(null);
  const [checkerEnabled, setCheckerEnabled] = useState(false);
  const [layoutTarget, setLayoutTarget] = useState<PublicationLayoutIssue | null>(null);
  useEffect(() => {
    if (!layoutTarget) return;
    const timer = setTimeout(() => setLayoutTarget(null), 3000);
    return () => clearTimeout(timer);
  }, [layoutTarget]);
  const [bodyIssues, setBodyIssues] = useState<{ manuscriptId: string; issues: PublicationLayoutIssue[] }>({ manuscriptId: '', issues: [] });
  const [frameIssues, setFrameIssues] = useState<{ manuscriptId: string; issues: PublicationLayoutIssue[] }>({ manuscriptId: '', issues: [] });
  const reportBodyIssues = useCallback((manuscriptId: string, issues: PublicationLayoutIssue[]) => setBodyIssues((previous) =>
    previous.manuscriptId === manuscriptId && JSON.stringify(previous.issues) === JSON.stringify(issues) ? previous : { manuscriptId, issues }), []);
  const reportFrameIssues = useCallback((manuscriptId: string, issues: PublicationLayoutIssue[]) => setFrameIssues((previous) =>
    previous.manuscriptId === manuscriptId && JSON.stringify(previous.issues) === JSON.stringify(issues) ? previous : { manuscriptId, issues }), []);
  const layoutIssues = [...(bodyIssues.manuscriptId === manuscript.id ? bodyIssues.issues : []), ...(frameIssues.manuscriptId === manuscript.id ? frameIssues.issues : [])];
  function navigateLayoutIssue(issue: PublicationLayoutIssue) {
    if (issue.insertionId) {
      editorRoot.current?.querySelector<HTMLElement>(`[data-insertion-id=${cssStringLiteral(issue.insertionId)}]`)?.scrollIntoView({ block: 'center' });
      return;
    }
    setLayoutTarget(issue);
    setOpenPanel(null);
    if (issue.frameId || issue.storyId) {
      setFrameToolsOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(() => document.dispatchEvent(new CustomEvent(PUBLICATION_REVEAL_FRAME_EVENT, { detail: issue }))));
      return;
    }
    requestAnimationFrame(() => {
      const selector = issue.blockId ? `[data-block-id=${cssStringLiteral(issue.blockId)}]` : `[data-section-id=${cssStringLiteral(issue.sectionId ?? '')}]`;
      const target = editorRoot.current?.querySelector<HTMLElement>(`.publication-document-content .omi-continuous-tiptap-editor > ${selector}`)
        ?? editorRoot.current?.querySelector<HTMLElement>(`.publication-document-content ${selector}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    });
  }

  const availableFontFamilies = useMemo(
    () => ensureSystemFontFamilies(
      systemFontCatalog,
      collectPublicationFontFamilies(style),
    ),
    [style, systemFontCatalog],
  );

  useEffect(() => {
    persistLibrary(upsertStyle(library, activeId, style), style);
    // Opening an unformatted document is a projection, not an authoring edit.
    // Embed the format after the first user change or when it already exists.
    if (style !== initial.style || synchronizedStyleRef.current) stageAppliedPublicationStyle(style);
    synchronizedStyleRef.current = getAppliedPublicationTemplate(useStudioStore.getState().manuscript)?.style;
  }, [activeId, library, style, initial.style]);

  useEffect(() => {
    // Revision restoration can replace a format without changing document id.
    if (!appliedStyle || appliedStyle === synchronizedStyleRef.current) return;
    // Checkpoints clone the portable state even when its format is unchanged.
    // Keep the user's style selection while acknowledging that new identity.
    if (JSON.stringify(appliedStyle) === JSON.stringify(synchronizedStyleRef.current)) {
      synchronizedStyleRef.current = appliedStyle;
      return;
    }
    synchronizedStyleRef.current = appliedStyle;
    const next = withCurrentPageDefaults(cloneStyle(appliedStyle));
    setStyle(next); setActiveId(next.id);
    setLibrary((current) => upsertStyle(current, next.id, next));
    setActiveParagraphStyleId((current) => next.paragraphStyles.items.some((item) => item.id === current) ? current : next.paragraphStyles.defaultStyleId);
    setProofingSelection(null);
  }, [appliedStyle]);

  useEffect(() => {
    if (!openPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpenPanel(null);
    };
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [openPanel]);

  function patchStyle(update: (current: PublicationStyle) => PublicationStyle): void {
    setSaved(false);
    setMessage('');
    setStyle(update);
  }

  function changeDocumentViewMode(mode: PublicationDocumentViewMode): void {
    setDocumentViewMode(mode);
    setOpenPanel(null);
    setProofingSelection(null);
  }

  function setPage<K extends keyof PublicationStyle['page']>(
    key: K,
    value: PublicationStyle['page'][K],
  ): void {
    patchStyle((current) => normalizePublicationStyle({
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
      role: undefined,
      automaticName: false,
      basedOnId: source.role ? source.id : source.basedOnId,
      name: `${publicationParagraphStyleName(source, locale)} — ${copy.copySuffix}`,
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
    if (activeParagraphStyleId === collection.defaultStyleId || collection.items.find((item) => item.id === activeParagraphStyleId)?.role) {
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
      && selectedParagraphBlock.type !== 'quote'
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
  const authorGivenName = style.styles.authorGivenName;
  const authorFamilyName = style.styles.authorFamilyName;
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
    : selectedParagraphBlock?.type === 'quote'
      ? style.paragraphStyles.items.find((item) => item.role === 'quote')?.id ?? style.paragraphStyles.defaultStyleId
      : style.paragraphStyles.defaultStyleId;
  const activeParagraphStyle = style.paragraphStyles.items.find(
    (definition) => definition.id === activeParagraphStyleId,
  ) ?? style.paragraphStyles.items[0];
  const resolvedParagraphStyle = resolvePublicationParagraphStyle(
    style,
    activeParagraphStyle?.id,
    manuscript.locale,
  );
  const bodyFontStyle: SystemFontCssStyle = body.fontStyle === 'italic' ? 'italic' : 'normal';
  const bodyFontFaces = systemFontFacesForFamily(
    availableFontFamilies,
    style.fonts.body.family,
  );
  const paragraphFontFaces = systemFontFacesForFamily(
    availableFontFamilies,
    resolvedParagraphStyle.fontFamily,
  );
  const fontCatalogStatusText = systemFontStatusMessage(
    systemFontLoadStatus,
    systemFontCatalog,
    copy,
  );

  async function loadSystemFonts(): Promise<void> {
    if (!supportsLocalFontAccess()) {
      setSystemFontLoadStatus('unsupported');
      return;
    }
    setSystemFontLoadStatus('loading');
    try {
      const catalog = await queryInstalledSystemFonts();
      setSystemFontCatalog(catalog);
      setSystemFontLoadStatus('loaded');
    } catch (error) {
      const name = error && typeof error === 'object' && 'name' in error
        ? String(error.name)
        : '';
      setSystemFontLoadStatus(
        name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error',
      );
    }
  }

  function setBodyFontFamily(family: string): void {
    const face = preferredSystemFontFace(
      availableFontFamilies,
      family,
      body.fontWeight,
      bodyFontStyle,
    );
    patchStyle((current) => ({
      ...current,
      fonts: {
        ...current.fonts,
        body: { ...current.fonts.body, family },
        note: { ...current.fonts.note, family },
      },
      styles: {
        ...current.styles,
        body: {
          ...current.styles.body,
          fontWeight: face.weight,
          fontStyle: face.fontStyle,
        },
      },
    }));
  }

  function setBodyFontFace(face: SystemFontFace): void {
    patchStyle((current) => ({
      ...current,
      styles: {
        ...current.styles,
        body: {
          ...current.styles.body,
          fontWeight: face.weight,
          fontStyle: face.fontStyle,
        },
      },
    }));
  }

  function setParagraphFontFamily(family: string): void {
    const face = preferredSystemFontFace(
      availableFontFamilies,
      family,
      resolvedParagraphStyle.fontWeight,
      resolvedParagraphStyle.fontStyle,
    );
    patchParagraphStyle(activeParagraphStyleId, (definition) => ({
      ...definition,
      properties: {
        ...definition.properties,
        fontFamily: family,
        fontWeight: face.weight,
        fontStyle: face.fontStyle,
      },
    }));
  }

  function setParagraphFontFace(face: SystemFontFace): void {
    patchParagraphStyle(activeParagraphStyleId, (definition) => ({
      ...definition,
      properties: {
        ...definition.properties,
        fontWeight: face.weight,
        fontStyle: face.fontStyle,
      },
    }));
  }

  useEffect(() => {
    if (!paragraphStyleAssignable) return;
    setActiveParagraphStyleId(selectedParagraphStyleId);
  }, [paragraphStyleAssignable, proofingSelection?.blockId, selectedParagraphStyleId]);

  return (
    <PublicationGraphicsContext.Provider value={presentation ? 'screen' : previewOnly ? 'full' : viewOptions.graphicsMode}>
    <section
      ref={editorRoot}
      className={`publication-style-editor${previewOnly ? ' publication-style-editor--preview' : ''}${presentation ? ' publication-style-editor--presentation' : ''}`}
      data-graphics-mode={presentation ? 'screen' : viewOptions.graphicsMode}
      data-publication-page-count={bodyPageCount}
      aria-labelledby="publication-style-editor-title"
    >
      {presentation ? <button type="button" className="publication-presentation-exit" onClick={exitPresentation} aria-label={viewCopy.exit}>
        <Minimize2 size={18} aria-hidden="true" />{viewCopy.exit}
      </button> : null}
      <div className="publication-profile-section-heading publication-style-editor-heading">
        <div>
          <h4 id="publication-style-editor-title">{copy.title}</h4>
          <p>{documentViewMode === 'html' ? copy.htmlDescription : copy.description}</p>
        </div>
        <div className="publication-style-editor-header-status">
          <strong title={style.name}>{style.name || copy.defaultNewName}</strong>
          <span>{message || (saved ? copy.saved : copy.liveApplied)}</span>
        </div>
      </div>

      {getDocumentStructureProfile(manuscript).kind === 'volume' ? <PublicationTemplatePanel locale={locale} style={style} onApplied={(next) => {
        setStyle(cloneStyle(next)); setActiveId(next.id); setLibrary((current) => upsertStyle(current, next.id, next));
        setActiveParagraphStyleId(next.paragraphStyles.defaultStyleId); setProofingSelection(null);
      }} /> : null}
      {getDocumentStructureProfile(manuscript).kind === 'volume' ? <div className="publication-workspace-tabs" role="tablist" aria-label={copy.title} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? false : event.key === 'End' ? true : !matterToolsOpen;
        setMatterToolsOpen(next); setOpenPanel(null);
        document.getElementById(next ? 'publication-matter-tab' : 'publication-content-tab')?.focus();
      }}>
        <button id="publication-content-tab" type="button" role="tab" tabIndex={matterToolsOpen ? -1 : 0} aria-selected={!matterToolsOpen} aria-controls="publication-content-workspace" onClick={() => { setMatterToolsOpen(false); setOpenPanel(null); }}>{copy.contentWorkspace}</button>
        <button id="publication-matter-tab" type="button" role="tab" tabIndex={matterToolsOpen ? 0 : -1} aria-selected={matterToolsOpen} aria-controls="publication-matter-workspace" onClick={() => { setMatterToolsOpen(true); setOpenPanel(null); }}>{getPublicationMatterCopy(locale).title}</button>
      </div> : null}
      {previewOnly && !matterToolsOpen ? (
        <div className="publication-frame-inspector-actions publication-frame-inspector-actions--preview">
          <button type="button" className="publication-frame-inspector-toggle"
            aria-label={frameCopy.tools}
            aria-expanded={frameToolsOpen}
            aria-controls="publication-frame-inspector-panel"
            title={frameCopy.tools}
            onClick={() => setFrameToolsOpen((current) => !current)}>
            <SquareDashed size={17} aria-hidden="true" />
            <span>{frameCopy.tools}</span>
          </button>
          <PublicationMeasurementSelector />
        </div>
      ) : null}
      {previewOnly && !matterToolsOpen ? <p className="publication-mobile-preview-note">{getVisualElementsCopy(locale).mobilePreviewNote}</p> : null}
      {previewOnly && !matterToolsOpen ? (
        <button
          type="button"
          className="studio-menu-secondary-action"
          aria-expanded={ojsTransferOpen}
          onClick={() => setOjsTransferOpen(current => !current)}
        >
          <FileCode2 size={18} aria-hidden="true" />
          {ojsPublicationCopy(locale).title}
        </button>
      ) : null}
      <div className={`publication-style-editor-shell${!previewOnly && !matterToolsOpen ? ' publication-style-editor-shell--with-ribbon' : ''}${openPanel ? ' publication-style-editor-shell--panel-open' : ''}`}
        style={{ '--omi-publication-panel-width': `${sidebarWidth}px` } as CSSProperties}>
      {!previewOnly && !matterToolsOpen ? <div className="publication-style-ribbon" ref={ribbonRef}>
        <div className="publication-style-ribbon-row">
          <div className="publication-style-ribbon-actions" role="toolbar" aria-label={copy.title}>
            <PublicationRibbonMenuButton
              panelId="styles"
              label={copy.styles}
              icon={<Palette size={18} aria-hidden="true" />}
              open={openPanel === 'styles'}
              onToggle={() => toggleSidebarPanel('styles')}
            />
            <PublicationRibbonMenuButton
              panelId="paragraphStyles"
              label={copy.paragraphStyles}
              icon={<Pilcrow size={18} aria-hidden="true" />}
              open={openPanel === 'paragraphStyles'}
              onToggle={() => toggleSidebarPanel('paragraphStyles')}
            />
            <PublicationRibbonMenuButton
              panelId="tableStyles"
              label={getVisualElementsCopy(locale).tableAppearanceStyles}
              icon={<SquareDashed size={18} aria-hidden="true" />}
              open={openPanel === 'tableStyles'}
              onToggle={() => toggleSidebarPanel('tableStyles')}
            />
            {documentViewMode === 'print' ? (
              <>
                <PublicationRibbonMenuButton
                  panelId="pageStyles"
                  label={publicationPageStylesCopy(locale).title}
                  icon={<Copy size={18} aria-hidden="true" />}
                  open={openPanel === 'pageStyles'}
                  onToggle={() => toggleSidebarPanel('pageStyles')}
                />
                <PublicationRibbonMenuButton
                  panelId="thumbnails"
                  label={sidebarCopy.thumbnails}
                  icon={<PanelsLeftBottom size={18} aria-hidden="true" />}
                  open={openPanel === 'thumbnails'}
                  onToggle={() => toggleSidebarPanel('thumbnails')}
                />
                <PublicationRibbonMenuButton
                  panelId="page"
                  label={copy.page}
                  icon={<FileText size={18} aria-hidden="true" />}
                  open={openPanel === 'page'}
                  onToggle={() => toggleSidebarPanel('page')}
                />
                <PublicationRibbonMenuButton
                  panelId="margins"
                  label={copy.margins}
                  icon={<Move size={18} aria-hidden="true" />}
                  open={openPanel === 'margins'}
                  onToggle={() => toggleSidebarPanel('margins')}
                />
              </>
            ) : null}
            <PublicationRibbonMenuButton
              panelId="typography"
              label={copy.typography}
              icon={<Type size={18} aria-hidden="true" />}
              open={openPanel === 'typography'}
              onToggle={() => toggleSidebarPanel('typography')}
            />
            {documentViewMode === 'print' ? (
              <PublicationRibbonMenuButton
                panelId="proofing"
                label={copy.proofing}
                icon={<Scissors size={18} aria-hidden="true" />}
                open={openPanel === 'proofing'}
                onToggle={() => toggleSidebarPanel('proofing')}
              />
            ) : null}
            <PublicationRibbonMenuButton
              panelId="view"
              label={viewCopy.view}
              icon={<Eye size={18} aria-hidden="true" />}
              open={openPanel === 'view'}
              onToggle={() => toggleSidebarPanel('view')}
            />
            <PublicationRibbonMenuButton
              panelId="units"
              label={sidebarCopy.units}
              icon={<DraftingCompass size={18} aria-hidden="true" />}
              open={openPanel === 'units'}
              onToggle={() => toggleSidebarPanel('units')}
            />
            <PublicationRibbonActionButton label={sidebarCopy.ruler} pressed={rulerVisible} onClick={() => setRulerVisible((visible) => !visible)}>
              <Ruler size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
            <PublicationRibbonActionButton label={viewCopy.presentation} onClick={enterPresentation}>
              <Maximize2 size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
            <PublicationRibbonActionButton label={frameCopy.tools} pressed={frameToolsOpen}
              expanded={frameToolsOpen} controls="publication-frame-inspector-panel"
              onClick={() => { setOpenPanel(null); setFrameToolsOpen((visible) => !visible); }}>
              <SquareDashed size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
            <span className="publication-style-ribbon-separator" aria-hidden="true" />
            <PublicationRibbonActionButton label={copy.save} onClick={() => { save(); setOpenPanel(null); }}>
              <Save size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
            <PublicationRibbonMenuButton
              panelId="export"
              label={copy.export}
              icon={<Download size={18} aria-hidden="true" />}
              open={openPanel === 'export'}
              onToggle={() => toggleSidebarPanel('export')}
            />
            <PublicationRibbonActionButton label={ojsPublicationCopy(locale).title} onClick={() => { setOjsTransferOpen(current => !current); setOpenPanel(null); }}>
              <FileCode2 size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
            <PublicationRibbonActionButton label={copy.reset} onClick={() => { reset(); setOpenPanel(null); }}>
              <RotateCcw size={18} aria-hidden="true" />
            </PublicationRibbonActionButton>
          </div>
          <div className="publication-style-ribbon-status" aria-live="polite">
            <strong title={style.name}>{style.name || copy.defaultNewName}</strong>
            <span>{message || (saved ? copy.saved : copy.liveApplied)}</span>
          </div>
        </div>

        {openPanel === 'thumbnails' ? (
          <div id="publication-style-ribbon-panel-thumbnails" className="publication-style-ribbon-panel publication-style-ribbon-panel--thumbnails"
            role="dialog" aria-label={sidebarCopy.thumbnails} ref={setThumbnailsTarget} />
        ) : null}
        {openPanel === 'units' ? (
          <div id="publication-style-ribbon-panel-units" className="publication-style-ribbon-panel publication-style-ribbon-panel--compact"
            role="dialog" aria-label={sidebarCopy.units}>
            <PublicationMeasurementSelector />
          </div>
        ) : null}
        {openPanel === 'view' ? (
          <div id="publication-style-ribbon-panel-view" className="publication-style-ribbon-panel publication-style-ribbon-panel--compact publication-view-panel" role="dialog" aria-label={viewCopy.view}>
            <fieldset>
              <legend>{viewCopy.graphics}</legend>
              {(['full', 'simplified', 'outlines'] as const).map((mode) => (
                <label key={mode} className="publication-view-option">
                  <input type="radio" name="publication-graphics-mode" value={mode}
                    checked={viewOptions.graphicsMode === mode}
                    onChange={() => setViewOptions((current) => ({ ...current, graphicsMode: mode }))} />
                  <span>{viewCopy[mode]}</span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>{viewCopy.aids}</legend>
              {(['nonPrintingMarks', 'showMarginBoundaries', 'showAlignmentGuides'] as const).map((key) => (
                <label key={key} className="publication-view-option">
                  <input type="checkbox"
                    checked={key === 'nonPrintingMarks' ? showNonPrintingMarks : viewOptions[key]}
                    onChange={(event) => onDisplayOptionChange(key, event.target.checked)} />
                  <span>{key === 'nonPrintingMarks' ? viewCopy.nonPrintingMarks : key === 'showMarginBoundaries' ? viewCopy.marginBoundaries : viewCopy.alignmentGuides}</span>
                </label>
              ))}
            </fieldset>
            <button type="button" className="publication-view-presentation" onClick={enterPresentation}>
              <Maximize2 size={16} aria-hidden="true" />{viewCopy.presentation}
            </button>
          </div>
        ) : null}
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
                  {style.paragraphStyles.items.filter((item) => item.role !== 'citation' && item.role !== 'note-citation').map((definition) => (
                    <option key={definition.id} value={definition.id}>{publicationParagraphStyleName(definition, locale)}</option>
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
                        onClick={() => {
                          setActiveParagraphStyleId(definition.id);
                          if (paragraphStyleAssignable && definition.role !== 'citation' && definition.role !== 'note-citation') {
                            assignParagraphStyle(definition.id);
                          }
                        }}
                      >
                        <Pilcrow size={14} aria-hidden="true" />
                        <span>{publicationParagraphStyleName(definition, locale)}</span>
                        {definition.id === style.paragraphStyles.defaultStyleId ? <small>¶</small> : null}
                      </button>
                    ))}
                  </div>
                  <div className="publication-paragraph-style-icon-actions">
                    <button type="button" title={copy.newParagraphStyle} aria-label={copy.newParagraphStyle} onClick={createParagraphStyle}><Plus size={16} /></button>
                    <button type="button" title={copy.duplicate} aria-label={copy.duplicate} onClick={duplicateParagraphStyle}><Copy size={16} /></button>
                    <button type="button" title={copy.deleteParagraphStyle} aria-label={copy.deleteParagraphStyle} disabled={activeParagraphStyle.id === style.paragraphStyles.defaultStyleId || !!activeParagraphStyle.role} onClick={deleteParagraphStyle}><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="publication-paragraph-style-settings">
                  <InDesignParagraphStyleSettings
                    locale={locale}
                    documentLanguage={manuscript.locale}
                    printLayout={documentViewMode === 'print'}
                    collection={style.paragraphStyles}
                    definition={activeParagraphStyle}
                    resolved={resolvedParagraphStyle}
                    onPatchDefinition={(update) => patchParagraphStyle(activeParagraphStyle.id, update)}
                    onSetProperty={setParagraphStyleProperty}
                    fontControls={(
                      <>
                        <SystemFontCatalogControls
                          status={systemFontLoadStatus}
                          statusText={fontCatalogStatusText}
                          loadLabel={systemFontLoadStatus === 'loaded' ? copy.refreshSystemFonts : copy.loadSystemFonts}
                          onLoad={() => void loadSystemFonts()}
                        />
                        <div className="publication-style-grid">
                          <FontFamilySelect
                            label={copy.font}
                            value={resolvedParagraphStyle.fontFamily}
                            families={availableFontFamilies}
                            sampleText={copy.fontSample}
                            searchLabel={copy.searchFonts}
                            noResults={copy.noMatchingFonts}
                            onChange={setParagraphFontFamily}
                          />
                          <FontFaceSelect
                            label={copy.fontVariant}
                            family={resolvedParagraphStyle.fontFamily}
                            faces={paragraphFontFaces}
                            weight={resolvedParagraphStyle.fontWeight}
                            fontStyle={resolvedParagraphStyle.fontStyle}
                            sampleText={copy.fontSample}
                            onChange={setParagraphFontFace}
                          />
                        </div>
                      </>
                    )}
                  />
                  {activeParagraphStyle.role === 'note-citation' ? <fieldset>
                    <legend>{publicationParagraphStyleName(activeParagraphStyle, locale)}</legend>
                    {(['first', 'subsequent'] as const).map((kind) => <label key={kind}>
                      <span>{noteCitationLabels[kind]}</span>
                      <select aria-label={noteCitationLabels[kind]} value={style.noteCitationStyles?.[kind] ?? ''} onChange={(event) => patchStyle((current) => ({ ...current, noteCitationStyles: { ...current.noteCitationStyles, [kind]: event.target.value || undefined } }))}>
                        <option value="">{locale === 'hu' ? 'Öröklés a hivatkozási beállításokból' : locale === 'de' ? 'Aus Zitiereinstellungen übernehmen' : 'Inherit citation settings'}</option>
                        {CITATION_STYLE_CATALOG.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </label>)}
                  </fieldset> : null}
                  <div className="publication-style-actions">
                    <button
                      type="button"
                      className="studio-menu-secondary-action"
                      disabled={!Object.keys(activeParagraphStyle.properties).length}
                      onClick={clearParagraphStyleOverrides}
                    >
                      <RotateCcw size={16} />
                      {copy.clearOverrides}
                    </button>
                    <small className="publication-paragraph-style-inheritance-note">
                      {copy.inheritedValues}
                    </small>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        ) : null}

        {openPanel === 'tableStyles' ? <div id="publication-style-ribbon-panel-tableStyles" className="publication-style-ribbon-panel" role="dialog" aria-label={getVisualElementsCopy(locale).tableAppearanceStyles}>
          <PublicationTableStylesPanel key={manuscript.id} catalog={style.tableStyles} copy={getVisualElementsCopy(locale)} onChange={tableStyles=>patchStyle(current=>({...current,tableStyles}))} onRename={(tableStyles,from,to)=>{
            const next={...style,tableStyles};
            // Synchronize an unsaved local style before the atomic rename.
            stageAppliedPublicationStyle(style);
            stageAppliedPublicationStyle(next,{from,to});
            synchronizedStyleRef.current=getAppliedPublicationTemplate(useStudioStore.getState().manuscript)?.style;
            patchStyle(()=>next);
          }} />
        </div> : null}

        {openPanel === 'pageStyles' ? <div id="publication-style-ribbon-panel-pageStyles" className="publication-style-ribbon-panel" role="dialog" aria-label={publicationPageStylesCopy(locale).title}>
          <PublicationPageStylesPanel style={style} sections={manuscript.sections} locale={locale} selectedSectionId={useStudioStore.getState().selectedSectionId} onChange={setStyle}
            checker={<PublicationLayoutChecker manuscript={manuscript} locale={locale} enabled={checkerEnabled} onEnabled={setCheckerEnabled} issues={layoutIssues} onNavigate={navigateLayoutIssue} />} />
        </div> : null}

        {openPanel === 'page' ? (
          <div id="publication-style-ribbon-panel-page" className="publication-style-ribbon-panel" role="dialog" aria-label={copy.page}>
            <fieldset>
              <legend>{copy.page}</legend>
              <label className="publication-style-toggle">
                <input type="checkbox" checked={style.page.facingPages === true} onChange={(event) => setPage('facingPages', event.target.checked)} />
                <span>{locale === 'hu' ? 'Oldalpáros elrendezés' : locale === 'de' ? 'Doppelseiten' : 'Facing pages'}</span>
              </label>
              <small>{locale === 'hu' ? 'Az első oldal önálló páratlan jobb oldal. Ezután páros bal és páratlan jobb oldalak következnek.' : locale === 'de' ? 'Die erste Seite ist eine einzelne ungerade rechte Seite. Danach folgen gerade linke und ungerade rechte Seiten.' : 'Start with a single odd right-hand page, then pair even left-hand and odd right-hand pages.'}</small>
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
                <NumberField label={copy.pageNumberStart} value={style.page.pageNumberStart ?? 1} min={style.page.facingPages ? 1 : 0} step={style.page.facingPages ? 2 : 1} onChange={(value) => setPage('pageNumberStart', Math.trunc(value))} />
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
              <SystemFontCatalogControls
                status={systemFontLoadStatus}
                statusText={fontCatalogStatusText}
                loadLabel={systemFontLoadStatus === 'loaded' ? copy.refreshSystemFonts : copy.loadSystemFonts}
                onLoad={() => void loadSystemFonts()}
              />
              <label className="publication-checkbox">
                <input type="checkbox" checked={style.overrideAuthorFonts === true}
                  onChange={event => patchStyle(current => ({ ...current, overrideAuthorFonts: event.target.checked }))} />
                <span>{({ hu: 'Szerzői betűtípusok felülbírálása a kiadványstílusokkal', de: 'Autorenschriften durch Publikationsstile ersetzen', en: 'Override author fonts with publication styles', fr: 'Remplacer les polices des auteurs par les styles de publication', it: 'Sostituisci i caratteri degli autori con gli stili di pubblicazione', es: 'Sustituir las fuentes del autor por los estilos de publicación', nl: 'Auteurslettertypen vervangen door publicatiestijlen', pl: 'Zastąp czcionki autora stylami publikacji' } as Record<string, string>)[locale] ?? 'Override author fonts with publication styles'}</span>
              </label>
              <div className="publication-style-grid">
                <FontFamilySelect
                  label={copy.font}
                  value={style.fonts.body.family}
                  families={availableFontFamilies}
                  sampleText={copy.fontSample}
                  searchLabel={copy.searchFonts}
                  noResults={copy.noMatchingFonts}
                  onChange={setBodyFontFamily}
                />
                <FontFaceSelect
                  label={copy.fontVariant}
                  family={style.fonts.body.family}
                  faces={bodyFontFaces}
                  weight={body.fontWeight}
                  fontStyle={bodyFontStyle}
                  sampleText={copy.fontSample}
                  onChange={setBodyFontFace}
                />
                <NumberField label={`${copy.bodySize} (pt)`} value={body.fontSize} step={0.1} onChange={(value) => setStyleValue('body', 'fontSize', value)} />
                <NumberField leading label={`${copy.bodyLeading} (pt)`} value={body.lineHeight} step={0.1} onChange={(value) => setStyleValue('body', 'lineHeight', value)} />
                <NumberField label={`${copy.indent} (mm)`} value={body.firstLineIndent} step={0.5} onChange={(value) => setStyleValue('body', 'firstLineIndent', value)} />
                <NumberField label={`${copy.titleSize} (pt)`} value={title.fontSize} step={0.1} onChange={(value) => setStyleValue('articleTitlePrimary', 'fontSize', value)} />
                <NumberField label={`${copy.headingSize} (pt)`} value={heading.fontSize} step={0.1} onChange={(value) => setStyleValue('heading1', 'fontSize', value)} />
                <NumberField label={`${copy.footnoteSize} (pt)`} value={footnote.fontSize} step={0.1} onChange={(value) => setStyleValue('footnote', 'fontSize', value)} />
                <fieldset className="publication-author-name-style">
                  <legend>{copy.authorNameParts}</legend>
                  <div className="publication-style-grid">
                    <label>
                      <span>{copy.givenNameStyle}</span>
                      <select
                        value={String(authorGivenName.fontWeight)}
                        onChange={(event) => setStyleValue('authorGivenName', 'fontWeight', Number(event.target.value))}
                      >
                        <option value="400">{copy.regular}</option>
                        <option value="500">{copy.medium}</option>
                        <option value="600">{copy.semiBold}</option>
                        <option value="700">{copy.bold}</option>
                      </select>
                    </label>
                    <label>
                      <span>{copy.familyNameStyle}</span>
                      <select
                        value={String(authorFamilyName.fontWeight)}
                        onChange={(event) => setStyleValue('authorFamilyName', 'fontWeight', Number(event.target.value))}
                      >
                        <option value="400">{copy.regular}</option>
                        <option value="500">{copy.medium}</option>
                        <option value="600">{copy.semiBold}</option>
                        <option value="700">{copy.bold}</option>
                      </select>
                    </label>
                    <label>
                      <span>{copy.givenNameVariant}</span>
                      <select
                        value={authorGivenName.fontStyle}
                        onChange={(event) => setStyleValue('authorGivenName', 'fontStyle', event.target.value)}
                      >
                        <option value="normal">{copy.normal}</option>
                        <option value="italic">{copy.italic}</option>
                      </select>
                    </label>
                    <label>
                      <span>{copy.familyNameVariant}</span>
                      <select
                        value={authorFamilyName.fontStyle}
                        onChange={(event) => setStyleValue('authorFamilyName', 'fontStyle', event.target.value)}
                      >
                        <option value="normal">{copy.normal}</option>
                        <option value="italic">{copy.italic}</option>
                      </select>
                    </label>
                    <label className="publication-style-toggle">
                      <input
                        type="checkbox"
                        checked={authorGivenName.fontVariantCaps === 'small-caps'}
                        onChange={(event) => setStyleValue('authorGivenName', 'fontVariantCaps', event.target.checked ? 'small-caps' : 'normal')}
                      />
                      <span>{copy.givenNameSmallCaps}</span>
                    </label>
                    <label className="publication-style-toggle">
                      <input
                        type="checkbox"
                        checked={authorFamilyName.fontVariantCaps === 'small-caps'}
                        onChange={(event) => setStyleValue('authorFamilyName', 'fontVariantCaps', event.target.checked ? 'small-caps' : 'normal')}
                      />
                      <span>{copy.familyNameSmallCaps}</span>
                    </label>
                    <label className="publication-style-toggle">
                      <input
                        type="checkbox"
                        checked={authorGivenName.textTransform === 'uppercase'}
                        onChange={(event) => setStyleValue('authorGivenName', 'textTransform', event.target.checked ? 'uppercase' : 'none')}
                      />
                      <span>{copy.givenNameUppercase}</span>
                    </label>
                    <label className="publication-style-toggle">
                      <input
                        type="checkbox"
                        checked={authorFamilyName.textTransform === 'uppercase'}
                        onChange={(event) => setStyleValue('authorFamilyName', 'textTransform', event.target.checked ? 'uppercase' : 'none')}
                      />
                      <span>{copy.familyNameUppercase}</span>
                    </label>
                  </div>
                </fieldset>
                <div className="publication-style-alignment" role="group" aria-label={copy.alignment}>
                  <span>{copy.alignment}</span>
                  <div>
                    {documentViewMode === 'print' ? <AlignmentButton label={copy.justify} active={body.alignment === 'justify'} onClick={() => setStyleValue('body', 'alignment', 'justify')}><AlignJustify size={17} aria-hidden="true" /></AlignmentButton> : null}
                    <AlignmentButton label={copy.alignLeft} active={body.alignment === 'left' || (documentViewMode === 'html' && body.alignment === 'justify')} onClick={() => setStyleValue('body', 'alignment', 'left')}><AlignLeft size={17} aria-hidden="true" /></AlignmentButton>
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
              <ProofingColorLegend locale={locale} mode="publication" />
              <div className={`publication-proofing-selection${proofingSelection ? '' : ' is-empty'}`}>
                <strong>{copy.selectedText}:</strong>{' '}
                {proofingSelection
                  ? proofingSelection.text.trim()
                    ? `“${proofingSelection.text.trim().slice(0, 160)}”`
                    : `${proofingSelection.blockId} · ${proofingSelection.from}`
                  : copy.placeCursor}
              </div>
              <div className="publication-proofing-actions">
                <button type="button" data-proofing-kind="discretionary-hyphen" disabled={!proofingSelection || proofingSelection.from !== proofingSelection.to} onClick={() => addCorrection('discretionary-hyphen')}><Scissors size={16} />{copy.optionalHyphen}</button>
                <button type="button" data-proofing-kind="nonbreaking" disabled={!proofingSelection?.text.trim()} onClick={() => addCorrection('nonbreaking')}><LinkIcon />{copy.nonbreaking}</button>
                <button type="button" data-proofing-kind="forced-line-break" disabled={!proofingSelection || proofingSelection.from !== proofingSelection.to} onClick={() => addCorrection('forced-line-break')}><CornerIcon />{copy.forcedLineBreak}</button>
                <button type="button" data-proofing-kind="page-break-before" disabled={!proofingSelection} onClick={() => addCorrection('page-break-before')}><FileText size={16} />{copy.pageBreakBefore}</button>
                <button type="button" data-proofing-kind="keep-together" disabled={!proofingSelection} onClick={() => addCorrection('keep-together')}><AlignJustify size={16} />{copy.keepTogether}</button>
                <button type="button" data-proofing-kind="keep-with-next" disabled={!proofingSelection} onClick={() => addCorrection('keep-with-next')}><Move size={16} />{copy.keepWithNext}</button>
              </div>
              <div className="publication-proofing-corrections">
                <h5>{copy.corrections} <span>{publicationCorrections.length}</span></h5>
                {publicationCorrections.length ? (
                  <ol>
                    {publicationCorrections.map((correction) => (
                      <li key={correction.id} data-proofing-kind={correction.kind}>
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
        {openPanel ? (
          <div className="publication-style-side-resizer" role="separator" aria-orientation="vertical"
            aria-label={sidebarCopy.resize} aria-valuemin={minSidebarWidth} aria-valuemax={maxSidebarWidth}
            aria-valuenow={sidebarWidth} tabIndex={0}
            onPointerDown={(event) => { if (event.button !== 0) return; resizingSidebar.current = true; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }}
            onPointerMove={(event) => {
              if (!resizingSidebar.current) return;
              const left = ribbonRef.current?.getBoundingClientRect().left ?? 0;
              setSidebarWidth(Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(event.clientX - left - 56))));
            }}
            onPointerUp={(event) => { resizingSidebar.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={() => { resizingSidebar.current = false; }}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              setSidebarWidth((width) => event.key === 'Home' ? minSidebarWidth : event.key === 'End' ? maxSidebarWidth
                : Math.max(minSidebarWidth, Math.min(maxSidebarWidth, width + (event.key === 'ArrowRight' ? 28 : -28))));
            }} />
        ) : null}
      </div> : null}
      <div className="publication-style-editor-main">

      {ojsTransferOpen ? <button type="button" className="studio-menu-secondary-action" onClick={() => setOjsTransferOpen(false)}>{ojsPublicationCopy(locale).close}</button> : null}
      <OjsPublicationTransferPanel key={manuscript.id} style={style} active={ojsTransferOpen} />
      {spineCalculationError ? <p role="alert">{getPublicationSpineCopy(locale).error}</p> : null}
      {matterToolsOpen ? <div id="publication-matter-workspace" className="publication-matter-workspace" role="tabpanel" aria-labelledby="publication-matter-tab"><PublicationMatterEditor widthMm={style.page.width} heightMm={style.page.height} bodyPageCount={bodyPageCount} /></div> : null}
      <div id="publication-content-workspace" className="publication-style-editor-layout" role={getDocumentStructureProfile(manuscript).kind === 'volume' ? 'tabpanel' : undefined} aria-labelledby={getDocumentStructureProfile(manuscript).kind === 'volume' ? 'publication-content-tab' : undefined} hidden={matterToolsOpen}>
        <PublicationDocumentCanvas
          active={!matterToolsOpen}
          style={style}
          onStyleChange={setStyle}
          viewMode={documentViewMode}
          onViewModeChange={changeDocumentViewMode}
          onProofingSelection={setProofingSelection}
          onPageCountChange={handlePageCount}
          onLayoutIssues={reportBodyIssues}
          navigationTarget={layoutTarget}
          pageNavigatorTarget={openPanel === 'thumbnails' ? thumbnailsTarget : null}
          showRuler={rulerVisible}
          presentation={presentation}
          displayOptions={{ nonPrintingMarks: showNonPrintingMarks, showMarginBoundaries: viewOptions.showMarginBoundaries, showAlignmentGuides: viewOptions.showAlignmentGuides }}
          onDisplayOptionChange={onDisplayOptionChange}
        />
        {frameToolsOpen || checkerEnabled ? (
          <section
            id="publication-frame-inspector-panel"
            className="publication-frame-inspector-panel"
            aria-label={frameCopy.tools}
            style={!frameToolsOpen ? { display: 'none' } : undefined}
          >
            <div className="publication-frame-inspector-heading">
              <h5>{frameCopy.tools}</h5>
              <button type="button" aria-label={frameCopy.closeTools} onClick={() => setFrameToolsOpen(false)}>
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <p className="publication-frame-inspector-advisory">{frameCopy.toolsHelp}</p>
            <PublicationFrameEditor key={manuscript.id} publicationStyle={style} onLayoutIssues={reportFrameIssues}
              showMarginBoundaries={viewOptions.showMarginBoundaries} showAlignmentGuides={viewOptions.showAlignmentGuides} />
          </section>
        ) : null}
      </div>
      </div>
      </div>
    </section>
    </PublicationGraphicsContext.Provider>
  );
}

function SystemFontCatalogControls({
  status,
  statusText,
  loadLabel,
  onLoad,
}: {
  status: SystemFontLoadStatus;
  statusText: string;
  loadLabel: string;
  onLoad: () => void;
}) {
  return (
    <div className="publication-system-font-controls">
      <button
        type="button"
        className="publication-system-font-refresh"
        disabled={status === 'loading'}
        aria-label={loadLabel}
        title={loadLabel}
        onClick={onLoad}
      >
        <RefreshCw
          size={16}
          className={status === 'loading' ? 'is-loading' : ''}
          aria-hidden="true"
        />
        <span>{loadLabel}</span>
      </button>
      <small role="status" aria-live="polite">{statusText}</small>
    </div>
  );
}

function FontFamilySelect({
  label,
  value,
  families,
  sampleText,
  searchLabel,
  noResults,
  onChange,
}: {
  label: string;
  value: string;
  families: readonly SystemFontFamily[];
  sampleText: string;
  searchLabel: string;
  noResults: string;
  onChange: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleFamilies = normalizedQuery
    ? families.filter((item) => item.family.toLocaleLowerCase().includes(normalizedQuery))
    : families;

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', closeOnPointerDown, true);
    };
  }, [open]);

  function selectFamily(family: string): void {
    onChange(family);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="publication-font-dropdown publication-font-family-field" ref={rootRef}>
      <span id={labelId}>{label}</span>
      <button
        type="button"
        className="publication-font-dropdown-trigger"
        role="combobox"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span style={{ fontFamily: value }}>{value}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="publication-font-dropdown-popover">
          <input
            ref={searchRef}
            type="search"
            value={query}
            aria-label={searchLabel}
            placeholder={searchLabel}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                rootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
              }
            }}
          />
          <div id={listId} className="publication-font-dropdown-list" role="listbox" aria-labelledby={labelId}>
            {visibleFamilies.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={item.family === value}
                className={item.family === value ? 'is-selected' : ''}
                key={item.family}
                onClick={() => selectFamily(item.family)}
              >
                <span className="publication-font-option-name">{item.family}</span>
                <span className="publication-font-option-sample" style={{ fontFamily: item.family }}>
                  {sampleText}
                </span>
              </button>
            ))}
            {!visibleFamilies.length ? (
              <span className="publication-font-dropdown-empty">{noResults}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FontFaceSelect({
  label,
  family,
  faces,
  weight,
  fontStyle,
  sampleText,
  onChange,
}: {
  label: string;
  family: string;
  faces: readonly SystemFontFace[];
  weight: number;
  fontStyle: SystemFontCssStyle;
  sampleText: string;
  onChange: (face: SystemFontFace) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const value = systemFontFaceValue(weight, fontStyle);
  const options = faces.some((face) => (
    systemFontFaceValue(face.weight, face.fontStyle) === value
  ))
    ? [...faces]
    : [...faces, currentSystemFontFace(family, weight, fontStyle)];
  const selectedFace = options.find((face) => (
    systemFontFaceValue(face.weight, face.fontStyle) === value
  )) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown, true);
    return () => document.removeEventListener('pointerdown', closeOnPointerDown, true);
  }, [open]);

  function selectFace(face: SystemFontFace): void {
    onChange(face);
    setOpen(false);
  }

  return (
    <div className="publication-font-dropdown publication-font-face-field" ref={rootRef}>
      <span id={labelId}>{label}</span>
      <button
        type="button"
        className="publication-font-dropdown-trigger"
        role="combobox"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        style={{ fontFamily: family, fontWeight: weight, fontStyle }}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => {
            rootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
          });
        }}
      >
        <span>{selectedFace?.style ?? fontWeightName(weight)}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="publication-font-dropdown-popover publication-font-dropdown-popover--faces">
          <div id={listId} className="publication-font-dropdown-list" role="listbox" aria-labelledby={labelId}>
            {options.map((face) => {
              const faceValue = systemFontFaceValue(face.weight, face.fontStyle);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={faceValue === value}
                  className={faceValue === value ? 'is-selected' : ''}
                  key={faceValue}
                  onClick={() => selectFace(face)}
                >
                  <span className="publication-font-option-name">{face.style}</span>
                  <span
                    className="publication-font-option-sample"
                    style={{
                      fontFamily: family,
                      fontWeight: face.weight,
                      fontStyle: face.fontStyle,
                    }}
                  >
                    {sampleText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function currentSystemFontFace(
  family: string,
  weight: number,
  fontStyle: SystemFontCssStyle,
): SystemFontFace {
  const style = `${fontWeightName(weight)}${fontStyle === 'italic' ? ' Italic' : ''}`;
  return {
    family,
    fullName: `${family} ${style}`,
    style,
    weight,
    fontStyle,
  };
}

function fontWeightName(weight: number): string {
  if (weight <= 100) return 'Thin';
  if (weight <= 200) return 'Extra Light';
  if (weight <= 300) return 'Light';
  if (weight <= 400) return 'Regular';
  if (weight <= 500) return 'Medium';
  if (weight <= 600) return 'Semi Bold';
  if (weight <= 700) return 'Bold';
  if (weight <= 800) return 'Extra Bold';
  return 'Black';
}

function systemFontStatusMessage(
  status: SystemFontLoadStatus,
  catalog: readonly SystemFontFamily[],
  copy: ReturnType<typeof copyFor>,
): string {
  if (status === 'loading') return copy.loadingSystemFonts;
  if (status === 'loaded') {
    return copy.systemFontsLoaded(catalog.length, systemFontFaceCount(catalog));
  }
  if (status === 'unsupported') return copy.systemFontsUnsupported;
  if (status === 'denied') return copy.systemFontsDenied;
  if (status === 'error') return copy.systemFontsError;
  return copy.systemFontsFallback;
}

function collectPublicationFontFamilies(style: PublicationStyle): string[] {
  return [
    style.fonts.body.family,
    style.fonts.note.family,
    ...style.paragraphStyles.items.map((definition) => definition.properties.fontFamily ?? ''),
  ];
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
      aria-label={label}
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
  pressed,
  expanded,
  controls,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      className="publication-style-ribbon-action-button"
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
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
  leading = false,
}: {
  leading?: boolean;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}) {
  const [unit] = usePublicationMeasurementUnit();
  if (label.endsWith('(pt)')) return <PublicationPointInput label={label} value={value} min={1} leading={leading} onChange={onChange} />;
  if (label.endsWith('(mm)')) return <MatterNumber label={label} value={value} min={min} max={20000} disabled={false} unit={unit} commitOnChange onCommit={onChange} />;
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
