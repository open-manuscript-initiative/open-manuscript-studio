import type { OmiManuscriptState } from '../types/omi';
import { collectPublicationContributors } from './publicationRendering';
import { partitionManuscriptStudies } from './sectionStructure';
import { getDocumentStructureProfile } from './documentProfile';

export const PUBLICATION_SHORTCODES = ['imprint', 'editorial-board', 'authors', 'contents', 'journal', 'publisher', 'address', 'contact', 'title', 'volume', 'number', 'year', 'issn', 'eissn', 'isbn', 'doi'] as const;
type Code = typeof PUBLICATION_SHORTCODES[number];
type Data = Record<string, unknown>;
function record(value: unknown): Data {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
}
function localized(value: unknown, locale: string): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const object = record(value);
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return [object[locale], Object.entries(object).find(([key]) => key.toLowerCase().split(/[-_]/)[0] === language)?.[1], ...Object.values(object)]
    .find((item): item is string => typeof item === 'string' && !!item.trim())?.trim() ?? '';
}
export function publicationShortcodeValues(state: OmiManuscriptState): Record<Code, string> {
  const origin = record(state.extensions?.['org.openmanuscript.ojs.issue']);
  const context = record(origin.context), issue = record(origin.issue), snapshot = record(context.publicationMatter);
  const meta = state.titleMatter, locale = state.locale;
  const text = (value: unknown) => localized(value, locale);
  const journal = text(context.name) || meta?.seriesTitle || '';
  const publisher = text(snapshot.publisher) || meta?.publisherName || '';
  const address = text(snapshot.address) || meta?.publicationPlace || '';
  const contact = text(snapshot.contactName);
  const board = Array.isArray(snapshot.editorialBoard) ? snapshot.editorialBoard.flatMap(value => {
    const group = record(value);
    const names = Array.isArray(group.members) ? group.members.flatMap(member => {
      const person = record(member), name = text(person.name), affiliation = text(person.affiliation);
      return name ? [affiliation ? name + ' (' + affiliation + ')' : name] : [];
    }) : [];
    return names.length ? [text(group.role), ...names].filter(Boolean) : [];
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
  const contents = studies.map(study => {
    const title = study.sections.find(section => section.id === study.rootSectionId)?.title ?? '';
    const names = authorsFor(study.rootSectionId).map(person => person.displayName).join(', ');
    return [names, title].filter(Boolean).join(' — ');
  }).join('\n');
  const issn = meta?.issn || text(issue.printIssn), eissn = meta?.eissn || text(issue.onlineIssn);
  const doi = meta?.doi || text(issue.doi), isbn = meta?.isbn || '';
  return {
    imprint: [meta?.colophon || [publisher, address, contact].filter(Boolean).join('\n'), meta?.copyrightStatement, issn && 'ISSN ' + issn, eissn && 'eISSN ' + eissn, isbn && 'ISBN ' + isbn, doi && 'DOI ' + doi].filter(Boolean).join('\n'),
    'editorial-board': board, authors, contents, journal, publisher, address, contact,
    title: state.title, volume: text(issue.volume), number: text(issue.number),
    year: meta?.publicationYear || text(issue.year), issn, eissn, isbn, doi,
  };
}
interface RichNode { type?: string; text?: string; content?: RichNode[]; [key: string]: unknown }
/** Expand on a detached render copy. Never turn external data into HTML or re-expand data as tokens. */
export function resolvePublicationShortcodes(content: string, values: Record<Code, string>): { content: string; missing: string[] } {
  const missing = new Set<string>();
  const doc = JSON.parse(content) as RichNode;
  function visit(node: RichNode): RichNode[] {
    if (node.type === 'text' && typeof node.text === 'string') {
      const result: RichNode[] = [];
      const append = (text: string) => { if (text) result.push({ ...node, text }); };
      let offset = 0;
      for (const match of node.text.matchAll(/\[omi:([a-z][a-z0-9-]*)\]/g)) {
        const index = match.index ?? 0, key = match[1]!;
        append(node.text.slice(offset, index));
        const value = Object.hasOwn(values, key) ? values[key as Code] : '';
        if (!value) { missing.add(key); append(match[0]); }
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
