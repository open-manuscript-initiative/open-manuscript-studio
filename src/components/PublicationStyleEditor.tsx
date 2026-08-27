import { Download, RotateCcw, Save } from 'lucide-react';
import { useMemo, useState } from 'react';

import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { useTranslation } from '../i18n';
import './PublicationStyleEditor.css';

type PublicationStyle = typeof templateJson;
type Align = 'left' | 'center' | 'right' | 'justify';

const STORAGE_KEY = 'omi:publication-style:egyhaztorteneti-szemle';

function cloneTemplate(): PublicationStyle {
  return JSON.parse(JSON.stringify(templateJson)) as PublicationStyle;
}

function loadStyle(): PublicationStyle {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as PublicationStyle) : cloneTemplate();
  } catch {
    return cloneTemplate();
  }
}

function copyFor(locale: string) {
  if (locale === 'hu') return {
    title: 'Kiadványstílus szerkesztő', description: 'Az export megjelenésének szerkeszthető beállításai élő előnézettel.',
    page: 'Lap', width: 'Szélesség', height: 'Magasság', margins: 'Margók', top: 'Felső', bottom: 'Alsó', inner: 'Belső', outer: 'Külső',
    typography: 'Tipográfia', font: 'Betűcsalád', bodySize: 'Törzsszöveg mérete', bodyLeading: 'Törzsszöveg sorköze', indent: 'Első sor behúzása',
    titleStyle: 'Cím', titleSize: 'Cím mérete', headingSize: 'Címsor mérete', footnoteSize: 'Lábjegyzet mérete', alignment: 'Igazítás',
    save: 'Mentés', saved: 'Mentve ezen az eszközön', reset: 'Sablon visszaállítása', export: 'Stílus exportálása', preview: 'Élő előnézet',
    sampleTitle: 'Hibrid köztisztviselők vagy szerzetes pap-tanárok?', sampleSubtitle: 'II. József tanári pályafutásról alkotott elképzelése', sampleAuthor: 'Balla János', sampleAffiliation: 'Nemzeti Közszolgálati Egyetem', sampleHeading: '1. Fejezetcím', sampleBody: 'Ez a bekezdés a kiválasztott kiadványstílus törzsszövegét, sorközét, margóit és behúzását szemlélteti. A végleges értékek bármikor pontosíthatók a nyomdai tördelés adatai alapján.', sampleFootnote: '1 Minta lábjegyzet az aktuális betűmérettel.'
  };
  if (locale === 'de') return {
    title: 'Publikationsstil-Editor', description: 'Bearbeitbare Exporteinstellungen mit Live-Vorschau.', page: 'Seite', width: 'Breite', height: 'Höhe', margins: 'Ränder', top: 'Oben', bottom: 'Unten', inner: 'Innen', outer: 'Außen', typography: 'Typografie', font: 'Schriftfamilie', bodySize: 'Grundschrift', bodyLeading: 'Zeilenabstand', indent: 'Erstzeileneinzug', titleStyle: 'Titel', titleSize: 'Titelgröße', headingSize: 'Überschriftgröße', footnoteSize: 'Fußnotengröße', alignment: 'Ausrichtung', save: 'Speichern', saved: 'Auf diesem Gerät gespeichert', reset: 'Vorlage zurücksetzen', export: 'Stil exportieren', preview: 'Live-Vorschau', sampleTitle: 'Hybrid Public Servants or Religious Teacher-Priests?', sampleSubtitle: 'Beispiel für einen Untertitel', sampleAuthor: 'Balla János', sampleAffiliation: 'Nemzeti Közszolgálati Egyetem', sampleHeading: '1. Abschnittsüberschrift', sampleBody: 'Dieser Absatz zeigt Grundschrift, Zeilenabstand, Ränder und Einzug des gewählten Publikationsstils.', sampleFootnote: '1 Beispiel für eine Fußnote.'
  };
  return {
    title: 'Publication style editor', description: 'Editable export appearance settings with a live preview.', page: 'Page', width: 'Width', height: 'Height', margins: 'Margins', top: 'Top', bottom: 'Bottom', inner: 'Inner', outer: 'Outer', typography: 'Typography', font: 'Font family', bodySize: 'Body size', bodyLeading: 'Body leading', indent: 'First-line indent', titleStyle: 'Title', titleSize: 'Title size', headingSize: 'Heading size', footnoteSize: 'Footnote size', alignment: 'Alignment', save: 'Save', saved: 'Saved on this device', reset: 'Reset template', export: 'Export style', preview: 'Live preview', sampleTitle: 'Hybrid Public Servants or Religious Teacher-Priests?', sampleSubtitle: 'Sample article subtitle', sampleAuthor: 'Balla János', sampleAffiliation: 'Nemzeti Közszolgálati Egyetem', sampleHeading: '1. Section heading', sampleBody: 'This paragraph previews body typography, line height, margins and first-line indentation for the selected publication style.', sampleFootnote: '1 Sample footnote at the current size.'
  };
}

