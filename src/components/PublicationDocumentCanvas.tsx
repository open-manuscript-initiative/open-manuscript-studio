import type { JSONContent } from '@tiptap/core';
import {
  useId,
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
import type { ProofingSelection } from '../model/proofing';
import { formatHierarchicalSectionNumber } from '../model/sectionNumbering';
import {
  loadPublicationPublisherIdentity,
  resolvePublicationParagraphStyle,
  type PublicationStyle,
} from '../services/publicationStyleExport';
import { cssStringLiteral } from '../services/embeddedCss';
import type { OmiPublicationFlowBreak } from '../editor/extensions/OmiProofingMarksExtension';
import { BlockEditor } from './BlockEditor';
import {
  paginatePublicationBlocks,
  type PublicationFlowLine,
} from './publicationPageLayout';

const PIXELS_PER_MM = 96 / 25.4;
const PIXELS_PER_POINT = 96 / 72;

type PublicationZoom = 'fit' | 50 | 75 | 100;
const EMPTY_PUBLICATION_CORRECTIONS = [] as const;
const EMPTY_PUBLICATION_FLOW_BREAKS: readonly OmiPublicationFlowBreak[] = [];

interface PublicationPaginationState {
  pageCount: number;
  css: string;
  flowBreaks: readonly OmiPublicationFlowBreak[];
}

interface PublicationDocumentCanvasProps {
  style: PublicationStyle;
  onProofingSelection?: (selection: ProofingSelection | null) => void;
}

interface PublicationCanvasCopy {
  editor: string;
  description: string;
  printLayout: string;
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

export function PublicationDocumentCanvas({
  style,
  onProofingSelection,
}: PublicationDocumentCanvasProps) {
  const { locale } = useTranslation();
  const copy = canvasCopy(locale);
  const canvasId = `publication-canvas-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const manuscript = useStudioStore((state) => state.manuscript);
  const publicationCorrections = manuscript.publicationCorrections
    ?? EMPTY_PUBLICATION_CORRECTIONS;
  const setTitle = useStudioStore((state) => state.setTitle);
  const setAbstract = useStudioStore((state) => state.setAbstract);
  const publisherIdentity = loadPublicationPublisherIdentity();
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [pagination, setPagination] = useState<PublicationPaginationState>({
    pageCount: 1,
    css: '',
    flowBreaks: EMPTY_PUBLICATION_FLOW_BREAKS,
  });
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
  const topMargin = topMarginMm * PIXELS_PER_MM * scale;
  const bottomMargin = bottomMarginMm * PIXELS_PER_MM * scale;
  const innerMargin = innerMarginMm * PIXELS_PER_MM * scale;
  const outerMargin = outerMarginMm * PIXELS_PER_MM * scale;
  const bleed = bleedMm * PIXELS_PER_MM * scale;
  const pageGap = Math.max(16, bleed * 2 + 12);
  const pageStride = pageHeight + pageGap;
  const usablePageHeight = Math.max(
    80,
    pageHeight - topMargin - bottomMargin,
  );
  const firstPageNumber = Math.max(0, Math.trunc(style.page.pageNumberStart ?? 1));
  const firstPageIsMirrored = style.page.mirroredMargins && firstPageNumber % 2 === 0;
  const firstPageLeftMargin = firstPageIsMirrored ? outerMargin : innerMargin;
  const firstPageRightMargin = firstPageIsMirrored ? innerMargin : outerMargin;
  const contentWidth = Math.max(80, pageWidth - firstPageLeftMargin - firstPageRightMargin);
  const pageOverhead = topMargin + bottomMargin + pageGap;

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
  const paragraphStyleNextById = useMemo(
    () => new Map(
      style.paragraphStyles.items.map((definition) => [
        definition.id,
        definition.nextStyleId ?? style.paragraphStyles.defaultStyleId,
      ]),
    ),
    [style.paragraphStyles],
  );
  const document = useMemo(
    () => buildContinuousManuscriptDocument(
      manuscript.sections,
      sectionNumbers,
      paragraphStyleNextById,
      style.paragraphStyles.defaultStyleId,
    ),
    [
      manuscript.sections,
      paragraphStyleNextById,
      sectionNumbers,
      style.paragraphStyles.defaultStyleId,
    ],
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

    let frame = 0;
    const update = () => {
      const flow = collectPublicationFlowElements(content);
      const corrections = publicationCorrections;
      let existingFlowBreakHeight = 0;
      const layout = paginatePublicationBlocks(
        flow.map(({ element }) => {
          const blockId = element.dataset.blockId ?? '';
          const blockCorrections = corrections.filter(
            (correction) => correction.targetBlockId === blockId,
          );
          const splittable = isSplittablePublicationParagraph(element);
          const lines = splittable ? measurePublicationLines(element) : [];
          const ownFlowBreakHeight = publicationFlowBreakHeight(element);
          const paragraphStyle = resolvePublicationParagraphStyle(
            style,
            element.dataset.paragraphStyleId,
          );
          const block = {
            top: Math.max(
              0,
              offsetTopWithin(element, content) - existingFlowBreakHeight,
            ),
            height: Math.max(
              0,
              element.getBoundingClientRect().height - ownFlowBreakHeight,
            ),
            lines,
            leadingHeight: lines[0]?.height,
            splittable,
            keepWithNext: /^H[1-6]$/.test(element.tagName)
              || paragraphStyle.keepWithNext
              || blockCorrections.some((item) => item.kind === 'keep-with-next'),
            keepTogether: paragraphStyle.keepTogether
              || blockCorrections.some((item) => item.kind === 'keep-together'),
            forcePageBreakBefore: blockCorrections.some(
              (item) => item.kind === 'page-break-before',
            ),
          };
          existingFlowBreakHeight += ownFlowBreakHeight;
          return block;
        }),
        usablePageHeight,
        pageOverhead,
      );
      const css = buildPaginationCss({
        canvasId,
        flow,
        placements: layout.placements,
        firstPageNumber,
        mirroredMargins: style.page.mirroredMargins,
        innerMargin,
        outerMargin,
        firstPageLeftMargin,
      });
      const flowBreaks = layout.flowBreaks.flatMap<OmiPublicationFlowBreak>(
        (flowBreak) => {
          const targetBlockId = flow[flowBreak.blockIndex]?.element.dataset.blockId;
          return targetBlockId
            ? [{
                targetBlockId,
                textOffset: flowBreak.textOffset,
                height: flowBreak.height,
              }]
            : [];
        },
      );

      setPagination((current) => (
        current.pageCount === layout.pageCount
          && current.css === css
          && publicationFlowBreaksEqual(current.flowBreaks, flowBreaks)
          ? current
          : { pageCount: layout.pageCount, css, flowBreaks }
      ));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    schedule();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedule);
    resizeObserver?.observe(content);
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(schedule);
    mutationObserver?.observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [
    canvasId,
    document,
    firstPageLeftMargin,
    firstPageNumber,
    innerMargin,
    manuscript.abstract,
    manuscript.motto,
    publicationCorrections,
    manuscript.subtitle,
    notes,
    outerMargin,
    pageOverhead,
    style.page.mirroredMargins,
    style,
    usablePageHeight,
  ]);

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
  const pageCount = pagination.pageCount;
  const paragraphStyleCss = buildLiveParagraphStyleCss(canvasId, style, scale);
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
    height: `${pageHeight * pageCount + pageGap * Math.max(0, pageCount - 1)}px`,
    marginTop: `${Math.max(8, bleed + 8)}px`,
    marginBottom: `${Math.max(8, bleed + 8)}px`,
    fontFamily: `${style.fonts.body.family}, ${style.fonts.body.fallback}`,
    '--omi-publication-page-height': `${pageHeight}px`,
    '--omi-publication-page-gap': `${pageGap}px`,
    '--omi-publication-bleed': `${bleed}px`,
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
    '--omi-publication-hyphens': body.hyphenation ? 'auto' : 'none',
  } as CSSProperties;
  const contentStyle = {
    top: `${topMargin}px`,
    left: `${firstPageLeftMargin}px`,
    width: `${contentWidth}px`,
  } as CSSProperties;
  const rulerStyle = {
    width: `${pageWidth}px`,
    '--omi-publication-ruler-left': `${firstPageLeftMargin}px`,
    '--omi-publication-ruler-right': `${firstPageRightMargin}px`,
    '--omi-publication-ruler-step': `${5 * PIXELS_PER_MM * scale}px`,
  } as CSSProperties;

  return (
    <section
      id={canvasId}
      className="publication-document-canvas"
      aria-labelledby="publication-document-canvas-title"
    >
      {pagination.css || paragraphStyleCss
        ? <style>{`${paragraphStyleCss}\n${pagination.css}`}</style>
        : null}
      <header className="publication-document-canvas-toolbar">
        <div>
          <strong id="publication-document-canvas-title">{copy.editor}</strong>
          <span>{copy.description}</span>
        </div>
        <div className="publication-document-canvas-status">
          <span className="publication-document-view-mode">{copy.printLayout}</span>
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

      <div
        ref={stageRef}
        className="publication-document-canvas-stage"
        aria-label={copy.printLayout}
      >
        <div className="publication-document-ruler" style={rulerStyle} aria-hidden="true">
          <span className="publication-document-ruler-margin publication-document-ruler-margin--left" />
          <span className="publication-document-ruler-margin publication-document-ruler-margin--right" />
        </div>
        <article className="publication-document-paper" style={pageStyle} lang={manuscript.locale}>
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
                    top: `${index * pageStride}px`,
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

          <div ref={contentRef} className="publication-document-content" style={contentStyle}>
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
                  proofingMode="publication"
                  publicationCorrections={publicationCorrections}
                  publicationFlowBreaks={pagination.flowBreaks}
                  onProofingSelection={onProofingSelection}
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

interface PublicationFlowElement {
  element: HTMLElement;
  selector: string;
}

function collectPublicationFlowElements(root: HTMLElement): PublicationFlowElement[] {
  const flow: PublicationFlowElement[] = [];
  const frontMatter = directChild(root, 'publication-document-front-matter');
  if (frontMatter) {
    flow.push({ element: frontMatter, selector: '.publication-document-front-matter' });
  }

  const editor = root.querySelector<HTMLElement>('.omi-continuous-tiptap-editor');
  if (editor) {
    Array.from(editor.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement)) return;
      flow.push({
        element: child,
        selector: `.omi-continuous-tiptap-editor > :nth-child(${index + 1})`,
      });
    });
  }

  const empty = directChild(root, 'publication-document-empty');
  if (empty) {
    flow.push({ element: empty, selector: '.publication-document-empty' });
  }
  const notes = directChild(root, 'publication-document-notes');
  if (notes) {
    flow.push({ element: notes, selector: '.publication-document-notes' });
  }

  return flow.sort(
    (left, right) => offsetTopWithin(left.element, root) - offsetTopWithin(right.element, root),
  );
}

function directChild(root: HTMLElement, className: string): HTMLElement | undefined {
  return Array.from(root.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains(className),
  );
}

function offsetTopWithin(element: HTMLElement, root: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = element;

  while (current && current !== root) {
    top += current.offsetTop;
    current = current.offsetParent instanceof HTMLElement ? current.offsetParent : null;
  }

  return current === root ? top : element.offsetTop;
}

function isSplittablePublicationParagraph(element: HTMLElement): boolean {
  return (element.tagName === 'P' || element.tagName === 'BLOCKQUOTE')
    && Boolean(element.closest('.omi-continuous-tiptap-editor'));
}

function measurePublicationLines(element: HTMLElement): PublicationFlowLine[] {
  const ownerDocument = element.ownerDocument;
  const elementRect = element.getBoundingClientRect();
  const existingBreaks = Array.from(
    element.querySelectorAll<HTMLElement>('.omi-publication-flow-break'),
  ).map((spacer) => ({
    top: spacer.getBoundingClientRect().top,
    height: spacer.getBoundingClientRect().height,
  }));
  const runs: Array<{ node: Text; start: number }> = [];
  let textOffset = 0;

  const visit = (node: Node): void => {
    if (node instanceof HTMLElement) {
      if (
        node.dataset.publicationFlowBreak
        || node.classList.contains('omi-publication-correction')
        || node.contentEditable === 'false'
      ) return;
      if (node.tagName === 'BR') {
        textOffset += 1;
        return;
      }
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (textNode.data.length) {
        runs.push({ node: textNode, start: textOffset });
        textOffset += textNode.data.length;
      }
      return;
    }
    node.childNodes.forEach(visit);
  };
  element.childNodes.forEach(visit);

  const measured: PublicationFlowLine[] = [];
  for (const run of runs) {
    const range = ownerDocument.createRange();
    range.selectNodeContents(run.node);
    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.height > 0.5 && rect.width > 0.01,
    );
    const lineRects = rects.filter((rect, index) => (
      index === 0 || Math.abs(rect.top - rects[index - 1]!.top) > 0.5
    ));
    for (const rect of lineRects) {
      const localOffset = firstTextOffsetAtVerticalPosition(
        ownerDocument,
        run.node,
        rect.top,
      );
      measured.push({
        textOffset: run.start + localOffset,
        top: Math.max(
          0,
          rect.top - elementRect.top - existingBreaks
            .filter((spacer) => spacer.top < rect.top - 0.5)
            .reduce((total, spacer) => total + spacer.height, 0),
        ),
        height: rect.height,
      });
    }
  }

  const lines = measured
    .sort((left, right) => left.top - right.top || left.textOffset - right.textOffset)
    .filter((line, index, values) => (
      index === 0 || Math.abs(line.top - values[index - 1]!.top) > 0.5
    ));
  if (lines.length) return lines;

  const lineHeight = Number.parseFloat(ownerDocument.defaultView?.getComputedStyle(element).lineHeight ?? '');
  return [{
    textOffset: 0,
    top: 0,
    height: Number.isFinite(lineHeight) && lineHeight > 0
      ? lineHeight
      : Math.max(
          0,
          element.getBoundingClientRect().height - publicationFlowBreakHeight(element),
        ),
  }];
}

function publicationFlowBreakHeight(element: HTMLElement): number {
  return Array.from(
    element.querySelectorAll<HTMLElement>('.omi-publication-flow-break'),
  ).reduce((total, spacer) => total + spacer.getBoundingClientRect().height, 0);
}

function firstTextOffsetAtVerticalPosition(
  ownerDocument: Document,
  textNode: Text,
  targetTop: number,
): number {
  let lower = 0;
  let upper = textNode.data.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const top = textCharacterTop(ownerDocument, textNode, middle);
    if (top < targetTop - 0.5) lower = middle + 1;
    else upper = middle;
  }
  return Math.max(0, Math.min(textNode.data.length, lower));
}

function textCharacterTop(
  ownerDocument: Document,
  textNode: Text,
  offset: number,
): number {
  if (!textNode.data.length) return 0;
  const start = Math.max(0, Math.min(textNode.data.length - 1, offset));
  const range = ownerDocument.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, start + 1);
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  return Number.isFinite(rect.top) ? rect.top : 0;
}

function publicationFlowBreaksEqual(
  left: readonly OmiPublicationFlowBreak[],
  right: readonly OmiPublicationFlowBreak[],
): boolean {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index];
    return other?.targetBlockId === item.targetBlockId
      && other.textOffset === item.textOffset
      && Math.abs(other.height - item.height) < 0.01;
  });
}

function buildLiveParagraphStyleCss(
  canvasId: string,
  style: PublicationStyle,
  scale: number,
): string {
  return style.paragraphStyles.items.map((definition) => {
    const resolved = resolvePublicationParagraphStyle(style, definition.id);
    const editor = `#${canvasId} .omi-continuous-tiptap-editor`;
    const assignedSelector = `${editor} > [data-paragraph-style-id=${cssStringLiteral(definition.id)}]`;
    const selector = definition.id === style.paragraphStyles.defaultStyleId
      ? `${assignedSelector}, ${editor} > :is(p, blockquote, ul, ol, pre):not([data-paragraph-style-id])`
      : assignedSelector;
    return `${selector} { font-family: ${cssStringLiteral(resolved.fontFamily)}, ${cssStringLiteral(style.fonts.body.fallback)}; font-size: ${cssPixel(resolved.fontSize * PIXELS_PER_POINT * scale)}; line-height: ${cssPixel(resolved.lineHeight * PIXELS_PER_POINT * scale)}; font-weight: ${resolved.fontWeight}; font-style: ${resolved.fontStyle}; text-align: ${resolved.alignment}; text-indent: ${cssPixel(resolved.firstLineIndent * PIXELS_PER_MM * scale)}; margin-top: ${cssPixel(resolved.spaceBefore * PIXELS_PER_POINT * scale)}; margin-bottom: ${cssPixel(resolved.spaceAfter * PIXELS_PER_POINT * scale)}; margin-left: ${cssPixel(resolved.leftIndent * PIXELS_PER_MM * scale)}; margin-right: ${cssPixel(resolved.rightIndent * PIXELS_PER_MM * scale)}; -webkit-hyphens: ${resolved.hyphenation ? 'auto' : 'none'}; hyphens: ${resolved.hyphenation ? 'auto' : 'none'}; widows: ${Math.max(1, Math.trunc(resolved.widows))}; orphans: ${Math.max(1, Math.trunc(resolved.orphans))}; }`;
  }).join('\n');
}

