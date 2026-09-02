import type { JSONContent } from '@tiptap/core';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react';

import { stageContinuousDocumentChange } from '../app/continuousDocumentActions';
import {
  stageMottoChange,
  stageSubtitleChange,
} from '../app/manuscriptFrontMatterActions';
import { useStudioStore } from '../app/useStudioStore';
import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../editor/continuousManuscriptDocument';
import { useTranslation } from '../i18n';
import { collectPublicationContributors } from '../model/publicationRendering';
import { formatHierarchicalSectionNumber } from '../model/sectionNumbering';
import {
  loadPublicationPublisherIdentity,
  type PublicationStyle,
} from '../services/publicationStyleExport';
import { BlockEditor } from './BlockEditor';

const PIXELS_PER_MM = 96 / 25.4;
const PIXELS_PER_POINT = 96 / 72;

type PublicationZoom = 'fit' | 50 | 75 | 100;

interface PublicationDocumentCanvasProps {
  style: PublicationStyle;
}

interface PublicationCanvasCopy {
  editor: string;
  description: string;
  zoom: string;
  fit: string;
  pages: (count: number) => string;
  page: (number: number) => string;
  title: string;
  subtitle: string;
  motto: string;
  abstract: string;
  body: string;
  notes: string;
  empty: string;
}

