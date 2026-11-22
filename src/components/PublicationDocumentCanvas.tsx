import { PublicationPageNavigator } from './PublicationPageNavigator';
import { placePublicationEmptyPage, type PublicationBodyPageThumbnail } from '../model/publicationPageNavigation';
import { getStudyRootSectionId, partitionManuscriptStudies } from '../model/sectionStructure';
import { stageMoveSectionToSibling } from '../app/sectionActions';
import { arrangePublicationSheets, publicationFirstPageNumber, type PublicationSheetPosition } from '../model/publicationSpreads';
import { resolvePublicationPageStyle, PUBLICATION_BODY_START, publicationPageStyles, publicationSectionPageRules, publicationSectionLayoutKey } from '../model/publicationPageStyles';
import { resolvePublicationProfile } from '../model/publicationProfile';
import { publicationPaginationCopy } from '../i18n/publicationPagination';
import type { PublicationLayoutIssue, PublicationLayoutIssueReporter } from '../model/publicationLayoutDiagnostics';
import { renderPublicationNoteBody, type PublicationNoteBody } from '../services/publicationNoteBody';
import { PublicationPreviewContext, usePublicationPreview } from './PublicationPreviewContext';
import type { JSONContent } from '@tiptap/core';
import { FileCode2, FileText } from 'lucide-react';
import {
  useEffect,
  useContext,
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
  editorZoomFromEvent,
  editorZoomScale,
  EDITOR_ZOOM_EVENT,
  readStoredEditorZoom,
} from '../editor/editorZoom';
import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../editor/continuousManuscriptDocument';
import { useTranslation } from '../i18n';
import {
  buildNoteNumberMap,
  collectNoteAnchorsInBlock,
  getNoteKind,
  sortNotesByDocumentOrder,
  type NoteAnchorOccurrence,
} from '../model/notes';
import { contributorNameParts } from '../model/contributorName';
import { collectPublicationContributors } from '../model/publicationRendering';
import type { ProofingSelection } from '../model/proofing';
import type { OmiBibliographicRecord, OmiBlock, OmiSection } from '../types/omi';
import { formatHierarchicalSectionNumber } from '../model/sectionNumbering';
import {
  loadPublicationPublisherIdentity,
  buildPublicationTextRoleCss,
  publicationNoteCitationRules,
  resolvePublicationParagraphStyle,
  type PublicationStyle,
} from '../services/publicationStyleExport';
import { cssStringLiteral } from '../services/embeddedCss';
import type { OmiPublicationFlowBreak } from '../editor/extensions/OmiProofingMarksExtension';
import { BlockEditor } from './BlockEditor';
import { TablePaginationContext } from './TablePaginationContext';
import { PublicationHtmlSectionsEditor } from './PublicationHtmlSectionsEditor';
import { PublicationSectionRuler } from './PublicationSectionRuler';
import {
  paginatePublicationBlocks,
  publicationSectionFitWarnings,
  type PublicationPageLayout,
  type PublicationFlowBlock,
  type PublicationFlowLine,
  type PublicationPageNote,
} from './publicationPageLayout';

const PIXELS_PER_MM = 96 / 25.4;
const PIXELS_PER_POINT = 96 / 72;

type PublicationZoom = 'fit' | 50 | 75 | 100;
export type PublicationDocumentViewMode = 'print' | 'html';
const EMPTY_PUBLICATION_CORRECTIONS = [] as const;
const EMPTY_BIBLIOGRAPHIC_RECORDS: readonly OmiBibliographicRecord[] = [];
const EMPTY_PUBLICATION_FLOW_BREAKS: readonly OmiPublicationFlowBreak[] = [];
const LARGE_PUBLICATION_DOCUMENT_NODE_COUNT = 400;
const LARGE_PUBLICATION_PAGINATION_DEBOUNCE_MS = 120;

interface NoteAnchorCacheEntry {
  content: string;
  sectionId: string;
  occurrences: NoteAnchorOccurrence[];
}

interface NoteBodyCacheEntry {
  key: string;
  records: readonly OmiBibliographicRecord[];
  body: PublicationNoteBody;
}

interface PublicationPaginationState {
  pageCount: number;
  css: string;
  pageNotes: PublicationPageNote[][];
  flowBreaks: readonly OmiPublicationFlowBreak[];
  pageSectionIds?: (string | undefined)[];
  insertedPages?: PublicationPageLayout['insertedPages'];
  sectionWarnings?: PublicationPageLayout['sectionWarnings'];
  thumbnails?: PublicationBodyPageThumbnail[];
}

interface PublicationDocumentCanvasProps {
  style: PublicationStyle;
  onStyleChange?: (style: PublicationStyle) => void;
  viewMode: PublicationDocumentViewMode;
  onViewModeChange: (mode: PublicationDocumentViewMode) => void;
  onProofingSelection?: (selection: ProofingSelection | null) => void;
  onPageCountChange?: (manuscriptId: string, count: number) => void;
  onLayoutIssues?: PublicationLayoutIssueReporter;
  navigationTarget?: PublicationLayoutIssue | null;
}

