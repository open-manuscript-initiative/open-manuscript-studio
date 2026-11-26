import { publicationFirstPageNumber } from './publicationSpreads';
import type { OmiSection } from '../types/omi';
import type { PublicationStyle } from '../services/publicationStyleExport';
import { getParentSectionId } from './sectionStructure';

export interface PublicationPageStyle {
  id: string;
  name: string;
  page: PublicationStyle['page'];
  runningHeaders: PublicationStyle['runningHeaders'];
  showFirstPage: boolean;
}
export interface PublicationSectionPageRule {
  sectionId: string;
  styleId?: string;
  startNewPage: boolean;
  runningHeaders?: PublicationStyle['runningHeaders'];
  showFirstPage?: boolean;
  keepTogether?: boolean;
}
/** Stable body boundary, before the rendered title/front matter. */
export const PUBLICATION_BODY_START = 'urn:omi:publication:body:start';
export interface PublicationPageInsertion { id: string; beforeBlockId?: string; afterBlockId?: string; styleId?: string }
export interface PublicationPageStyleCollection {
  version: 1;
  styles: PublicationPageStyle[];
  sections: PublicationSectionPageRule[];
  /** Inclusive printed body-page numbers; later assignments take precedence. */
  pages: { from: number; to: number; styleId: string }[];
  /** Deliberate empty pages anchored to stable manuscript block IDs. */
  insertions?: PublicationPageInsertion[];
}

/** Invalidate page measurements for structure/layout changes, not every keystroke. */
export function publicationSectionLayoutKey(sections: readonly OmiSection[]): string {
  const visit = (section: OmiSection): unknown[] => [section.id, getParentSectionId(section), section.layout, (section.children ?? []).map(visit)];
  return JSON.stringify(sections.map(visit));
}

export function publicationPageStyles(style: PublicationStyle): PublicationPageStyleCollection {
  return style.pageStyles ?? { version: 1, styles: [], sections: [], pages: [] };
}

export function capturePublicationPageStyle(style: PublicationStyle, id: string, name: string): PublicationPageStyle {
  return { id, name, page: structuredClone(style.page), runningHeaders: structuredClone(style.runningHeaders), showFirstPage: style.firstPage.showRunningHeader };
}

/** Prepare lookup indexes once for an immutable publication layout snapshot.
 * Consumers must create a new resolver when style or section hierarchy changes.
 */
export function createPublicationPageStyleResolver(style: PublicationStyle, sections: readonly OmiSection[]) {
  const collection = publicationPageStyles(style);
  const parents = new Map<string, string | undefined>();
  const visit = (items: readonly OmiSection[], parent?: string) => {
    for (const section of items) {
      if (parents.has(section.id)) continue;
      parents.set(section.id, getParentSectionId(section) ?? parent);
      visit(section.children ?? [], section.id);
    }
  };
  visit(sections);
  const rulesById = new Map<string, PublicationSectionPageRule>();
  for (const rule of collection.sections) if (!rulesById.has(rule.sectionId)) rulesById.set(rule.sectionId, rule);
  const masters = new Map<string, PublicationPageStyle>();
  for (const master of collection.styles) if (!masters.has(master.id)) masters.set(master.id, master);
  const rulesCache = new Map<string | undefined, PublicationSectionPageRule[]>();
  const defaultMaster = capturePublicationPageStyle(style, 'default', style.name);
  const firstPageNumber = publicationFirstPageNumber(style.page);
  const rules = (sectionId?: string): PublicationSectionPageRule[] => {
    const cached = rulesCache.get(sectionId);
    if (cached) return cached;
    const result: PublicationSectionPageRule[] = [], seen = new Set<string>();
    let id = sectionId;
    while (id && !seen.has(id)) {
      seen.add(id);
      const rule = rulesById.get(id);
      if (rule) result.unshift(rule);
      id = parents.get(id);
    }
    rulesCache.set(sectionId, result);
    return result;
  };
  const resolve = (pageIndex: number, sectionId?: string, insertedStyleId?: string) => {
    let result = defaultMaster;
    let headerSectionId: string | undefined;
    for (const rule of rules(sectionId)) {
      const master = rule.styleId === undefined ? undefined : masters.get(rule.styleId);
      if (master) { result = master; headerSectionId = rule.sectionId; }
      if (rule.runningHeaders) { result = { ...result, runningHeaders: rule.runningHeaders }; headerSectionId = rule.sectionId; }
      if (rule.showFirstPage !== undefined) result = { ...result, showFirstPage: rule.showFirstPage };
    }
    const number = firstPageNumber + pageIndex;
    // Later physical-page assignments win, including an assignment to a
    // missing master (which falls back to the section master).
    for (let index = collection.pages.length - 1; index >= 0; index -= 1) {
      const assignment = collection.pages[index]!;
      if (number < assignment.from || number > assignment.to) continue;
      result = masters.get(assignment.styleId) ?? result;
      break;
    }
    if (insertedStyleId !== undefined) result = masters.get(insertedStyleId) ?? defaultMaster;
    return { ...result, headerSectionId, pageNumber: number };
  };
  return { rules, resolve };
}

