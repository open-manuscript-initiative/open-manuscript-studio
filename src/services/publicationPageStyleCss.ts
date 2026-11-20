import type { OmiSection } from '../types/omi';
import type { PublicationStyle, PublicationPublisherIdentity } from './publicationStyleExport';
import { publicationSectionPageRules, resolvePublicationPageStyle, type PublicationPageStyle } from '../model/publicationPageStyles';
import { cssStringLiteral } from './embeddedCss';

/** Named pages and page-group selectors are consumed by the Vivliostyle PDF engine. */
export function buildPublicationPageStylesCss(style: PublicationStyle, sections: readonly OmiSection[], title: string,
  identity: PublicationPublisherIdentity, year: string, bodyPageOffset = 0): string {
  if (!style.pageStyles) return '';
  const result: string[] = ['.omi-scholarly-article{page:omi_body}'];
  const seen = new Set<string>();
  const all: OmiSection[] = [];
  const visit = (items: readonly OmiSection[]) => { for (const item of items) { if (seen.has(item.id)) continue; seen.add(item.id); all.push(item); visit(item.children ?? []); } };
  visit(sections);
  const sectionNames = new Map(style.pageStyles.sections.map((rule, index) => [rule.sectionId, `omi_section_${index}`]));
  const baseValues = { articleTitle: title, shortArticleTitle: short(title), journalTitle: identity.journalTitle || style.name,
    volume: identity.issue.volume, issue: identity.issue.number, year: identity.issue.year || year };
  const header = (master: PublicationPageStyle, values: Record<string, string>, selector: string, dynamicSection = false) => {
    const h = master.runningHeaders;
    const declarations = `font-family:${cssStringLiteral(style.fonts.body.family)},${cssStringLiteral(style.fonts.body.fallback)};font-size:${h.fontSize}pt;vertical-align:bottom;padding-bottom:1.5mm;border-bottom:${h.rule.enabled ? `${h.rule.width}pt solid currentColor` : '0'};`;
    // CSS page sides follow the printed counter parity, including a non-1 start.
    return (['left', 'right'] as const).map((side) => {
      const fields = side === 'left' ? h.even : h.odd;
      return `@page ${selector}:${side}{@top-left{content:${h.enabled ? content(fields.left, values, dynamicSection) : 'none'};${declarations}}@top-right{content:${h.enabled ? content(fields.right, values, dynamicSection) : 'none'};text-align:right;${declarations}}}`;
    }).join('\n');
  };
  const geometry = (master: PublicationPageStyle, selector: string) => {
    const p = master.page, inner = p.margins.inner + p.gutter, outer = p.margins.outer;
    const base = `size:${p.width}mm ${p.height}mm;margin:${p.margins.top}mm ${outer}mm ${p.margins.bottom}mm ${inner}mm;bleed:${p.bleed}mm;marks:${p.cropMarks ? 'crop' : 'none'};`;
    return `@page ${selector}{${base}}\n@page ${selector}:left{margin-left:${p.mirroredMargins ? outer : inner}mm;margin-right:${p.mirroredMargins ? inner : outer}mm;}`;
  };
  const defaultMaster = resolvePublicationPageStyle({ ...style, pageStyles: { ...style.pageStyles, pages: [] } }, sections, 0);
  result.push(geometry(defaultMaster, 'omi_body'), header(defaultMaster, { ...baseValues, sectionTitle: '', shortSectionTitle: '' }, 'omi_body', true));
  const emitted = new Set<string>(['omi_body']);
  for (const section of all) {
    const rules = publicationSectionPageRules(style, sections, section.id);
    const owner = [...rules].reverse().find((rule) => rule.styleId || rule.runningHeaders);
    const name = owner ? sectionNames.get(owner.sectionId)! : 'omi_body';
    const selector = `.manuscript-section[data-omi-section-id=${cssStringLiteral(section.id)}]`;
    const direct = style.pageStyles.sections.find((item) => item.sectionId === section.id);
    result.push(`${selector}{page:${name};string-set:omi_section_title ${cssStringLiteral(section.title)},omi_short_section_title ${cssStringLiteral(short(section.title))};${direct?.startNewPage ? 'break-before:page;' : ''}}`);
    if (emitted.has(name)) continue;
    emitted.add(name);
    const master = resolvePublicationPageStyle({ ...style, pageStyles: { ...style.pageStyles, pages: [] } }, sections, 0, section.id);
    const ownerSection = all.find((item) => item.id === (owner?.sectionId ?? section.id));
    const values = { ...baseValues, sectionTitle: ownerSection?.title ?? '', shortSectionTitle: short(ownerSection?.title ?? '') };
    result.push(geometry(master, name), header(master, values, name, !owner));
    if (owner && !master.showFirstPage) result.push(`@page ${name}:nth(1 of ${name}){@top-left{content:none}@top-right{content:none}}`);
  }
  // Page-number exceptions have higher specificity and are emitted last. The
  // :nth() index is physical within this body document, independent of counters.
  const names = ['omi_body', ...sectionNames.values()];
  for (const assignment of style.pageStyles.pages) {
    const master = style.pageStyles.styles.find((item) => item.id === assignment.styleId);
    if (!master) continue;
    const from = assignment.from - (style.page.pageNumberStart ?? 1) + 1 + bodyPageOffset;
    const to = assignment.to - (style.page.pageNumberStart ?? 1) + 1 + bodyPageOffset;
    if (to < 1) continue;
    const range = `:nth(n+${Math.max(bodyPageOffset + 1, from)}):nth(-n+${to})`;
    for (const name of names) {
      const ownerId = [...sectionNames].find(([, value]) => value === name)?.[0];
      const section = all.find((item) => item.id === ownerId);
      const values = { ...baseValues, sectionTitle: section?.title ?? '', shortSectionTitle: short(section?.title ?? '') };
      result.push(geometry(master, `${name}${range}`), header(master, values, `${name}${range}`, !ownerId));
      if (!master.showFirstPage) result.push(`@page ${name}${range}:${ownerId ? `nth(1 of ${name})` : `nth(${bodyPageOffset + 1})`}{@top-left{content:none}@top-right{content:none}}`);
    }
  }
  if (!resolvePublicationPageStyle(style, sections, 0).showFirstPage) result.push(`@page omi_body:nth(${bodyPageOffset + 1}){@top-left{content:none}@top-right{content:none}}`);
  return result.join('\n');
}
function short(value: string) { const text = value.replace(/\s+/g, ' ').trim(); return text.length > 72 ? `${text.slice(0, 71).trimEnd()}…` : text; }
function content(template: string, values: Record<string, string>, dynamicSection: boolean) {
  const tokens = template.split(/(\{\{[a-zA-Z][a-zA-Z0-9]*\}\})/g).filter(Boolean);
  const fragments = tokens.map((token) => {
    const match = /^\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}$/.exec(token);
    if (!match) return cssStringLiteral(token);
    const key = match[1]!;
    if (key === 'pageNumber') return 'counter(page)';
    if (dynamicSection && key === 'sectionTitle') return 'string(omi_section_title, first)';
    if (dynamicSection && key === 'shortSectionTitle') return 'string(omi_short_section_title, first)';
    return cssStringLiteral(Object.hasOwn(values, key) ? values[key]! : '');
  });
  return fragments.join(' ') || 'none';
}