interface PublicationCanvasCopy {
  editor: string;
  printDescription: string;
  htmlDescription: string;
  view: string;
  printLayout: string;
  htmlLayout: string;
  responsiveWidth: string;
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
  onStyleChange,
  viewMode,
  onViewModeChange,
  onProofingSelection,
  onPageCountChange,
  onLayoutIssues,
  navigationTarget,
}: PublicationDocumentCanvasProps) {
  const { locale } = useTranslation();
  const copy = canvasCopy(locale);
  const previewOnly = usePublicationPreview();
  const canvasId = `publication-canvas-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const manuscript = useStudioStore((state) => state.manuscript);
  const pageCountChange = useRef(onPageCountChange); pageCountChange.current = onPageCountChange;
  const reportIssues = useRef(onLayoutIssues); reportIssues.current = onLayoutIssues;
  const {
    id: manuscriptId,
    agents: manuscriptAgents,
    contributions: manuscriptContributions,
    annotations: manuscriptAnnotations,
    sections: manuscriptSections,
    documentStructure: manuscriptDocumentStructure,
  } = manuscript;
  const publicationCorrections = manuscript.publicationCorrections
    ?? EMPTY_PUBLICATION_CORRECTIONS;
  const setTitle = useStudioStore((state) => state.setTitle);
  const setAbstract = useStudioStore((state) => state.setAbstract);
  const publisherIdentity = loadPublicationPublisherIdentity();
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const noteMeasureRef = useRef<HTMLDivElement>(null);
  // Read the latest section hierarchy without discarding measured-line caches
  // on every content edit. MutationObserver already schedules changed blocks.
  const layoutSectionsRef = useRef(manuscript.sections);
  layoutSectionsRef.current = manuscript.sections;
  const sectionLayoutKey = publicationSectionLayoutKey(manuscript.sections);
  const noteAnchorCacheRef = useRef(new Map<string, NoteAnchorCacheEntry>());
  const noteBodyCacheRef = useRef(new Map<string, NoteBodyCacheEntry>());
  const [stageWidth, setStageWidth] = useState(0);
  const [visiblePageRange, setVisiblePageRange] = useState({ start: 0, end: 16 });
  const [pagination, setPagination] = useState<PublicationPaginationState>({
    pageCount: 1,
    css: '',
    pageNotes: [],
    flowBreaks: EMPTY_PUBLICATION_FLOW_BREAKS,
  });
  const [selectedThumbnailId, setSelectedThumbnailId] = useState('');
  const pendingThumbnailNavigation = useRef<string | null>(null);
  const [zoom, setZoom] = useState<PublicationZoom>('fit');
  const [editorZoomPercent, setEditorZoomPercent] = useState(readStoredEditorZoom);

  useEffect(() => {
    const handleEditorZoom = (event: Event) => {
      const next = editorZoomFromEvent(event);
      if (next !== null) setEditorZoomPercent(next);
    };
    window.addEventListener(EDITOR_ZOOM_EVENT, handleEditorZoom);
    return () => window.removeEventListener(EDITOR_ZOOM_EVENT, handleEditorZoom);
  }, []);

  const pageWidthMm = positive(style.page.width, 150);
  const pageHeightMm = positive(style.page.height, 240);
  const topMarginMm = nonNegative(style.page.margins.top, 18);
  const bottomMarginMm = nonNegative(style.page.margins.bottom, 18);
  const gutterMm = nonNegative(style.page.gutter, 0);
  const bleedMm = nonNegative(style.page.bleed, 0);
  const innerMarginMm = nonNegative(style.page.margins.inner, 19) + gutterMm;
  const outerMarginMm = nonNegative(style.page.margins.outer, 17);
  const facingPages = style.page.facingPages === true;
  const physicalWidth = pageWidthMm * PIXELS_PER_MM;
  const fitScale = stageWidth > 0
    ? Math.min(1, Math.max(facingPages ? 0.1 : 0.25, (stageWidth - 34) / (physicalWidth * (facingPages ? 2 : 1))))
    : 0.75;
  const printLayoutScale = zoom === 'fit'
    ? fitScale
    : zoom / 100;
  const scale = viewMode === 'html'
    ? 1
    : printLayoutScale * editorZoomScale(editorZoomPercent);
  const pageWidth = physicalWidth * scale;
  const pageHeight = pageHeightMm * PIXELS_PER_MM * scale;
  const topMargin = topMarginMm * PIXELS_PER_MM * scale;
  const bottomMargin = bottomMarginMm * PIXELS_PER_MM * scale;
  const innerMargin = innerMarginMm * PIXELS_PER_MM * scale;
  const outerMargin = outerMarginMm * PIXELS_PER_MM * scale;
  const bleed = bleedMm * PIXELS_PER_MM * scale;
  const pageGap = Math.max(28, bleed * 2 + 12);
  const pageStride = pageHeight + pageGap;
  const pageCount = viewMode === 'print' ? pagination.pageCount : 1;
  const usablePageHeight = Math.max(
    80,
    pageHeight - topMargin - bottomMargin,
  );
  const firstPageNumber = publicationFirstPageNumber(style.page);
  const firstPageIsMirrored = style.page.mirroredMargins && firstPageNumber % 2 === 0;
  const firstPageLeftMarginMm = firstPageIsMirrored ? outerMarginMm : innerMarginMm;
  const firstPageRightMarginMm = firstPageIsMirrored ? innerMarginMm : outerMarginMm;
  const firstPageLeftMargin = firstPageLeftMarginMm * PIXELS_PER_MM * scale;
  const firstPageRightMargin = firstPageRightMarginMm * PIXELS_PER_MM * scale;
  const contentWidth = Math.max(80, pageWidth - firstPageLeftMargin - firstPageRightMargin);
  const pageOverhead = topMargin + bottomMargin + pageGap;

  const styledSheetLayout = useMemo(() => {
    const pages = [];
    const seenHeaders = new Set<string | undefined>();
    for (let index = 0; index < pageCount; index += 1) {
      const sectionId = pagination.pageSectionIds?.[index];
      const insertedPage = pagination.insertedPages?.find((item) => item.pageIndex === index);
      const insertedStyleId = insertedPage ? insertedPage.styleId ?? '' : undefined;
      const resolved = resolvePublicationPageStyle(style, manuscript.sections, index, sectionId, insertedStyleId);
      const geometry = canvasPageGeometry(resolved, scale);
      const firstSectionPage = !seenHeaders.has(resolved.headerSectionId);
      seenHeaders.add(resolved.headerSectionId);
      pages.push({ ...geometry, resolved, sectionId, firstSectionPage });
    }
    const arranged = arrangePublicationSheets(pages, facingPages, pageGap);
    return { ...arranged, pages: pages.map((page, index) => ({ ...page, ...arranged.pages[index]! })) };
  }, [style, manuscript.sections, pagination.pageSectionIds, pagination.insertedPages, pageCount, scale, pageGap, facingPages]);
  const styledPages = styledSheetLayout.pages;
  const fitWarningCss = viewMode === 'print' ? (pagination.sectionWarnings ?? []).map((warning) =>
    `#${canvasId} :is(h1,h2,h3,h4,h5,h6)[data-section-id=${cssStringLiteral(warning.sectionId)}]{position:relative}#${canvasId} :is(h1,h2,h3,h4,h5,h6)[data-section-id=${cssStringLiteral(warning.sectionId)}]::after{content:"⚠";position:absolute;right:100%;top:0;margin-right:.35em;color:#b45309;font:14px sans-serif;pointer-events:none}`,
  ).join('\n') : '';
  const navigationSelector = navigationTarget?.blockId ? `[data-block-id=${cssStringLiteral(navigationTarget.blockId)}]`
    : navigationTarget?.sectionId ? `:is(h1,h2,h3,h4,h5,h6)[data-section-id=${cssStringLiteral(navigationTarget.sectionId)}]` : '';
  const navigationCss = navigationSelector ? `#${canvasId} .publication-document-content .omi-continuous-tiptap-editor > ${navigationSelector}{outline:2px solid #b45309;outline-offset:3px}` : '';

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
  const paginationDebounceMs = (document.content?.length ?? 0) > LARGE_PUBLICATION_DOCUMENT_NODE_COUNT
    ? LARGE_PUBLICATION_PAGINATION_DEBOUNCE_MS
    : 0;
  const contributors = useMemo(
    () => collectPublicationContributors({
      id: manuscriptId,
      agents: manuscriptAgents,
      contributions: manuscriptContributions,
    }),
    [manuscriptAgents, manuscriptContributions, manuscriptId],
  );
  const noteNumbers = useMemo(() => {
    const cache = noteAnchorCacheRef.current;
    const activeBlockIds = new Set<string>();
    const occurrences: NoteAnchorOccurrence[] = [];
    for (const section of manuscriptSections) {
      for (const block of section.blocks) {
        activeBlockIds.add(block.id);
        const cached = cache.get(block.id);
        const entry = cached
          && cached.content === block.content
          && cached.sectionId === section.id
          ? cached
          : {
              content: block.content,
              sectionId: section.id,
              occurrences: collectNoteAnchorsInBlock(block.content, section.id, block.id),
            };
        cache.set(block.id, entry);
        occurrences.push(...entry.occurrences);
      }
    }
    for (const blockId of cache.keys()) {
      if (!activeBlockIds.has(blockId)) cache.delete(blockId);
    }
    return buildNoteNumberMap({
      sections: manuscriptSections,
      documentStructure: manuscriptDocumentStructure,
      annotations: manuscriptAnnotations,
    }, occurrences);
  }, [manuscriptAnnotations, manuscriptDocumentStructure, manuscriptSections]);
  const citationRules = useMemo(() => publicationNoteCitationRules(style, resolvePublicationProfile({
    publicationProfile: manuscript.publicationProfile,
    embeddedPublicationProfile: manuscript.embeddedPublicationProfile,
  }).rules.citations), [manuscript.publicationProfile, manuscript.embeddedPublicationProfile, style]);
  const noteLocale = manuscript.locale;
  const records = manuscript.bibliographicRecords ?? EMPTY_BIBLIOGRAPHIC_RECORDS;
  const semanticNotes = useMemo(() => {
    const cache = noteBodyCacheRef.current;
    const activeIds = new Set<string>();
    const previousTargets = new Set<string>();
    const occurrences = manuscriptSections.flatMap((section) => section.blocks.flatMap((block) =>
      noteAnchorCacheRef.current.get(block.id)?.occurrences ?? [],
    ));
    const result = sortNotesByDocumentOrder({ sections: manuscriptSections, annotations: manuscriptAnnotations }, occurrences)
      .map((annotation, index) => {
        activeIds.add(annotation.id);
        const key = JSON.stringify([annotation.body, annotation.bodyContent, annotation.noteCitations,
          citationRules, noteLocale, [...previousTargets]]);
        const cached = cache.get(annotation.id);
        const body = cached?.key === key && cached.records === records ? cached.body : renderPublicationNoteBody(
          annotation, records, citationRules.noteFirstStyle ?? citationRules.style, noteLocale,
          { subsequentStyle: citationRules.noteSubsequentStyle, previouslyCitedTargets: [...previousTargets] },
        );
        for (const citation of annotation.noteCitations ?? []) previousTargets.add(citation.target);
        cache.set(annotation.id, { key, records, body });
        return {
          id: annotation.id,
          label: getNoteKind(annotation) === 'author-note' ? '✧' : (noteNumbers.get(annotation.id) ?? index + 1),
          ...body,
          kind: getNoteKind(annotation),
        };
      });
    for (const id of cache.keys()) {
      if (!activeIds.has(id)) cache.delete(id);
    }
    return result;
  }, [manuscriptAnnotations, manuscriptSections, noteNumbers, citationRules, noteLocale, records]);
  const notes = useMemo(() => semanticNotes.filter(
    (note) => note.kind === 'footnote' && noteNumbers.has(note.id),
  ), [semanticNotes, noteNumbers]);
  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const endnotes = useMemo(() => semanticNotes.filter(
    (note) => note.kind === 'endnote',
  ), [semanticNotes]);
  const noteStyle = resolvePublicationParagraphStyle(style, style.paragraphStyles.items.find((item) => item.role === 'note')?.id, manuscript.locale);
  const noteLineHeight = positive(noteStyle.lineHeight * PIXELS_PER_POINT * scale, 1);
  const noteSeparatorHeight = 8 * scale + 1;
  const firstVisiblePage = Math.max(0, Math.min(pageCount - 1, visiblePageRange.start));
  const visiblePageEnd = Math.min(pageCount, Math.max(firstVisiblePage + 1, visiblePageRange.end));

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

  const tableBlockIds = useMemo(() => new Set(manuscript.sections.flatMap((section) =>
    section.blocks.filter((block) => block.visual?.kind === 'table').map((block) => block.id),
  )), [manuscript.sections]);
  const textFlowBreaks = useMemo(() => pagination.flowBreaks.filter((item) =>
    !tableBlockIds.has(item.targetBlockId),
  ), [pagination.flowBreaks, tableBlockIds]);

  useLayoutEffect(() => {
    if (viewMode !== 'print') return;
    const stage = stageRef.current;
    const paper = stage?.querySelector<HTMLElement>('.publication-document-paper--print');
    if (!stage || !paper) return;

    let frame = 0;
    const updateVisiblePages = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const stageRect = stage.getBoundingClientRect();
        const paperRect = paper.getBoundingClientRect();
        const paperTop = paperRect.top - stageRect.top + stage.scrollTop;
        const viewportTop = stage.scrollTop - paperTop;
        const overscan = Math.max(stage.clientHeight * 1.5, pageStride * 2);
        const first = styledPages.findIndex((page) => page.top + page.height >= viewportTop - overscan);
        const start = first < 0 ? Math.max(0, pageCount - 1) : first;
        const end = Math.min(
          pageCount,
          styledPages.filter((page) => page.top <= viewportTop + stage.clientHeight + overscan).length + 1,
        );
        setVisiblePageRange((current) => (
          current.start === start && current.end === end
            ? current
            : { start, end }
        ));
      });
    };

    stage.addEventListener('scroll', updateVisiblePages, { passive: true });
    updateVisiblePages();
    return () => {
      stage.removeEventListener('scroll', updateVisiblePages);
      cancelAnimationFrame(frame);
    };
  }, [pageCount, pageStride, styledPages, viewMode]);

  useLayoutEffect(() => {
    if (viewMode !== 'print') {
      setPagination((current) => (
        current.pageCount === 1
          && current.css === ''
          && current.pageNotes.length === 0
          && current.flowBreaks.length === 0
          ? current
          : {
              pageCount: 1,
              css: '',
              pageNotes: [],
              flowBreaks: EMPTY_PUBLICATION_FLOW_BREAKS,
            }
      ));
      return;
    }
    const content = contentRef.current;
    if (!content) return;

    let frame = 0;
    let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let measuredLines = new WeakMap<HTMLElement, PublicationFlowLine[]>();
    const measuredWidths = new WeakMap<HTMLElement, number>();
    const dirtyBlocks = new WeakSet<HTMLElement>();
    const update = () => {
      if (!content.getClientRects().length) return;
      const flow = collectPublicationFlowElements(content);
      const noteElements = Array.from(
        noteMeasureRef.current?.querySelectorAll<HTMLElement>('[data-publication-note-id]') ?? [],
      );
      const noteHeights = new Map<string, number>();
      let noteIndex = 0;

      const measureNotesChunk = () => {
        if (cancelled || !content.getClientRects().length) return;
        const startedAt = performance.now();
        while (noteIndex < noteElements.length
          && (noteIndex === 0 || performance.now() - startedAt < 8)) {
          const element = noteElements[noteIndex]!;
          noteHeights.set(
            element.dataset.publicationNoteId!,
            Math.max(
              noteLineHeight,
              Math.ceil((element.getBoundingClientRect().height - 0.01) / noteLineHeight) * noteLineHeight,
            ),
          );
          noteIndex += 1;
        }
        if (noteIndex < noteElements.length) {
          frame = requestAnimationFrame(measureNotesChunk);
          return;
        }
        measureBlocksChunk();
      };

      const corrections = publicationCorrections;
      const measuredBlocks: PublicationFlowBlock[] = [];
      let flowIndex = 0;
      let existingFlowBreakHeight = 0;

      const measureBlocksChunk = () => {
        if (cancelled || !content.getClientRects().length) return;
        const startedAt = performance.now();
        // This React-owned ancestor is outside ProseMirror's observed DOM.
        // Touching a paragraph/node-view style would make ProseMirror reparse
        // and recreate it, restarting measurement and losing active controls.
        // Measure natural flow, without the previous pass's page spacers or
        // spread projection. Subtracting spacer heights cannot undo wrapping
        // at an obsolete break after zooming or editing. Restore before yielding
        // so the unpaginated document is never painted.
        content.dataset.publicationMeasuring = 'true';
        try {
          while (flowIndex < flow.length
            && (flowIndex === 0 || performance.now() - startedAt < 8)) {
            const { element } = flow[flowIndex]!;
            const blockId = publicationFlowBlockId(element) ?? '';
            const blockCorrections = corrections.filter(
              (correction) => correction.targetBlockId === blockId,
            );
            const table = element.querySelector<HTMLTableElement>('.omi-visual-block--table .omi-table-editor');
            const tableHeight = element.getBoundingClientRect().height - publicationFlowBreakHeight(element);
            const splittable = isSplittablePublicationParagraph(element) || Boolean(table && tableHeight > usablePageHeight);
            let lines: PublicationFlowLine[] = [];
            const flowBreakElements = Array.from(
              element.querySelectorAll<HTMLElement>('.omi-publication-flow-break'),
            );
            if (splittable) {
              const width = element.getBoundingClientRect().width;
              const cachedLines = measuredLines.get(element);
              if (cachedLines && !dirtyBlocks.has(element) && measuredWidths.get(element) === width) {
                lines = cachedLines.map((line) => ({ ...line }));
              } else {
                lines = table ? measurePublicationTableRows(element, table) : measurePublicationLines(element);
                measuredLines.set(
                  element,
                  lines.map((line) => ({ ...line, noteIds: undefined })),
                );
                measuredWidths.set(element, width);
                dirtyBlocks.delete(element);
              }
            }
            const elementRect = element.getBoundingClientRect();
            const flowBreaks = flowBreakElements.map((spacer) => {
              const rect = spacer.getBoundingClientRect();
              return { top: rect.top, height: rect.height };
            });
            const ownFlowBreakHeight = flowBreaks.reduce((sum, spacer) => sum + spacer.height, 0);
            const anchors = Array.from(
              element.querySelectorAll<HTMLElement>('[data-omi-note][data-note-id]'),
            ).filter((anchor) => noteHeights.has(anchor.dataset.noteId!));
            for (const anchor of anchors) {
              const rect = anchor.getBoundingClientRect();
              const removedSpace = flowBreaks
                .filter((spacer) => spacer.top < rect.top - 0.5)
                .reduce((sum, spacer) => sum + spacer.height, 0);
              const top = rect.top - elementRect.top - removedSpace;
              const line = lines.reduce<PublicationFlowLine | undefined>((nearest, candidate) => (
                !nearest || Math.abs(candidate.top - top) < Math.abs(nearest.top - top) ? candidate : nearest
              ), undefined);
              if (line) line.noteIds = [...(line.noteIds ?? []), anchor.dataset.noteId!];
            }
            const paragraphStyle = resolvePublicationParagraphStyle(
              style,
              element.dataset.paragraphStyleId,
            );
            const sectionId = element.dataset.sectionId ?? element.querySelector<HTMLElement>('[data-section-id]')?.dataset.sectionId;
            const keepRule = publicationSectionPageRules(style, layoutSectionsRef.current, sectionId).filter((rule) => rule.keepTogether !== undefined).at(-1);
            measuredBlocks.push({
              top: Math.max(
                0,
                offsetTopWithin(element, content) - existingFlowBreakHeight,
              ),
              height: Math.max(0, elementRect.height - ownFlowBreakHeight),
              sectionId,
              lines,
              noteIds: anchors.map((anchor) => anchor.dataset.noteId!),
              leadingHeight: lines[0]?.height,
              splittable,
              keepWithNext: /^H[1-6]$/.test(element.tagName)
                || paragraphStyle.keepWithNext
                || blockCorrections.some((item) => item.kind === 'keep-with-next'),
              keepTogether: paragraphStyle.keepTogether
                || blockCorrections.some((item) => item.kind === 'keep-together'),
              keepSectionTogether: keepRule?.keepTogether,
              keepSectionId: keepRule?.keepTogether ? keepRule.sectionId : undefined,
              insertedPagesBefore: (publicationFlowBlockId(element) || element.classList.contains('publication-document-front-matter')) ? style.pageStyles?.insertions?.filter((item) => item.beforeBlockId === (publicationFlowBlockId(element) ?? PUBLICATION_BODY_START)) : undefined,
              insertedPagesAfter: publicationFlowBlockId(element) ? style.pageStyles?.insertions?.filter((item) => item.afterBlockId === publicationFlowBlockId(element)) : undefined,
              forcePageBreakBefore: blockCorrections.some((item) => item.kind === 'page-break-before')
                || Boolean(element.dataset.sectionId && element.dataset.sectionId !== flow[flowIndex - 1]?.element.dataset.sectionId
                  && publicationSectionPageRules(style, layoutSectionsRef.current, element.dataset.sectionId).some((rule) => rule.sectionId === element.dataset.sectionId && (rule.startNewPage || rule.styleId || rule.runningHeaders))),
            });
            existingFlowBreakHeight += ownFlowBreakHeight;
            flowIndex += 1;
          }
        } finally {
          delete content.dataset.publicationMeasuring;
        }

        if (flowIndex < flow.length) {
          frame = requestAnimationFrame(measureBlocksChunk);
          return;
        }
        if (cancelled) return;
        const metricPages: ReturnType<typeof canvasPageGeometry>[] = [];
        const metricCache = new Map<number, { sectionId?: string; bodyHeight: number; bodyTop: number }>();
        const insertionStyles = new Map<number, string>();
        const metrics = (index: number, sectionId?: string, insertedStyleId?: string) => {
          if (insertedStyleId !== undefined && insertionStyles.get(index) !== insertedStyleId) { insertionStyles.set(index, insertedStyleId); metricCache.delete(index); }
          const cached = metricCache.get(index);
          if (cached && cached.sectionId === sectionId) return cached;
          const resolved = resolvePublicationPageStyle(style, layoutSectionsRef.current, index, sectionId, insertionStyles.get(index));
          metricPages[index] = canvasPageGeometry(resolved, scale);
          const previousHeight = metricPages.slice(0, index).reduce((sum, item) => sum + item.height + pageGap, 0);
          const measured = { sectionId, bodyHeight: metricPages[index]!.bodyHeight, bodyTop: previousHeight + metricPages[index]!.topMargin - topMargin };
          // A revised first content block can change a page's master. Future
          // absolute positions must then be recomputed from that page onward.
          for (const key of metricCache.keys()) if (key >= index) metricCache.delete(key);
          metricCache.set(index, measured);
          return measured;
        };
        const layout = paginatePublicationBlocks(
          measuredBlocks,
          usablePageHeight,
          pageOverhead,
          { heights: noteHeights, lineHeight: noteLineHeight, separatorHeight: noteSeparatorHeight,
            allowPageContinuation: noteStyle.footnoteContinueOnNextPage !== false },
          style.pageStyles ? metrics : undefined,
        );
        const sectionWarnings = layout.sectionWarnings ?? publicationSectionFitWarnings(measuredBlocks, layout,
          () => ({ bodyHeight: usablePageHeight, bodyTop: 0 }));
        const diagnosticCopy = publicationPaginationCopy(locale);
        const issues: PublicationLayoutIssue[] = sectionWarnings.map((warning) => ({
          id: `section:${warning.sectionId}`, sectionId: warning.sectionId,
          message: `${layoutSectionsRef.current.find((section) => section.id === warning.sectionId)?.title || diagnosticCopy.untitled}: ${diagnosticCopy[warning.reason]}`,
        }));
        const presentBlocks = new Set(flow.map((item) => publicationFlowBlockId(item.element) ?? (item.element.classList.contains('publication-document-front-matter') ? PUBLICATION_BODY_START : undefined)));
        for (const insertion of style.pageStyles?.insertions ?? []) if (!presentBlocks.has(insertion.beforeBlockId ?? insertion.afterBlockId)) issues.push({
          id: `insertion:${insertion.id}`, insertionId: insertion.id, message: diagnosticCopy.missingAnchor,
        });
        measuredBlocks.forEach((block, index) => {
          const pageIndex = layout.placements[index]?.pageIndex ?? 0;
          if ((!block.splittable || block.keepTogether) && block.height > metrics(pageIndex, layout.pageSectionIds?.[pageIndex]).bodyHeight + 0.5) issues.push({
            id: `block:${index}`, blockId: publicationFlowBlockId(flow[index]!.element), sectionId: block.sectionId,
            message: diagnosticCopy.blockOverflow,
          });
        });
        reportIssues.current?.(manuscriptId, issues);
        const pageGeometries = Array.from({ length: layout.pageCount }, (_, index) =>
          canvasPageGeometry(resolvePublicationPageStyle(style, layoutSectionsRef.current, index, layout.pageSectionIds?.[index], insertionStyles.get(index)), scale));
        const sheetPositions = arrangePublicationSheets(pageGeometries, facingPages, pageGap).pages;
        const css = buildPaginationCss({
          canvasId,
          flow,
          placements: layout.placements,
          firstPageNumber,
          mirroredMargins: style.page.mirroredMargins,
          innerMargin,
          outerMargin,
          firstPageLeftMargin,
          styledPageGeometry: pageGeometries,
          sheetPositions,
          scale,
        });
        const flowBreaks = layout.flowBreaks.flatMap<OmiPublicationFlowBreak>(
          (flowBreak) => {
            const targetElement = flow[flowBreak.blockIndex]?.element;
            const targetBlockId = targetElement ? publicationFlowBlockId(targetElement) : undefined;
            return targetBlockId
              ? [{
                  targetBlockId,
                  textOffset: flowBreak.textOffset,
                  height: flowBreak.height,
                  ...(facingPages ? continuationProjection(
                    pageGeometries, sheetPositions,
                    layout.placements[flowBreak.blockIndex]!.pageIndex, flowBreak.pageIndex,
                  ) : {}),
                }]
              : [];
          },
        );

        // Read-only previews use the measured line positions; no editable DOM
        // is cloned or modified by thumbnail rendering.
        const validBlockIds = new Set<string>(), blockSectionIds = new Map<string, string>();
        const visitBlocks = (blocks: OmiBlock[], sectionId: string) => { for (const block of blocks) { validBlockIds.add(block.id); blockSectionIds.set(block.id, sectionId); visitBlocks(block.children ?? [], sectionId); } };
        for (const section of layoutSectionsRef.current) visitBlocks(section.blocks, section.id);
        const blockIds = flow.map((item) => publicationFlowBlockId(item.element));
        const thumbnails: PublicationBodyPageThumbnail[] = pageGeometries.map((geometry, index) => {
          const inserted = layout.insertedPages?.find((item) => item.pageIndex === index);
          const insertion = style.pageStyles?.insertions?.find((item) => item.id === inserted?.id);
          const anchorSection = insertion?.beforeBlockId === PUBLICATION_BODY_START ? layoutSectionsRef.current[0]?.id
            : blockSectionIds.get(insertion?.beforeBlockId ?? insertion?.afterBlockId ?? '');
          return { id: inserted ? `inserted:${inserted.id}` : `body:${index}`, insertionId: inserted?.id,
            number: firstPageNumber + index, styleId: resolvePublicationPageStyle(style, layoutSectionsRef.current, index, layout.pageSectionIds?.[index], insertionStyles.get(index)).id,
            width: geometry.width, height: geometry.height, marks: [], studyId: getStudyRootSectionId(layoutSectionsRef.current, layout.pageSectionIds?.[index] ?? anchorSection ?? ''),
          };
        });
        let priorInlineHeight = 0;
        measuredBlocks.forEach((block, index) => {
          const placement = layout.placements[index]; if (!placement) return;
          const id = blockIds[index];
          const anchor = id && validBlockIds.has(id) ? id : blockIds.slice(index + 1).find((candidate) => candidate && validBlockIds.has(candidate));
          const lines = block.lines?.length ? block.lines : [{ top: 0, height: block.height, textOffset: 0 }];
          const breaks = layout.flowBreaks.filter((item) => item.blockIndex === index);
          let page = placement.pageIndex, inline = 0;
          const text = flow[index]!.element.textContent ?? '';
          lines.forEach((line, lineIndex) => {
            for (const point of breaks.filter((item) => item.textOffset === line.textOffset)) { page = point.pageIndex; inline += point.height; }
            const thumbnail = thumbnails[page], geometry = pageGeometries[page]; if (!thumbnail || !geometry) return;
            const y = block.top + line.top + placement.translateY + priorInlineHeight + inline - metrics(page, layout.pageSectionIds?.[page]).bodyTop + geometry.topMargin;
            const count = (lines[lineIndex + 1]?.textOffset ?? text.length) - line.textOffset;
            if (thumbnail.marks.length < 96) thumbnail.marks.push({ x: geometry.left, y: Math.max(0, Math.min(geometry.height, y)),
              width: geometry.bodyWidth * (block.splittable ? Math.min(1, Math.max(0.12, count / 70)) : 1), height: Math.max(1, Math.min(line.height * 0.4, geometry.height)),
              graphic: !block.splittable && !!flow[index]!.element.querySelector('img,svg,table'),
            });
            thumbnail.studyId ??= getStudyRootSectionId(layoutSectionsRef.current, block.sectionId ?? blockSectionIds.get(anchor ?? '') ?? '');
            if (anchor) { thumbnail.firstBlockId ??= anchor; thumbnail.lastBlockId = anchor; }
            if (!thumbnail.id.startsWith('inserted:') && thumbnail.id === `body:${page}`) thumbnail.id = `text:${id ?? `front-${index}`}:${line.textOffset}`;
          });
          priorInlineHeight += breaks.reduce((sum, point) => sum + point.height, 0);
        });
        const frontIndex = flow.findIndex((item) => item.element.classList.contains('publication-document-front-matter'));
        const frontPage = layout.placements[frontIndex]?.pageIndex;
        if (frontPage !== undefined && thumbnails[frontPage]) thumbnails[frontPage]!.firstBlockId = PUBLICATION_BODY_START;
        // Footnote-only sheets use the nearest manuscript boundary for additions.
        thumbnails.forEach((item, index) => {
          item.firstBlockId ??= thumbnails.slice(index + 1).find((next) => next.firstBlockId)?.firstBlockId ?? thumbnails.slice(0, index).reverse().find((previous) => previous.lastBlockId)?.lastBlockId;
          item.lastBlockId ??= item.firstBlockId;
        });
        if (!content.getClientRects().length) return;
        pageCountChange.current?.(manuscriptId, layout.pageCount);
        setPagination((current) => (
          current.pageCount === layout.pageCount
            && JSON.stringify(current.pageNotes) === JSON.stringify(layout.pageNotes ?? [])
            && JSON.stringify(current.pageSectionIds) === JSON.stringify(layout.pageSectionIds)
            && JSON.stringify(current.insertedPages) === JSON.stringify(layout.insertedPages)
            && JSON.stringify(current.sectionWarnings) === JSON.stringify(sectionWarnings)
            && JSON.stringify(current.thumbnails) === JSON.stringify(thumbnails)
            && current.css === css
            && publicationFlowBreaksEqual(current.flowBreaks, flowBreaks)
            ? current
            : { pageCount: layout.pageCount, css, flowBreaks, pageNotes: layout.pageNotes ?? [], pageSectionIds: layout.pageSectionIds, insertedPages: layout.insertedPages, sectionWarnings, thumbnails }
        ));
      };

      measureNotesChunk();
    };
    const schedule = () => {
      if (paginationDebounceMs > 0) {
        if (scheduleTimer !== null) clearTimeout(scheduleTimer);
        scheduleTimer = setTimeout(() => {
          scheduleTimer = null;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(update);
        }, paginationDebounceMs);
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    schedule();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedule);
    resizeObserver?.observe(content);
    if (noteMeasureRef.current) resizeObserver?.observe(noteMeasureRef.current);
    const fonts = content.ownerDocument.fonts;
    const fontsLoaded = () => {
      // Font metrics can change line breaks without changing a block's width.
      measuredLines = new WeakMap();
      schedule();
    };
    fonts?.addEventListener('loadingdone', fontsLoaded);
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          for (const record of records) {
            const target = record.target instanceof Element
              ? record.target
              : record.target.parentElement;
            if (target?.closest('.omi-publication-flow-break')) continue;
            const changedNodes = [...record.addedNodes, ...record.removedNodes];
            if (changedNodes.length > 0 && changedNodes.every((node) => (
              node instanceof HTMLElement && node.matches('.omi-publication-flow-break')
            ))) continue;
            const block = target?.closest<HTMLElement>('[data-block-id]');
            if (block && content.contains(block)) dirtyBlocks.add(block);
          }
          schedule();
        });
    mutationObserver?.observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    if (noteMeasureRef.current) {
      mutationObserver?.observe(noteMeasureRef.current, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    return () => {
      cancelled = true;
      if (scheduleTimer !== null) clearTimeout(scheduleTimer);
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      fonts?.removeEventListener('loadingdone', fontsLoaded);
      mutationObserver?.disconnect();
    };
  }, [
    canvasId,
    manuscriptId,
    locale,
    firstPageLeftMargin,
    firstPageNumber,
    facingPages,
    innerMargin,
    publicationCorrections,
    noteLineHeight,
    noteSeparatorHeight,
    outerMargin,
    paginationDebounceMs,
    pageOverhead,
    pageGap,
    scale,
    topMargin,
    sectionLayoutKey,
    style.page.mirroredMargins,
    style,
    usablePageHeight,
    viewMode,
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
  const author = style.styles.author;
  const authorGivenName = style.styles.authorGivenName;
  const authorFamilyName = style.styles.authorFamilyName;
  const heading1 = style.styles.heading1;
  const heading2 = style.styles.heading2;
  const note = noteStyle;
  const paragraphStyleCss = buildLiveParagraphStyleCss(
    canvasId,
    style,
    scale,
    viewMode,
  ) + '\n' + buildPublicationTextRoleCss(style, viewMode, manuscript.locale, `#${canvasId}`, scale);
  const sectionLayoutCss = buildLiveSectionLayoutCss(
    canvasId,
    manuscript.sections,
    scale,
  );
  const runningHeaderValues = {
    articleTitle: manuscript.title,
    shortArticleTitle: shorten(manuscript.title, 72),
    journalTitle: publisherIdentity.journalTitle || style.name,
    volume: publisherIdentity.issue.volume,
    issue: publisherIdentity.issue.number,
    year: publisherIdentity.issue.year || manuscript.updatedAt.slice(0, 4),
  };
  const publicationStyleVariables = {
    fontFamily: `${style.fonts.body.family}, ${style.fonts.body.fallback}`,
    fontWeight: body.fontWeight,
    fontStyle: body.fontStyle,
    '--omi-publication-page-height': `${pageHeight}px`,
    '--omi-publication-page-gap': `${pageGap}px`,
    '--omi-publication-bleed': `${bleed}px`,
    '--omi-publication-running-header-size': `${style.runningHeaders.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-running-header-rule': style.runningHeaders.rule.enabled
      ? `${Math.max(0.5, style.runningHeaders.rule.width * PIXELS_PER_POINT * scale)}px`
      : '0px',
    '--omi-publication-point': `${PIXELS_PER_POINT * scale}px`,
    '--omi-publication-body-size': `${body.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-body-leading': `${body.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-first-line': `${body.firstLineIndent * PIXELS_PER_MM * scale}px`,
    '--omi-publication-title-size': `${title.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-title-leading': `${title.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-subtitle-size': `${subtitle.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-subtitle-leading': `${subtitle.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-author-size': `${author.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-author-leading': `${author.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-author-weight': String(author.fontWeight),
    '--omi-publication-author-align': viewMode === 'html' && author.alignment === 'justify' ? 'left' : author.alignment,
    '--omi-publication-author-given-weight': String(authorGivenName.fontWeight),
    '--omi-publication-author-given-style': authorGivenName.fontStyle,
    '--omi-publication-author-given-caps': authorGivenName.fontVariantCaps,
    '--omi-publication-author-given-transform': authorGivenName.textTransform,
    '--omi-publication-author-family-weight': String(authorFamilyName.fontWeight),
    '--omi-publication-author-family-style': authorFamilyName.fontStyle,
    '--omi-publication-author-family-caps': authorFamilyName.fontVariantCaps,
    '--omi-publication-author-family-transform': authorFamilyName.textTransform,
    '--omi-publication-heading-one-size': `${heading1.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-one-leading': `${heading1.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-size': `${heading2.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-leading': `${heading2.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-note-separator': `${noteSeparatorHeight}px`,
    '--omi-publication-note-size': `${note.fontSize * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-note-leading': `${note.lineHeight * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-one-before': `${heading1.spaceBefore * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-one-after': `${heading1.spaceAfter * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-before': `${heading2.spaceBefore * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-heading-two-after': `${heading2.spaceAfter * PIXELS_PER_POINT * scale}px`,
    '--omi-publication-body-align': viewMode === 'html' && body.alignment === 'justify' ? 'left' : body.alignment,
    '--omi-publication-hyphens': viewMode === 'print' && body.hyphenation ? 'auto' : 'none',
  } as CSSProperties;
  const pageStyle = viewMode === 'print'
    ? {
        ...publicationStyleVariables,
        width: `${styledSheetLayout.width}px`,
        height: `${styledSheetLayout.height}px`,
        marginTop: `${Math.max(8, bleed + 8)}px`,
        marginBottom: `${Math.max(8, bleed + 8)}px`,
      }
    : publicationStyleVariables;
  const contentStyle = viewMode === 'print'
    ? {
        top: `${topMargin}px`,
        left: `${firstPageLeftMargin}px`,
        width: `${contentWidth}px`,
      } as CSSProperties
    : undefined;
  const studies = partitionManuscriptStudies(manuscript.sections);
  const pageCollection = publicationPageStyles(style);
  const navigationPages = (pagination.thumbnails ?? []).map((item, index) => {
    const studyIndex = studies.findIndex((study) => study.rootSectionId === item.studyId);
    return { ...item,
      label: manuscript.sections.find((section) => section.id === item.studyId)?.title,
      canInsert: !!onStyleChange && (pageCollection.insertions?.length ?? 0) < 100 && (!!item.insertionId || !!item.firstBlockId),
      canDelete: !!onStyleChange && !!item.insertionId,
      moveUpTarget: item.insertionId ? index - 1 : pagination.thumbnails?.findIndex((candidate) => candidate.studyId === studies[studyIndex - 1]?.rootSectionId),
      moveDownTarget: item.insertionId ? index + 1 : pagination.thumbnails?.findIndex((candidate) => candidate.studyId === studies[studyIndex + 1]?.rootSectionId),
      canMoveUp: item.insertionId ? !!onStyleChange && index > 0 : studyIndex > 0,
      canMoveDown: item.insertionId ? !!onStyleChange && index < pagination.pageCount - 1 : studyIndex >= 0 && studyIndex < studies.length - 1,
    };
  });
  const selectedThumbnail = Math.max(0, navigationPages.findIndex((item) => item.id === selectedThumbnailId));
  function selectThumbnail(index: number) {
    const page = navigationPages[index]; if (!page) return;
    setSelectedThumbnailId(page.id);
    setVisiblePageRange({ start: Math.max(0, index - 2), end: Math.min(pageCount, index + 3) });
    requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-page-number="${firstPageNumber + index}"]`)?.scrollIntoView({ block: 'center', inline: 'nearest' }));
  }
  function moveThumbnail(from: number, to: number) {
    const source = navigationPages[from], target = navigationPages[to]; if (!source || !target || from === to) return;
    if (source.insertionId) {
      const insertion = pageCollection.insertions?.find((item) => item.id === source.insertionId);
      if (insertion) onStyleChange?.({ ...style, pageStyles: placePublicationEmptyPage(pageCollection, insertion, target, to < from ? 'before' : 'after') });
    } else if (source.studyId) {
      const targetId = target.studyId !== source.studyId ? target.studyId : undefined;
      if (targetId) stageMoveSectionToSibling(source.studyId, targetId, to > from);
    }
    setSelectedThumbnailId(source.id); pendingThumbnailNavigation.current = source.insertionId ? source.id : `study:${source.studyId}`;
  }
  useEffect(() => {
    const id = pendingThumbnailNavigation.current;
    if (!id) return;
    const index = pagination.thumbnails?.findIndex((item) => id.startsWith('study:') ? item.studyId === id.slice(6) : item.id === id) ?? -1;
    if (index < 0) return;
    pendingThumbnailNavigation.current = null;
    setSelectedThumbnailId(pagination.thumbnails![index]!.id);
    setVisiblePageRange({ start: Math.max(0, index - 2), end: Math.min(pagination.pageCount, index + 3) });
    const frame = requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-page-number="${firstPageNumber + index}"]`)?.scrollIntoView({ block: 'center', inline: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [pagination.thumbnails, pagination.pageCount, firstPageNumber]);
  return (
    <PublicationPreviewContext.Provider value={previewOnly}>
    <section
      id={canvasId}
      className={`publication-document-canvas publication-document-canvas--${viewMode}${previewOnly ? ' publication-document-canvas--preview' : ''}`}
      data-layout-checker-target={navigationTarget ? 'true' : undefined}
      data-layout-checker-section={navigationTarget?.sectionId}
      aria-labelledby="publication-document-canvas-title"
    >
      {pagination.css || paragraphStyleCss || sectionLayoutCss || fitWarningCss || navigationCss
        ? <style>{`${paragraphStyleCss}\n${sectionLayoutCss}\n${viewMode === 'print' ? pagination.css : ''}\n${fitWarningCss}\n${navigationCss}`}</style>
        : null}
      <header className="publication-document-canvas-toolbar">
        <div>
          <strong id="publication-document-canvas-title">{copy.editor}</strong>
          {!previewOnly ? <span>{viewMode === 'print' ? copy.printDescription : copy.htmlDescription}</span> : null}
        </div>
        <div className="publication-document-canvas-status">
          <div className="publication-document-view-switch" role="group" aria-label={copy.view}>
            <button
              type="button"
              aria-pressed={viewMode === 'print'}
              onClick={() => onViewModeChange('print')}
            >
              <FileText size={15} aria-hidden="true" />
              <span>{copy.printLayout}</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'html'}
              onClick={() => onViewModeChange('html')}
            >
              <FileCode2 size={15} aria-hidden="true" />
              <span>{copy.htmlLayout}</span>
            </button>
          </div>
          {viewMode === 'print' ? (
            <>
              <span aria-live="polite">{copy.pages(pageCount)}</span>
              <label>
                <span>{copy.zoom}</span>
                <select
                  value={String(zoom)}
                  onChange={(event) => setZoom(parseZoom(event.target.value))}
                >
                  <option value="fit">{facingPages ? (locale === 'hu' ? 'Oldalpár szélessége' : locale === 'de' ? 'Doppelseitenbreite' : 'Fit spread') : copy.fit}</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                </select>
              </label>
            </>
          ) : (
            <span className="publication-document-responsive-status">{copy.responsiveWidth}</span>
          )}
        </div>
      </header>

      {viewMode === 'print' ? <PublicationPageNavigator pages={navigationPages}
        styles={[{ id: 'default', name: style.name }, ...pageCollection.styles]} selected={selectedThumbnail} help="body"
        onSelect={selectThumbnail} onMove={moveThumbnail}
        onInsert={(index, side, styleId) => {
          const target = navigationPages[index]; if (!target) return;
          const id = crypto.randomUUID();
          onStyleChange?.({ ...style, pageStyles: placePublicationEmptyPage(pageCollection, { id, styleId: styleId === 'default' ? undefined : styleId }, target, side) });
          setSelectedThumbnailId(`inserted:${id}`); pendingThumbnailNavigation.current = `inserted:${id}`;
        }}
        onDelete={(index) => {
          const id = navigationPages[index]?.insertionId;
          if (id) onStyleChange?.({ ...style, pageStyles: { ...pageCollection, insertions: pageCollection.insertions?.filter((item) => item.id !== id) } });
          setSelectedThumbnailId(navigationPages[Math.max(0, index - 1)]?.id ?? '');
        }} /> : null}
      <div
        ref={stageRef}
        className={`publication-document-canvas-stage publication-document-canvas-stage--${viewMode}`}
        aria-label={viewMode === 'print' ? copy.printLayout : copy.htmlLayout}
      >
        {!previewOnly ? <PublicationSectionRuler
          locale={locale}
          viewMode={viewMode}
          widthPx={pageWidth}
          pageWidthMm={pageWidthMm}
          leftMarginMm={firstPageLeftMarginMm}
          rightMarginMm={firstPageRightMarginMm}
          rulerStepPx={5 * PIXELS_PER_MM * scale}
        /> : null}
        <article
          className={`publication-document-paper publication-document-paper--${viewMode}${facingPages && viewMode === 'print' ? ' publication-document-paper--spreads' : ''}`}
          data-publication-view={viewMode}
          style={pageStyle}
          lang={manuscript.locale}
        >
          {viewMode === 'print' ? (
            <>
            <div className="publication-document-page-guides" aria-hidden="true">
            {Array.from({ length: visiblePageEnd - firstVisiblePage }, (_, visibleIndex) => {
              const index = firstVisiblePage + visibleIndex;
              const pageNumber = firstPageNumber + index;
              const geometry = styledPages[index]!;
              const resolved = geometry.resolved;
              const header = pageNumber % 2 === 0 ? resolved.runningHeaders.even : resolved.runningHeaders.odd;
              const showRunningHeader = resolved.runningHeaders.enabled && (!geometry.firstSectionPage || resolved.showFirstPage);
              const headerSection = manuscript.sections.find((section) => section.id === (resolved.headerSectionId ?? geometry.sectionId));
              const headerValues = { ...runningHeaderValues, sectionTitle: headerSection?.title ?? '', shortSectionTitle: shorten(headerSection?.title ?? '', 72), pageNumber: String(pageNumber) };

              return (
                <div
                  className={`publication-document-page-guide${resolved.page.cropMarks ? ' publication-document-page-guide--crop-marks' : ''}${resolved.page.bleed > 0 ? ' publication-document-page-guide--bleed' : ''}`}
                  key={index}
                  style={{
                    top: `${geometry.top}px`,
                    left: `${geometry.x}px`,
                    width: `${geometry.width}px`,
                    height: `${geometry.height}px`,
                    '--omi-publication-bleed': `${resolved.page.bleed * PIXELS_PER_MM * scale}px`,
                    '--omi-publication-page-left-margin': `${geometry.left}px`,
                    '--omi-publication-page-right-margin': `${geometry.right}px`,
                    '--omi-publication-page-top-margin': `${geometry.topMargin}px`,
                    '--omi-publication-page-bottom-margin': `${geometry.bottomMargin}px`,
                  } as CSSProperties}
                  data-page-style={resolved.id}
                  data-inserted-page={pagination.insertedPages?.find((item) => item.pageIndex === index)?.id}
                  data-section-id={geometry.sectionId}
                  data-page-number={pageNumber}
                  data-page-side={geometry.side}
                  data-spread={geometry.spread}
                  data-page-label={copy.page(pageNumber)}
                >
                  {showRunningHeader ? (
                    <div className="publication-document-running-header" style={{ fontSize: resolved.runningHeaders.fontSize * PIXELS_PER_POINT * scale, borderBottomWidth: resolved.runningHeaders.rule.enabled ? resolved.runningHeaders.rule.width * PIXELS_PER_POINT * scale : 0 }}>
                      <span>{fillRunningHeaderTemplate(header.left, headerValues)}</span>
                      <span>{fillRunningHeaderTemplate(header.right, headerValues)}</span>
                    </div>
                  ) : null}
                  {resolved.page.cropMarks ? (
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
            <div className="publication-document-page-separators" aria-hidden="true">
              {Array.from({ length: visiblePageEnd - firstVisiblePage }, (_, visibleIndex) => {
                const index = firstVisiblePage + visibleIndex;
                return (
                  <div
                    className="publication-document-page-separator"
                    key={index}
                    style={{ top: `${styledPages[index]!.top + styledPages[index]!.height}px`, left: styledPages[index]!.x, width: styledPages[index]!.width }}
                    data-page-label={copy.page(firstPageNumber + index)}
                  />
                );
              })}
            </div>
            </>
          ) : null}

          <div
            ref={contentRef}
            className={`publication-document-content publication-document-content--${viewMode}`}
            style={contentStyle}
          >
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
                <p className="publication-document-authors">
                  {contributors.map((contributor, contributorIndex) => (
                    <span className="publication-document-author" key={contributor.contributionId}>
                      {contributorNameParts(contributor).map((part, partIndex) => (
                        <span
                          className={
                            part.kind === 'given'
                              ? 'publication-document-author-given-name'
                              : part.kind === 'family'
                                ? 'publication-document-author-family-name'
                                : 'publication-document-author-literal-name'
                          }
                          key={`${part.kind}-${partIndex}`}
                        >
                          {partIndex > 0 ? ' ' : ''}
                          {part.text}
                        </span>
                      ))}
                      {contributorIndex < contributors.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
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
              {manuscript.keywords.length ? <div className="publication-document-keywords">{manuscript.keywords.join(' · ')}</div> : null}
            </header>

            {manuscript.sections.length ? (
              <div className="publication-document-body" aria-label={copy.body}>
                {viewMode === 'html' ? (
                  <PublicationHtmlSectionsEditor
                    sections={manuscript.sections}
                    sectionNumbers={sectionNumbers}
                    paragraphStyleNextById={paragraphStyleNextById}
                    defaultParagraphStyleId={style.paragraphStyles.defaultStyleId}
                    manuscriptLanguage={manuscript.locale}
                    editable={!previewOnly}
                  />
                ) : (
                  <TablePaginationContext.Provider value={pagination.flowBreaks}>
                    <BlockEditor
                      blockId={`omi-publication-document-${manuscript.id}`}
                      blockType="manuscript"
                      editable={!previewOnly}
                      content={JSON.stringify(document)}
                      onUpdate={updateDocument}
                      manuscriptLanguage={manuscript.locale}
                      className="publication-layout-document-editor"
                      continuous
                      proofingMode="publication"
                      publicationCorrections={publicationCorrections}
                      publicationFlowBreaks={textFlowBreaks}
                      onProofingSelection={onProofingSelection}
                    />
                  </TablePaginationContext.Provider>
                )}
              </div>
            ) : (
              <p className="publication-document-empty">{copy.empty}</p>
            )}

            {viewMode === 'html' && semanticNotes.length ? (
              <section
                className="publication-document-notes publication-document-html-notes"
                role="doc-endnotes"
                aria-labelledby={`${canvasId}-notes-heading`}
              >
                <h2 id={`${canvasId}-notes-heading`}>{copy.notes}</h2>
                <ol>
                  {semanticNotes.map((annotation) => (
                    <li
                      id={`${canvasId}-note-${annotation.id}`}
                      role="doc-endnote"
                      value={annotation.label}
                      key={annotation.id}
                    >
                      <span className="omi-publication-note-body" dangerouslySetInnerHTML={{ __html: annotation.html }} />
                    </li>
                  ))}
                </ol>
              </section>
            ) : viewMode === 'print' && endnotes.length ? (
              <section className="publication-document-notes" aria-label={copy.notes}>
                <ol>
                  {endnotes.map((annotation) => (
                    <li key={annotation.id} value={annotation.label}><span className="omi-publication-note-body" dangerouslySetInnerHTML={{ __html: annotation.html }} /></li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
          {viewMode === 'print' ? (
            <div ref={noteMeasureRef} className="publication-page-footnotes publication-page-footnotes--measure" aria-hidden="true" style={{ width: contentWidth }}>
              {notes.map((note) => (
                <div className="publication-page-note" data-publication-note-id={note.id} key={note.id}>
                  <span className="publication-page-note-label">{note.label}</span><span className="omi-publication-note-body" dangerouslySetInnerHTML={{ __html: note.html }} />
                </div>
              ))}
            </div>
          ) : null}
          {viewMode === 'print' ? pagination.pageNotes.map((fragments, pageIndex) => {
            if (!fragments?.length) return null;
            const geometry = styledPages[pageIndex]!;
            return (
              <section key={pageIndex} className="publication-page-footnotes" data-footnote-page={pageIndex}
                aria-label={`${copy.notes} — ${copy.page(firstPageNumber + pageIndex)}`}
                style={{
                  left: geometry.x + geometry.left,
                  width: geometry.bodyWidth,
                  top: geometry.top + geometry.height - geometry.bottomMargin - noteSeparatorHeight
                    - fragments.reduce((sum, fragment) => sum + fragment.height, 0),
                }}>
                {fragments.map((fragment) => {
                  const note = noteById.get(fragment.id);
                  return note ? (
                    <div key={`${fragment.id}-${fragment.offset}`} className="publication-page-note-fragment"
                      data-publication-note-id={note.id} data-note-continuation={fragment.offset > 0 || undefined}
                      style={{ height: fragment.height }}>
                      <div className="publication-page-note" style={{ transform: `translateY(-${fragment.offset}px)` }}>
                        <span className="publication-page-note-label">{note.label}</span><span className="omi-publication-note-body" dangerouslySetInnerHTML={{ __html: note.html }} />
                      </div>
                    </div>
                  ) : null;
                })}
              </section>
            );
          }) : null}
        </article>
      </div>
    </section>
    </PublicationPreviewContext.Provider>
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
  const previewOnly = useContext(PublicationPreviewContext);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  });

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onChange(event.target.value.replace(/[\r\n]+/g, ' '));
  }

  if (previewOnly) return value ? <div className={className}>{value}</div> : null;

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

function fillRunningHeaderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template
    .replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_match, key: string) => Object.hasOwn(values, key) ? values[key]! : '')
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

function publicationFlowBlockId(element: HTMLElement): string | undefined {
  return element.dataset.blockId ?? element.querySelector<HTMLElement>('[data-block-id]')?.dataset.blockId;
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

/** Use rows as screen pagination units. Subtract prior presentation spacers
 * before measuring, so repeated layout passes converge without changing data. */
function measurePublicationTableRows(element: HTMLElement, table: HTMLTableElement): PublicationFlowLine[] {
  const rootTop = element.getBoundingClientRect().top;
  const spacers = Array.from(table.querySelectorAll<HTMLElement>('.omi-table-page-break'))
    .map((spacer) => spacer.getBoundingClientRect());
  const rows = Array.from(table.rows).filter((row) => !row.classList.contains('omi-table-page-break'));
  const naturalTop = (top: number) => top - rootTop - spacers
    .filter((spacer) => spacer.top < top - 0.5)
    .reduce((sum, spacer) => sum + spacer.height, 0);
  const height = element.getBoundingClientRect().height - spacers.reduce((sum, spacer) => sum + spacer.height, 0);
  const lines = rows.map((row, index) => {
    const rect = row.getBoundingClientRect();
    const top = index === 0 ? 0 : naturalTop(rect.top);
    const bottom = naturalTop(rect.bottom);
    return { textOffset: index, top, height: Math.max(0, bottom - top) };
  });
  const lastRow = lines.at(-1);
  const bottom = lastRow ? lastRow.top + lastRow.height : 0;
  // Editing controls are independent of the final data row. Keeping them in
  // that row's unit could make it taller than a page at smaller zoom settings.
  if (height > bottom) lines.push({ textOffset: rows.length, top: bottom, height: height - bottom });
  return lines;
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
      && Math.abs(other.height - item.height) < 0.01
      && other.shiftX === item.shiftX && other.shiftY === item.shiftY;
  });
}

function buildLiveSectionLayoutCss(
  canvasId: string,
  sections: readonly OmiSection[],
  scale: number,
): string {
  const editor = `#${canvasId} .omi-continuous-tiptap-editor`;
  return sections.map((section) => {
    const firstTabStopMm = section.layout?.tabStopsMm?.[0] ?? 12.5;
    const tabSize = Math.max(2.5, firstTabStopMm) * PIXELS_PER_MM * scale;
    const selector = `${editor} > [data-section-id=${cssStringLiteral(section.id)}]`;
    return `${selector} { tab-size: ${cssPixel(tabSize)}; white-space: pre-wrap; }`;
  }).join('\n');
}

function buildLiveParagraphStyleCss(
  canvasId: string,
  style: PublicationStyle,
  scale: number,
  viewMode: PublicationDocumentViewMode,
): string {
  return style.paragraphStyles.items.filter((item) => item.role !== 'citation' && item.role !== 'note-citation').map((definition) => {
    const resolved = resolvePublicationParagraphStyle(style, definition.id);
    const editor = `#${canvasId} .omi-continuous-tiptap-editor`;
    const assignedSelector = `${editor} > [data-paragraph-style-id=${cssStringLiteral(definition.id)}]`;
    const selector = definition.id === style.paragraphStyles.defaultStyleId
      ? `${assignedSelector}, ${editor} > :is(p, blockquote, ul, ol, pre):not([data-paragraph-style-id])`
      : assignedSelector;
    const hyphenation = viewMode === 'print' && resolved.hyphenation ? 'auto' : 'none';
    return `${selector} { font-family: ${cssStringLiteral(resolved.fontFamily)}, ${cssStringLiteral(style.fonts.body.fallback)}; font-size: ${cssPixel(resolved.fontSize * PIXELS_PER_POINT * scale)}; line-height: ${cssPixel(resolved.lineHeight * PIXELS_PER_POINT * scale)}; font-weight: ${resolved.fontWeight}; font-style: ${resolved.fontStyle}; ${resolved.language ? `-webkit-locale:${cssStringLiteral(resolved.language)};` : ''} text-align: ${viewMode === 'html' && resolved.alignment === 'justify' ? 'left' : resolved.alignment}; text-indent: ${cssPixel(resolved.firstLineIndent * PIXELS_PER_MM * scale)}; margin-top: ${cssPixel(resolved.spaceBefore * PIXELS_PER_POINT * scale)}; margin-bottom: ${cssPixel(resolved.spaceAfter * PIXELS_PER_POINT * scale)}; margin-left: ${cssPixel(resolved.leftIndent * PIXELS_PER_MM * scale)}; margin-right: ${cssPixel(resolved.rightIndent * PIXELS_PER_MM * scale)}; -webkit-hyphens: ${hyphenation}; hyphens: ${hyphenation}; widows: ${Math.max(1, Math.trunc(resolved.widows))}; orphans: ${Math.max(1, Math.trunc(resolved.orphans))}; }`;
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
  styledPageGeometry,
  sheetPositions,
  scale,
}: {
  canvasId: string;
  flow: readonly PublicationFlowElement[];
  placements: readonly { pageIndex: number; translateY: number }[];
  firstPageNumber: number;
  mirroredMargins: boolean;
  innerMargin: number;
  outerMargin: number;
  firstPageLeftMargin: number;
  styledPageGeometry?: ReturnType<typeof canvasPageGeometry>[];
  sheetPositions?: PublicationSheetPosition[];
  scale: number;
}): string {
  return flow.map((block, index) => {
    const placement = placements[index];
    if (!placement) return '';
    const pageNumber = firstPageNumber + placement.pageIndex;
    const pageLeftMargin = mirroredMargins && pageNumber % 2 === 0
      ? outerMargin
      : innerMargin;
    const geometry = styledPageGeometry?.[placement.pageIndex];
    const sheet = sheetPositions?.[placement.pageIndex];
    const translateX = (sheet?.x ?? 0) + (geometry?.left ?? pageLeftMargin) - firstPageLeftMargin;
    const translateY = placement.translateY + (sheet ? sheet.top - sheet.flowTop : 0);
    const computed = geometry ? block.element.ownerDocument.defaultView?.getComputedStyle(block.element) : undefined;
    const horizontalMargins = (parseFloat(computed?.marginLeft ?? '0') || 0) + (parseFloat(computed?.marginRight ?? '0') || 0);
    const blockWidth = geometry ? Math.max(1, geometry.bodyWidth - horizontalMargins) : 0;
    // Keep the assigned master width in scaled points, so a zoom render cannot
    // measure new font sizes against the previous pagination's pixel width.
    const widthPoints = blockWidth / (PIXELS_PER_POINT * scale);
    return `#${canvasId} ${block.selector} { translate: ${cssPixel(translateX)} ${cssPixel(translateY)}; ${geometry ? `width:calc(var(--omi-publication-point) * ${widthPoints});max-width:none;box-sizing:border-box;` : ''} }`;
  }).filter(Boolean).join('\n');
}

function cssPixel(value: number): string {
  const rounded = Math.abs(value) < 0.005 ? 0 : Math.round(value * 100) / 100;
  return `${rounded}px`;
}

function canvasCopy(locale: string): PublicationCanvasCopy {
  if (locale === 'hu') {
    return {
      editor: 'Kiadványszerkesztő',
      printDescription: 'A kézirat tartalma és a nyomtatási stílus ugyanazon a szerkeszthető oldalon látható.',
      htmlDescription: 'A szemantikus HTML5-kiadvány folyamatos, reszponzív nézete közvetlenül szerkeszthető.',
      view: 'Vizuális szerkesztő nézete',
      printLayout: 'Nyomtatási elrendezés',
      htmlLayout: 'HTML5 vizuális szerkesztő',
      responsiveWidth: 'Reszponzív szélesség',
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
      editor: 'Publikationseditor',
      printDescription: 'Manuskriptinhalt und Druckstil erscheinen gemeinsam auf einer bearbeitbaren Seite.',
      htmlDescription: 'Die fortlaufende, responsive Ansicht der semantischen HTML5-Publikation ist direkt bearbeitbar.',
      view: 'Ansicht des visuellen Editors',
      printLayout: 'Drucklayout',
      htmlLayout: 'Visueller HTML5-Editor',
      responsiveWidth: 'Responsive Breite',
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
    editor: 'Publication editor',
    printDescription: 'Manuscript content and print styling appear together on the same editable page.',
    htmlDescription: 'The continuous, responsive semantic HTML5 publication view is directly editable.',
    view: 'Visual editor view',
    printLayout: 'Print layout',
    htmlLayout: 'HTML5 visual editor',
    responsiveWidth: 'Responsive width',
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

function canvasPageGeometry(resolved: ReturnType<typeof resolvePublicationPageStyle>, scale: number) {
  const p = resolved.page, unit = PIXELS_PER_MM * scale;
  const inner = (p.margins.inner + p.gutter) * unit, outer = p.margins.outer * unit;
  const mirrored = p.mirroredMargins && resolved.pageNumber % 2 === 0;
  const width = p.width * unit, height = p.height * unit;
  const topMargin = p.margins.top * unit, bottomMargin = p.margins.bottom * unit;
  return { width, height, topMargin, bottomMargin, left: mirrored ? outer : inner, right: mirrored ? inner : outer,
    bodyHeight: Math.max(10 * unit, height - topMargin - bottomMargin), bodyWidth: Math.max(10 * unit, width - inner - outer) };
}

/** Relative to the block's starting sheet, including mirrored inside margins. */
function continuationProjection(geometry: ReturnType<typeof canvasPageGeometry>[], sheets: PublicationSheetPosition[], from: number, to: number) {
  const start = sheets[from]!, end = sheets[to]!;
  return { shiftX: end.x + geometry[to]!.left - start.x - geometry[from]!.left,
    shiftY: end.top - end.flowTop - (start.top - start.flowTop) };
}
