import type { OmiManuscriptState } from '../types/omi';
import { listOjsIssueTransferTargets } from './ojsIssueTransferTargets';
import { printedPageLabel, type PrintedPageRange } from './ojsIssuePrintedPages';

export const ISSUE_STUDY_CITATION = 'https://openmanuscript.org/extensions/issue-study-citation/1';
export interface IssueStudyCitationMetadata {
  version: 1;
  status: 'planned';
  journalTitle?: string;
  articleDoi?: string;
  issueDoi?: string;
  printIssn?: string;
  onlineIssn?: string;
  volume?: string;
  issue?: string;
  year?: string;
  sectionTitle?: string;
  pages?: string;
  firstPage?: string;
  lastPage?: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function scalar(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  return text && text.length <= 512 && ![...text].some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) ? text : undefined;
}
function localized(value: unknown, locale: string): string | undefined {
  const map = record(value);
  if (!map) return scalar(value);
  const normalized = (key: string) => key.toLowerCase().replaceAll('_', '-');
  const language = normalized(locale).split('-')[0];
  return scalar(map[locale]) || scalar(Object.entries(map).find(([key]) => normalized(key) === normalized(locale))?.[1]) ||
    scalar(Object.entries(map).find(([key]) => normalized(key).split('-')[0] === language)?.[1]) ||
    Object.values(map).map(scalar).find(Boolean);
}
function doi(value: unknown): string | undefined {
  const candidate = scalar(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
  return candidate && /^10\.\d{4,9}\/[^\s<>"']+$/u.test(candidate) ? candidate : undefined;
}
function issn(value: unknown): string | undefined {
  const candidate = scalar(value)?.replaceAll('-', '').toUpperCase();
  if (!candidate || !/^\d{7}[\dX]$/.test(candidate)) return undefined;
  const digits = [...candidate].map(ch => ch === 'X' ? 10 : Number(ch));
  if (digits.reduce((sum, digit, index) => sum + digit * (8 - index), 0) % 11 !== 0) return undefined;
  return candidate.slice(0, 4) + '-' + candidate.slice(4);
}

/** Imported issue metadata is authoritative for planned issue identity. Old
 * imported pages are not final proof pagination; only an explicit reviewed
 * printed range may be added to a publication artifact. */
export function projectIssueStudyCitationMetadata(
  source: OmiManuscriptState, rootSectionId: string, locale: string, reviewedPages?: PrintedPageRange,
): IssueStudyCitationMetadata | undefined {
  const origin = record(source.extensions?.['org.openmanuscript.ojs.issue']);
  if (!origin) return undefined;
  const target = listOjsIssueTransferTargets(source).find(item => item.rootSectionId === rootSectionId);
  if (!target) return undefined;
  const issue = record(origin.issue);
  const context = record(origin.context);
  if (!issue || issue.published !== false || !context || !Array.isArray(origin.sections)) throw new Error('Invalid planned issue metadata.');
  const matches = origin.sections.flatMap(value => {
    const section = record(value);
    if (!Array.isArray(section?.articles)) return [];
    return section.articles.flatMap(item => {
      const article = record(item);
      return article?.rootSectionId === rootSectionId ? [{ article, section }] : [];
    });
  });
  if (matches.length !== 1) throw new Error('Ambiguous article metadata.');
  const { article, section } = matches[0]!;
  const submission = record(article.submission);
  if (!submission || submission.externalId !== String(target.submissionId) ||
      (submission.publicationExternalId !== undefined && submission.publicationExternalId !== String(target.publicationId))) {
    throw new Error('Article citation metadata belongs to another publication.');
  }
  const citation = record(submission.citationMetadata);
  const year = scalar(issue.year);
  const issueDoi = doi(issue.doi);
  const articleDoi = doi(citation?.doi);
  if (articleDoi && issueDoi && articleDoi.toLowerCase() === issueDoi.toLowerCase()) {
    throw new Error('Article DOI must differ from the issue DOI.');
  }
  return {
    version: 1, status: 'planned',
    journalTitle: localized(context.name, locale) || scalar(source.titleMatter?.seriesTitle),
    articleDoi, issueDoi, printIssn: issn(issue.printIssn), onlineIssn: issn(issue.onlineIssn),
    volume: scalar(issue.volume), issue: scalar(issue.number), year: year && /^\d{4}$/.test(year) ? year : undefined,
    sectionTitle: localized(section.title, locale),
    ...(reviewedPages ? { pages: printedPageLabel(reviewedPages), firstPage: String(reviewedPages.firstPrintedPage),
      lastPage: String(reviewedPages.lastPrintedPage) } : {}),
  };
}

export function getIssueStudyCitationMetadata(source: Pick<OmiManuscriptState, 'extensions'>): IssueStudyCitationMetadata | undefined {
  const value = record(source.extensions?.[ISSUE_STUDY_CITATION]);
  if (value?.version !== 1 || value.status !== 'planned') return undefined;
  const result: IssueStudyCitationMetadata = { version: 1, status: 'planned' };
  for (const key of ['journalTitle', 'articleDoi', 'issueDoi', 'printIssn', 'onlineIssn', 'volume', 'issue', 'year', 'sectionTitle', 'pages', 'firstPage', 'lastPage'] as const) {
    const text = scalar(value[key]);
    if (text) result[key] = text;
  }
  return result;
}
