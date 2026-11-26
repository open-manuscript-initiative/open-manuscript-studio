import { normalizeListAttribute } from '../model/directListFormatting';
import { normalizeSourceStyle, sourceStyleBundle } from '../model/sourceWordStyles';
import type { Editor } from '@tiptap/core';
import { EyeOff, Unlink, RotateCcw, PaintBucket, Square, ArrowRightToLine, Plus, Trash2, AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease, List, ListOrdered, Pilcrow, Baseline, CaseUpper, Highlighter, LetterText, Palette, RemoveFormatting, Strikethrough, Type, Underline } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { PUBLICATION_FONT_SIZE_PRESETS } from './PublicationPointInput';
import { fallbackSystemFontFamilies } from '../services/systemFonts';
import { normalizeParagraphValue, paragraphBorders, paragraphTabs, BORDER_SIDES, type ParagraphFormat, type ParagraphBorder, type ParagraphTab } from '../model/directParagraphFormatting';
import { DIRECT_FORMATS, normalizeDirectValue, normalizeUnderlineStyle, type DirectFormat } from '../model/directFormatting';
import { getRichTextCopy } from '../i18n/richText';
import type { SupportedLocale } from '../i18n/types';

// Use the same common typefaces as the publication editor, without requesting
// local-font permission just to open the authoring formatting panel.
const AUTHORING_FONT_FAMILIES = fallbackSystemFontFamilies()
  .map(({ family }) => family)
  .filter(family => !['system-ui', 'sans-serif', 'serif', 'monospace'].includes(family));

type Labels = readonly string[];
const LABELS: Record<string, Labels> = {
  en: ['Character formatting','Font family','Font size (pt)','Text color','Character background','Highlight','Letter spacing (pt)','Baseline shift (pt)','Underline style','Single','Double','Dotted','Wavy','Uppercase','Double strike','Outline','Shadow','Character width (%)','Kerning threshold (pt)','Reset','Mixed formatting'],
  hu: ['Karakterformázás','Betűtípus','Betűméret (pt)','Betűszín','Karakterháttér','Kiemelés','Betűköz (pt)','Alapvonal-eltolás (pt)','Aláhúzás típusa','Egyszeres','Dupla','Pontozott','Hullámos','Nagybetűs','Dupla áthúzás','Körvonal','Árnyék','Betűszélesség (%)','Alávágási küszöb (pt)','Alaphelyzet','Vegyes formázás'],
  de: ['Zeichenformatierung','Schriftfamilie','Schriftgröße (pt)','Schriftfarbe','Zeichenhintergrund','Hervorhebung','Laufweite (pt)','Grundlinienversatz (pt)','Unterstreichungsart','Einfach','Doppelt','Gepunktet','Wellig','Versalien','Doppelt durchgestrichen','Kontur','Schatten','Zeichenbreite (%)','Kerning-Schwelle (pt)','Zurücksetzen','Gemischte Formatierung'],
  fr: ['Mise en forme des caractères','Police','Taille (pt)','Couleur du texte','Arrière-plan','Surlignage','Interlettrage (pt)','Décalage vertical (pt)','Type de soulignement','Simple','Double','Pointillé','Ondulé','Majuscules','Double barré','Contour','Ombre','Largeur (%)','Seuil de crénage (pt)','Réinitialiser','Formats mixtes'],
  it: ['Formattazione caratteri','Famiglia di caratteri','Dimensione (pt)','Colore del testo','Sfondo','Evidenziazione','Spaziatura (pt)','Spostamento verticale (pt)','Tipo di sottolineatura','Singola','Doppia','Punteggiata','Ondulata','Maiuscolo','Doppio barrato','Contorno','Ombra','Larghezza (%)','Soglia crenatura (pt)','Ripristina','Formati misti'],
  es: ['Formato de caracteres','Familia tipográfica','Tamaño (pt)','Color del texto','Fondo','Resaltado','Espaciado (pt)','Desplazamiento vertical (pt)','Tipo de subrayado','Simple','Doble','Punteado','Ondulado','Mayúsculas','Doble tachado','Contorno','Sombra','Ancho (%)','Umbral de interletraje (pt)','Restablecer','Formato mixto'],
  nl: ['Tekenopmaak','Lettertype','Tekengrootte (pt)','Tekstkleur','Achtergrond','Markering','Letterafstand (pt)','Basislijnverschuiving (pt)','Onderstrepingstype','Enkel','Dubbel','Gestippeld','Golvend','Hoofdletters','Dubbel doorhalen','Omtrek','Schaduw','Tekenbreedte (%)','Kerningdrempel (pt)','Herstellen','Gemengde opmaak'],
  pl: ['Formatowanie znaków','Krój pisma','Rozmiar (pt)','Kolor tekstu','Tło znaków','Wyróżnienie','Odstępy (pt)','Przesunięcie pionowe (pt)','Rodzaj podkreślenia','Pojedyncze','Podwójne','Kropkowane','Faliste','Wielkie litery','Podwójne przekreślenie','Kontur','Cień','Szerokość (%)','Próg kerningu (pt)','Resetuj','Formatowanie mieszane'],
};
const DIRECTION_LABELS:Record<string,readonly string[]>={en:['Text direction','Left to right','Right to left'],hu:['Írásirány','Balról jobbra','Jobbról balra'],de:['Schreibrichtung','Links nach rechts','Rechts nach links'],fr:['Sens du texte','De gauche à droite','De droite à gauche'],it:['Direzione del testo','Da sinistra a destra','Da destra a sinistra'],es:['Dirección del texto','De izquierda a derecha','De derecha a izquierda'],nl:['Schrijfrichting','Van links naar rechts','Van rechts naar links'],pl:['Kierunek tekstu','Od lewej do prawej','Od prawej do lewej']};
const directionLabels=(locale:SupportedLocale)=>DIRECTION_LABELS[locale]??DIRECTION_LABELS.en!;
const directionChoices=(locale:SupportedLocale)=>['ltr','rtl'].map((value,i)=>({value,label:directionLabels(locale)[i+1]!}));
const labels = (locale: SupportedLocale) => LABELS[locale] ?? LABELS.en!;
export function directFormattingLabel(locale: SupportedLocale): string { return labels(locale)[0]!; }
/** Reuse the existing localized vocabulary in table range controls. */
export function tableRangeCharacterLabels(locale:SupportedLocale){
  const l=labels(locale);
  return {title:l[0]!,omiSourceFont:l[1]!,omiFontSize:l[2]!,omiTextColor:l[3]!,omiCharacterBackground:l[4]!,omiTracking:l[6]!,omiBaseline:l[7]!,omiCharacterScale:l[17]!,omiKerning:l[18]!,reset:l[19]!,mixed:l[20]!};
}
function selectedValue(editor: Editor, name: string, attribute: string): { value: string; mixed: boolean } {
  const { from, to, empty } = editor.state.selection;
  if (empty) return { value: String(editor.getAttributes(name)[attribute] ?? ''), mixed: false };
  const values = new Set<string>();
  editor.state.doc.nodesBetween(from, to, node => {
    if (!node.isText) return;
    values.add(String(node.marks.find(mark => mark.type.name === name)?.attrs[attribute] ?? ''));
  });
  return { value: values.size === 1 ? [...values][0]! : '', mixed: values.size > 1 };
}
function applyMark(editor: Editor, name: string, attrs: Record<string, unknown> | null, restoreFocus = true): void {
  const chain = editor.chain();
  if (restoreFocus) chain.focus(undefined, { scrollIntoView: false });
  if (editor.state.selection.empty && editor.isActive(name)) chain.extendMarkRange(name);
  if (attrs) chain.setMark(name, attrs).run();
  else chain.unsetMark(name).run();
}

