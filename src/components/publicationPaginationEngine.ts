import type { OmiSection } from '../types/omi';
import type { PublicationStyle } from '../services/publicationStyleExport';
import { createPublicationPageStyleResolver } from '../model/publicationPageStyles';
import { getParentSectionId } from '../model/sectionStructure';
import { canvasPageGeometry } from './publicationPageGeometry';
import { createIncrementalPublicationPaginator, createPublicationPageMetricsResolver,
  type PublicationFlowBlock, type PublicationFootnotes, type PublicationPageLayout, type PublicationPageMetricsSnapshot } from './publicationPageLayout';

export interface PublicationPaginationConfiguration {
  style: PublicationStyle;
  sections: readonly OmiSection[];
  scale: number;
  pageGap: number;
  topMargin: number;
  usablePageHeight: number;
  pageOverhead: number;
}

export interface PublicationPaginationResult {
  layout: PublicationPageLayout;
  metricsState: PublicationPageMetricsSnapshot;
}

/** Only section identity and hierarchy are needed for page masters, never body text. */
export function publicationWorkerSections(sections: readonly OmiSection[]): OmiSection[] {
  return sections.map(section => ({
    id: section.id, title: '', blocks: [],
    parentSectionId: getParentSectionId(section),
    ...(section.children?.length ? { children: publicationWorkerSections(section.children) } : {}),
  }));
}

export function createPublicationPaginationEngine(configuration: PublicationPaginationConfiguration) {
  const { style, sections, scale, pageGap, topMargin, usablePageHeight, pageOverhead } = configuration;
  const prepared = createPublicationPageStyleResolver(style, sections);
  const paginator = createIncrementalPublicationPaginator();
  return (blocks: readonly PublicationFlowBlock[], footnotes?: PublicationFootnotes): PublicationPaginationResult => {
    const resolver = createPublicationPageMetricsResolver((index, section, inserted) =>
      canvasPageGeometry(prepared.resolve(index, section, inserted), scale), pageGap, topMargin);
    const layout = paginator.paginate(blocks, usablePageHeight, pageOverhead, footnotes,
      style.pageStyles ? resolver.metrics : undefined,
      style.pageStyles ? { key: prepared, snapshot: resolver.snapshot, restore: resolver.restore } : undefined);
    return { layout, metricsState: resolver.snapshot() };
  };
}

export type PublicationWorkerRequest =
  | { kind: 'configure'; configuration: PublicationPaginationConfiguration }
  | { kind: 'paginate'; id: number; blocks: readonly PublicationFlowBlock[]; footnotes: PublicationFootnotes };
export type PublicationWorkerResponse = { id: number; result: PublicationPaginationResult } | { id: number; failed: true };