export function PublicationDocumentCanvas({ style }: PublicationDocumentCanvasProps) {
  const { locale } = useTranslation();
  const copy = canvasCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const setTitle = useStudioStore((state) => state.setTitle);
  const setAbstract = useStudioStore((state) => state.setAbstract);
  const publisherIdentity = loadPublicationPublisherIdentity();
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState<PublicationZoom>('fit');

  const pageWidthMm = positive(style.page.width, 150);
  const pageHeightMm = positive(style.page.height, 240);
  const topMarginMm = nonNegative(style.page.margins.top, 18);
  const bottomMarginMm = nonNegative(style.page.margins.bottom, 18);
  const gutterMm = nonNegative(style.page.gutter, 0);
  const bleedMm = nonNegative(style.page.bleed, 0);
  const innerMarginMm = nonNegative(style.page.margins.inner, 19) + gutterMm;
  const outerMarginMm = nonNegative(style.page.margins.outer, 17);
  const physicalWidth = pageWidthMm * PIXELS_PER_MM;
  const fitScale = stageWidth > 0
    ? Math.min(1, Math.max(0.25, (stageWidth - 34) / physicalWidth))
    : 0.75;
  const scale = zoom === 'fit' ? fitScale : zoom / 100;
  const pageWidth = physicalWidth * scale;
  const pageHeight = pageHeightMm * PIXELS_PER_MM * scale;
  const usablePageHeight = Math.max(
    80,
    (pageHeightMm - topMarginMm - bottomMarginMm) * PIXELS_PER_MM * scale,
  );

  const sectionNumbers = useMemo(
    () => new Map(
      manuscript.sections.map((section) => [
        section.id,
        formatHierarchicalSectionNumber(
          manuscript.sections,
          section.id,
          manuscript.sectionNumberingStyle,
        ),
      ]),
    ),
    [manuscript.sectionNumberingStyle, manuscript.sections],
  );
  const document = useMemo(
    () => buildContinuousManuscriptDocument(manuscript.sections, sectionNumbers),
    [manuscript.sections, sectionNumbers],
  );
  const contributors = useMemo(
    () => collectPublicationContributors(manuscript).map((contributor) => contributor.displayName),
    [manuscript],
  );
  const notes = useMemo(
    () => manuscript.annotations.filter(
      (annotation) => annotation.noteKind === 'footnote'
        || annotation.noteKind === 'endnote'
        || annotation.renderingHint === 'footnote'
        || annotation.renderingHint === 'endnote',
    ),
    [manuscript.annotations],
  );

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setStageWidth(stage.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const update = () => {
      const next = Math.max(1, Math.ceil(content.scrollHeight / usablePageHeight));
      setPageCount((current) => current === next ? current : next);
    };
    const frame = requestAnimationFrame(update);
    if (typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [document, manuscript.abstract, manuscript.motto, manuscript.subtitle, notes, scale, style, usablePageHeight]);

  function updateDocument(_documentId: string, content: string): void {
    let parsed: JSONContent;
    try {
      parsed = JSON.parse(content) as JSONContent;
    } catch {
      return;
    }
    const currentSections = useStudioStore.getState().manuscript.sections;
    stageContinuousDocumentChange(
      projectContinuousManuscriptDocument(parsed, currentSections),
    );
  }

  const body = style.styles.body;
  const title = style.styles.articleTitlePrimary;
  const subtitle = style.styles.articleSubtitlePrimary;
  const heading1 = style.styles.heading1;
  const heading2 = style.styles.heading2;
  const note = style.styles.footnote;
  const firstPageNumber = Math.max(0, Math.trunc(style.page.pageNumberStart ?? 1));
  const runningHeaderValues = {
    articleTitle: manuscript.title,
    shortArticleTitle: shorten(manuscript.title, 72),
    journalTitle: publisherIdentity.journalTitle || style.name,
    volume: publisherIdentity.issue.volume,
    issue: publisherIdentity.issue.number,
    year: publisherIdentity.issue.year || manuscript.updatedAt.slice(0, 4),
  };
  const pageStyle = {
    width: `${pageWidth}px`,
    minHeight: `${pageHeight * pageCount}px`,
    marginTop: `${Math.max(6, bleedMm * PIXELS_PER_MM * scale + 6)}px`,
    marginBottom: `${Math.max(6, bleedMm * PIXELS_PER_MM * scale + 6)}px`,
    paddingTop: `${topMarginMm * PIXELS_PER_MM * scale}px`,
    paddingRight: `${outerMarginMm * PIXELS_PER_MM * scale}px`,
    paddingBottom: `${bottomMarginMm * PIXELS_PER_MM * scale}px`,
    paddingLeft: `${innerMarginMm * PIXELS_PER_MM * scale}px`,
    fontFamily: `${style.fonts.body.family}, ${style.fonts.body.fallback}`,
    '--omi-publication-page-height': `${pageHeight}px`,
    '--omi-publication-bleed': `${bleedMm * PIXELS_PER_MM * scale}px`,
    '--omi-publication-running-header-size': `${style.runningHeaders.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-running-header-rule': style.runningHeaders.rule.enabled
      ? `${Math.max(0.5, style.runningHeaders.rule.width * PIXELS_PER_POINT * scale)}px`
      : '0px',
    '--omi-publication-body-size': `${body.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-body-leading': `${body.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-first-line': `${body.firstLineIndent * PIXELS_PER_MM * scale}px`,
    '--omi-publication-title-size': `${title.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-title-leading': `${title.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-subtitle-size': `${subtitle.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-subtitle-leading': `${subtitle.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-one-size': `${heading1.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-one-leading': `${heading1.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-size': `${heading2.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-leading': `${heading2.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-note-size': `${note.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-note-leading': `${note.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-one-before': `${heading1.spaceBefore * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-one-after': `${heading1.spaceAfter * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-before': `${heading2.spaceBefore * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-after': `${heading2.spaceAfter * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-body-align': body.alignment,
  } as CSSProperties;

  return (
    <section className="publication-document-canvas" aria-labelledby="publication-document-canvas-title">
      <header className="publication-document-canvas-toolbar">
        <div>
          <strong id="publication-document-canvas-title">{copy.editor}</strong>
          <span>{copy.description}</span>
        </div>
        <div className="publication-document-canvas-status">
          <span aria-live="polite">{copy.pages(pageCount)}</span>
          <label>
            <span>{copy.zoom}</span>
            <select
              value={String(zoom)}
              onChange={(event) => setZoom(parseZoom(event.target.value))}
            >
              <option value="fit">{copy.fit}</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
            </select>
          </label>
        </div>
      </header>

      <div ref={stageRef} className="publication-document-canvas-stage">
        <article className="publication-document-paper" style={pageStyle}>
          <div className="publication-document-page-guides" aria-hidden="true">
            {Array.from({ length: pageCount }, (_, index) => {
              const pageNumber = firstPageNumber + index;
              const evenPage = pageNumber % 2 === 0;
              const mirroredEvenPage = style.page.mirroredMargins && evenPage;
              const leftMargin = mirroredEvenPage ? outerMarginMm : innerMarginMm;
              const rightMargin = mirroredEvenPage ? innerMarginMm : outerMarginMm;
              const header = evenPage ? style.runningHeaders.even : style.runningHeaders.odd;
              const showRunningHeader = style.runningHeaders.enabled
                && (index > 0 || style.firstPage.showRunningHeader);

              return (
                <div
                  className={`publication-document-page-guide${style.page.cropMarks ? ' publication-document-page-guide--crop-marks' : ''}${bleedMm > 0 ? ' publication-document-page-guide--bleed' : ''}`}
                  key={index}
                  style={{
                    top: `${index * pageHeight}px`,
                    height: `${pageHeight}px`,
                    '--omi-publication-page-left-margin': `${leftMargin * PIXELS_PER_MM * scale}px`,
                    '--omi-publication-page-right-margin': `${rightMargin * PIXELS_PER_MM * scale}px`,
                    '--omi-publication-page-top-margin': `${topMarginMm * PIXELS_PER_MM * scale}px`,
                    '--omi-publication-page-bottom-margin': `${bottomMarginMm * PIXELS_PER_MM * scale}px`,
                  } as CSSProperties}
                  data-page-label={copy.page(pageNumber)}
                >
                  {showRunningHeader ? (
                    <div className="publication-document-running-header">
                      <span>{fillRunningHeaderTemplate(header.left, { ...runningHeaderValues, pageNumber: String(pageNumber) })}</span>
                      <span>{fillRunningHeaderTemplate(header.right, { ...runningHeaderValues, pageNumber: String(pageNumber) })}</span>
                    </div>
                  ) : null}
                  {style.page.cropMarks ? (
                    <>
                      <i className="publication-document-crop-mark publication-document-crop-mark--top-left" />
                      <i className="publication-document-crop-mark publication-document-crop-mark--top-right" />
                      <i className="publication-document-crop-mark publication-document-crop-mark--bottom-left" />
                      <i className="publication-document-crop-mark publication-document-crop-mark--bottom-right" />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div ref={contentRef} className="publication-document-content">
            <header className="publication-document-front-matter">
              <AutoGrowPublicationField
                className="publication-document-title"
                value={manuscript.title}
                ariaLabel={copy.title}
                placeholder={copy.title}
                onChange={setTitle}
              />
              <AutoGrowPublicationField
                className="publication-document-subtitle"
                value={manuscript.subtitle ?? ''}
                ariaLabel={copy.subtitle}
                placeholder={copy.subtitle}
                onChange={stageSubtitleChange}
              />
              {contributors.length ? (
                <p className="publication-document-authors">{contributors.join(', ')}</p>
              ) : null}
              <AutoGrowPublicationField
                className="publication-document-motto"
                value={manuscript.motto ?? ''}
                ariaLabel={copy.motto}
                placeholder={copy.motto}
                onChange={stageMottoChange}
              />
              <AutoGrowPublicationField
                className="publication-document-abstract"
                value={manuscript.abstract ?? ''}
                ariaLabel={copy.abstract}
                placeholder={copy.abstract}
                onChange={setAbstract}
              />
            </header>

            {manuscript.sections.length ? (
              <div className="publication-document-body" aria-label={copy.body}>
                <BlockEditor
                  blockId={`omi-publication-document-${manuscript.id}`}
                  blockType="manuscript"
                  content={JSON.stringify(document)}
                  onUpdate={updateDocument}
                  manuscriptLanguage={manuscript.locale}
                  className="publication-layout-document-editor"
                  continuous
                />
              </div>
            ) : (
              <p className="publication-document-empty">{copy.empty}</p>
            )}

            {notes.length ? (
              <section className="publication-document-notes" aria-label={copy.notes}>
                <ol>
                  {notes.map((annotation) => (
                    <li key={annotation.id}>{plainText(annotation.body)}</li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function AutoGrowPublicationField({
  className,
  value,
  ariaLabel,
  placeholder,
  onChange,
}: {
  className: string;
  value: string;
  ariaLabel: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onChange(event.target.value.replace(/[\r\n]+/g, ' '));
  }

  return (
    <textarea
      ref={ref}
      className={className}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
    />
  );
}

function parseZoom(value: string): PublicationZoom {
  if (value === '50' || value === '75' || value === '100') return Number(value) as PublicationZoom;
  return 'fit';
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function nonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function plainText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return collectJsonText(JSON.parse(trimmed) as unknown).replace(/\s+/g, ' ').trim();
  } catch {
    return trimmed.replace(/\s+/g, ' ');
  }
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  const text = typeof node.text === 'string' ? node.text : '';
  const children = (node.content ?? []).map(collectJsonText).join(' ');
  return [text, children].filter(Boolean).join(' ');
}

function fillRunningHeaderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template
    .replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_match, key: string) => values[key] ?? '')
    .replace(/\s*\/\s*(?=\()/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function shorten(value: string, maximumLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maximumLength - 1)).trimEnd()}…`;
}

function canvasCopy(locale: string): PublicationCanvasCopy {
  if (locale === 'hu') {
    return {
      editor: 'Élő kiadványszerkesztő',
      description: 'A kézirat tartalma és a nyomtatási stílus ugyanazon a szerkeszthető oldalon látható.',
      zoom: 'Nagyítás',
      fit: 'Oldalszélesség',
      pages: (count) => `${count} becsült oldal`,
      page: (number) => `${number}. oldal`,
      title: 'Dokumentum címe',
      subtitle: 'Alcím',
      motto: 'Mottó',
      abstract: 'Absztrakt',
      body: 'Szerkeszthető kiadványszöveg',
      notes: 'Jegyzetek',
      empty: 'A dokumentum még nem tartalmaz törzsszöveget.',
    };
  }
  if (locale === 'de') {
    return {
      editor: 'Live-Publikationseditor',
      description: 'Manuskriptinhalt und Druckstil erscheinen gemeinsam auf einer bearbeitbaren Seite.',
      zoom: 'Zoom',
      fit: 'Seitenbreite',
      pages: (count) => `${count} geschätzte Seite${count === 1 ? '' : 'n'}`,
      page: (number) => `Seite ${number}`,
      title: 'Dokumenttitel',
      subtitle: 'Untertitel',
      motto: 'Motto',
      abstract: 'Zusammenfassung',
      body: 'Bearbeitbarer Publikationstext',
      notes: 'Anmerkungen',
      empty: 'Das Dokument enthält noch keinen Fließtext.',
    };
  }
  return {
    editor: 'Live publication editor',
    description: 'Manuscript content and print styling appear together on the same editable page.',
    zoom: 'Zoom',
    fit: 'Fit width',
    pages: (count) => `${count} estimated page${count === 1 ? '' : 's'}`,
    page: (number) => `Page ${number}`,
    title: 'Document title',
    subtitle: 'Subtitle',
    motto: 'Motto',
    abstract: 'Abstract',
    body: 'Editable publication text',
    notes: 'Notes',
    empty: 'The document does not yet contain body text.',
  };
}