function FormatField({ editor, name, paragraph = false, attribute = 'value', label, icon, copy, reset, mixed, kind = 'text', choices, defaultValue, normalize }: {
  editor: Editor; name: string; paragraph?: boolean; attribute?: string; label: string; icon: ReactNode;
  copy: ReturnType<typeof getRichTextCopy>; reset: string; mixed: string;
  kind?: 'text' | 'number' | 'color'; choices?: { value: string; label: string }[];
  defaultValue?: string; normalize: (value: string) => unknown;
}) {
  const current = paragraph ? selectedParagraphValue(editor, name) : selectedValue(editor, name, attribute);
  const [draft, setDraft] = useState(current.value || defaultValue || '');
  const [editing, setEditing] = useState(false);
  const editSelection = useRef<{ from: number; to: number } | null>(null);
  const value = editing ? draft : current.value || (choices ? '' : defaultValue || '');
  const normalized = normalize(value);
  const fontFamilies = name === 'omiSourceFont'
    ? [...new Set([...AUTHORING_FONT_FAMILIES, ...(current.value ? [current.value] : [])])]
    : [];
  const applyValue = (next: string, restoreFocus: boolean) => {
    const nextValue = normalize(next);
    if (nextValue === undefined || nextValue === null) return;
    if (paragraph) {
      const chain = editor.chain();
      if (restoreFocus) chain.focus(undefined, { scrollIntoView: false });
      chain.updateAttributes('paragraph', { [name]: nextValue }).run();
    } else applyMark(editor, name, { [attribute]: nextValue }, restoreFocus);
    setEditing(false);
  };
  const apply = () => applyValue(value, true);
  const update = (next: string) => {
    if (!editing) editSelection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    setDraft(next); setEditing(true);
  };
  const choose = (next: string) => { applyValue(next, false); };
  return <div className="omi-direct-format-field">
    <label title={current.mixed ? mixed : label}>
      {icon}<span>{label}</span>
      {choices ? <select aria-label={label} value={value} onChange={event => choose(event.target.value)}>
        <option value="" disabled>{current.mixed ? mixed : reset}</option>
        {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select> : <><input aria-label={label} type={kind} step={kind === 'number' ? 'any' : undefined}
        placeholder={current.mixed ? mixed : undefined} value={value}
        onChange={event => kind === 'color' ? choose(event.target.value) : update(event.target.value)}
        onBlur={() => {
          const selection = editSelection.current;
          if (editing && selection && selection.from === editor.state.selection.from && selection.to === editor.state.selection.to) {
            applyValue(draft, false);
          }
          setEditing(false);
        }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); apply(); } }} />
        {name === 'omiSourceFont' ? <select aria-label={label} value={current.value} onChange={event => choose(event.target.value)}>
          <option value="" disabled>{current.mixed ? mixed : reset}</option>
          {fontFamilies.map(family => <option key={family} value={family} style={{ fontFamily: family }}>{family}</option>)}
        </select> : null}
        {name === 'omiFontSize' ? <select aria-label={label} value={current.value && PUBLICATION_FONT_SIZE_PRESETS.includes(Number(current.value)) ? current.value : ''} onChange={event => choose(event.target.value)}>
          <option value="" disabled>—</option>
          {PUBLICATION_FONT_SIZE_PRESETS.map(size => <option key={size} value={size}>{size} pt</option>)}
        </select> : null}</>}
    </label>
    <button type="button" aria-label={copy.apply + ': ' + label} title={copy.apply} disabled={normalized === undefined || normalized === null} onMouseDown={e => e.preventDefault()} onClick={apply}>✓</button>
    <button type="button" aria-label={reset + ': ' + label} title={reset} onMouseDown={e => e.preventDefault()} onClick={() => { if (paragraph) editor.chain().focus().updateAttributes('paragraph', { [name]: null }).run(); else applyMark(editor, name, null); setEditing(false); }}><RemoveFormatting size={15} aria-hidden="true" /></button>
  </div>;
}
const ADVANCED_CHARACTER_LABELS: Record<string, Labels> = {
  "en": [
    "Hidden text",
    "Ligatures",
    "None",
    "Standard",
    "Contextual",
    "Historical",
    "Discretionary",
    "All"
  ],
  "hu": [
    "Rejtett szöveg",
    "Ligatúrák",
    "Nincs",
    "Szabványos",
    "Környezetfüggő",
    "Történeti",
    "Választható",
    "Mindegyik"
  ],
  "de": [
    "Ausgeblendeter Text",
    "Ligaturen",
    "Keine",
    "Standard",
    "Kontextabhängig",
    "Historisch",
    "Bedingt",
    "Alle"
  ],
  "fr": [
    "Texte masqué",
    "Ligatures",
    "Aucune",
    "Standard",
    "Contextuelles",
    "Historiques",
    "Discrétionnaires",
    "Toutes"
  ],
  "it": [
    "Testo nascosto",
    "Legature",
    "Nessuna",
    "Standard",
    "Contestuali",
    "Storiche",
    "Discrezionali",
    "Tutte"
  ],
  "es": [
    "Texto oculto",
    "Ligaduras",
    "Ninguna",
    "Estándar",
    "Contextuales",
    "Históricas",
    "Discrecionales",
    "Todas"
  ],
  "nl": [
    "Verborgen tekst",
    "Ligaturen",
    "Geen",
    "Standaard",
    "Contextueel",
    "Historisch",
    "Optioneel",
    "Alle"
  ],
  "pl": [
    "Tekst ukryty",
    "Ligatury",
    "Brak",
    "Standardowe",
    "Kontekstowe",
    "Historyczne",
    "Opcjonalne",
    "Wszystkie"
  ]
};
function ligatureLabel(value: string, l: Labels): string {
  if (value === 'none') return l[2]!;
  if (value === 'all') return l[7]!;
  return ['standard','contextual','historical','discretional'].flatMap((part,i)=>value.toLowerCase().includes(part)?[l[i+3]!]:[]).join(' + ');
}
export function DirectFormattingPanel({ editor, locale }: { editor: Editor; locale: SupportedLocale }) {
  const l = labels(locale);
  const advanced = ADVANCED_CHARACTER_LABELS[locale] ?? ADVANCED_CHARACTER_LABELS.en!;
  const copy = getRichTextCopy(locale);
  const common = { editor, copy, reset: l[19]!, mixed: l[20]! };
  const field = (name: DirectFormat, index: number, icon: ReactNode, kind: 'number' | 'color' = 'number', defaultValue = '') =>
    <FormatField key={name} {...common} name={name} label={l[index]!} icon={icon} kind={kind} defaultValue={defaultValue} normalize={v => normalizeDirectValue(name, v)} />;
  const toggle = (name: DirectFormat, index: number | string, icon: ReactNode) => {
    const label = typeof index === 'number' ? l[index] : index;
    const state = selectedValue(editor, name, 'value');
    const active = editor.isActive(name);
    return <button type="button" key={name} title={label} aria-label={label} aria-pressed={state.mixed ? 'mixed' : active} className={active ? 'is-active' : ''} onMouseDown={e => e.preventDefault()} onClick={() => applyMark(editor, name, active ? null : { value: true })}>{icon}</button>;
  };
  return <div className="omi-rich-text-popover omi-direct-formatting" aria-label={l[0]}>
    <div className="omi-rich-text-command-grid">
      {toggle('omiUppercase', 13, <CaseUpper size={17} aria-hidden="true" />)}
      {toggle('omiDoubleStrike', 14, <span aria-hidden="true" style={{ textDecoration: 'line-through double' }}>S</span>)}
      {toggle('omiOutline', 15, <span aria-hidden="true" style={{ WebkitTextStroke: '0.7px currentColor', color: 'transparent' }}>A</span>)}
      {toggle('omiShadow', 16, <span aria-hidden="true" style={{ textShadow: '1px 1px 1px #888' }}>A</span>)}
      {toggle('omiHiddenText', advanced[0]!, <EyeOff size={17} aria-hidden="true" />)}
    </div>
    <div className="omi-direct-format-fields">
      <SourceStyleControls editor={editor} locale={locale} kind="character"/>
      <FormatField {...common} name="omiSourceFont" attribute="family" label={l[1]!} icon={<Type size={16} aria-hidden="true" />}
        normalize={v => { const value = v.trim(); return value && value.length <= 128 && Array.from(value).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127 && !';{}<>'.includes(c)) ? value : undefined; }} />
      {field('omiFontSize', 2, <LetterText size={16} aria-hidden="true" />, 'number', '12')}
      {field('omiTextColor', 3, <Palette size={16} aria-hidden="true" />, 'color', '#000000')}
      {field('omiCharacterBackground', 4, <Palette size={16} aria-hidden="true" />, 'color', '#ffffff')}
      <FormatField {...common} name="omiHighlight" label={l[5]!} icon={<Highlighter size={16} aria-hidden="true" />} defaultValue="yellow"
        choices={DIRECT_FORMATS.omiHighlight.choices.map(value => ({ value, label: value }))}
        normalize={v => normalizeDirectValue('omiHighlight', v)} />
      {field('omiTracking', 6, <LetterText size={16} aria-hidden="true" />, 'number', '0')}
      {field('omiBaseline', 7, <Baseline size={16} aria-hidden="true" />, 'number', '0')}
      <FormatField {...common} name="omiUnderline" attribute="variant" label={l[8]!} icon={<Underline size={16} aria-hidden="true" />} defaultValue="single"
        choices={['single', 'double', 'dotted', 'wave'].map((value, i) => ({ value, label: l[9 + i]! }))}
        normalize={v => v === 'single' ? 'single' : normalizeUnderlineStyle(v)} />
      {field('omiCharacterScale', 17, <LetterText size={16} aria-hidden="true" />, 'number', '100')}
      {field('omiKerning', 18, <Strikethrough size={16} aria-hidden="true" />, 'number', '0')}
      <FormatField {...common} name="omiTextDirection" label={directionLabels(locale)[0]!} icon={<Pilcrow size={15}/>} choices={directionChoices(locale)} normalize={value=>normalizeDirectValue('omiTextDirection',value)}/>
      <FormatField {...common} name="omiLigatures" label={advanced[1]!} icon={<span aria-hidden="true">ﬁ</span>} defaultValue="standardContextual"
        choices={DIRECT_FORMATS.omiLigatures.choices.map(value=>({value,label:ligatureLabel(value,advanced)}))}
        normalize={value=>normalizeDirectValue('omiLigatures',value)}/>
    </div>
  </div>;
}


