import type { OmiManuscriptState } from '../types/omi';
import type { PublicationTemplate } from './publicationTemplates';

export const OJS_ISSUE_ORIGIN = 'org.openmanuscript.ojs.issue';
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function normalized(value: unknown): string { return text(value).normalize('NFKC').replace(/\s+/gu, ' ').toLowerCase(); }
function issn(value: unknown): string {
  const candidate = text(value).replace(/[-\s]/gu, '').toUpperCase();
  return /^\d{7}[\dX]$/.test(candidate) ? candidate : '';
}
function originOf(state: Pick<OmiManuscriptState, 'extensions'>): RecordValue | undefined {
  const origin = record(state.extensions?.[OJS_ISSUE_ORIGIN]);
  return origin?.version === 1 && Array.isArray(origin.sections) ? origin : undefined;
}
function localLabel(value: unknown, locale: string): string {
  const names = record(value);
  if (!names) return text(value);
  const language = locale.toLowerCase().split(/[-_]/u)[0];
  return text(names[locale]) ||
    text(Object.entries(names).find(([key]) => key.toLowerCase().split(/[-_]/u)[0] === language)?.[1]) ||
    Object.values(names).map(text).find(Boolean) || '';
}
export function ojsIssueSectionLabels(state: Pick<OmiManuscriptState, 'extensions'>, locale: string): Map<string, { id: string; label: string }> {
  const result = new Map<string, { id: string; label: string }>();
  const sections = originOf(state)?.sections;
  if (!Array.isArray(sections)) return result;
  for (const value of sections) {
    const section = record(value);
    if (!section || !text(section.externalId) || !Array.isArray(section.articles)) continue;
    const label = localLabel(section.title, locale);
    if (!label) continue;
    for (const item of section.articles) {
      const root = text(record(item)?.rootSectionId);
      if (root && !result.has(root)) result.set(root, { id: text(section.externalId), label });
    }
  }
  return result;
}

/** Only suggest an unambiguous journal-specific template; never guess from a generic template. */
export function suggestOjsIssueTemplate(state: Pick<OmiManuscriptState, 'extensions' | 'titleMatter'>, templates: PublicationTemplate[]): PublicationTemplate | undefined {
  const origin = originOf(state);
  if (!origin) return undefined;
  const issue = record(origin.issue);
  const context = record(origin.context);
  const names = new Set([normalized(state.titleMatter?.seriesTitle), ...Object.values(record(context?.name) ?? {}).map(normalized)].filter(Boolean));
  const identifiers = new Set([issn(issue?.printIssn), issn(issue?.onlineIssn), issn(state.titleMatter?.issn), issn(state.titleMatter?.eissn)].filter(Boolean));
  const matches = templates.filter(template => template.kind === 'journal-issue' &&
    [issn(template.defaults.issn), issn(template.defaults.eissn)].some(value => identifiers.has(value)));
  if (matches.length) return matches.length === 1 ? matches[0] : undefined;
  const byName = templates.filter(template => template.kind === 'journal-issue' &&
    [normalized(template.association), normalized(template.defaults.seriesTitle)].some(value => names.has(value)) &&
    ![issn(template.defaults.issn), issn(template.defaults.eissn)].some(value => value && identifiers.size && !identifiers.has(value)));
  return byName.length === 1 ? byName[0] : undefined;
}

/** A previous issue's unique identifiers must not become defaults for an OJS issue. */
export function safeOjsIssueTemplate(state: Pick<OmiManuscriptState, 'extensions'>, template: PublicationTemplate): PublicationTemplate {
  if (!originOf(state) || template.kind !== 'journal-issue') return template;
  const defaults = { ...template.defaults };
  for (const field of ['publicationYear', 'doi', 'isbn', 'electronicIsbn', 'otherIdentifiers'] as const) delete defaults[field];
  return { ...template, defaults };
}
