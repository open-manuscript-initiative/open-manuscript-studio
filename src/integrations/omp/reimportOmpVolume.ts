import type { OmiManuscript } from '../../types/omi';
import { mergeOmiDocumentAsStudy } from '../../model/studyImport';
import { commitManuscriptRevision, extractManuscriptState, type CreateChangeEventInput } from '../../model/versioning';
import { ensureManuscriptRevisionStateDigests } from '../../model/revisionIntegrity';
import { fingerprintOmpVolumeSource as fingerprint, importedSource, localMap, isSameOmpVolume, OMP_VOLUME_ORIGIN, volumeTitleMatter, type OmpVolumeHandoff } from './importOmpVolume';

type Data = Record<string, unknown>;
type Status = 'new' | 'changed' | 'unchanged' | 'unknown' | 'removed' | 'locally-removed';
export interface OmpVolumeReview {
  items: Array<{ id: string; title: string; status: Status }>;
  publicationChanged: boolean;
  representationChanged: boolean;
  metadataChanged: boolean;
  matterChanged: boolean;
  matterConflicts: string[];
  canAppend: boolean;
}
const obj = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const rows = (value: unknown): Data[] => Array.isArray(value) ? value.map(obj) : [];
const str = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const title = (value: unknown, locale: string, fallback: string): string => {
  const data = obj(value);
  return str(value) || str(data[locale]) || Object.values(data).map(str).find(Boolean) || fallback;
};
const matterKeys = ['publisherName', 'publicationPlace', 'seriesTitle', 'issn', 'eissn', 'isbn', 'electronicIsbn'] as const;
function origin(document: OmiManuscript, launch: OmpVolumeHandoff): Data {
  if (!isSameOmpVolume(document, launch) || launch.protocol !== 'omi-integration/1' ||
      launch.profile !== 'omi-integration/1/omp' || launch.kind !== 'volume') throw new Error('Invalid OMP volume reimport.');
  return obj(document.extensions?.[OMP_VOLUME_ORIGIN]);
}
function matterDiff(document: OmiManuscript, launch: OmpVolumeHandoff, previous: Data) {
  if (!launch.publicationMatter) return { changed: false, conflicts: [], next: {} as Partial<ReturnType<typeof volumeTitleMatter>> };
  const before = volumeTitleMatter({ ...launch, publicationMatter: obj(previous.publicationMatter) }, document.locale);
  const after = volumeTitleMatter(launch, document.locale);
  const conflicts: string[] = [];
  const next: Partial<ReturnType<typeof volumeTitleMatter>> = {};
  for (const key of matterKeys) {
    if (before[key] === after[key]) continue;
    const local = str(document.titleMatter?.[key]);
    if (local !== before[key] && local !== after[key]) conflicts.push(key);
    else next[key] = after[key];
  }
  return { changed: fingerprint(previous.publicationMatter ?? {}) !== fingerprint(launch.publicationMatter), conflicts, next };
}

