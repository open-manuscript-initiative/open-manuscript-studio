import { createDocumentStructureProfile, getDocumentStructureProfile } from './documentProfile';
import { partitionManuscriptStudies, validateSectionHierarchy } from './sectionStructure';
import { walkManuscriptStructure } from './manuscriptTreeTraversal';
import { publicPublicationManuscript } from './publicationAnnotations';
import { createInitialVersioningEnvelope } from './versioning';
import { ensureManuscriptRevisionStateDigests } from './revisionIntegrity';
import type { OmiManuscript, OmiManuscriptState } from '../types/omi';

/** Collect exact structured identifiers, including note/table rich-text JSON. */
function collectStrings(value: unknown, result: Set<string>): void {
  if (typeof value === 'string') {
    result.add(value);
    if (/^[\s]*[{\[]/.test(value)) {
      try { collectStrings(JSON.parse(value), result); } catch { /* legacy text */ }
    }
  } else if (Array.isArray(value)) {
    value.forEach(item => collectStrings(item, result));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectStrings(item, result));
  }
}

export interface IssueStudyExportOptions {
  /** Uncited bibliography records require an explicit article assignment. */
  additionalBibliographyRecordIds?: readonly string[];
}

/** A fresh standalone export snapshot, not a mutation or a copy of issue history. */
export function projectIssueStudyForExport(issue: OmiManuscript, rootSectionId: string, options: IssueStudyExportOptions = {}): OmiManuscript {
  if (getDocumentStructureProfile(issue).kind !== 'volume' || validateSectionHierarchy(issue.sections).length) {
    throw new Error('Select a valid edited volume or journal issue.');
  }
  const study = partitionManuscriptStudies(issue.sections).find(item => item.rootSectionId === rootSectionId);
  const root = study?.sections.find(section => section.id === rootSectionId);
  if (!study || !root) throw new Error('Study does not exist in this issue.');
  const meta = root.studyMetadata;
  if (!meta) throw new Error('Complete the study metadata before standalone publication.');
  const sectionIds = new Set<string>(), blockIds = new Set<string>();
  for (const item of walkManuscriptStructure(study.sections)) {
    (item.kind === 'section' ? sectionIds : blockIds).add(item.kind === 'section' ? item.section.id : item.block.id);
  }
  const belongs = (id: string) => sectionIds.has(id) || blockIds.has(id);
  if (issue.proofing?.changes.some(change => change.status === 'pending' && blockIds.has(change.targetBlockId))) {
    throw new Error('Resolve pending tracked changes before exporting this study.');
  }
  const publicIssue = publicPublicationManuscript(issue);
  const sections = structuredClone(publicIssue.sections.filter(section => sectionIds.has(section.id)));
  // Keep the complete current subtree, including headings that may be reference targets.
  const annotations = publicIssue.annotations.filter(note => blockIds.has(note.targetBlockId));
  const strings = new Set<string>();
  collectStrings(sections, strings);
  collectStrings(annotations, strings);
  const noteIds = new Set(annotations.map(note => note.id));
  const citations = issue.citations.filter(citation => blockIds.has(citation.targetBlockId) ||
    noteIds.has(citation.targetBlockId) || strings.has(citation.id) || strings.has(citation.anchorId));
  const citationIds = new Set(citations.map(citation => citation.id));
  const citationClusters = (issue.citationClusters ?? []).filter(cluster => blockIds.has(cluster.targetBlockId) ||
    noteIds.has(cluster.targetBlockId) || strings.has(cluster.id) || strings.has(cluster.anchorId));
  if (citationClusters.some(cluster => cluster.citationIds.some(id => !citationIds.has(id)))) throw new Error('Unresolved study citation cluster.');
  const namedAnchors = (issue.namedAnchors ?? []).filter(anchor => belongs(anchor.targetId));
  const localTargets = new Set([...sectionIds, ...blockIds, ...namedAnchors.map(anchor => anchor.id)]);
  const crossReferences = (issue.crossReferences ?? []).filter(ref => blockIds.has(ref.sourceBlockId) ||
    noteIds.has(ref.sourceBlockId) || strings.has(ref.id) || strings.has(ref.anchorId));
  if (crossReferences.some(ref => !localTargets.has(ref.targetId))) throw new Error('A cross-study reference requires editorial resolution before standalone export.');
  const sourceAttributions = (issue.sourceAttributions ?? []).filter(item => belongs(item.sourceObjectId) || noteIds.has(item.sourceObjectId));
  const recordIds = new Set([...citations.map(item => item.target), ...sourceAttributions.map(item => item.targetBibliographicRecordId)]);
  const additional = [...new Set(options.additionalBibliographyRecordIds ?? [])];
  additional.forEach(id => recordIds.add(id));
  const bibliographicRecords = (issue.bibliographicRecords ?? []).filter(record => recordIds.has(record.id));
  if (bibliographicRecords.length !== recordIds.size) throw new Error('Unresolved study bibliographic record.');
  const manuscriptId = crypto.randomUUID();
  const contributions = issue.contributions.filter(item => sectionIds.has(item.targetId) && item.visibility === 'public')
    .map(item => ({ ...item, targetId: item.targetId === rootSectionId ? manuscriptId : item.targetId }));
  const agentIds = new Set(contributions.map(item => item.agentId));
  // Never include unrelated reviewers or issue-level contributors.
  const agents = issue.agents.filter(agent => agentIds.has(agent.id));
  const assets = (issue.assets ?? []).filter(asset => strings.has(asset.id));
  const semanticFields = (issue.semanticFields ?? []).filter(field => field.scope === 'section' && field.sectionId && sectionIds.has(field.sectionId))
    .map(field => field.sectionId === rootSectionId ? { ...field, scope: 'manuscript' as const, sectionId: undefined } : field);
  const state: OmiManuscriptState = {
    schema: issue.schema, id: manuscriptId, version: issue.version, identityModelVersion: issue.identityModelVersion,
    locale: meta.locale, title: root.title || meta.title, subtitle: meta.subtitle, abstract: meta.abstract,
    keywords: meta.keywords ?? [], abstracts: meta.abstracts, keywordsByLocale: meta.keywordsByLocale,
    metadata: meta.scholarlyMetadata, documentStructure: createDocumentStructureProfile('study'),
    citationStyle: issue.citationStyle, sectionNumberingStyle: issue.sectionNumberingStyle,
    crossReferenceNumbering: issue.crossReferenceNumbering, publicationProfile: issue.publicationProfile,
    embeddedPublicationProfile: issue.embeddedPublicationProfile,
    agents, contributions, sections, annotations, citations, citationClusters, bibliographicRecords,
    bibliographyAdditionalRecordIds: additional, sourceAttributions, crossReferences, namedAnchors, assets, semanticFields,
    tombstones: [], createdAt: issue.createdAt, updatedAt: issue.updatedAt,
  };
  const cloned = structuredClone(state);
  return ensureManuscriptRevisionStateDigests({
    ...cloned, ...createInitialVersioningEnvelope(cloned, { summary: 'Standalone study publication projection', timestamp: issue.updatedAt, completeness: 'complete' }),
  });
}
