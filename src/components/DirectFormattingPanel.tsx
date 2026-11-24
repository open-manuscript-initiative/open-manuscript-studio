import type { Editor } from '@tiptap/core';
import { Baseline, CaseUpper, Highlighter, LetterText, Palette, RemoveFormatting, Strikethrough, Type, Underline } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DIRECT_FORMATS, normalizeDirectValue, normalizeUnderlineStyle, type DirectFormat } from '../model/directFormatting';
import { getRichTextCopy } from '../i18n/richText';
import type { SupportedLocale } from '../i18n/types';

type Labels = readonly string[];
const LABELS: Record<string, Labels> = {
  en: ['Character formatting','Font family','Font size (pt)','Text color','Character background','Highlight','Letter spacing (pt)','Baseline shift (pt)','Underline style','Single','Double','Dotted','Wavy','Uppercase','Double strike','Outline','Shadow','Character width (%)','Kerning threshold (pt)','Reset','Mixed formatting'],
  hu: ['Karakterformázás','Betűcsalád','Betűméret (pt)','Betűszín','Karakterháttér','Kiemelés','Betűköz (pt)','Alapvonal-eltolás (pt)','Aláhúzás típusa','Egyszeres','Dupla','Pontozott','Hullámos','Nagybetűs','Dupla áthúzás','Körvonal','Árnyék','Betűszélesség (%)','Alávágási küszöb (pt)','Alaphelyzet','Vegyes formázás'],
  de: ['Zeichenformatierung','Schriftfamilie','Schriftgröße (pt)','Schriftfarbe','Zeichenhintergrund','Hervorhebung','Laufweite (pt)','Grundlinienversatz (pt)','Unterstreichungsart','Einfach','Doppelt','Gepunktet','Wellig','Versalien','Doppelt durchgestrichen','Kontur','Schatten','Zeichenbreite (%)','Kerning-Schwelle (pt)','Zurücksetzen','Gemischte Formatierung'],
  fr: ['Mise en forme des caractères','Police','Taille (pt)','Couleur du texte','Arrière-plan','Surlignage','Interlettrage (pt)','Décalage vertical (pt)','Type de soulignement','Simple','Double','Pointillé','Ondulé','Majuscules','Double barré','Contour','Ombre','Largeur (%)','Seuil de crénage (pt)','Réinitialiser','Formats mixtes'],
  it: ['Formattazione caratteri','Famiglia di caratteri','Dimensione (pt)','Colore del testo','Sfondo','Evidenziazione','Spaziatura (pt)','Spostamento verticale (pt)','Tipo di sottolineatura','Singola','Doppia','Punteggiata','Ondulata','Maiuscolo','Doppio barrato','Contorno','Ombra','Larghezza (%)','Soglia crenatura (pt)','Ripristina','Formati misti'],
  es: ['Formato de caracteres','Familia tipográfica','Tamaño (pt)','Color del texto','Fondo','Resaltado','Espaciado (pt)','Desplazamiento vertical (pt)','Tipo de subrayado','Simple','Doble','Punteado','Ondulado','Mayúsculas','Doble tachado','Contorno','Sombra','Ancho (%)','Umbral de interletraje (pt)','Restablecer','Formato mixto'],
  nl: ['Tekenopmaak','Lettertype','Tekengrootte (pt)','Tekstkleur','Achtergrond','Markering','Letterafstand (pt)','Basislijnverschuiving (pt)','Onderstrepingstype','Enkel','Dubbel','Gestippeld','Golvend','Hoofdletters','Dubbel doorhalen','Omtrek','Schaduw','Tekenbreedte (%)','Kerningdrempel (pt)','Herstellen','Gemengde opmaak'],
  pl: ['Formatowanie znaków','Krój pisma','Rozmiar (pt)','Kolor tekstu','Tło znaków','Wyróżnienie','Odstępy (pt)','Przesunięcie pionowe (pt)','Rodzaj podkreślenia','Pojedyncze','Podwójne','Kropkowane','Faliste','Wielkie litery','Podwójne przekreślenie','Kontur','Cień','Szerokość (%)','Próg kerningu (pt)','Resetuj','Formatowanie mieszane'],
};
const labels = (locale: SupportedLocale) => LABELS[locale] ?? LABELS.en!;
export function directFormattingLabel(locale: SupportedLocale): string { return labels(locale)[0]!; }
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
function applyMark(editor: Editor, name: string, attrs: Record<string, unknown> | null): void {
  const chain = editor.chain().focus();
  if (editor.state.selection.empty && editor.isActive(name)) chain.extendMarkRange(name);
  if (attrs) chain.setMark(name, attrs).run();
  else chain.unsetMark(name).run();
}

