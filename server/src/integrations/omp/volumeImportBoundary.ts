import type { OmpLaunchClaims } from './launchVerifier.js';

type Data = Record<string, unknown>;
const id = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OMP volume manifest object.');
  return value as Data;
}

export function validateOmpLaunchTarget(claims: OmpLaunchClaims, target: 'submission' | 'volume'): void {
  if (target === 'submission') {
    if (claims.volume !== undefined || claims.actorMode === 'volume' || claims.scope?.includes('volume.import.read')) {
      throw new Error('Volume grants cannot launch an individual OMP manuscript.');
    }
    return;
  }
  if (claims.profile !== 'omi-integration/1/omp' || claims.actorMode !== 'volume' ||
      !id(claims.volume?.submissionId) || !id(claims.volume?.publicationId) ||
      !id(claims.context?.externalId) || claims.context?.type !== 'press' || !claims.context?.path ||
      !id(claims.actor?.externalId) || !claims.installationId ||
      claims.submission !== undefined || claims.component !== undefined || claims.reviewAssignment !== undefined ||
      claims.scope?.length !== 1 || claims.scope[0] !== 'volume.import.read' ||
      !claims.apiBaseUrl || !claims.externalBaseUrl ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      claims.iat < 1 || claims.exp <= claims.iat || claims.exp - claims.iat > 300 ||
      !/^[a-f0-9]{32}$/.test(claims.nonce)) {
    throw new Error('A volume-only OMP editorial read assertion is required.');
  }
}

export interface VolumeCandidate extends Data {
  externalId: string;
  chapterExternalId: string | null;
  contentPath: string;
}
export interface VolumePlan {
  context: Data;
  volume: Data;
  doi: string | null;
  publicationMatter?: Data;
  workType: 'authored-work' | 'edited-volume';
  chapters: Data[];
  contributors: Data[];
  mode: 'full-manuscript' | 'chapters';
  candidates: VolumeCandidate[];
}

/** Select one coherent source representation. Never combine the full book and chapter files. */
export function planOmpVolumeImport(value: unknown, claims: OmpLaunchClaims): VolumePlan {
  validateOmpLaunchTarget(claims, 'volume');
  const manifest = object(value);
  const context = object(manifest.context);
  const volume = object(manifest.volume);
  if (manifest.protocol !== 'omi-integration/1' || manifest.profile !== 'omi-integration/1/omp' ||
      manifest.installationId !== claims.installationId || context.externalId !== claims.context?.externalId ||
      context.type !== 'press' || context.path !== claims.context?.path ||
      volume.externalId !== claims.volume?.submissionId || volume.publicationExternalId !== claims.volume?.publicationId ||
      object(manifest.binaryTransfer).available !== true ||
      (manifest.workType !== 'authored-work' && manifest.workType !== 'edited-volume') ||
      !Array.isArray(manifest.chapters) || manifest.chapters.length > 100 ||
      !Array.isArray(manifest.contributors) || !Array.isArray(manifest.sources) || manifest.sources.length > 1000) {
    throw new Error('OMP returned a mismatched or unsupported volume manifest.');
  }
  const chapterIds = new Set<string>();
  const chapters = manifest.chapters.map(object);
  for (const chapter of chapters) {
    if (!id(chapter.externalId) || chapterIds.has(chapter.externalId) ||
        chapter.publicationExternalId !== claims.volume?.publicationId ||
        typeof chapter.sequence !== 'number' || !Number.isFinite(chapter.sequence)) throw new Error('Invalid OMP chapter identity or order.');
    chapterIds.add(chapter.externalId);
  }
  chapters.sort((a, b) => Number(a.sequence) - Number(b.sequence) || String(a.externalId).localeCompare(String(b.externalId), 'en', { numeric: true }));
  const seenFiles = new Set<string>();
  const sources = manifest.sources.map(raw => {
    const source = object(raw);
    const chapter = source.chapterExternalId;
    const genre = String(source.genreKey ?? '').trim().toUpperCase();
    if (!id(source.externalId) || seenFiles.has(source.externalId) ||
        source.contentPath !== `volume-import/files/${source.externalId}/content` ||
        !((chapter === null && genre === 'MANUSCRIPT') || (id(chapter) && chapterIds.has(chapter) && genre === 'CHAPTER')) ||
        !(String(source.mediaType ?? '').toLowerCase() === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          String(source.name ?? '').toLowerCase().endsWith('.docx'))) throw new Error('Invalid or unscoped OMP volume source.');
    seenFiles.add(source.externalId);
    return source as VolumeCandidate;
  });
  const full = sources.find(source => source.chapterExternalId === null);
  const separate = chapters.map(chapter => sources.find(source => source.chapterExternalId === chapter.externalId));
  const complete = separate.length > 0 && separate.every((source): source is VolumeCandidate => source !== undefined);
  const mode = (manifest.workType === 'edited-volume' && complete) || (!full && complete) ? 'chapters' : 'full-manuscript';
  const candidates = mode === 'chapters' ? separate.filter((source): source is VolumeCandidate => source !== undefined) : full ? [full] : [];
  if (!candidates.length) throw new Error('OMP volume has no complete manuscript or complete set of chapter sources.');
  return { context, volume, doi: typeof manifest.doi === 'string' ? manifest.doi : null, workType: manifest.workType,
    ...(manifest.publicationMatter === undefined ? {} : { publicationMatter: object(manifest.publicationMatter) }),
    chapters, contributors: manifest.contributors.map(object), mode, candidates };
}
