import { sha256HexSync } from '../../model/stateDigest';
import { createBlankManuscript } from '../../document/createBlankManuscript';
import { ensureManuscriptRevisionStateDigests } from '../../model/revisionIntegrity';
import { mergeOmiDocumentAsStudy } from '../../model/studyImport';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../../model/versioning';
import { createPublicationMatter, PUBLICATION_MATTER_EXTENSION } from '../../model/publicationMatter';
import type { OmiManuscript, OmiManuscriptState } from '../../types/omi';
import { createManuscriptFromOjsLaunch } from '../ojs/importOjsLaunchLocalized';
import type { OjsSourceDocument } from '../ojs/importOjsLaunch';
import { createManuscriptFromOmpLaunch, type OmpLaunchPayload } from './importOmpLaunch';

export const OMP_VOLUME_ORIGIN = 'org.openmanuscript.omp.volume';
type Data = Record<string, unknown>;
type Contributor = NonNullable<OmpLaunchPayload['contributors']>[number];
type Submission = NonNullable<OmpLaunchPayload['submission']>;
interface VolumeChapter extends Data {
  externalId: string;
  publicationExternalId: string;
  sequence: number;
  contributorExternalIds: string[];
}
export interface OmpVolumeHandoff {
  protocol: 'omi-integration/1';
  profile: 'omi-integration/1/omp';
  kind: 'volume';
  installation: NonNullable<OmpLaunchPayload['installation']>;
  context: Data;
  volume: Submission & Data & { externalId: string; publicationExternalId: string };
  doi: string | null;
  publicationMatter?: Data;
  workType: 'authored-work' | 'edited-volume';
  chapters: VolumeChapter[];
  contributors: Contributor[];
  mode: 'full-manuscript' | 'chapters';
  sources: Array<{ chapterExternalId: string | null; sourceDocument: OjsSourceDocument }>;
}