function buildPaginationCss({
  canvasId,
  flow,
  placements,
  firstPageNumber,
  mirroredMargins,
  innerMargin,
  outerMargin,
  firstPageLeftMargin,
}: {
  canvasId: string;
  flow: readonly PublicationFlowElement[];
  placements: readonly { pageIndex: number; translateY: number }[];
  firstPageNumber: number;
  mirroredMargins: boolean;
  innerMargin: number;
  outerMargin: number;
  firstPageLeftMargin: number;
}): string {
  return flow.map((block, index) => {
    const placement = placements[index];
    if (!placement) return '';
    const pageNumber = firstPageNumber + placement.pageIndex;
    const pageLeftMargin = mirroredMargins && pageNumber % 2 === 0
      ? outerMargin
      : innerMargin;
    const translateX = pageLeftMargin - firstPageLeftMargin;
    return `#${canvasId} ${block.selector} { translate: ${cssPixel(translateX)} ${cssPixel(placement.translateY)}; }`;
  }).filter(Boolean).join('\n');
}

function cssPixel(value: number): string {
  const rounded = Math.abs(value) < 0.005 ? 0 : Math.round(value * 100) / 100;
  return `${rounded}px`;
}

function canvasCopy(locale: string): PublicationCanvasCopy {
  if (locale === 'hu') {
    return {
      editor: 'Élő kiadványszerkesztő',
      description: 'A kézirat tartalma és a nyomtatási stílus ugyanazon a szerkeszthető oldalon látható.',
      printLayout: 'Nyomtatási elrendezés',
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
      printLayout: 'Drucklayout',
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
    printLayout: 'Print layout',
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
