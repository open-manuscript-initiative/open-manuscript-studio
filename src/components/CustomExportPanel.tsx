import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { CITATION_STYLE_CATALOG } from '../model/cslRendering';
import {
  CUSTOM_CITATION_CONTENT_TOKENS,
  CUSTOM_RUNNING_CONTENT_TOKENS,
  customExportLanguages,
  defaultCustomCitationStyle,
  defaultCustomExportTemplate,
  defaultCustomPageLayout,
  normalizeCustomExportTemplate,
  type CustomExportBlock,
  type CustomExportBlockKind,
  type CustomExportCitationOccurrenceRule,
  type CustomExportNoteMode,
  type CustomExportOutput,
  type CustomExportRunningContent,
  type CustomExportTemplate,
  type CustomExportTypography,
} from '../model/customExport';
import { saveExportBlob } from '../services/exportFileDelivery';
import {
  buildCustomDocxExport,
  buildCustomHtmlExport,
  openCustomPdfPrintView,
} from '../services/exportCustom';
import { useTranslation } from '../i18n';

const STORAGE_KEY = 'omi.custom-export.templates.v1';
const FONT_OPTIONS = ['Times New Roman', 'Arial', 'Calibri', 'Garamond', 'Georgia', 'Cambria', 'Palatino Linotype', 'Courier New'];