const record = (value: unknown): value is Data => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const id = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
function localized(value: unknown, locale: string): string {
  if (!record(value)) return text(value);
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return text(value[locale]) || text(Object.entries(value).find(([key]) => key.toLowerCase().split(/[-_]/)[0] === language)?.[1])
    || Object.values(value).map(text).find(Boolean) || '';
}
function localMap(value: unknown, locale: string): Data {
  return record(value) ? value : text(value) ? { [locale]: text(value) } : {};
}
/** Keep distinct format identifiers; do not guess an edition when ambiguous. */
export function volumeTitleMatter(launch: OmpVolumeHandoff, locale: string) {
  const matter = record(launch.publicationMatter) ? launch.publicationMatter : {};
  const series = record(matter.series) ? matter.series : {};
  const formats = Array.isArray(matter.formats) ? matter.formats.filter(record) : [];
  const isbnFor = (physical: boolean): string => {
    const identifiers = formats.filter(format => format.physical === physical).flatMap(format =>
      Array.isArray(format.identifiers) ? format.identifiers.filter(record) : []);
    const values = (code: string) => [...new Set(identifiers.filter(item => item.type === code)
      .map(item => text(item.value).replace(/[\s-]/g, '').toUpperCase())
      .filter(value => code === '15' ? /^97[89]\d{10}$/.test(value) : /^\d{9}[\dX]$/.test(value)))];
    const thirteen = values('15'), ten = values('02');
    return thirteen.length === 1 ? thirteen[0]! : thirteen.length === 0 && ten.length === 1 ? ten[0]! : '';
  };
  return { doi: text(launch.doi), publisherName: localized(matter.publisher, locale) || localized(matter.pressName, locale),
    publicationPlace: localized(matter.publicationPlace, locale), seriesTitle: localized(series.title, locale),
    issn: text(series.printIssn), eissn: text(series.onlineIssn), isbn: isbnFor(true), electronicIsbn: isbnFor(false) };
}
/** Compare upstream source content, not the locally edited manuscript. */
export function fingerprintOmpVolumeSource(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (record(item)) return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]));
    return item;
  };
  return sha256HexSync(new TextEncoder().encode(JSON.stringify(canonical(value))));
}
export async function fetchOmpVolumeHandoff(token: string): Promise<OmpVolumeHandoff> {
  const response = await fetch(`/integrations/omp/volume-handoff/${encodeURIComponent(token)}`, {
    method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('The OMP volume handoff has expired or failed. Open the volume again in OMP.');
  return await response.json() as OmpVolumeHandoff;
}
export function isSameOmpVolume(manuscript: OmiManuscriptState, launch: OmpVolumeHandoff): boolean {
  const origin = manuscript.extensions?.[OMP_VOLUME_ORIGIN];
  return record(origin) && origin.installationId === launch.installation?.installationId
    && origin.contextExternalId === launch.context?.externalId
    && origin.submissionExternalId === launch.volume?.externalId;
}
function importedSource(launch: OmpVolumeHandoff, submission: Submission, sourceDocument: OjsSourceDocument | undefined,
  contributors: Contributor[]): OmiManuscript {
  const locale = submission.primaryLocale || 'en';
  // Reuse rich DOCX conversion but retain native OMP contributor roles.
  const identity = createManuscriptFromOmpLaunch({ protocol: launch.protocol, profile: launch.profile,
    submission, contributors, installation: launch.installation });
  const rich = createManuscriptFromOjsLaunch({ protocol: launch.protocol, profile: launch.profile,
    submission: { externalId: submission.externalId, primaryLocale: locale,
      title: localMap(submission.title, locale), subtitle: localMap(submission.subtitle, locale),
      abstract: localMap(submission.abstract, locale), keywords: submission.keywords },
    ...(sourceDocument ? { sourceDocument } : {}),
  }, { includeSourceNotice: false });
  if (!identity || !rich) throw new Error('Unable to assemble an OMP manuscript.');
  return { ...rich, agents: identity.agents, contributions: identity.contributions.map(item => ({ ...item, targetId: rich.id })) };
}

/** Atomic assembly; incomplete inputs do not mutate the workspace. */
export function createVolumeFromOmpHandoff(launch: OmpVolumeHandoff, fallbackLocale: string): OmiManuscript {
  if (launch?.protocol !== 'omi-integration/1' || launch.profile !== 'omi-integration/1/omp' || launch.kind !== 'volume'
      || !text(launch.installation?.installationId) || !id(launch.context?.externalId)
      || !id(launch.volume?.externalId) || !id(launch.volume?.publicationExternalId)
      || !['authored-work', 'edited-volume'].includes(launch.workType)
      || !['full-manuscript', 'chapters'].includes(launch.mode)
      || !Array.isArray(launch.chapters) || !Array.isArray(launch.contributors) || !Array.isArray(launch.sources)) {
    throw new Error('Invalid OMP volume handoff.');
  }
  const locale = text(launch.volume.primaryLocale) || fallbackLocale || 'en';
  const title = localized(launch.volume.title, locale);
  if (!title) throw new Error('The OMP volume title is missing.');
  const contributorMap = new Map<string, Contributor>();
  for (const contributor of launch.contributors) {
    if (!id(contributor.externalId) || contributorMap.has(contributor.externalId)) throw new Error('Invalid OMP contributor identity.');
    contributorMap.set(contributor.externalId, contributor);
  }
  const chapterIds = new Set<string>();
  for (const chapter of launch.chapters) {
    if (!id(chapter.externalId) || chapterIds.has(chapter.externalId) ||
        chapter.publicationExternalId !== launch.volume.publicationExternalId || !Number.isFinite(chapter.sequence) ||
        !Array.isArray(chapter.contributorExternalIds) ||
        chapter.contributorExternalIds.some(key => !contributorMap.has(key))) throw new Error('Invalid OMP chapter or contributor association.');
    chapterIds.add(chapter.externalId);
  }
  const chapters = [...launch.chapters].sort((a, b) => a.sequence - b.sequence || Number(a.externalId) - Number(b.externalId));
  const sourceByChapter = new Map<string | null, OjsSourceDocument>();
  const fileIds = new Set<string>();
  for (const item of launch.sources) {
    if ((item.chapterExternalId !== null && !chapterIds.has(item.chapterExternalId)) || sourceByChapter.has(item.chapterExternalId) ||
        item.sourceDocument?.kind !== 'docx' || !id(item.sourceDocument.fileExternalId) ||
        fileIds.has(item.sourceDocument.fileExternalId) || !Array.isArray(item.sourceDocument.paragraphs)) {
      throw new Error('Invalid, duplicate or missing OMP source.');
    }
    sourceByChapter.set(item.chapterExternalId, item.sourceDocument);
    fileIds.add(item.sourceDocument.fileExternalId);
  }
  if (launch.mode === 'full-manuscript' ? sourceByChapter.size !== 1 || !sourceByChapter.has(null)
      : !chapters.length || sourceByChapter.size !== chapters.length || chapters.some(chapter => !sourceByChapter.has(chapter.externalId))) {
    throw new Error('Incomplete or mixed OMP volume sources.');
  }
  const blank = createBlankManuscript({ kind: 'volume', volumeKind: launch.workType === 'authored-work' ? 'monograph' : 'edited-volume',
    publicationKind: 'volume', locale, title, titleMatter: volumeTitleMatter(launch, locale) });
  const volumeContributors = launch.workType === 'edited-volume' && launch.mode === 'chapters'
    ? launch.contributors.filter(contributor => contributor.isEditor) : launch.contributors;
  const book = importedSource(launch, { ...launch.volume, primaryLocale: locale }, sourceByChapter.get(null), volumeContributors);
  let state: OmiManuscriptState = { ...extractManuscriptState(blank),
    subtitle: book.subtitle, abstract: book.abstract, keywords: book.keywords,
    abstracts: book.abstracts, keywordsByLocale: book.keywordsByLocale,
    agents: book.agents, contributions: book.contributions.map(item => ({ ...item, targetId: blank.id })),
  };
  const mappings: Array<{ chapterExternalId: string; rootSectionId: string; sourceFileExternalId?: string; sourceFingerprint?: string }> = [];
  if (launch.mode === 'full-manuscript') {
    // Keep the native DOCX hierarchy. Do not guess chapter boundaries.
    state = { ...extractManuscriptState(book), id: blank.id, createdAt: blank.createdAt, updatedAt: blank.updatedAt,
      title, locale, titleMatter: blank.titleMatter, documentStructure: blank.documentStructure,
      contributions: book.contributions.map(item => ({ ...item, targetId: blank.id })), extensions: blank.extensions };
  } else {
    const sharedAgents = new Map<string, string>();
    volumeContributors.forEach((contributor, index) => {
      const agent = book.agents[index];
      if (contributor.externalId && agent) sharedAgents.set(contributor.externalId, agent.id);
    });
    for (const chapter of chapters) {
      const source = sourceByChapter.get(chapter.externalId)!;
      const chapterContributors = [...new Set(chapter.contributorExternalIds)].map(key => contributorMap.get(key)!);
      if (!localized(chapter.title, locale)) throw new Error('An OMP chapter title is missing.');
      const imported = importedSource(launch, { externalId: chapter.externalId, primaryLocale: locale,
        title: localMap(chapter.title, locale), subtitle: localMap(chapter.subtitle, locale), abstract: localMap(chapter.abstract, locale) },
        source, chapterContributors);
      const merged = mergeOmiDocumentAsStudy(state, extractManuscriptState(imported), { importedAt: blank.createdAt });
      state = merged.state;
      const replacements = new Map<string, string>();
      chapterContributors.forEach((contributor, index) => {
        const localAgent = imported.agents[index];
        const remapped = localAgent && merged.idMap.get(localAgent.id);
        const external = contributor.externalId;
        if (!remapped || !external) return;
        const known = sharedAgents.get(external);
        if (known) replacements.set(remapped, known);
        else sharedAgents.set(external, remapped);
      });
      state = { ...state, agents: state.agents.filter(agent => !replacements.has(agent.id)),
        contributions: state.contributions.map(item => ({ ...item, agentId: replacements.get(item.agentId) ?? item.agentId })),
        annotations: state.annotations.map(item => item.creatorAgentId && replacements.has(item.creatorAgentId)
          ? { ...item, creatorAgentId: replacements.get(item.creatorAgentId)! } : item) };
      mappings.push({ chapterExternalId: chapter.externalId, rootSectionId: merged.rootSectionId, sourceFileExternalId: source.fileExternalId, sourceFingerprint: fingerprintOmpVolumeSource(source) });
    }
  }
  state = { ...state, extensions: { ...state.extensions,
    [PUBLICATION_MATTER_EXTENSION]: createPublicationMatter(state),
    [OMP_VOLUME_ORIGIN]: { version: 1, installationId: launch.installation.installationId,
      contextExternalId: launch.context.externalId, submissionExternalId: launch.volume.externalId,
      publicationExternalId: launch.volume.publicationExternalId, workType: launch.workType, mode: launch.mode,
      context: structuredClone(launch.context), volume: structuredClone(launch.volume),
      publicationMatter: structuredClone(launch.publicationMatter ?? {}),
      chapters: structuredClone(chapters), contributors: structuredClone(launch.contributors),
      mappings, fullSourceFileExternalId: sourceByChapter.get(null)?.fileExternalId,
      fullSourceFingerprint: sourceByChapter.has(null) ? fingerprintOmpVolumeSource(sourceByChapter.get(null)) : undefined,
      importedAt: blank.createdAt },
  } };
  return ensureManuscriptRevisionStateDigests({ ...state,
    ...createInitialVersioningEnvelope(state, { summary: 'Imported OMP volume', timestamp: blank.createdAt, completeness: 'complete' }) });
}