function FormatField({ editor, name, attribute = 'value', label, icon, copy, reset, mixed, kind = 'text', choices, defaultValue, normalize }: {
  editor: Editor; name: string; attribute?: string; label: string; icon: ReactNode;
  copy: ReturnType<typeof getRichTextCopy>; reset: string; mixed: string;
  kind?: 'text' | 'number' | 'color'; choices?: { value: string; label: string }[];
  defaultValue?: string; normalize: (value: string) => unknown;
}) {
  const current = selectedValue(editor, name, attribute);
  const [draft, setDraft] = useState(current.value || defaultValue || '');
  const [editing, setEditing] = useState(false);
  const value = editing ? draft : current.value || defaultValue || '';
  const normalized = normalize(value);
  const apply = () => {
    if (normalized === undefined || normalized === null) return;
    applyMark(editor, name, { [attribute]: normalized });
    setEditing(false);
  };
  const update = (next: string) => { setDraft(next); setEditing(true); };
  return <div className="omi-direct-format-field">
    <label title={current.mixed ? mixed : label}>
      {icon}<span>{label}</span>
      {choices ? <select aria-label={label} value={value} onChange={event => update(event.target.value)}>
        {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select> : <input aria-label={label} type={kind} step={kind === 'number' ? '0.5' : undefined}
        placeholder={current.mixed ? mixed : undefined} value={value}
        onChange={event => update(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); apply(); } }} />}
    </label>
    <button type="button" aria-label={copy.apply + ': ' + label} title={copy.apply} disabled={normalized === undefined || normalized === null} onMouseDown={e => e.preventDefault()} onClick={apply}>✓</button>
    <button type="button" aria-label={reset + ': ' + label} title={reset} onMouseDown={e => e.preventDefault()} onClick={() => { applyMark(editor, name, null); setEditing(false); }}><RemoveFormatting size={15} aria-hidden="true" /></button>
  </div>;
}
export function DirectFormattingPanel({ editor, locale }: { editor: Editor; locale: SupportedLocale }) {
  const l = labels(locale);
  const copy = getRichTextCopy(locale);
  const common = { editor, copy, reset: l[19]!, mixed: l[20]! };
  const field = (name: DirectFormat, index: number, icon: ReactNode, kind: 'number' | 'color' = 'number', defaultValue = '') =>
    <FormatField key={name} {...common} name={name} label={l[index]!} icon={icon} kind={kind} defaultValue={defaultValue} normalize={v => normalizeDirectValue(name, v)} />;
  const toggle = (name: DirectFormat, index: number, icon: ReactNode) => {
    const state = selectedValue(editor, name, 'value');
    const active = editor.isActive(name);
    return <button type="button" key={name} title={l[index]} aria-label={l[index]} aria-pressed={state.mixed ? 'mixed' : active} className={active ? 'is-active' : ''} onMouseDown={e => e.preventDefault()} onClick={() => applyMark(editor, name, active ? null : { value: true })}>{icon}</button>;
  };
  return <div className="omi-rich-text-popover omi-direct-formatting" aria-label={l[0]}>
    <div className="omi-rich-text-command-grid">
      {toggle('omiUppercase', 13, <CaseUpper size={17} aria-hidden="true" />)}
      {toggle('omiDoubleStrike', 14, <span aria-hidden="true" style={{ textDecoration: 'line-through double' }}>S</span>)}
      {toggle('omiOutline', 15, <span aria-hidden="true" style={{ WebkitTextStroke: '0.7px currentColor', color: 'transparent' }}>A</span>)}
      {toggle('omiShadow', 16, <span aria-hidden="true" style={{ textShadow: '1px 1px 1px #888' }}>A</span>)}
    </div>
    <div className="omi-direct-format-fields">
      <FormatField {...common} name="omiSourceFont" attribute="family" label={l[1]!} icon={<Type size={16} aria-hidden="true" />}
        normalize={v => { const value = v.trim(); return value && value.length <= 128 && Array.from(value).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127) ? value : undefined; }} />
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
    </div>
  </div>;
}