/** A read-only review; no upstream change is silently applied. Legacy sources have no fingerprint. */
export function compareOmpVolume(document: OmiManuscript, launch: OmpVolumeHandoff): OmpVolumeReview {
  const previous = origin(document, launch);
  if (!Array.isArray(launch.chapters) || !Array.isArray(launch.sources) || !Array.isArray(launch.contributors) ||
      !['full-manuscript', 'chapters'].includes(launch.mode)) throw new Error('Invalid OMP volume sources.');
  const oldChapters = new Map(rows(previous.chapters).map(item => [str(item.externalId), item]));
  const oldMappings = new Map(rows(previous.mappings).map(item => [str(item.chapterExternalId), item]));
  const roots = new Set(document.sections.map(item => item.id));
  const sources = new Map(launch.sources.map(item => [item.chapterExternalId, item.sourceDocument]));
  if (sources.size !== launch.sources.length || (launch.mode === 'full-manuscript' && (sources.size !== 1 || !sources.has(null))) ||
      (launch.mode === 'chapters' && (sources.size !== launch.chapters.length || sources.has(null)))) throw new Error('Incomplete OMP volume source set.');
  const seen = new Set<string>();
  const items: OmpVolumeReview['items'] = [];
  const representationChanged = previous.mode !== launch.mode;
  const publicationChanged = previous.publicationExternalId !== launch.volume.publicationExternalId;
  const previousContributors = rows(previous.contributors);
  for (const chapter of launch.chapters) {
    const id = chapter.externalId;
    const source = sources.get(id);
    if (!/^[1-9][0-9]*$/.test(id) || seen.has(id) || chapter.publicationExternalId !== launch.volume.publicationExternalId ||
        (launch.mode === 'chapters' && (source?.kind !== 'docx' || !Array.isArray(source.paragraphs)))) throw new Error('Invalid OMP chapter source.');
    seen.add(id);
    const old = oldChapters.get(id), mapping = oldMappings.get(id);
    const contributorIds = new Set(chapter.contributorExternalIds);
    const metadataChanged = !!old && (fingerprint(old) !== fingerprint(chapter) ||
      (mapping?.contributorFingerprint ?? fingerprint(previousContributors.filter(person => contributorIds.has(str(person.externalId))))) !==
      fingerprint(launch.contributors.filter(person => contributorIds.has(str(person.externalId)))));
    const changed = metadataChanged || publicationChanged || (mapping && source &&
      (mapping.sourceFileExternalId !== source.fileExternalId ||
        (mapping.sourceFingerprint && mapping.sourceFingerprint !== fingerprint(source))));
    const status: Status = !old ? 'new' : mapping && !roots.has(str(mapping.rootSectionId)) ? 'locally-removed' :
      changed ? 'changed' : !representationChanged && mapping?.sourceFingerprint && source ? 'unchanged' : 'unknown';
    items.push({ id, title: title(chapter.title, document.locale, id), status });
  }
  for (const [id, old] of oldChapters) if (!seen.has(id)) items.push({ id, title: title(old.title, document.locale, id), status: 'removed' });
  if (launch.mode === 'full-manuscript') {
    const source = sources.get(null);
    if (source?.kind !== 'docx' || !Array.isArray(source.paragraphs)) throw new Error('Missing OMP book source.');
    const status: Status = representationChanged || publicationChanged || previous.fullSourceFileExternalId !== source.fileExternalId ||
      (previous.fullSourceFingerprint && previous.fullSourceFingerprint !== fingerprint(source)) ? 'changed' :
      previous.fullSourceFingerprint ? 'unchanged' : 'unknown';
    items.unshift({ id: 'book', title: title(launch.volume.title, document.locale, document.title), status });
  }
  const matter = matterDiff(document, launch, previous);
  const additions = new Set(items.filter(item => item.status === 'new').map(item => item.id));
  const localAgents = new Set(document.agents.map(agent => agent.id));
  const identities = obj(previous.contributorMappings);
  const priorIds = new Set(previousContributors.map(person => str(person.externalId)));
  // Older volumes without explicit mappings must not guess which person is
  // which. New contributors remain safe; shared legacy contributors do not.
  const canAppend = !publicationChanged && !representationChanged && previous.workType === launch.workType &&
    launch.mode === 'chapters' && additions.size > 0 && launch.chapters.filter(chapter => additions.has(chapter.externalId))
      .every(chapter => chapter.contributorExternalIds.every(id => !priorIds.has(id) || localAgents.has(str(identities[id]))));
  return { items, publicationChanged, representationChanged, canAppend,
    metadataChanged: fingerprint(previous.volume) !== fingerprint(launch.volume) || fingerprint(previous.contributors) !== fingerprint(launch.contributors),
    matterChanged: matter.changed, matterConflicts: matter.conflicts };
}

/** Explicit, conflict-free publisher/series refresh only. Never advance source or publication identity. */
export function refreshOmpPublicationMatter(document: OmiManuscript, launch: OmpVolumeHandoff): OmiManuscript {
  const previous = origin(document, launch);
  const review = compareOmpVolume(document, launch);
  if (review.publicationChanged || review.representationChanged) throw new Error('The OMP publication version or representation changed.');
  const matter = matterDiff(document, launch, previous);
  if (!matter.changed) return document;
  if (matter.conflicts.length) throw new Error('Local title matter conflicts with OMP metadata.');
  const state = extractManuscriptState(document);
  const nextOrigin = { ...previous, publicationMatter: structuredClone(launch.publicationMatter) };
  state.titleMatter = { ...state.titleMatter, ...matter.next };
  state.extensions = { ...state.extensions, [OMP_VOLUME_ORIGIN]: nextOrigin };
  return ensureManuscriptRevisionStateDigests(commitManuscriptRevision(document, state, {
    summary: 'Refreshed OMP publication matter metadata', timestamp: new Date().toISOString(),
    events: [{ operation: 'manuscript.snapshot.create', targetId: document.id, path: '/extensions/' + OMP_VOLUME_ORIGIN,
      previousValue: previous, nextValue: nextOrigin }],
  }));
}

/** Explicit additive update: preserve existing chapter content, local order,
 * layout and agent records. Never insert a locally deleted chapter again. */
