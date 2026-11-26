import type { OmiManuscript } from '../../types/omi';
import { mergeOmiDocumentAsStudy } from '../../model/studyImport';
import { commitManuscriptRevision, extractManuscriptState, type CreateChangeEventInput } from '../../model/versioning';
import { ensureManuscriptRevisionStateDigests } from '../../model/revisionIntegrity';
import { createJournalIssueFromOjsHandoff, fingerprintOjsArticle, OJS_ISSUE_ORIGIN, type OjsIssueHandoff } from './importOjsIssue';
import { createManuscriptFromOjsLaunch } from './importOjsLaunchLocalized';

interface ArticleOrigin {
  rootSectionId: string;
  submissionExternalId: string;
  publicationExternalId: string;
  sequence: number;
  sourceFingerprint?: string;
  sourceFileExternalId?: string;
  submission: unknown;
}
interface SectionOrigin {
  externalId: string;
  title: Record<string, unknown>;
  sequence: number;
  articles: ArticleOrigin[];
}
interface Origin {
  version: 1;
  installationId: string;
  context: Record<string, unknown>;
  issue: Record<string, unknown>;
  sections: SectionOrigin[];
  importedAt: string;
}
function originOf(document: OmiManuscript): Origin | undefined {
  const origin = document.extensions?.[OJS_ISSUE_ORIGIN] as Origin | undefined;
  return origin?.version === 1 && Array.isArray(origin.sections) ? origin : undefined;
}
export function isSameOjsIssue(document: OmiManuscript, launch: OjsIssueHandoff): boolean {
  const origin = originOf(document);
  return !!origin && origin.installationId === launch.installation?.installationId &&
    origin.context?.externalId === launch.context?.externalId && origin.issue?.externalId === launch.issue?.externalId;
}
export type OjsIssueChange = 'new' | 'changed' | 'unchanged' | 'unknown' | 'removed' | 'locally-removed';
export interface OjsIssueReviewItem { id: string; title: string; status: OjsIssueChange; }
export interface OjsIssueReview {
  items: OjsIssueReviewItem[];
  issueMetadataChanged: boolean;
}
function label(value: unknown, id: string): string {
  const title = (value as { title?: Record<string, unknown> } | null)?.title;
  return Object.values(title ?? {}).find((v): v is string => typeof v === 'string' && !!v.trim()) ?? id;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
export function compareOjsIssue(document: OmiManuscript, launch: OjsIssueHandoff): OjsIssueReview {
  if (!isSameOjsIssue(document, launch)) throw new Error('The selected document is not the same OJS issue.');
  if (launch.protocol !== 'omi-integration/1' || launch.profile !== 'omi-integration/1/ojs' ||
      launch.kind !== 'issue' || launch.issue.published !== false || !Array.isArray(launch.sections)) throw new Error('Invalid planned issue.');
  const origin = originOf(document)!;
  const old = new Map<string, { article: ArticleOrigin; section: SectionOrigin }>();
  for (const section of origin.sections) for (const article of section.articles) {
    if (old.has(article.submissionExternalId)) throw new Error('Duplicate local OJS identity.');
    old.set(article.submissionExternalId, { article, section });
  }
  const roots = new Set(document.sections.map(section => section.id));
  const seen = new Set<string>(), sections = new Set<string>();
  const items: OjsIssueReviewItem[] = [];
  for (const section of launch.sections) {
    if (!/^[1-9][0-9]*$/.test(section.externalId) || sections.has(section.externalId) ||
      !Number.isFinite(section.sequence) || !Array.isArray(section.articles)) throw new Error('Invalid issue section.');
    sections.add(section.externalId);
    for (const article of section.articles) {
      const id = article.submissionExternalId;
      if (!/^[1-9][0-9]*$/.test(id) || seen.has(id) || !/^[1-9][0-9]*$/.test(article.publicationExternalId) ||
        article.submission?.externalId !== id || !Number.isFinite(article.sequence) ||
        article.sourceDocument?.kind !== 'docx' || !Array.isArray(article.sourceDocument.paragraphs)) throw new Error('Invalid issue article.');
      seen.add(id);
      const previous = old.get(id);
      const changed = previous && (previous.article.publicationExternalId !== article.publicationExternalId ||
        previous.article.sourceFileExternalId !== article.sourceDocument.fileExternalId ||
        previous.article.sequence !== article.sequence || previous.section.externalId !== section.externalId ||
        previous.section.sequence !== section.sequence || canonical(previous.section.title) !== canonical(section.title) ||
        (previous.article.sourceFingerprint !== undefined && previous.article.sourceFingerprint !== fingerprintOjsArticle(article)));
      const status: OjsIssueChange = !previous ? 'new' : !roots.has(previous.article.rootSectionId) ? 'locally-removed' :
        changed ? 'changed' : previous.article.sourceFingerprint ? 'unchanged' : 'unknown';
      items.push({ id, title: label(article.submission, id), status });
    }
  }
  for (const [id, previous] of old) if (!seen.has(id)) items.push({ id, title: label(previous.article.submission, id), status: 'removed' });
  return { items, issueMetadataChanged: canonical(origin.issue) !== canonical(launch.issue) || canonical(origin.context) !== canonical(launch.context) };
}

/** Explicit additive update only: no existing text, ordering, layout or identity is replaced. */
export function appendNewOjsStudies(document: OmiManuscript, launch: OjsIssueHandoff): OmiManuscript {
  const review = compareOjsIssue(document, launch);
  const additions = new Set(review.items.filter(item => item.status === 'new').map(item => item.id));
  if (!additions.size) return document;
  // Validate the reduced issue through the standard importer before touching local state.
  const filtered = { ...launch, sections: launch.sections.map(section => ({ ...section,
    articles: section.articles.filter(article => additions.has(article.submissionExternalId)),
  })).filter(section => section.articles.length) };
  const validated = originOf(createJournalIssueFromOjsHandoff(filtered, document.locale))!;
  const origin = structuredClone(originOf(document)!);
  let state = extractManuscriptState(document);
  const timestamp = new Date().toISOString();
  const events: CreateChangeEventInput[] = [];
  for (const section of filtered.sections) {
    let target = origin.sections.find(item => item.externalId === section.externalId);
    if (!target) {
      target = { externalId: section.externalId, sequence: section.sequence, title: structuredClone(section.title), articles: [] };
      origin.sections.push(target);
    }
    for (const article of section.articles) {
      const source = createManuscriptFromOjsLaunch({ protocol: launch.protocol, profile: launch.profile,
        installation: launch.installation, submission: article.submission, contributors: article.contributors,
        sourceDocument: article.sourceDocument }, { includeSourceNotice: false });
      if (!source) throw new Error('Could not import new OJS article.');
      const start = state.sections.length;
      const merged = mergeOmiDocumentAsStudy(state, extractManuscriptState(source), { importedAt: timestamp });
      state = merged.state;
      const entry = validated.sections.find(item => item.externalId === section.externalId)!.articles.find(item => item.submissionExternalId === article.submissionExternalId)!;
      target.articles.push({ ...entry, rootSectionId: merged.rootSectionId });
      events.push(...merged.importedSections.map((item, index): CreateChangeEventInput => ({
        operation: 'section.create', targetId: item.id, path: '/sections/' + (start + index), nextValue: item,
      })), ...merged.importedAgents.map((item): CreateChangeEventInput => ({
        operation: 'agent.create', targetId: item.id, path: '/agents/-', nextValue: item,
      })), ...merged.importedContributions.map((item): CreateChangeEventInput => ({
        operation: 'contribution.update', targetId: item.id, path: '/contributions/-', nextValue: item,
      })));
    }
  }
  state.extensions = { ...state.extensions, [OJS_ISSUE_ORIGIN]: origin };
  return ensureManuscriptRevisionStateDigests(commitManuscriptRevision(document, state, {
    summary: 'Added new studies from OJS issue', timestamp, events,
  }));
}