const LABELS: Record<string, Record<string, string>> = {
  hu: {
    title: 'Egyéni export', description: 'Állítsd össze a kimenetet rendezhető, opcionális blokkokból.', output: 'Kimenet', template: 'Sablon', saveTemplate: 'Sablon mentése', templateName: 'Sablon neve', export: 'Exportálás', enabled: 'Bekapcsolva', font: 'Betűtípus', size: 'Méret', bold: 'Félkövér', italic: 'Dőlt', align: 'Igazítás', spacing: 'Térköz utána', lineHeight: 'Sorköz', language: 'Nyelv', noteMode: 'Jegyzettípus', bibliographyStyle: 'Bibliográfia stílusa', moveUp: 'Fel', moveDown: 'Le', remove: 'Eltávolítás', addAbstract: 'Absztrakt hozzáadása', addKeywords: 'Kulcsszavak hozzáadása', saved: 'Sablon mentve.', failed: 'Az export nem sikerült.', titleBlock: 'Cím', subtitleBlock: 'Alcím', mottoBlock: 'Mottó', authorBlock: 'Szerző', affiliationBlock: 'Affiliáció', abstractBlock: 'Absztrakt', keywordsBlock: 'Kulcsszavak', bodyBlock: 'Szövegtörzs', notesBlock: 'Jegyzetek', bibliographyBlock: 'Bibliográfia', citationStyle: 'Hivatkozások stílusa', citationStyleDescription: 'Az első és a további előfordulások tartalma és tipográfiája külön szabályozható.', customCitationStyle: 'Egyéni előfordulási szabályok használata', firstOccurrence: 'Első előfordulás', subsequentOccurrence: 'További előfordulások', content: 'Tartalom', tokens: 'Használható mezők', pageLayout: 'Fejléc, lábléc és oldalszám', pageLayoutDescription: 'DOCX és PDF exporthoz külön bal és jobb fejléc/lábléc, valamint tetszőleges kezdőoldalú oldalszámozás.', header: 'Fejléc', footer: 'Lábléc', left: 'Bal oldali tartalom', right: 'Jobb oldali tartalom', pageNumbers: 'Oldalszámozás', area: 'Elhelyezés', pageNumberPosition: 'Pozíció', startOnPage: 'Megjelenés kezdőoldala', startAt: 'Kezdő oldalszám', headerArea: 'Fejléc', footerArea: 'Lábléc', leftPos: 'Bal', centerPos: 'Közép', rightPos: 'Jobb', runningTokens: 'Használható fejléc/lábléc mezők' },
  de: {
    title: 'Benutzerdefinierter Export', description: 'Ausgabe aus sortierbaren, optionalen Blöcken zusammenstellen.', output: 'Ausgabe', template: 'Vorlage', saveTemplate: 'Vorlage speichern', templateName: 'Vorlagenname', export: 'Exportieren', enabled: 'Aktiv', font: 'Schriftart', size: 'Größe', bold: 'Fett', italic: 'Kursiv', align: 'Ausrichtung', spacing: 'Abstand danach', lineHeight: 'Zeilenabstand', language: 'Sprache', noteMode: 'Anmerkungstyp', bibliographyStyle: 'Bibliografiestil', moveUp: 'Hoch', moveDown: 'Runter', remove: 'Entfernen', addAbstract: 'Zusammenfassung hinzufügen', addKeywords: 'Schlüsselwörter hinzufügen', saved: 'Vorlage gespeichert.', failed: 'Export fehlgeschlagen.', titleBlock: 'Titel', subtitleBlock: 'Untertitel', mottoBlock: 'Motto', authorBlock: 'Autor', affiliationBlock: 'Affiliation', abstractBlock: 'Zusammenfassung', keywordsBlock: 'Schlüsselwörter', bodyBlock: 'Textkörper', notesBlock: 'Anmerkungen', bibliographyBlock: 'Bibliografie', citationStyle: 'Zitationsstil', citationStyleDescription: 'Inhalt und Typografie der ersten und weiteren Nennungen können getrennt festgelegt werden.', customCitationStyle: 'Eigene Regeln für Erst- und Folgezitate verwenden', firstOccurrence: 'Erste Nennung', subsequentOccurrence: 'Weitere Nennungen', content: 'Inhalt', tokens: 'Verfügbare Felder', pageLayout: 'Kopfzeile, Fußzeile und Seitenzahl', pageLayoutDescription: 'Separate linke und rechte Kopf-/Fußzeilen sowie frei startende Seitenzahlen für DOCX und PDF.', header: 'Kopfzeile', footer: 'Fußzeile', left: 'Inhalt links', right: 'Inhalt rechts', pageNumbers: 'Seitennummerierung', area: 'Bereich', pageNumberPosition: 'Position', startOnPage: 'Anzeigen ab Seite', startAt: 'Startnummer', headerArea: 'Kopfzeile', footerArea: 'Fußzeile', leftPos: 'Links', centerPos: 'Mitte', rightPos: 'Rechts', runningTokens: 'Verfügbare Kopf-/Fußzeilenfelder' },
  en: {
    title: 'Custom export', description: 'Build the output from reorderable, optional blocks.', output: 'Output', template: 'Template', saveTemplate: 'Save template', templateName: 'Template name', export: 'Export', enabled: 'Enabled', font: 'Font', size: 'Size', bold: 'Bold', italic: 'Italic', align: 'Alignment', spacing: 'Space after', lineHeight: 'Line spacing', language: 'Language', noteMode: 'Note type', bibliographyStyle: 'Bibliography style', moveUp: 'Up', moveDown: 'Down', remove: 'Remove', addAbstract: 'Add abstract', addKeywords: 'Add keywords', saved: 'Template saved.', failed: 'Export failed.', titleBlock: 'Title', subtitleBlock: 'Subtitle', mottoBlock: 'Motto', authorBlock: 'Author', affiliationBlock: 'Affiliation', abstractBlock: 'Abstract', keywordsBlock: 'Keywords', bodyBlock: 'Body text', notesBlock: 'Notes', bibliographyBlock: 'Bibliography', citationStyle: 'Citation style', citationStyleDescription: 'Configure the content and typography of first and subsequent occurrences separately.', customCitationStyle: 'Use custom occurrence rules', firstOccurrence: 'First occurrence', subsequentOccurrence: 'Subsequent occurrences', content: 'Content', tokens: 'Available fields', pageLayout: 'Header, footer and page numbers', pageLayoutDescription: 'Separate left/right running headers and footers plus page numbering with an arbitrary starting page for DOCX and PDF.', header: 'Header', footer: 'Footer', left: 'Left content', right: 'Right content', pageNumbers: 'Page numbering', area: 'Area', pageNumberPosition: 'Position', startOnPage: 'Show from document page', startAt: 'First displayed number', headerArea: 'Header', footerArea: 'Footer', leftPos: 'Left', centerPos: 'Center', rightPos: 'Right', runningTokens: 'Available header/footer fields' },
};