/** An explicit descendant overrides its ancestor; unconfigured subsections inherit. */
export function publicationSectionPageRules(style: PublicationStyle, sections: readonly OmiSection[], sectionId?: string): PublicationSectionPageRule[] {
  return createPublicationPageStyleResolver(style, sections).rules(sectionId);
}

export function resolvePublicationPageStyle(style: PublicationStyle, sections: readonly OmiSection[], pageIndex: number, sectionId?: string, insertedStyleId?: string) {
  return createPublicationPageStyleResolver(style, sections).resolve(pageIndex, sectionId, insertedStyleId);
}

/** Reusable formats carry masters, never another document's section/page bindings. */
export function withoutPublicationPageAssignments(style: PublicationStyle): PublicationStyle {
  const next = structuredClone(style);
  if (next.pageStyles) { next.pageStyles.sections = []; next.pageStyles.pages = []; delete next.pageStyles.insertions; }
  return next;
}

export function removePublicationPageStyle(collection: PublicationPageStyleCollection, id: string): PublicationPageStyleCollection {
  return { ...collection, styles: collection.styles.filter((item) => item.id !== id),
    insertions: collection.insertions?.map((item) => item.styleId === id ? { ...item, styleId: undefined } : item),
    pages: collection.pages.filter((item) => item.styleId !== id),
    sections: collection.sections.map((item) => item.styleId === id ? { ...item, styleId: undefined } : item) };
}

export function validatePublicationPageStyles(value: unknown): asserts value is PublicationPageStyleCollection {
  function fail(): never { throw new Error('Invalid publication page styles.'); }
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const text = (v: unknown, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const header = (v: unknown) => {
    if (!record(v) || typeof v.enabled !== 'boolean' || !finite(v.fontSize, 1, 100) || v.font !== 'body'
      || !record(v.rule) || typeof v.rule.enabled !== 'boolean' || !finite(v.rule.width, 0, 20)) fail();
    for (const fields of [v.even, v.odd]) if (!record(fields) || ![fields.left, fields.right].every((s) => typeof s === 'string' && s.length <= 1000)) fail();
  };
  if (!record(value) || value.version !== 1 || !Array.isArray(value.styles) || value.styles.length > 100
    || !Array.isArray(value.sections) || value.sections.length > 5000 || !Array.isArray(value.pages) || value.pages.length > 5000) fail();
  // PDF exceptions are emitted for each named section page group. Bound the
  // cross product as well as individual collections before allocating CSS.
  const groups = 1 + value.sections.filter((item) => record(item) && (item.styleId || item.runningHeaders)).length;
  if (groups * value.pages.length > 4096) fail();
  const ids = new Set<string>(), sectionIds = new Set<string>();
  for (const item of value.styles) {
    if (!record(item) || !text(item.id) || ids.has(item.id as string) || !text(item.name) || typeof item.showFirstPage !== 'boolean' || !record(item.page)) fail();
    ids.add(item.id as string);
    const p = item.page;
    if (!finite(p.width, 50, 1200) || !finite(p.height, 50, 1200) || !record(p.margins)
      || ![p.margins.top, p.margins.bottom, p.margins.inner, p.margins.outer].every((v) => finite(v, 0, 600))
      || !finite(p.gutter, 0, 600) || !finite(p.bleed, 0, 100) || typeof p.mirroredMargins !== 'boolean' || typeof p.cropMarks !== 'boolean' || (p.facingPages !== undefined && typeof p.facingPages !== 'boolean')
      || Number(p.margins.top) + Number(p.margins.bottom) > Number(p.height) - 10
      || Number(p.margins.inner) + Number(p.margins.outer) + Number(p.gutter) > Number(p.width) - 10) fail();
    header(item.runningHeaders);
  }
  for (const rule of value.sections) {
    if (!record(rule) || !text(rule.sectionId) || sectionIds.has(rule.sectionId as string) || typeof rule.startNewPage !== 'boolean'
      || (rule.styleId !== undefined && !ids.has(rule.styleId as string)) || (rule.showFirstPage !== undefined && typeof rule.showFirstPage !== 'boolean')
      || (rule.keepTogether !== undefined && typeof rule.keepTogether !== 'boolean')) fail();
    sectionIds.add(rule.sectionId as string);
    if (rule.runningHeaders !== undefined) header(rule.runningHeaders);
  }
  for (const item of value.pages) if (!record(item) || !ids.has(item.styleId as string) || !Number.isInteger(item.from) || !Number.isInteger(item.to)
    || !finite(item.from, 0, 1_000_000) || !finite(item.to, Number(item.from), 1_000_000)) fail();
  if (value.insertions !== undefined) {
    if (!Array.isArray(value.insertions) || value.insertions.length > 100) fail();
    const insertionIds = new Set<string>();
    for (const item of value.insertions) {
      if (!record(item) || !text(item.id) || insertionIds.has(item.id as string) || (text(item.beforeBlockId) === text(item.afterBlockId))
        || (item.beforeBlockId !== undefined && !text(item.beforeBlockId)) || (item.afterBlockId !== undefined && !text(item.afterBlockId))
        || (item.styleId !== undefined && !ids.has(item.styleId as string))) fail();
      insertionIds.add(item.id as string);
    }
  }
}
