import type { OmiManuscriptState } from '../types/omi';
import { collectPublicationContributors } from './publicationRendering';
import { getDocumentStructureProfile } from './documentProfile';
import { partitionManuscriptStudies } from './sectionStructure';
import { getIssueStudyCitationMetadata, projectIssueStudyCitationMetadata } from './issueStudyCitationMetadata';

export const RUNNING_STUDY_FIELDS = ['article-doi', 'article-title', 'short-article-title', 'article-authors'] as const;
export type RunningStudyField = typeof RUNNING_STUDY_FIELDS[number];
export type RunningStudyValues = Record<RunningStudyField, string>;
export const emptyRunningStudyValues = (): RunningStudyValues => ({ 'article-doi': '', 'article-title': '', 'short-article-title': '', 'article-authors': '' });
export function normalizeRunningShortcodes(text: string): string {
  return text.replace(/\[omi:(page-number|article-doi|article-title|short-article-title|article-authors)\]/g, (_, key: string) => '{{' + (key === 'page-number' ? 'pageNumber' : key) + '}}');
}
export function containsStudyRunningShortcodes(text: string): boolean {
  return RUNNING_STUDY_FIELDS.some(key => text.includes('[omi:' + key + ']') || text.includes('{{' + key + '}}'));
}
function short(value: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 72 ? text.slice(0, 71).trimEnd() + '…' : text;
}
export function createRunningStudyFields(state: OmiManuscriptState) {
  const structure = getDocumentStructureProfile(state);
  const values = new Map<string, RunningStudyValues>();
  const authorNames = (id: string) => collectPublicationContributors({ id, agents: state.agents, contributions: state.contributions }).map(person => person.displayName).join(', ');
  const make = (title: string, doi: string, authors: string): RunningStudyValues => ({ 'article-doi': doi, 'article-title': title, 'short-article-title': short(title), 'article-authors': authors });
  if (structure.kind === 'volume' && structure.volumeKind === 'edited-volume') {
    for (const study of partitionManuscriptStudies(state.sections)) {
      const root = study.sections.find(section => section.id === study.rootSectionId);
      if (!root) continue;
      let doi = '';
      try { doi = projectIssueStudyCitationMetadata(state, root.id, state.locale)?.articleDoi ?? ''; } catch { /* invalid identity: never borrow another DOI */ }
      const fields = make(root.title, doi, authorNames(root.id));
      for (const section of study.sections) values.set(section.id, fields);
    }
    return { bySection: values, fallback: emptyRunningStudyValues() };
  }
  const citation = getIssueStudyCitationMetadata(state);
  const doi = citation?.articleDoi ?? (structure.kind === 'study' ? state.titleMatter?.doi ?? '' : '');
  return { bySection: values, fallback: make(state.title, doi, authorNames(state.id)) };
}
export function runningStudyStringName(key: RunningStudyField) { return 'omi_running_' + key.replaceAll('-', '_'); }