export function CustomExportPanel() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const copy = LABELS[locale] ?? LABELS.en;
  const [template, setTemplate] = useState<CustomExportTemplate>(() => defaultCustomExportTemplate(manuscript));
  const [templates, setTemplates] = useState<CustomExportTemplate[]>(loadTemplates);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const languages = useMemo(() => customExportLanguages(manuscript), [manuscript]);
  const citationStyle = template.citationStyle ?? defaultCustomCitationStyle();
  const pageLayout = template.pageLayout ?? defaultCustomPageLayout();

  const updateBlock = (id: string, patch: Partial<CustomExportBlock>) => setTemplate((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) }));
  const updateCitationRule = (occurrence: 'first' | 'subsequent', patch: Partial<CustomExportCitationOccurrenceRule>) => setTemplate((current) => {
    const style = current.citationStyle ?? defaultCustomCitationStyle();
    return { ...current, citationStyle: { ...style, [occurrence]: { ...style[occurrence], ...patch } } };
  });
  const updateRunning = (area: 'header' | 'footer', patch: Partial<CustomExportRunningContent>) => setTemplate((current) => {
    const layout = current.pageLayout ?? defaultCustomPageLayout();
    return { ...current, pageLayout: { ...layout, [area]: { ...layout[area], ...patch } } };
  });
  const updatePageNumbering = (patch: Partial<typeof pageLayout.pageNumbering>) => setTemplate((current) => {
    const layout = current.pageLayout ?? defaultCustomPageLayout();
    return { ...current, pageLayout: { ...layout, pageNumbering: { ...layout.pageNumbering, ...patch } } };
  });

  const moveBlock = (id: string, delta: number) => setTemplate((current) => {
    const index = current.blocks.findIndex((block) => block.id === id); const target = index + delta;
    if (index < 0 || target < 0 || target >= current.blocks.length) return current;
    const blocks = [...current.blocks]; [blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
    return { ...current, blocks };
  });
  const removeBlock = (id: string) => setTemplate((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== id) }));
  const addLocalizedBlock = (kind: 'abstract' | 'keywords') => {
    const existing = new Set(template.blocks.filter((block) => block.kind === kind).map((block) => block.language));
    const language = languages.find((item) => !existing.has(item)) ?? languages[0] ?? manuscript.locale;
    const base = defaultCustomExportTemplate(manuscript).blocks.find((block) => block.kind === kind)!;
    setTemplate((current) => ({ ...current, blocks: [...current.blocks, { ...base, id: `${kind}-${language}-${Date.now()}`, language }] }));
  };
  const saveTemplate = () => {
    const normalized = normalizeCustomExportTemplate({ ...template, id: template.id === 'default' ? `template-${Date.now()}` : template.id });
    const next = [...templates.filter((item) => item.id !== normalized.id), normalized];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setTemplates(next); setTemplate(normalized); setNotice(copy.saved);
  };
  const runExport = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      useStudioStore.getState().checkpoint('export');
      const normalized = normalizeCustomExportTemplate(template);
      if (normalized.output === 'pdf') openCustomPdfPrintView(manuscript, normalized);
      else {
        const result = normalized.output === 'docx' ? buildCustomDocxExport(manuscript, normalized) : buildCustomHtmlExport(manuscript, normalized);
        await saveExportBlob(result.blob, result.fileName);
      }
    } catch (cause) { setError(cause instanceof Error && cause.message ? cause.message : copy.failed); }
    finally { setBusy(false); }
  };

  return <section className="studio-settings-card studio-custom-export" aria-busy={busy}>
    <div className="studio-settings-card-header"><div><h4>{copy.title}</h4><p>{copy.description}</p></div></div>
    <div className="studio-manuscript-fields">
      <label><span>{copy.output}</span><select value={template.output} onChange={(event) => setTemplate((current) => ({ ...current, output: event.target.value as CustomExportOutput }))}><option value="docx">DOCX</option><option value="pdf">PDF</option><option value="html">HTML</option></select></label>
      <label><span>{copy.templateName}</span><input value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} /></label>
      {templates.length ? <label><span>{copy.template}</span><select value="" onChange={(event) => { const selected = templates.find((item) => item.id === event.target.value); if (selected) setTemplate(normalizeCustomExportTemplate(selected)); }}><option value="">—</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
    </div>

    <div className="studio-custom-export-blocks">{template.blocks.map((block, index) => <div key={block.id} className="studio-settings-card studio-custom-export-block">
      <div className="studio-settings-card-header"><label><input type="checkbox" checked={block.enabled} onChange={(event) => updateBlock(block.id, { enabled: event.target.checked })} /> <strong>{blockLabel(copy, block.kind)}{block.language ? ` (${block.language})` : ''}</strong></label><div className="studio-tool-actions"><button type="button" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}>↑ {copy.moveUp}</button><button type="button" disabled={index === template.blocks.length - 1} onClick={() => moveBlock(block.id, 1)}>↓ {copy.moveDown}</button>{(block.kind === 'abstract' || block.kind === 'keywords') ? <button type="button" onClick={() => removeBlock(block.id)}>{copy.remove}</button> : null}</div></div>
      <div className="studio-manuscript-fields"><TypographyEditor typography={block.typography} copy={copy} onChange={(typography) => updateBlock(block.id, { typography })} />
        {(block.kind === 'abstract' || block.kind === 'keywords') ? <label><span>{copy.language}</span><select value={block.language ?? manuscript.locale} onChange={(event) => updateBlock(block.id, { language: event.target.value })}>{languages.map((language) => <option key={language} value={language}>{language}</option>)}</select></label> : null}
        {block.kind === 'notes' ? <label><span>{copy.noteMode}</span><select value={block.noteMode ?? 'all'} onChange={(event) => updateBlock(block.id, { noteMode: event.target.value as CustomExportNoteMode })}><option value="all">All</option><option value="footnote">Footnote</option><option value="endnote">Endnote</option><option value="author-note">Author note</option></select></label> : null}
        {block.kind === 'bibliography' ? <label><span>{copy.bibliographyStyle}</span><select value={block.bibliographyStyle ?? manuscript.citationStyle ?? 'apa-7'} onChange={(event) => updateBlock(block.id, { bibliographyStyle: event.target.value as CustomExportBlock['bibliographyStyle'] })}>{CITATION_STYLE_CATALOG.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label> : null}
      </div>
    </div>)}</div>

    <div className="studio-settings-card studio-custom-export-citations">
      <div className="studio-settings-card-header"><div><h4>{copy.citationStyle}</h4><p>{copy.citationStyleDescription}</p></div></div>
      <label><input type="checkbox" checked={citationStyle.enabled} onChange={(event) => setTemplate((current) => ({ ...current, citationStyle: { ...(current.citationStyle ?? defaultCustomCitationStyle()), enabled: event.target.checked } }))} /> {copy.customCitationStyle}</label>
      <p className="studio-settings-hint">{copy.tokens}: {CUSTOM_CITATION_CONTENT_TOKENS.join(' ')}</p>
      <div className="studio-custom-export-blocks"><CitationOccurrenceEditor label={copy.firstOccurrence} rule={citationStyle.first} copy={copy} disabled={!citationStyle.enabled} onChange={(patch) => updateCitationRule('first', patch)} /><CitationOccurrenceEditor label={copy.subsequentOccurrence} rule={citationStyle.subsequent} copy={copy} disabled={!citationStyle.enabled} onChange={(patch) => updateCitationRule('subsequent', patch)} /></div>
    </div>

    {template.output !== 'html' ? <div className="studio-settings-card studio-custom-export-page-layout">
      <div className="studio-settings-card-header"><div><h4>{copy.pageLayout}</h4><p>{copy.pageLayoutDescription}</p></div></div>
      <p className="studio-settings-hint">{copy.runningTokens}: {CUSTOM_RUNNING_CONTENT_TOKENS.join(' ')}</p>
      <div className="studio-custom-export-blocks">
        <RunningContentEditor label={copy.header} value={pageLayout.header} copy={copy} onChange={(patch) => updateRunning('header', patch)} />
        <RunningContentEditor label={copy.footer} value={pageLayout.footer} copy={copy} onChange={(patch) => updateRunning('footer', patch)} />
      </div>
      <div className="studio-settings-card studio-custom-export-block">
        <div className="studio-settings-card-header"><label><input type="checkbox" checked={pageLayout.pageNumbering.enabled} onChange={(event) => updatePageNumbering({ enabled: event.target.checked })} /> <strong>{copy.pageNumbers}</strong></label></div>
        <div className="studio-manuscript-fields">
          <label><span>{copy.area}</span><select disabled={!pageLayout.pageNumbering.enabled} value={pageLayout.pageNumbering.area} onChange={(event) => updatePageNumbering({ area: event.target.value as 'header' | 'footer' })}><option value="header">{copy.headerArea}</option><option value="footer">{copy.footerArea}</option></select></label>
          <label><span>{copy.pageNumberPosition}</span><select disabled={!pageLayout.pageNumbering.enabled} value={pageLayout.pageNumbering.alignment} onChange={(event) => updatePageNumbering({ alignment: event.target.value as 'left' | 'center' | 'right' })}><option value="left">{copy.leftPos}</option><option value="center">{copy.centerPos}</option><option value="right">{copy.rightPos}</option></select></label>
          <label><span>{copy.startOnPage}</span><input disabled={!pageLayout.pageNumbering.enabled} type="number" min="1" value={pageLayout.pageNumbering.startOnPage} onChange={(event) => updatePageNumbering({ startOnPage: Math.max(1, Number(event.target.value) || 1) })} /></label>
          <label><span>{copy.startAt}</span><input disabled={!pageLayout.pageNumbering.enabled} type="number" min="0" value={pageLayout.pageNumbering.startAt} onChange={(event) => updatePageNumbering({ startAt: Math.max(0, Number(event.target.value) || 0) })} /></label>
          <TypographyEditor typography={pageLayout.pageNumbering.typography} copy={copy} disabled={!pageLayout.pageNumbering.enabled} compact onChange={(typography) => updatePageNumbering({ typography })} />
        </div>
      </div>
    </div> : null}

    <div className="studio-tool-actions"><button type="button" onClick={() => addLocalizedBlock('abstract')}>{copy.addAbstract}</button><button type="button" onClick={() => addLocalizedBlock('keywords')}>{copy.addKeywords}</button><button type="button" onClick={saveTemplate}>{copy.saveTemplate}</button><button type="button" className="studio-menu-primary-action" disabled={busy} onClick={() => void runExport()}>{busy ? '…' : copy.export}</button></div>
    {notice ? <p className="studio-settings-hint" role="status">{notice}</p> : null}{error ? <div className="studio-export-error" role="alert">{error}</div> : null}
  </section>;
}

