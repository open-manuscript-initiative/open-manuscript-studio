import { createBlankManuscript } from '../../document/createBlankManuscript';
import { ensureManuscriptRevisionStateDigests } from '../../model/revisionIntegrity';
import { mergeOmiDocumentAsStudy } from '../../model/studyImport';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../../model/versioning';
import type { OmiManuscript } from '../../types/omi';
import { createManuscriptFromOjsLaunch } from './importOjsLaunchLocalized';
import type { OjsLaunchPayload } from './importOjsLaunch';

export const OJS_ISSUE_ORIGIN = 'org.openmanuscript.ojs.issue';

type Data = Record<string, unknown>;
interface IssueArticle extends Pick<OjsLaunchPayload, 'submission' | 'contributors' | 'sourceDocument'> {
  submissionExternalId: string;
  publicationExternalId: string;
  sequence: number;
}
interface IssueSection {
  externalId: string;
  title: Record<string, unknown>;
  sequence: number;
  articles: IssueArticle[];
}
export interface OjsIssueHandoff {
  protocol: 'omi-integration/1';
  profile: 'omi-integration/1/ojs';
  kind: 'issue';
  installation: NonNullable<OjsLaunchPayload['installation']>;
  context: Data;
  issue: Data;
  sections: IssueSection[];
}

function record(value: unknown): value is Data {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function id(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
}
function scalar(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}
function localized(value: unknown, locale: string): string {
  if (!record(value)) return scalar(value);
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return scalar(value[locale]) ||
    scalar(Object.entries(value).find(([key]) => key.toLowerCase().split(/[-_]/)[0] === language)?.[1]) ||
    Object.values(value).map(scalar).find(Boolean) || '';
}

export async function fetchOjsIssueHandoff(token: string): Promise<OjsIssueHandoff> {
  const response = await fetch(`/integrations/ojs/issue-handoff/${encodeURIComponent(token)}`, {
    method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`OJS issue handoff failed (HTTP ${response.status}). Open the issue again in OJS.`);
  return await response.json() as OjsIssueHandoff;
}

/** Pure assembly: the active workspace is never modified on incomplete import. */
export function createJournalIssueFromOjsHandoff(launch: OjsIssueHandoff, locale: string): OmiManuscript {
  if (launch?.protocol !== 'omi-integration/1' || launch.profile !== 'omi-integration/1/ojs' ||
      launch.kind !== 'issue' || !scalar(launch.installation?.installationId) ||
      !id(launch.context?.externalId) || !id(launch.issue?.externalId) ||
      launch.issue.published !== false || !Array.isArray(launch.sections)) {
    throw new Error('Invalid OJS planned issue handoff.');
  }
  const issue = launch.issue;
  const journal = localized(launch.context.name, locale) || scalar(launch.installation.displayName) || 'OJS';
  const identification = localized(issue.identification, locale) ||
    [scalar(issue.volume), scalar(issue.number), scalar(issue.year)].filter(Boolean).join(' / ');
  const title = [journal, identification || localized(issue.title, locale)].filter(Boolean).join(' — ');
  const blank = createBlankManuscript({
    kind: 'volume', volumeKind: 'edited-volume', publicationKind: 'journal-issue', locale, title,
    titleMatter: { seriesTitle: journal, publicationYear: scalar(issue.year), issn: scalar(issue.printIssn),
      eissn: scalar(issue.onlineIssn), doi: scalar(issue.doi) },
  });
  let state = extractManuscriptState(blank);
  const seenSections = new Set<string>();
  const seenArticles = new Set<string>();
  const origins: Array<{ externalId: string; title: Record<string, unknown>; sequence: number;
    articles: Array<{ rootSectionId: string; submissionExternalId: string; publicationExternalId: string; sequence: number; sourceFileExternalId?: string; submission: unknown }> }> = [];
  const importedAt = blank.createdAt;
  for (const section of launch.sections) {
    if (!id(section?.externalId) || seenSections.has(section.externalId) ||
        !Number.isFinite(section.sequence) || !Array.isArray(section.articles)) throw new Error('Invalid OJS issue section.');
    seenSections.add(section.externalId);
    const origin: typeof origins[number] = { externalId: section.externalId, title: record(section.title) ? section.title : {},
      sequence: section.sequence, articles: [] };
    for (const article of section.articles) {
      if (!id(article?.submissionExternalId) || !id(article.publicationExternalId) ||
          seenArticles.has(article.submissionExternalId) || !Number.isFinite(article.sequence) ||
          article.submission?.externalId !== article.submissionExternalId ||
          !article.sourceDocument || article.sourceDocument.kind !== 'docx' ||
          !Array.isArray(article.sourceDocument.paragraphs)) throw new Error('Invalid or missing OJS article source.');
      seenArticles.add(article.submissionExternalId);
      const manuscript = createManuscriptFromOjsLaunch({
        protocol: launch.protocol, profile: launch.profile, installation: launch.installation,
        submission: article.submission, contributors: article.contributors, sourceDocument: article.sourceDocument,
      }, { includeSourceNotice: false });
      if (!manuscript) throw new Error(`Could not import OJS article ${article.submissionExternalId}.`);
      const merged = mergeOmiDocumentAsStudy(state, extractManuscriptState(manuscript), { importedAt });
      state = merged.state;
      origin.articles.push({ rootSectionId: merged.rootSectionId,
        submissionExternalId: article.submissionExternalId, publicationExternalId: article.publicationExternalId,
        sequence: article.sequence, sourceFileExternalId: article.sourceDocument.fileExternalId,
        submission: structuredClone(article.submission) });
    }
    origins.push(origin);
  }
  state = {
    ...state,
    extensions: {
      ...state.extensions,
      [OJS_ISSUE_ORIGIN]: {
        version: 1, installationId: launch.installation.installationId, context: structuredClone(launch.context),
        issue: structuredClone(issue), sections: origins, importedAt,
      },
    },
  };
  return ensureManuscriptRevisionStateDigests({
    ...state,
    ...createInitialVersioningEnvelope(state, { summary: 'Imported planned OJS journal issue', timestamp: importedAt, completeness: 'complete' }),
  });
}
