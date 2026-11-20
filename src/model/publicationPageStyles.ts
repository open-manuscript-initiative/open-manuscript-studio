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
}
export interface PublicationPageStyleCollection {
  version: 1;
  styles: PublicationPageStyle[];
  sections: PublicationSectionPageRule[];
  /** Inclusive printed body-page numbers; later assignments take precedence. */
  pages: { from: number; to: number; styleId: string }[];
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

/** An explicit descendant overrides its ancestor; unconfigured subsections inherit. */
export function publicationSectionPageRules(style: PublicationStyle, sections: readonly OmiSection[], sectionId?: string): PublicationSectionPageRule[] {
  const map = new Map<string, { section: OmiSection; parent?: string }>();
  const visit = (items: readonly OmiSection[], parent?: string) => {
    for (const section of items) {
      if (map.has(section.id)) continue;
      map.set(section.id, { section, parent: getParentSectionId(section) ?? parent });
      visit(section.children ?? [], section.id);
    }
  };
  visit(sections);
  const result: PublicationSectionPageRule[] = [], seen = new Set<string>();
  let id = sectionId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const rule = style.pageStyles?.sections.find((item) => item.sectionId === id);
    if (rule) result.unshift(rule);
    id = map.get(id)?.parent;
  }
  return result;
}

export function resolvePublicationPageStyle(style: PublicationStyle, sections: readonly OmiSection[], pageIndex: number, sectionId?: string) {
  const collection = publicationPageStyles(style);
  const rules = publicationSectionPageRules(style, sections, sectionId);
  let result = capturePublicationPageStyle(style, 'default', style.name);
  let headerSectionId: string | undefined;
  for (const rule of rules) {
    const master = collection.styles.find((item) => item.id === rule.styleId);
    if (master) { result = master; headerSectionId = rule.sectionId; }
    if (rule.runningHeaders) { result = { ...result, runningHeaders: rule.runningHeaders }; headerSectionId = rule.sectionId; }
    if (rule.showFirstPage !== undefined) result = { ...result, showFirstPage: rule.showFirstPage };
  }
  const number = publicationFirstPageNumber(style.page) + pageIndex;
  const assignment = [...collection.pages].reverse().find((item) => number >= item.from && number <= item.to);
  const master = collection.styles.find((item) => item.id === assignment?.styleId);
  // Explicit pages override the section geometry/header style, while keeping section tokens.
  if (master) result = master;
  return { ...result, headerSectionId, pageNumber: number };
}

/** Reusable formats carry masters, never another document's section/page bindings. */
export function withoutPublicationPageAssignments(style: PublicationStyle): PublicationStyle {
  const next = structuredClone(style);
  if (next.pageStyles) { next.pageStyles.sections = []; next.pageStyles.pages = []; }
  return next;
}

export function removePublicationPageStyle(collection: PublicationPageStyleCollection, id: string): PublicationPageStyleCollection {
  return { ...collection, styles: collection.styles.filter((item) => item.id !== id),
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
      || (rule.styleId !== undefined && !ids.has(rule.styleId as string)) || (rule.showFirstPage !== undefined && typeof rule.showFirstPage !== 'boolean')) fail();
    sectionIds.add(rule.sectionId as string);
    if (rule.runningHeaders !== undefined) header(rule.runningHeaders);
  }
  for (const item of value.pages) if (!record(item) || !ids.has(item.styleId as string) || !Number.isInteger(item.from) || !Number.isInteger(item.to)
    || !finite(item.from, 0, 1_000_000) || !finite(item.to, Number(item.from), 1_000_000)) fail();
}
