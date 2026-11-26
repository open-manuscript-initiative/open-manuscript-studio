import type { OmiManuscriptState } from '../types/omi';
import { partitionManuscriptStudies } from './sectionStructure';
import type { PublicationArtifactRequest, PublicationArtifactTarget } from '../services/publicationArtifact';

const ORIGIN = 'org.openmanuscript.ojs.issue';
type Data = Record<string, unknown>;
function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OJS issue provenance.');
  return value as Data;
}
function identifier(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid OJS identifier.');
  return Number(value);
}
export interface OjsIssueTransferTarget {
  rootSectionId: string;
  title: string;
  installationId: string;
  contextId: number;
  issueId: number;
  submissionId: number;
  publicationId: number;
}
export function listOjsIssueTransferTargets(state: OmiManuscriptState): OjsIssueTransferTarget[] {
  const raw = state.extensions?.[ORIGIN];
  if (!raw) return [];
  const origin = object(raw);
  if (origin.version !== 1 || typeof origin.installationId !== 'string' || !origin.installationId.trim() ||
      !Array.isArray(origin.sections)) throw new Error('Invalid OJS issue provenance.');
  const issueId = identifier(object(origin.issue).externalId);
  const contextId = identifier(object(origin.context).externalId);
  const roots = new Map<string, OjsIssueTransferTarget>();
  const submissions = new Set<number>();
  for (const value of origin.sections) {
    const section = object(value);
    if (!Array.isArray(section.articles)) throw new Error('Invalid OJS article provenance.');
    for (const item of section.articles) {
      const article = object(item);
      const root = article.rootSectionId;
      const submissionId = identifier(article.submissionExternalId);
      const publicationId = identifier(article.publicationExternalId);
      if (typeof root !== 'string' || !root || roots.has(root) || submissions.has(submissionId)) throw new Error('Ambiguous OJS article identity.');
      submissions.add(submissionId);
      roots.set(root, { rootSectionId: root, title: '', installationId: origin.installationId, contextId, issueId, submissionId, publicationId });
    }
  }
  return partitionManuscriptStudies(state.sections).flatMap(study => {
    const target = roots.get(study.rootSectionId);
    return target ? [{ ...target, title: study.sections.find(s => s.id === study.rootSectionId)?.title ?? '' }] : [];
  });
}
export function issueArtifactInspectRequest(target: OjsIssueTransferTarget, manuscriptId: string): PublicationArtifactRequest {
  return { action: 'inspect', manuscriptId, submissionId: target.submissionId, publicationId: target.publicationId,
    expectedIssueId: target.issueId, expectedInstallationId: target.installationId };
}
export function assertIssueArtifactTarget(expected: OjsIssueTransferTarget, actual: PublicationArtifactTarget): void {
  if (actual.protocol !== 'omi-publication-artifact/1' || actual.published !== false ||
    actual.submissionId !== expected.submissionId || actual.publicationId !== expected.publicationId ||
    actual.issueId !== expected.issueId || actual.contextId !== expected.contextId ||
    actual.installationId !== expected.installationId || !/^[a-f0-9]{64}$/.test(actual.workflowToken ?? '')) {
    throw new Error('OJS issue or publication identity changed. Inspect the original planned issue again.');
  }
}