export function appendNewOmpChapters(document: OmiManuscript, launch: OmpVolumeHandoff): OmiManuscript {
  const previous = origin(document, launch);
  const review = compareOmpVolume(document, launch);
  const additions = new Set(review.items.filter(item => item.status === 'new').map(item => item.id));
  if (!additions.size) return document;
  if (!review.canAppend) throw new Error('OMP chapter additions require the same publication and verified contributor identities.');
  const identities = { ...obj(previous.contributorMappings) };
  const priorChapters = rows(previous.chapters);
  const priorMappings = rows(previous.mappings);
  const priorContributors = rows(previous.contributors);
  const contributorMap = new Map(launch.contributors.map(person => [person.externalId, person]));
  if (contributorMap.size !== launch.contributors.length || launch.contributors.some(person => !/^[1-9][0-9]*$/.test(person.externalId ?? ''))) {
    throw new Error('Invalid OMP contributors.');
  }
  let state = extractManuscriptState(document);
  const timestamp = new Date().toISOString();
  const events: CreateChangeEventInput[] = [];
  const chapters = launch.chapters.filter(chapter => additions.has(chapter.externalId))
    .sort((a, b) => a.sequence - b.sequence || Number(a.externalId) - Number(b.externalId));
  const mappings: Data[] = [];
  const usedContributorIds = new Set<string>();
  const fileIds = new Set(priorMappings.map(mapping => str(mapping.sourceFileExternalId)).filter(Boolean));
  for (const chapter of chapters) {
    const source = launch.sources.find(item => item.chapterExternalId === chapter.externalId)?.sourceDocument;
    if (!source || !/^[1-9][0-9]*$/.test(source.fileExternalId ?? '') || fileIds.has(source.fileExternalId!) ||
        !Number.isFinite(chapter.sequence) || !title(chapter.title, document.locale, '')) throw new Error('Invalid new OMP chapter source.');
    fileIds.add(source.fileExternalId!);
    const contributors = [...new Set(chapter.contributorExternalIds)].map(id => {
      const contributor = contributorMap.get(id);
      if (!contributor) throw new Error('Missing OMP chapter contributor.');
      usedContributorIds.add(id);
      return contributor;
    });
    const imported = importedSource(launch, { externalId: chapter.externalId, primaryLocale: document.locale,
      title: localMap(chapter.title, document.locale), subtitle: localMap(chapter.subtitle, document.locale),
      abstract: localMap(chapter.abstract, document.locale) }, source, contributors);
    const start = state.sections.length;
    const merged = mergeOmiDocumentAsStudy(state, extractManuscriptState(imported), { importedAt: timestamp });
    const replacements = new Map<string, string>();
    contributors.forEach((person, index) => {
      const agent = imported.agents[index];
      const mapped = agent && merged.idMap.get(agent.id);
      const external = person.externalId!;
      if (!mapped) throw new Error('Missing imported OMP contributor identity.');
      const existing = str(identities[external]);
      if (existing) {
        if (!state.agents.some(item => item.id === existing)) throw new Error('Local OMP contributor was removed.');
        replacements.set(mapped, existing);
      } else identities[external] = mapped;
    });
    const newAgents = merged.importedAgents.filter(agent => !replacements.has(agent.id));
    const newContributions = merged.importedContributions.map(item => ({ ...item, agentId: replacements.get(item.agentId) ?? item.agentId }));
    const newAnnotationIds = new Set(merged.state.annotations.slice(state.annotations.length).map(item => item.id));
    state = { ...merged.state, agents: [...state.agents, ...newAgents],
      contributions: [...state.contributions, ...newContributions],
      annotations: merged.state.annotations.map(item => newAnnotationIds.has(item.id) && item.creatorAgentId && replacements.has(item.creatorAgentId)
        ? { ...item, creatorAgentId: replacements.get(item.creatorAgentId)! } : item) };
    mappings.push({ chapterExternalId: chapter.externalId, rootSectionId: merged.rootSectionId,
      sourceFileExternalId: source.fileExternalId, sourceFingerprint: fingerprint(source),
      contributorFingerprint: fingerprint(launch.contributors.filter(person => chapter.contributorExternalIds.includes(person.externalId ?? ''))) });
    events.push(...merged.importedSections.map((item, index): CreateChangeEventInput => ({
      operation: 'section.create', targetId: item.id, path: '/sections/' + (start + index), nextValue: item,
    })), ...newAgents.map((item): CreateChangeEventInput => ({
      operation: 'agent.create', targetId: item.id, path: '/agents/-', nextValue: item,
    })), ...newContributions.map((item): CreateChangeEventInput => ({
      operation: 'contribution.update', targetId: item.id, path: '/contributions/-', nextValue: item,
    })));
  }
  const known = new Set(priorContributors.map(person => str(person.externalId)));
  const nextOrigin = { ...previous, chapters: [...priorChapters, ...structuredClone(chapters)],
    mappings: [...priorMappings, ...mappings], contributorMappings: identities,
    contributors: [...priorContributors, ...structuredClone(launch.contributors.filter(person => usedContributorIds.has(person.externalId ?? '') && !known.has(person.externalId ?? '')))] };
  state.extensions = { ...state.extensions, [OMP_VOLUME_ORIGIN]: nextOrigin };
  events.push({ operation: 'manuscript.snapshot.create', targetId: document.id, path: '/extensions/' + OMP_VOLUME_ORIGIN,
    previousValue: previous, nextValue: nextOrigin });
  return ensureManuscriptRevisionStateDigests(commitManuscriptRevision(document, state, {
    summary: 'Added new chapters from OMP volume', timestamp, events,
  }));
}
