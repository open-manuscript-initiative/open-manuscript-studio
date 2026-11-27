import type { OmiManuscript } from '../../types/omi';
import { commitManuscriptRevision, extractManuscriptState } from '../../model/versioning';
import { ensureManuscriptRevisionStateDigests } from '../../model/revisionIntegrity';
import { fingerprintOmpVolumeSource as fingerprint, isSameOmpVolume, OMP_VOLUME_ORIGIN, volumeTitleMatter, type OmpVolumeHandoff } from './importOmpVolume';

type Data = Record<string, unknown>;
type Status = 'new' | 'changed' | 'unchanged' | 'unknown' | 'removed' | 'locally-removed';
export interface OmpVolumeReview {
  items: Array<{ id: string; title: string; status: Status }>;
  publicationChanged: boolean;
  representationChanged: boolean;
  metadataChanged: boolean;
  matterChanged: boolean;
  matterConflicts: string[];
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
      fingerprint(previousContributors.filter(person => contributorIds.has(str(person.externalId))) ) !==
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
  return { items, publicationChanged, representationChanged,
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