const PARAGRAPH_LABELS: Record<string, Labels> = {
  en: ['Paragraph formatting','Align left','Align center','Align right','Justify','Left indent (pt)','Right indent (pt)','First line indent (pt)','Space before (pt)','Space after (pt)','Line spacing','Line spacing rule','Multiple','Exact (pt)','At least (pt)','Increase list level','Decrease list level','Reset paragraph formatting'],
  hu: ['Bekezdésformázás','Balra zárt','Középre zárt','Jobbra zárt','Sorkizárt','Bal behúzás (pt)','Jobb behúzás (pt)','Első sor behúzása (pt)','Térköz előtte (pt)','Térköz utána (pt)','Sorköz','Sorköz típusa','Többszörös','Pontos (pt)','Legalább (pt)','Listaszint növelése','Listaszint csökkentése','Bekezdésformázás törlése'],
  de: ['Absatzformatierung','Linksbündig','Zentriert','Rechtsbündig','Blocksatz','Linker Einzug (pt)','Rechter Einzug (pt)','Erstzeileneinzug (pt)','Abstand davor (pt)','Abstand danach (pt)','Zeilenabstand','Zeilenabstandsart','Mehrfach','Genau (pt)','Mindestens (pt)','Listenebene erhöhen','Listenebene verringern','Absatzformatierung zurücksetzen'],
  fr: ['Mise en forme du paragraphe','Aligner à gauche','Centrer','Aligner à droite','Justifier','Retrait gauche (pt)','Retrait droit (pt)','Retrait première ligne (pt)','Espacement avant (pt)','Espacement après (pt)','Interligne','Type d’interligne','Multiple','Exact (pt)','Au moins (pt)','Augmenter le niveau de liste','Réduire le niveau de liste','Réinitialiser le paragraphe'],
  it: ['Formattazione paragrafo','Allinea a sinistra','Centra','Allinea a destra','Giustifica','Rientro sinistro (pt)','Rientro destro (pt)','Rientro prima riga (pt)','Spazio prima (pt)','Spazio dopo (pt)','Interlinea','Tipo di interlinea','Multipla','Esatta (pt)','Almeno (pt)','Aumenta livello elenco','Riduci livello elenco','Ripristina paragrafo'],
  es: ['Formato de párrafo','Alinear a la izquierda','Centrar','Alinear a la derecha','Justificar','Sangría izquierda (pt)','Sangría derecha (pt)','Sangría primera línea (pt)','Espacio antes (pt)','Espacio después (pt)','Interlineado','Tipo de interlineado','Múltiple','Exacto (pt)','Mínimo (pt)','Aumentar nivel de lista','Reducir nivel de lista','Restablecer párrafo'],
  nl: ['Alineaopmaak','Links uitlijnen','Centreren','Rechts uitlijnen','Uitvullen','Inspringing links (pt)','Inspringing rechts (pt)','Eerste regel (pt)','Ruimte voor (pt)','Ruimte na (pt)','Regelafstand','Type regelafstand','Meervoudig','Exact (pt)','Minimaal (pt)','Lijstniveau verhogen','Lijstniveau verlagen','Alineaopmaak herstellen'],
  pl: ['Formatowanie akapitu','Wyrównaj do lewej','Wyśrodkuj','Wyrównaj do prawej','Wyjustuj','Wcięcie lewe (pt)','Wcięcie prawe (pt)','Wcięcie pierwszego wiersza (pt)','Odstęp przed (pt)','Odstęp po (pt)','Interlinia','Rodzaj interlinii','Wielokrotna','Dokładna (pt)','Co najmniej (pt)','Zwiększ poziom listy','Zmniejsz poziom listy','Resetuj akapit'],
};
const PAGINATION_LABELS: Record<string, readonly string[]> = {
  "en": [
    "Widow/orphan control",
    "Keep with next",
    "Keep lines together",
    "Page break before",
    "Inherit",
    "On",
    "Off"
  ],
  "hu": [
    "Fattyú- és árvasorok tiltása",
    "Együtt a következővel",
    "Sorok együtt tartása",
    "Oldaltörés előtte",
    "Öröklés",
    "Be",
    "Ki"
  ],
  "de": [
    "Schusterjungen/Hurenkinder vermeiden",
    "Mit nächstem Absatz zusammenhalten",
    "Zeilen zusammenhalten",
    "Seitenumbruch davor",
    "Vererben",
    "Ein",
    "Aus"
  ],
  "fr": [
    "Éviter les veuves et orphelines",
    "Avec le paragraphe suivant",
    "Lignes solidaires",
    "Saut de page avant",
    "Hériter",
    "Activé",
    "Désactivé"
  ],
  "it": [
    "Controllo righe isolate",
    "Mantieni con successivo",
    "Mantieni righe unite",
    "Interruzione di pagina prima",
    "Eredita",
    "Attivo",
    "Disattivo"
  ],
  "es": [
    "Control de viudas y huérfanas",
    "Mantener con el siguiente",
    "Mantener líneas juntas",
    "Salto de página anterior",
    "Heredar",
    "Activado",
    "Desactivado"
  ],
  "nl": [
    "Weduwen en wezen voorkomen",
    "Bij volgende houden",
    "Regels bijeenhouden",
    "Pagina-einde ervoor",
    "Overnemen",
    "Aan",
    "Uit"
  ],
  "pl": [
    "Kontrola wdów i sierot",
    "Razem z następnym",
    "Zachowaj wiersze razem",
    "Podział strony przed",
    "Dziedzicz",
    "Włącz",
    "Wyłącz"
  ]
};
const paragraphLabels = (locale: SupportedLocale) => PARAGRAPH_LABELS[locale] ?? PARAGRAPH_LABELS.en!;
export function paragraphFormattingLabel(locale: SupportedLocale): string { return paragraphLabels(locale)[0]!; }

