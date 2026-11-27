import { readOmpVolumeOrigin } from './ompVolumeOrigin';
import type { OmiManuscriptState } from '../types/omi';
import { collectPublicationContributors } from './publicationRendering';
import { partitionManuscriptStudies } from './sectionStructure';
import { getDocumentStructureProfile } from './documentProfile';

export const PUBLICATION_SHORTCODES = ['imprint', 'editorial-board', 'authors', 'contents', 'journal', 'publisher', 'address', 'contact', 'title', 'volume', 'number', 'year', 'issn', 'eissn', 'isbn', 'doi', 'electronic-isbn', 'series', 'series-number', 'press'] as const;
type Code = typeof PUBLICATION_SHORTCODES[number];
type Data = Record<string, unknown>;
function record(value: unknown): Data {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
}
function localized(value: unknown, locale: string, strict = false): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const object = record(value);
  const normalized = locale.toLowerCase().replaceAll('_', '-');
  const language = normalized.split('-')[0];
  const entries = Object.entries(object).filter(([, item]) => typeof item === 'string' && !!item.trim());
  return [entries.find(([key]) => key.toLowerCase().replaceAll('_', '-') === normalized)?.[1], entries.find(([key]) => key.toLowerCase().split(/[-_]/)[0] === language)?.[1], ...(strict ? [] : Object.values(object))]
    .find((item): item is string => typeof item === 'string' && !!item.trim())?.trim() ?? '';
}
export function publicationShortcodeValues(state: OmiManuscriptState, requestedLocale?: string): Record<Code, string> {
  const origin = record(state.extensions?.['org.openmanuscript.ojs.issue']);
  const ompOrigin = record(readOmpVolumeOrigin(state));
  const ompMatter = record(ompOrigin.publicationMatter), ompSeries = record(ompMatter.series);
  const context = record(origin.context), issue = record(origin.issue), snapshot = record(context.publicationMatter);
  const meta = state.titleMatter, locale = requestedLocale || state.locale;
  const strict = !!requestedLocale;
  const sameLanguage = locale.toLowerCase().split(/[-_]/)[0] === state.locale.toLowerCase().split(/[-_]/)[0];
  const text = (value: unknown) => localized(value, locale, strict);
  const local = (value?: string) => !strict || sameLanguage ? value || '' : '';
  const journal = text(context.name) || local(meta?.seriesTitle);
  const publisher = text(snapshot.publisher) || text(ompMatter.publisher) || text(ompMatter.pressName) || local(meta?.publisherName);
  const address = text(snapshot.address) || text(ompMatter.publicationPlace) || local(meta?.publicationPlace);
  const contact = text(snapshot.contactName);
  let boardIncomplete = false;
  const board = Array.isArray(snapshot.editorialBoard) ? snapshot.editorialBoard.flatMap(value => {
    const group = record(value);
    const names = Array.isArray(group.members) ? group.members.flatMap(member => {
      const person = record(member), name = text(person.localizedNames) || text(person.name), affiliation = text(person.affiliation);
      return name ? [affiliation ? name + ' (' + affiliation + ')' : name] : [];
    }) : [];
    const role = text(group.role);
    if (strict && names.length && !role) boardIncomplete = true;
    return names.length ? [role, ...names].filter(Boolean) : [];
  }).join('\n') : '';
  const structure = getDocumentStructureProfile(state);
  const studies = structure.kind === 'volume' && structure.volumeKind === 'edited-volume' ? partitionManuscriptStudies(state.sections) : [];
  const authorsFor = (id: string) => collectPublicationContributors({ id, agents: state.agents, contributions: state.contributions });
  const contributors = studies.length ? studies.flatMap(study => authorsFor(study.rootSectionId)) : authorsFor(state.id);
  const seenOrcids = new Set<string>();
  const authors = contributors.filter(person => {
    if (!person.orcid) return true;
    if (seenOrcids.has(person.orcid)) return false;
    seenOrcids.add(person.orcid); return true;
  }).map(person => person.displayName).join('\n');
  const originalTitles = new Map<string, unknown>();
  if (Array.isArray(ompOrigin.mappings) && Array.isArray(ompOrigin.chapters)) {
    const chapters = ompOrigin.chapters.map(record);
    for (const value of ompOrigin.mappings) {
      const mapping = record(value);
      const chapter = chapters.find(item => item.externalId === mapping.chapterExternalId);
      if (typeof mapping.rootSectionId === 'string' && chapter) originalTitles.set(mapping.rootSectionId, chapter.title);
    }
  }
  if (Array.isArray(origin.sections)) for (const value of origin.sections) {
    const section = record(value);
    if (Array.isArray(section.articles)) for (const entry of section.articles) {
      const article = record(entry);
      if (typeof article.rootSectionId === 'string') originalTitles.set(article.rootSectionId, record(article.submission).title);
    }
  }
  let contentsIncomplete = false;
  const contents = studies.map(study => {
    const currentTitle = study.sections.find(section => section.id === study.rootSectionId)?.title ?? '';
    const title = strict && !sameLanguage ? text(originalTitles.get(study.rootSectionId)) : currentTitle;
    if (!title) contentsIncomplete = true;
    const names = authorsFor(study.rootSectionId).map(person => person.displayName).join(', ');
    return [names, title].filter(Boolean).join(' — ');
  }).join('\n');
  const issn = meta?.issn || text(issue.printIssn), eissn = meta?.eissn || text(issue.onlineIssn);
  const doi = meta?.doi || text(issue.doi), isbn = meta?.isbn || '', electronicIsbn = meta?.electronicIsbn || '';
  return {
    imprint: [local(meta?.colophon) || [publisher, address, contact].filter(Boolean).join('\n'), local(meta?.copyrightStatement), issn && 'ISSN ' + issn, eissn && 'eISSN ' + eissn, isbn && 'ISBN ' + isbn, electronicIsbn && 'eISBN ' + electronicIsbn, doi && 'DOI ' + doi].filter(Boolean).join('\n'),
    'editorial-board': boardIncomplete ? '' : board, authors, contents: contentsIncomplete ? '' : contents, journal, publisher, address, contact,
    title: strict && !sameLanguage ? text(record(ompOrigin.volume).title) || text(issue.title) || [journal, text(issue.identification)].filter(Boolean).join(' — ') : state.title, volume: text(issue.volume), number: text(issue.number),
    year: meta?.publicationYear || text(issue.year), issn, eissn, isbn, doi,
    'electronic-isbn': electronicIsbn, series: text(ompSeries.title) || local(meta?.seriesTitle),
    'series-number': text(ompSeries.position), press: text(ompMatter.pressName),
  };
}
interface RichNode { type?: string; text?: string; content?: RichNode[]; [key: string]: unknown }
/** Expand on a detached render copy. Never turn external data into HTML or re-expand data as tokens. */
export function resolvePublicationShortcodes(content: string, values: Record<Code, string>, valuesForLanguage?: (locale: string) => Record<Code, string>): { content: string; missing: string[] } {
  const missing = new Set<string>();
  const doc = JSON.parse(content) as RichNode;
  function visit(node: RichNode): RichNode[] {
    if (node.type === 'text' && typeof node.text === 'string') {
      const result: RichNode[] = [];
      const append = (text: string) => { if (text) result.push({ ...node, text }); };
      let offset = 0;
      for (const match of node.text.matchAll(/\[omi:([a-z][a-z0-9-]*)(?::([a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})*))?\]/g)) {
        const index = match.index ?? 0, key = match[1]!;
        append(node.text.slice(offset, index));
        const language = match[2];
        const selected = language ? valuesForLanguage?.(language) : values;
        const value = selected && Object.hasOwn(selected, key) ? selected[key as Code] : '';
        if (!value) { missing.add(language ? key + ':' + language : key); append(match[0]); }
        else value.split(/\r?\n/).forEach((line, i) => { if (i) result.push({ type: 'hardBreak' }); append(line); });
        offset = index + match[0].length;
      }
      append(node.text.slice(offset));
      return result;
    }
    return [{ ...node, ...(node.content ? { content: node.content.flatMap(visit) } : {}) }];
  }
  return { content: JSON.stringify(visit(doc)[0]), missing: [...missing] };
}

/** Shared resolution for editor preview and export; explicit per-token locale wins over frame locale. */
export function resolvePublicationMatterText(content: string, state: OmiManuscriptState, frameLocale?: string) {
  const cache = new Map<string, Record<Code, string>>();
  const forLanguage = (locale: string) => {
    const cached = cache.get(locale);
    if (cached) return cached;
    const values = publicationShortcodeValues(state, locale);
    cache.set(locale, values); return values;
  };
  return resolvePublicationShortcodes(content, frameLocale ? forLanguage(frameLocale) : publicationShortcodeValues(state), forLanguage);
}