export function PublicationStyleEditor() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const [style, setStyle] = useState<PublicationStyle>(loadStyle);
  const [saved, setSaved] = useState(false);

  const pageRatio = useMemo(() => style.page.height / style.page.width, [style.page.height, style.page.width]);

  function setPage<K extends keyof PublicationStyle['page']>(key: K, value: PublicationStyle['page'][K]) {
    setSaved(false);
    setStyle((current) => ({ ...current, page: { ...current.page, [key]: value } }));
  }

  function setMargin(key: keyof PublicationStyle['page']['margins'], value: number) {
    setSaved(false);
    setStyle((current) => ({ ...current, page: { ...current.page, margins: { ...current.page.margins, [key]: value } } }));
  }

  function setStyleValue(styleKey: keyof PublicationStyle['styles'], property: string, value: string | number) {
    setSaved(false);
    setStyle((current) => ({
      ...current,
      styles: {
        ...current.styles,
        [styleKey]: { ...current.styles[styleKey], [property]: value },
      },
    } as PublicationStyle));
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
    setSaved(true);
  }

  function reset() {
    const next = cloneTemplate();
    setStyle(next);
    window.localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
  }

  function exportStyle() {
    const blob = new Blob([JSON.stringify(style, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${style.id}.omi-publication-style.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const body = style.styles.body;
  const title = style.styles.articleTitlePrimary;
  const heading = style.styles.heading1;
  const footnote = style.styles.footnote;

  return <section className="publication-style-editor" aria-labelledby="publication-style-editor-title">
    <div className="publication-profile-section-heading">
      <div><h4 id="publication-style-editor-title">{copy.title}</h4><p>{copy.description}</p></div>
    </div>
    <div className="publication-style-editor-layout">
      <div className="publication-style-controls">
        <fieldset><legend>{copy.page}</legend><div className="publication-style-grid">
          <NumberField label={`${copy.width} (mm)`} value={style.page.width} onChange={(value) => setPage('width', value)} />
          <NumberField label={`${copy.height} (mm)`} value={style.page.height} onChange={(value) => setPage('height', value)} />
        </div></fieldset>
        <fieldset><legend>{copy.margins}</legend><div className="publication-style-grid">
          <NumberField label={`${copy.top} (mm)`} value={style.page.margins.top} onChange={(value) => setMargin('top', value)} />
          <NumberField label={`${copy.bottom} (mm)`} value={style.page.margins.bottom} onChange={(value) => setMargin('bottom', value)} />
          <NumberField label={`${copy.inner} (mm)`} value={style.page.margins.inner} onChange={(value) => setMargin('inner', value)} />
          <NumberField label={`${copy.outer} (mm)`} value={style.page.margins.outer} onChange={(value) => setMargin('outer', value)} />
        </div></fieldset>
        <fieldset><legend>{copy.typography}</legend><div className="publication-style-grid">
          <label><span>{copy.font}</span><input value={style.fonts.body.family} onChange={(event) => { setSaved(false); setStyle((current) => ({ ...current, fonts: { ...current.fonts, body: { ...current.fonts.body, family: event.target.value }, note: { ...current.fonts.note, family: event.target.value } } })); }} /></label>
          <NumberField label={`${copy.bodySize} (pt)`} value={body.fontSize} step={0.1} onChange={(value) => setStyleValue('body', 'fontSize', value)} />
          <NumberField label={`${copy.bodyLeading} (pt)`} value={body.lineHeight} step={0.1} onChange={(value) => setStyleValue('body', 'lineHeight', value)} />
          <NumberField label={`${copy.indent} (mm)`} value={body.firstLineIndent} step={0.5} onChange={(value) => setStyleValue('body', 'firstLineIndent', value)} />
          <NumberField label={`${copy.titleSize} (pt)`} value={title.fontSize} step={0.1} onChange={(value) => setStyleValue('articleTitlePrimary', 'fontSize', value)} />
          <NumberField label={`${copy.headingSize} (pt)`} value={heading.fontSize} step={0.1} onChange={(value) => setStyleValue('heading1', 'fontSize', value)} />
          <NumberField label={`${copy.footnoteSize} (pt)`} value={footnote.fontSize} step={0.1} onChange={(value) => setStyleValue('footnote', 'fontSize', value)} />
          <label><span>{copy.alignment}</span><select value={body.alignment} onChange={(event) => setStyleValue('body', 'alignment', event.target.value as Align)}><option value="justify">Justify</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        </div></fieldset>
        <div className="publication-style-actions">
          <button type="button" className="studio-menu-primary-action" onClick={save}><Save size={16} aria-hidden="true" />{copy.save}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={exportStyle}><Download size={16} aria-hidden="true" />{copy.export}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={reset}><RotateCcw size={16} aria-hidden="true" />{copy.reset}</button>
        </div>
        {saved ? <p className="publication-style-saved" role="status">{copy.saved}</p> : null}
      </div>
      <div className="publication-style-preview-wrap">
        <strong>{copy.preview}</strong>
        <div className="publication-style-preview-stage">
          <article className="publication-style-preview-page" style={{
            aspectRatio: `${style.page.width} / ${style.page.height}`,
            maxHeight: `min(70vh, ${Math.max(420, pageRatio * 310)}px)`,
            fontFamily: `${style.fonts.body.family}, ${style.fonts.body.fallback}`,
            paddingTop: `${style.page.margins.top / style.page.height * 100}%`,
            paddingBottom: `${style.page.margins.bottom / style.page.height * 100}%`,
            paddingLeft: `${style.page.margins.inner / style.page.width * 100}%`,
            paddingRight: `${style.page.margins.outer / style.page.width * 100}%`,
          }}>
            <h1 style={{ fontSize: `${title.fontSize}px`, lineHeight: title.lineHeight / title.fontSize }}>{copy.sampleTitle}</h1>
            <p className="publication-style-preview-subtitle">{copy.sampleSubtitle}</p>
            <p className="publication-style-preview-author">{copy.sampleAuthor}</p>
            <p className="publication-style-preview-affiliation">{copy.sampleAffiliation}</p>
            <h2 style={{ fontSize: `${heading.fontSize}px`, lineHeight: heading.lineHeight / heading.fontSize }}>{copy.sampleHeading}</h2>
            <p className="publication-style-preview-body" style={{ fontSize: `${body.fontSize}px`, lineHeight: body.lineHeight / body.fontSize, textAlign: body.alignment as React.CSSProperties['textAlign'], textIndent: `${body.firstLineIndent}px` }}>{copy.sampleBody}</p>
            <div className="publication-style-preview-footnote" style={{ fontSize: `${footnote.fontSize}px`, lineHeight: footnote.lineHeight / footnote.fontSize }}>{copy.sampleFootnote}</div>
          </article>
        </div>
      </div>
    </div>
  </section>;
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label><span>{label}</span><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