function TypographyEditor({ typography, copy, disabled = false, compact = false, onChange }: { typography: CustomExportTypography; copy: Record<string, string>; disabled?: boolean; compact?: boolean; onChange: (value: CustomExportTypography) => void }) {
  return <><label><span>{copy.font}</span><select disabled={disabled} value={typography.fontFamily} onChange={(event) => onChange({ ...typography, fontFamily: event.target.value })}>{FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}</select></label><label><span>{copy.size} (pt)</span><input disabled={disabled} type="number" min="6" max="72" step="0.5" value={typography.fontSizePt} onChange={(event) => onChange({ ...typography, fontSizePt: Number(event.target.value) || 10 })} /></label><label><span>{copy.bold}</span><input disabled={disabled} type="checkbox" checked={Boolean(typography.bold)} onChange={(event) => onChange({ ...typography, bold: event.target.checked })} /></label><label><span>{copy.italic}</span><input disabled={disabled} type="checkbox" checked={Boolean(typography.italic)} onChange={(event) => onChange({ ...typography, italic: event.target.checked })} /></label>{compact ? null : <><label><span>{copy.align}</span><select disabled={disabled} value={typography.alignment ?? 'left'} onChange={(event) => onChange({ ...typography, alignment: event.target.value as CustomExportTypography['alignment'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label><label><span>{copy.spacing} (pt)</span><input disabled={disabled} type="number" min="0" max="72" value={typography.spaceAfterPt ?? 0} onChange={(event) => onChange({ ...typography, spaceAfterPt: Number(event.target.value) || 0 })} /></label><label><span>{copy.lineHeight}</span><input disabled={disabled} type="number" min="0.8" max="3" step="0.05" value={typography.lineHeight ?? 1.15} onChange={(event) => onChange({ ...typography, lineHeight: Number(event.target.value) || 1.15 })} /></label></>}</>;
}

function CitationOccurrenceEditor({ label, rule, copy, disabled, onChange }: { label: string; rule: CustomExportCitationOccurrenceRule; copy: Record<string, string>; disabled: boolean; onChange: (patch: Partial<CustomExportCitationOccurrenceRule>) => void }) {
  return <div className="studio-settings-card studio-custom-export-block"><div className="studio-settings-card-header"><strong>{label}</strong></div><div className="studio-manuscript-fields"><label><span>{copy.content}</span><textarea rows={3} value={rule.content} disabled={disabled} onChange={(event) => onChange({ content: event.target.value })} /></label><TypographyEditor typography={rule.typography} copy={copy} disabled={disabled} compact onChange={(typography) => onChange({ typography })} /></div></div>;
}

function RunningContentEditor({ label, value, copy, onChange }: { label: string; value: CustomExportRunningContent; copy: Record<string, string>; onChange: (patch: Partial<CustomExportRunningContent>) => void }) {
  return <div className="studio-settings-card studio-custom-export-block"><div className="studio-settings-card-header"><label><input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /> <strong>{label}</strong></label></div><div className="studio-manuscript-fields"><label><span>{copy.left}</span><input disabled={!value.enabled} value={value.left} onChange={(event) => onChange({ left: event.target.value })} /></label><label><span>{copy.right}</span><input disabled={!value.enabled} value={value.right} onChange={(event) => onChange({ right: event.target.value })} /></label><TypographyEditor typography={value.typography} copy={copy} disabled={!value.enabled} compact onChange={(typography) => onChange({ typography })} /></div></div>;
}

function loadTemplates(): CustomExportTemplate[] { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); return Array.isArray(parsed) ? parsed.map((item) => normalizeCustomExportTemplate(item as CustomExportTemplate)) : []; } catch { return []; } }
function blockLabel(copy: Record<string, string>, kind: CustomExportBlockKind): string { return copy[`${kind}Block`] ?? kind; }