function selectedParagraphValue(editor: Editor, name: string): { value: string; mixed: boolean } {
  const { from, to, empty } = editor.state.selection;
  if (empty) return { value: String(editor.getAttributes('paragraph')[name] ?? ''), mixed: false };
  const values = new Set<string>();
  editor.state.doc.nodesBetween(from, to, node => { if (node.type.name === 'paragraph') values.add(String(node.attrs[name] ?? '')); });
  return { value: values.size === 1 ? [...values][0]! : '', mixed: values.size > 1 };
}
export function ParagraphFormattingPanel({ editor, locale }: { editor: Editor; locale: SupportedLocale }) {
  const l = paragraphLabels(locale);
  const pagination = PAGINATION_LABELS[locale] ?? PAGINATION_LABELS.en!;
  const copy = getRichTextCopy(locale);
  const common = { editor, copy, reset: labels(locale)[19]!, mixed: labels(locale)[20]!, paragraph: true };
  const align = selectedParagraphValue(editor, 'omiAlign');
  const field = (name: ParagraphFormat, index: number, fallback = '0') => <FormatField key={name} {...common}
    name={name} label={l[index]!} icon={<Pilcrow size={15} aria-hidden="true" />} kind="number" defaultValue={fallback} normalize={value => normalizeParagraphValue(name, value)} />;
  const command = (label: string, icon: ReactNode, run: () => void, active = false, disabled = false) =>
    <button key={label} type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled}
      className={active ? 'is-active' : ''} onMouseDown={e => e.preventDefault()} onClick={run}>{icon}</button>;
  return <div className="omi-rich-text-popover omi-direct-formatting" aria-label={l[0]}>
    <div className="omi-rich-text-command-grid">
      {(['left', 'center', 'right', 'justify'] as const).map((value, i) => command(l[i + 1]!, [<AlignLeft size={17} />, <AlignCenter size={17} />, <AlignRight size={17} />, <AlignJustify size={17} />][i],
        () => editor.chain().focus().updateAttributes('paragraph', { omiAlign: value }).run(), align.value === value))}
      {command(copy.bulletList, <List size={17} />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {command(copy.orderedList, <ListOrdered size={17} />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {command(l[15]!, <IndentIncrease size={17} />, () => editor.chain().focus().sinkListItem('listItem').run(), false, !editor.can().sinkListItem('listItem'))}
      {command(l[16]!, <IndentDecrease size={17} />, () => editor.chain().focus().liftListItem('listItem').run(), false, !editor.can().liftListItem('listItem'))}
      {command(l[17]!, <RemoveFormatting size={17} />, () => editor.chain().focus().updateAttributes('paragraph', {
        omiAutoHyphenation:null, omiParagraphDirection:null, omiParagraphBackground:null, omiParagraphBorders:null, omiParagraphTabs:null, omiAlign: null, omiLeftIndent: null, omiRightIndent: null, omiFirstLineIndent: null, omiSpaceBefore: null, omiSpaceAfter: null, omiLineSpacing: null, omiLineRule: null, omiWidowControl: null, omiKeepNext: null, omiKeepLines: null, omiPageBreakBefore: null,
      }).run())}
    </div>
    <div className="omi-direct-format-fields">
      <FormatField {...common} name="omiParagraphDirection" label={directionLabels(locale)[0]!} icon={<Pilcrow size={15}/>} choices={directionChoices(locale)} normalize={value=>normalizeParagraphValue('omiParagraphDirection',value)}/>
      <label className="omi-direct-format-field"><span>{({en:'Automatic hyphenation',hu:'Automatikus elválasztás',de:'Automatische Silbentrennung',fr:'Césure automatique',it:'Sillabazione automatica',es:'División automática de palabras',nl:'Automatische woordafbreking',pl:'Automatyczne dzielenie wyrazów'} as Record<string,string>)[locale]??'Automatic hyphenation'}</span>
        <select value={selectedParagraphValue(editor,'omiAutoHyphenation').mixed?'mixed':selectedParagraphValue(editor,'omiAutoHyphenation').value} onChange={e=>editor.chain().focus().updateAttributes('paragraph',{omiAutoHyphenation:e.target.value===''?null:e.target.value==='true'}).run()}>
          {selectedParagraphValue(editor,'omiAutoHyphenation').mixed&&<option value="mixed" disabled>{labels(locale)[20]}</option>}
          <option value="">{pagination[4]}</option><option value="true">{pagination[5]}</option><option value="false">{pagination[6]}</option>
        </select>
      </label>
      {field('omiLeftIndent', 5)}
      {field('omiRightIndent', 6)}
      {field('omiFirstLineIndent', 7)}
      {field('omiSpaceBefore', 8)}
      {field('omiSpaceAfter', 9)}
      <FormatField {...common} name="omiLineRule" label={l[11]!} icon={<Pilcrow size={15} aria-hidden="true" />} defaultValue="auto"
        choices={['auto', 'exact', 'atLeast'].map((value, i) => ({ value, label: l[12 + i]! }))}
        normalize={value => normalizeParagraphValue('omiLineRule', value)} />
      {field('omiLineSpacing', 10, '1.5')}
      <ListNumberingControls editor={editor} locale={locale}/>
      <SourceStyleControls editor={editor} locale={locale} kind="paragraph"/>
      <ParagraphDecorationControls editor={editor} locale={locale}/>
      {(['omiWidowControl','omiKeepNext','omiKeepLines','omiPageBreakBefore'] as const).map((name, index) => {
        const selected = selectedParagraphValue(editor, name);
        return <label key={name} className="omi-direct-format-field">
          <span>{pagination[index]}</span>
          <select aria-label={pagination[index]} value={selected.mixed ? 'mixed' : selected.value}
            onChange={event => editor.chain().focus().updateAttributes('paragraph', { [name]: event.target.value === '' ? null : event.target.value === 'true' }).run()}>
            {selected.mixed && <option value="mixed" disabled>{labels(locale)[20]}</option>}
            <option value="">{pagination[4]}</option><option value="true">{pagination[5]}</option><option value="false">{pagination[6]}</option>
          </select>
        </label>;
      })}
    </div>
  </div>;
}

const DECORATION_LABELS: Record<string, Labels> = {
  "en": [
    "Paragraph background",
    "Borders",
    "Tab stops",
    "Top",
    "Left",
    "Bottom",
    "Right",
    "Style",
    "Width (pt)",
    "Color",
    "Distance (pt)",
    "Position (pt)",
    "Alignment",
    "Leader",
    "Add",
    "Remove",
    "Single",
    "Double",
    "Dotted",
    "Dashed",
    "None",
    "Left",
    "Center",
    "Right",
    "Decimal",
    "Clear",
    "Dots",
    "Hyphens",
    "Underscore",
    "Middle dots",
    "Heavy"
  ],
  "hu": [
    "Bekezdésháttér",
    "Szegélyek",
    "Tabulátorok",
    "Felső",
    "Bal",
    "Alsó",
    "Jobb",
    "Típus",
    "Vastagság (pt)",
    "Szín",
    "Távolság (pt)",
    "Pozíció (pt)",
    "Igazítás",
    "Kitöltőkarakter",
    "Hozzáadás",
    "Eltávolítás",
    "Egyszeres",
    "Dupla",
    "Pontozott",
    "Szaggatott",
    "Nincs",
    "Balra",
    "Középre",
    "Jobbra",
    "Tizedes",
    "Törlés",
    "Pontok",
    "Kötőjelek",
    "Aláhúzás",
    "Középpontok",
    "Vastag"
  ],
  "de": [
    "Absatzhintergrund",
    "Rahmen",
    "Tabstopps",
    "Oben",
    "Links",
    "Unten",
    "Rechts",
    "Stil",
    "Breite (pt)",
    "Farbe",
    "Abstand (pt)",
    "Position (pt)",
    "Ausrichtung",
    "Füllzeichen",
    "Hinzufügen",
    "Entfernen",
    "Einfach",
    "Doppelt",
    "Gepunktet",
    "Gestrichelt",
    "Keine",
    "Links",
    "Zentriert",
    "Rechts",
    "Dezimal",
    "Löschen",
    "Punkte",
    "Bindestriche",
    "Unterstrich",
    "Mittelpunkte",
    "Dick"
  ],
  "fr": [
    "Arrière-plan du paragraphe",
    "Bordures",
    "Tabulations",
    "Haut",
    "Gauche",
    "Bas",
    "Droite",
    "Style",
    "Épaisseur (pt)",
    "Couleur",
    "Distance (pt)",
    "Position (pt)",
    "Alignement",
    "Caractère de suite",
    "Ajouter",
    "Supprimer",
    "Simple",
    "Double",
    "Pointillé",
    "Tirets",
    "Aucun",
    "Gauche",
    "Centre",
    "Droite",
    "Décimal",
    "Effacer",
    "Points",
    "Tirets",
    "Souligné",
    "Points médians",
    "Épais"
  ],
  "it": [
    "Sfondo paragrafo",
    "Bordi",
    "Tabulazioni",
    "Alto",
    "Sinistra",
    "Basso",
    "Destra",
    "Stile",
    "Spessore (pt)",
    "Colore",
    "Distanza (pt)",
    "Posizione (pt)",
    "Allineamento",
    "Riempimento",
    "Aggiungi",
    "Rimuovi",
    "Singolo",
    "Doppio",
    "Punteggiato",
    "Tratteggiato",
    "Nessuno",
    "Sinistra",
    "Centro",
    "Destra",
    "Decimale",
    "Cancella",
    "Punti",
    "Trattini",
    "Sottolineato",
    "Punti medi",
    "Spesso"
  ],
  "es": [
    "Fondo de párrafo",
    "Bordes",
    "Tabulaciones",
    "Superior",
    "Izquierdo",
    "Inferior",
    "Derecho",
    "Estilo",
    "Grosor (pt)",
    "Color",
    "Distancia (pt)",
    "Posición (pt)",
    "Alineación",
    "Relleno",
    "Añadir",
    "Eliminar",
    "Sencillo",
    "Doble",
    "Punteado",
    "Discontinuo",
    "Ninguno",
    "Izquierda",
    "Centro",
    "Derecha",
    "Decimal",
    "Borrar",
    "Puntos",
    "Guiones",
    "Subrayado",
    "Puntos medios",
    "Grueso"
  ],
  "nl": [
    "Alinea-achtergrond",
    "Randen",
    "Tabstops",
    "Boven",
    "Links",
    "Onder",
    "Rechts",
    "Stijl",
    "Dikte (pt)",
    "Kleur",
    "Afstand (pt)",
    "Positie (pt)",
    "Uitlijning",
    "Opvulteken",
    "Toevoegen",
    "Verwijderen",
    "Enkel",
    "Dubbel",
    "Gestippeld",
    "Gestreept",
    "Geen",
    "Links",
    "Midden",
    "Rechts",
    "Decimaal",
    "Wissen",
    "Punten",
    "Streepjes",
    "Onderstreping",
    "Middenpunten",
    "Dik"
  ],
  "pl": [
    "Tło akapitu",
    "Obramowanie",
    "Tabulatory",
    "Góra",
    "Lewo",
    "Dół",
    "Prawo",
    "Styl",
    "Grubość (pt)",
    "Kolor",
    "Odstęp (pt)",
    "Pozycja (pt)",
    "Wyrównanie",
    "Znak wiodący",
    "Dodaj",
    "Usuń",
    "Pojedynczy",
    "Podwójny",
    "Kropkowany",
    "Kreskowany",
    "Brak",
    "Lewo",
    "Środek",
    "Prawo",
    "Dziesiętny",
    "Wyczyść",
    "Kropki",
    "Kreski",
    "Podkreślenie",
    "Punkty środkowe",
    "Gruby"
  ]
};

function ParagraphDecorationControls({editor,locale}: {editor:Editor;locale:SupportedLocale}) {
  const l=DECORATION_LABELS[locale] ?? DECORATION_LABELS.en!;
  const copy=getRichTextCopy(locale);
  const [open,setOpen]=useState<'borders'|'tabs'|null>(null);
  const current=editor.getAttributes('paragraph');
  const borders=paragraphBorders(current), tabs=paragraphTabs(current);
  const [side,setSide]=useState<(typeof BORDER_SIDES)[number]>('bottom');
  const [borderDraft,setBorderDraft]=useState<ParagraphBorder>({style:'single',width:1,color:'#000000',space:4});
  const [tabDraft,setTabDraft]=useState<ParagraphTab>({position:72,alignment:'left',leader:'none'});
  const border=borders[side] ?? borderDraft;
  const set=(name:ParagraphFormat,value:unknown)=>{
    const normalized=value===null?null:normalizeParagraphValue(name,value);
    if(normalized!==undefined) editor.chain().focus().updateAttributes('paragraph',{[name]:normalized}).run();
  };
  const patchBorder=(patch:Partial<ParagraphBorder>)=>{
    const next={...border,...patch};setBorderDraft(next);set('omiParagraphBorders',{...borders,[side]:next});
  };
  const button=(label:string,icon:ReactNode,run:()=>void,active=false)=><button type="button" aria-label={label} title={label} aria-pressed={active} onMouseDown={e=>e.preventDefault()} onClick={run}>{icon}</button>;
  const options=(values:string[],names:number[])=>values.map((v,i)=><option key={v} value={v}>{l[names[i]!]}</option>);
  return <>
    <FormatField editor={editor} paragraph name="omiParagraphBackground" label={l[0]!} icon={<PaintBucket size={16}/>} copy={copy} reset={labels(locale)[19]!} mixed={labels(locale)[20]!} kind="color" defaultValue="#ffffff" normalize={v=>normalizeParagraphValue('omiParagraphBackground',v)}/>
    <div className="omi-rich-text-command-grid">
      {button(l[1]!,<Square size={17}/>,()=>setOpen(open==='borders'?null:'borders'),open==='borders')}
      {button(l[2]!,<ArrowRightToLine size={17}/>,()=>setOpen(open==='tabs'?null:'tabs'),open==='tabs')}
    </div>
    {open==='borders' && <div className="omi-direct-format-fields">
      <label>{l[1]}<select aria-label={l[1]} value={side} onChange={e=>setSide(e.target.value as typeof side)}>{options([...BORDER_SIDES],[3,4,5,6])}</select></label>
      <label>{l[7]}<select aria-label={l[7]} value={border.style} onChange={e=>patchBorder({style:e.target.value})}>{options(['single','double','dotted','dashed','nil'],[16,17,18,19,20])}</select></label>
      <label>{l[8]}<input type="number" min=".125" max="12" step=".125" value={border.width} onChange={e=>patchBorder({width:Number(e.target.value)})}/></label>
      <label>{l[9]}<input type="color" value={border.color} onChange={e=>patchBorder({color:e.target.value})}/></label>
      <label>{l[10]}<input type="number" min="0" max="31" value={border.space} onChange={e=>patchBorder({space:Number(e.target.value)})}/></label>
      {button(copy.apply+': '+l[1],<Plus size={16}/>,()=>set('omiParagraphBorders',{...borders,[side]:border}))}
      {button(l[15]+': '+l[1],<Trash2 size={16}/>,()=>{const next={...borders};delete next[side];set('omiParagraphBorders',Object.keys(next).length?next:null);})}
    </div>}
    {open==='tabs' && <div className="omi-direct-format-fields">
      <label>{l[11]}<input type="number" min="0" max="2000" step=".05" value={tabDraft.position} onChange={e=>setTabDraft({...tabDraft,position:Number(e.target.value)})}/></label>
      <label>{l[12]}<select aria-label={l[12]} value={tabDraft.alignment} onChange={e=>setTabDraft({...tabDraft,alignment:e.target.value})}>{options(['left','center','right','decimal','clear'],[21,22,23,24,25])}</select></label>
      <label>{l[13]}<select aria-label={l[13]} value={tabDraft.leader} onChange={e=>setTabDraft({...tabDraft,leader:e.target.value})}>{options(['none','dot','hyphen','underscore','middleDot','heavy'],[20,26,27,28,29,30])}</select></label>
      {button(l[14]+': '+l[2],<Plus size={16}/>,()=>set('omiParagraphTabs',[...tabs.filter(t=>t.position!==tabDraft.position),tabDraft]))}
      {tabs.map(t=><div key={t.position} className="omi-direct-format-field">
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setTabDraft(t)}>{t.position} pt · {l[21+['left','center','right','decimal','clear'].indexOf(t.alignment)]}</button>
        {button(l[15]+': '+t.position+' pt',<Trash2 size={15}/>,()=>set('omiParagraphTabs',tabs.length===1?null:tabs.filter(x=>x.position!==t.position)))}
      </div>)}
    </div>}
  </>;
}

const SOURCE_STYLE_LABELS:Record<string,Labels>={
  "en": [
    "Source paragraph style",
    "Source character style",
    "Based on",
    "Next style",
    "Detach source style"
  ],
  "hu": [
    "Forrás-bekezdésstílus",
    "Forrás-karakterstílus",
    "Alapstílus",
    "Következő stílus",
    "Forrásstílus leválasztása"
  ],
  "de": [
    "Quell-Absatzformat",
    "Quell-Zeichenformat",
    "Basiert auf",
    "Folgeformat",
    "Quellformat lösen"
  ],
  "fr": [
    "Style de paragraphe source",
    "Style de caractère source",
    "Basé sur",
    "Style suivant",
    "Dissocier le style source"
  ],
  "it": [
    "Stile paragrafo sorgente",
    "Stile carattere sorgente",
    "Basato su",
    "Stile successivo",
    "Scollega stile sorgente"
  ],
  "es": [
    "Estilo de párrafo de origen",
    "Estilo de carácter de origen",
    "Basado en",
    "Estilo siguiente",
    "Desvincular estilo de origen"
  ],
  "nl": [
    "Bronalineaopmaak",
    "Brontekenopmaak",
    "Gebaseerd op",
    "Volgende stijl",
    "Bronstijl loskoppelen"
  ],
  "pl": [
    "Źródłowy styl akapitu",
    "Źródłowy styl znaku",
    "Na podstawie",
    "Następny styl",
    "Odłącz styl źródłowy"
  ]
};

function SourceStyleControls({editor,locale,kind}:{editor:Editor;locale:SupportedLocale;kind:'paragraph'|'character'}) {
  const l=SOURCE_STYLE_LABELS[locale]??SOURCE_STYLE_LABELS.en!;
  const copy=getRichTextCopy(locale);
  const current=kind==='paragraph' ? selectedParagraphValue(editor,'omiWordParagraphStyle') : selectedValue(editor,'omiWordCharacterStyle','definition');
  const bundle=sourceStyleBundle(current.value);
  const selected=bundle?.styles.find(style=>style.id===bundle.selected);
  if(!selected||!bundle) return null;
  return <SourceStyleFields key={current.value} editor={editor} kind={kind} locale={locale} bundle={bundle} selected={selected.id} applyLabel={copy.apply} labels={l}/>;
}
function SourceStyleFields({editor,kind,locale,bundle,selected,applyLabel,labels:l}:{
  editor:Editor;kind:'paragraph'|'character';locale:SupportedLocale;bundle:NonNullable<ReturnType<typeof sourceStyleBundle>>;selected:string;applyLabel:string;labels:Labels;
}) {
  const style=bundle.styles.find(item=>item.id===selected)!;
  const [name,setName]=useState(style.name);
  const label=l[kind==='paragraph'?0:1]!;
  const definition=normalizeSourceStyle({...bundle,styles:bundle.styles.map(item=>item.id===selected?{...item,name}:item)});
  const apply=(value:string|null)=>{
    if(kind==='paragraph') editor.chain().focus().updateAttributes('paragraph',{omiWordParagraphStyle:value}).run();
    else applyMark(editor,'omiWordCharacterStyle',value===null?null:{definition:value});
  };
  return <div className="omi-direct-format-field" lang={locale}>
    <label><span>{label}</span><input aria-label={label} value={name} maxLength={160} onChange={e=>setName(e.target.value)}/></label>
    {style.basedOn && <small>{l[2]}: {bundle.styles.find(item=>item.id===style.basedOn)?.name??style.basedOn}</small>}
    {style.next && <small>{l[3]}: {bundle.styles.find(item=>item.id===style.next)?.name??style.next}</small>}
    <button type="button" title={applyLabel} aria-label={applyLabel+': '+label} disabled={!definition||name===style.name} onMouseDown={e=>e.preventDefault()} onClick={()=>{if(definition)apply(definition);}}>✓</button>
    <button type="button" title={l[4]} aria-label={l[4]} onMouseDown={e=>e.preventDefault()} onClick={()=>apply(null)}><Unlink size={16} aria-hidden="true"/></button>
  </div>;
}

const NUMBERING_LABELS: Record<string, Labels> = {
  "en": [
    "List numbering",
    "Number format",
    "Start at",
    "Number label (%1–%9)",
    "Restart sequence",
    "Decimal",
    "Roman (I, II)",
    "Roman (i, ii)",
    "Letters (A, B)",
    "Letters (a, b)",
    "Leading zero"
  ],
  "hu": [
    "Listaszámozás",
    "Számozás formátuma",
    "Kezdőérték",
    "Számozási minta (%1–%9)",
    "Számozás újraindítása",
    "Arab számok",
    "Római (I, II)",
    "Római (i, ii)",
    "Betűk (A, B)",
    "Betűk (a, b)",
    "Vezető nulla"
  ],
  "de": [
    "Listennummerierung",
    "Zahlenformat",
    "Beginnen bei",
    "Nummernmuster (%1–%9)",
    "Nummerierung neu starten",
    "Dezimal",
    "Römisch (I, II)",
    "Römisch (i, ii)",
    "Buchstaben (A, B)",
    "Buchstaben (a, b)",
    "Führende Null"
  ],
  "fr": [
    "Numérotation de liste",
    "Format de numéro",
    "Commencer à",
    "Motif (%1–%9)",
    "Recommencer la numérotation",
    "Décimal",
    "Romain (I, II)",
    "Romain (i, ii)",
    "Lettres (A, B)",
    "Lettres (a, b)",
    "Zéro initial"
  ],
  "it": [
    "Numerazione elenco",
    "Formato numerico",
    "Inizia da",
    "Modello (%1–%9)",
    "Riavvia numerazione",
    "Decimale",
    "Romano (I, II)",
    "Romano (i, ii)",
    "Lettere (A, B)",
    "Lettere (a, b)",
    "Zero iniziale"
  ],
  "es": [
    "Numeración de lista",
    "Formato numérico",
    "Empezar en",
    "Patrón (%1–%9)",
    "Reiniciar numeración",
    "Decimal",
    "Romano (I, II)",
    "Romano (i, ii)",
    "Letras (A, B)",
    "Letras (a, b)",
    "Cero inicial"
  ],
  "nl": [
    "Lijstnummering",
    "Getalnotatie",
    "Begin bij",
    "Nummerpatroon (%1–%9)",
    "Nummering opnieuw beginnen",
    "Decimaal",
    "Romeins (I, II)",
    "Romeins (i, ii)",
    "Letters (A, B)",
    "Letters (a, b)",
    "Voorloopnul"
  ],
  "pl": [
    "Numeracja listy",
    "Format numeru",
    "Zacznij od",
    "Wzór (%1–%9)",
    "Rozpocznij numerację ponownie",
    "Dziesiętny",
    "Rzymski (I, II)",
    "Rzymski (i, ii)",
    "Litery (A, B)",
    "Litery (a, b)",
    "Zero wiodące"
  ]
};

function ListNumberingControls({editor,locale}: {editor:Editor;locale:SupportedLocale}) {
  const l = NUMBERING_LABELS[locale] ?? NUMBERING_LABELS.en!;
  const [open,setOpen] = useState(false);
  const from = editor.state.selection.$from;
  let depth = from.depth;
  while (depth > 0 && !['orderedList','bulletList'].includes(from.node(depth).type.name)) depth--;
  const node = depth > 0 ? from.node(depth) : undefined;
  const position = depth > 0 ? from.before(depth) : -1;
  const enabled = node?.type.name === 'orderedList';
  const attrs = node?.attrs ?? {};
  const level = normalizeListAttribute('omiListLevel',attrs.omiListLevel) ?? 0;
  return <div>
    <button type="button" aria-label={l[0]} title={l[0]} aria-pressed={open && enabled} disabled={!enabled}
      onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(value=>!value)}><ListOrdered size={17} aria-hidden="true"/></button>
    {open && enabled && <NumberingFields key={JSON.stringify([position,attrs.omiListFormat,attrs.omiListLabel,attrs.start,attrs.omiListId])}
      editor={editor} locale={locale} position={position} attrs={attrs} level={Number(level)}/>}
  </div>;
}
function NumberingFields({editor,locale,position,attrs,level}: {editor:Editor;locale:SupportedLocale;position:number;attrs:Record<string,unknown>;level:number}) {
  const l = NUMBERING_LABELS[locale] ?? NUMBERING_LABELS.en!;
  const copy = getRichTextCopy(locale);
  const [format,setFormat] = useState(String(attrs.omiListFormat ?? 'decimal'));
  const [start,setStart] = useState(String(attrs.start ?? attrs.omiListStart ?? 1));
  const [label,setLabel] = useState(String(attrs.omiListLabel ?? '%'+(level+1)+'.'));
  const formats = ['decimal','upperRoman','lowerRoman','upperLetter','lowerLetter','decimalZero'];
  const n = normalizeListAttribute('omiListStart',start);
  const valid = typeof n === 'number' && normalizeListAttribute('omiListFormat',format) !== undefined && normalizeListAttribute('omiListLabel',label) !== undefined;
  const apply = (restart:boolean) => {
    if(!valid || typeof n !== 'number') return;
    editor.chain().focus().command(({tr,dispatch})=>{
      const node = tr.doc.nodeAt(position);
      if(node?.type.name !== 'orderedList') return false;
      const changedStart = n !== (node.attrs.start ?? node.attrs.omiListStart ?? 1);
      if(dispatch) tr.setNodeMarkup(position,undefined,{...node.attrs,omiListFormat:format,omiListLabel:label,start:n,omiListStart:n,
        ...(restart || changedStart ? {omiListId:crypto.randomUUID(),omiListOverrideStart:n} : {})});
      return true;
    }).run();
  };
  return <div className="omi-direct-format-fields">
    <label>{l[1]}<select aria-label={l[1]} value={format} onChange={e=>setFormat(e.target.value)}>
      {!formats.includes(format) && <option value={format}>{format}</option>}
      {formats.map((value,i)=><option key={value} value={value}>{l[i+5]}</option>)}
    </select></label>
    <label>{l[2]}<input aria-label={l[2]} type="number" min="1" max="999999" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>{l[3]}<input aria-label={l[3]} maxLength={128} value={label} onChange={e=>setLabel(e.target.value)}/></label>
    <button type="button" disabled={!valid} aria-label={copy.apply+': '+l[0]} title={copy.apply} onMouseDown={e=>e.preventDefault()} onClick={()=>apply(false)}>✓</button>
    <button type="button" disabled={!valid} aria-label={l[4]} title={l[4]} onMouseDown={e=>e.preventDefault()} onClick={()=>apply(true)}><RotateCcw size={16} aria-hidden="true"/></button>
  </div>;
}
