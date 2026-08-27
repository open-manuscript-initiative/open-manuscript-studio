import { Download, RotateCcw, Save } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { useTranslation } from '../i18n';
import type { OmiBlock, OmiManuscript } from '../types/omi';
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
    untitled: 'Cím nélküli kézirat', emptyBody: 'A kézirat még nem tartalmaz megjeleníthető törzsszöveget.'
  };
  if (locale === 'de') return {
    title: 'Publikationsstil-Editor', description: 'Bearbeitbare Exporteinstellungen mit Live-Vorschau.', page: 'Seite', width: 'Breite', height: 'Höhe', margins: 'Ränder', top: 'Oben', bottom: 'Unten', inner: 'Innen', outer: 'Außen', typography: 'Typografie', font: 'Schriftfamilie', bodySize: 'Grundschrift', bodyLeading: 'Zeilenabstand', indent: 'Erstzeileneinzug', titleStyle: 'Titel', titleSize: 'Titelgröße', headingSize: 'Überschriftgröße', footnoteSize: 'Fußnotengröße', alignment: 'Ausrichtung', save: 'Speichern', saved: 'Auf diesem Gerät gespeichert', reset: 'Vorlage zurücksetzen', export: 'Stil exportieren', preview: 'Live-Vorschau', untitled: 'Unbenanntes Manuskript', emptyBody: 'Das Manuskript enthält noch keinen darstellbaren Fließtext.'
  };
  return {
    title: 'Publication style editor', description: 'Editable export appearance settings with a live preview.', page: 'Page', width: 'Width', height: 'Height', margins: 'Margins', top: 'Top', bottom: 'Bottom', inner: 'Inner', outer: 'Outer', typography: 'Typography', font: 'Font family', bodySize: 'Body size', bodyLeading: 'Body leading', indent: 'First-line indent', titleStyle: 'Title', titleSize: 'Title size', headingSize: 'Heading size', footnoteSize: 'Footnote size', alignment: 'Alignment', save: 'Save', saved: 'Saved on this device', reset: 'Reset template', export: 'Export style', preview: 'Live preview', untitled: 'Untitled manuscript', emptyBody: 'The manuscript does not yet contain displayable body text.'
  };
}

interface ManuscriptPreviewContent {
  title: string;
  subtitle?: string;
  authors: string[];
  affiliation?: string;
  heading?: string;
  body?: string;
  footnote?: string;
}

function manuscriptPreviewContent(manuscript: OmiManuscript): ManuscriptPreviewContent {
  const agentById = new Map(manuscript.agents.map((agent) => [agent.id, agent]));
  const authorContributions = manuscript.contributions
    .filter((contribution) => contribution.targetId === manuscript.id && contribution.roles.includes('author'))
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER));

  const authors = authorContributions
    .map((contribution) => {
      if (contribution.attributionName?.trim()) return contribution.attributionName.trim();
      const agent = agentById.get(contribution.agentId);
      const preferred = agent?.names.find((name) => name.preferred) ?? agent?.names[0];
      return preferred?.value.trim() ?? '';
    })
    .filter(Boolean);

  if (!authors.length && manuscript.authors?.length) {
    authors.push(...manuscript.authors
      .map((author) => [author.givenName, author.familyName].filter(Boolean).join(' ').trim())
      .filter(Boolean));
  }

  const firstAuthorAgent = authorContributions.length
    ? agentById.get(authorContributions[0]?.agentId ?? '')
    : undefined;
  const affiliation = firstAuthorAgent?.affiliations.find((item) => item.visibility === 'public')?.organizationName.trim()
    || manuscript.authors?.find((author) => author.affiliation?.trim())?.affiliation?.trim();

  const heading = manuscript.sections.find((section) => section.title.trim())?.title.trim();
  const body = findFirstBodyText(manuscript.sections.flatMap((section) => section.blocks));
  const footnote = manuscript.annotations.find(
    (annotation) => annotation.noteKind === 'footnote' || annotation.renderingHint === 'footnote',
  )?.body.trim();

  return {
    title: manuscript.title.trim(),
    subtitle: manuscript.subtitle?.trim() || undefined,
    authors,
    affiliation: affiliation || undefined,
    heading: heading || undefined,
    body: body || undefined,
    footnote: footnote || undefined,
  };
}

function findFirstBodyText(blocks: readonly OmiBlock[]): string | undefined {
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'quote') {
      const text = blockPlainText(block.content);
      if (text) return text;
    }
    if (block.children?.length) {
      const nested = findFirstBodyText(block.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

function blockPlainText(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return jsonNodeText(parsed).replace(/\s+/g, ' ').trim();
  } catch {
    return trimmed.replace(/\s+/g, ' ');
  }
}

function jsonNodeText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown };
  const ownText = typeof node.text === 'string' ? node.text : '';
  const children = Array.isArray(node.content)
    ? node.content.map((child) => jsonNodeText(child)).join(' ')
    : '';
  return [ownText, children].filter(Boolean).join(' ');
}

export function PublicationStyleEditor() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const previewContent = useMemo(() => manuscriptPreviewContent(manuscript), [manuscript]);
  const [style, setStyle] = useState<PublicationStyle>(loadStyle);
  const [saved, setSaved] = useState(false);

  const pageRatio = useMemo(() => style.page.height / style.page.width, [style.page.height, style.page.width]);

  function setPage<K extends keyof PublicationStyle['page']>(key: K, value: PublicationStyle['page'][K]) {
    setSaved(false);
    setStyle((current) => ({ ...current, page: { ...current.page, [key]: value } }));
  }

  function setMargin(key: keyof PublicationStyle['page']['margins'], value: number) {
    setSaved(false);
    setStyle((current) => ({
      ...current,
      page: {
        ...current.page,
        margins: { ...current.page.margins, [key]: value },
      },
    }));
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
            <h1 style={{ fontSize: `${title.fontSize}px`, lineHeight: title.lineHeight / title.fontSize }}>{previewContent.title || copy.untitled}</h1>
            {previewContent.subtitle ? <p className="publication-style-preview-subtitle">{previewContent.subtitle}</p> : null}
            {previewContent.authors.length ? <p className="publication-style-preview-author">{previewContent.authors.join(', ')}</p> : null}
            {previewContent.affiliation ? <p className="publication-style-preview-affiliation">{previewContent.affiliation}</p> : null}
            {previewContent.heading ? <h2 style={{ fontSize: `${heading.fontSize}px`, lineHeight: heading.lineHeight / heading.fontSize }}>{previewContent.heading}</h2> : null}
            <p className="publication-style-preview-body" style={{ fontSize: `${body.fontSize}px`, lineHeight: body.lineHeight / body.fontSize, textAlign: body.alignment as CSSProperties['textAlign'], textIndent: `${body.firstLineIndent}px` }}>{previewContent.body || copy.emptyBody}</p>
            {previewContent.footnote ? <div className="publication-style-preview-footnote" style={{ fontSize: `${footnote.fontSize}px`, lineHeight: footnote.lineHeight / footnote.fontSize }}>{previewContent.footnote}</div> : null}
          </article>
        </div>
      </div>
    </div>
  </section>;
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label><span>{label}</span><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
