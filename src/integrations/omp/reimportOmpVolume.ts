import { collectCrossReferenceAnchors } from '../../model/crossReferences';
import { textFromAtomicBlock } from '../../model/atomicTextBlocks';
import { getParentSectionId, partitionManuscriptStudies } from '../../model/sectionStructure';
import type { OmiManuscriptState, OmiBlock, OmiSection, OmiAnnotation, OmiBibliographicRecord, OmiManuscript } from '../../types/omi';
import { mergeOmiDocumentAsStudy } from '../../model/studyImport';
import { commitManuscriptRevision, extractManuscriptState, type CreateChangeEventInput } from '../../model/versioning';
import { ensureManuscriptRevisionStateDigests } from '../../model/revisionIntegrity';
import { fingerprintOmpVolumeSource as fingerprint, importedSource, localMap, isSameOmpVolume, OMP_VOLUME_ORIGIN, volumeTitleMatter, type OmpVolumeHandoff } from './importOmpVolume';

type Data = Record<string, unknown>;
type Status = 'new' | 'changed' | 'unchanged' | 'unknown' | 'removed' | 'locally-removed';
export interface OmpVolumeReview {
  items: Array<{ id: string; title: string; status: Status; reviewedLocal?: boolean }>;
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
    const decision = obj(obj(previous.chapterReviewDecisions)[id]);
    const reviewedLocal = status === 'changed' && source && decision.action === 'keep-local' &&
      decision.incomingFingerprint === incomingChapterFingerprint(launch, id);
    items.push({ id, title: title(chapter.title, document.locale, id), status, ...(reviewedLocal ? { reviewedLocal: true } : {}) });
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

export interface OmpChapterPreviewText { text: string; truncated: boolean }
export interface OmpChapterPreview {
  original: OmpChapterPreviewText | null;
  local: OmpChapterPreviewText;
  incoming: OmpChapterPreviewText;
  sourceChanged: boolean | null;
  localTextChanged: boolean | null;
  canKeepLocal: boolean;
  canAcceptIncoming: boolean;
}
function incomingChapterFingerprint(launch: OmpVolumeHandoff, id: string): string {
  const chapter = launch.chapters.find(item => item.externalId === id);
  const source = launch.sources.find(item => item.chapterExternalId === id)?.sourceDocument;
  if (!chapter || !source) throw new Error('Missing OMP chapter.');
  return fingerprint([chapter, source, launch.contributors.filter(person => chapter.contributorExternalIds.includes(person.externalId ?? ''))]);
}
const PREVIEW_LIMIT = 24000;
function chapterText(state: OmiManuscriptState, rootSectionId?: string): OmpChapterPreviewText {
  const sections = rootSectionId ? partitionManuscriptStudies(state.sections).find(item => item.rootSectionId === rootSectionId)?.sections ?? [] : state.sections;
  const parts: string[] = [];
  let length = 0, truncated = false;
  const add = (value: string) => {
    if (!value) return;
    const remaining = PREVIEW_LIMIT - length;
    if (value.length > remaining) truncated = true;
    if (remaining > 0) { parts.push(value.slice(0, remaining)); length += Math.min(value.length, remaining) + 1; }
  };
  const blocks = new Set<string>();
  const visit = (block: OmiBlock) => {
    blocks.add(block.id);
    add(textFromAtomicBlock(block.content));
    block.children?.forEach(visit);
  };
  for (const section of sections) {
    add(section.title);
    section.blocks.forEach(visit);
  }
  for (const note of state.annotations) if (note.type === 'note' && blocks.has(note.targetBlockId)) add(textFromAtomicBlock(note.body));
  return { text: parts.join('\n'), truncated };
}
/** Preview only; the historical import snapshot is not reconstructed from guesses.
 * Plain text is intentionally not a rich-content merge or a formatting diff. */
export function previewOmpChapter(document: OmiManuscript, launch: OmpVolumeHandoff, id: string): OmpChapterPreview {
  const previous = origin(document, launch);
  const review = compareOmpVolume(document, launch);
  const item = review.items.find(entry => entry.id === id);
  const mapping = rows(previous.mappings).find(entry => entry.chapterExternalId === id);
  const chapter = launch.chapters.find(entry => entry.externalId === id);
  const source = launch.sources.find(entry => entry.chapterExternalId === id)?.sourceDocument;
  const root = str(mapping?.rootSectionId);
  if (item?.status !== 'changed' || !root || !chapter || !source || launch.mode !== 'chapters' || previous.mode !== 'chapters' ||
      !document.sections.some(section => section.id === root)) throw new Error('No comparable OMP chapter.');
  const incoming = importedSource(launch, { externalId: id, primaryLocale: document.locale,
    title: localMap(chapter.title, document.locale), subtitle: localMap(chapter.subtitle, document.locale),
    abstract: localMap(chapter.abstract, document.locale) }, source,
    launch.contributors.filter(person => chapter.contributorExternalIds.includes(person.externalId ?? '')));
  const sourceHash = str(mapping?.sourceFingerprint);
  const baseline = sourceHash ? document.revisionHistory.revisions.find(revision => {
    const snapshot = revision.snapshot.state;
    const historic = rows(obj(snapshot.extensions?.[OMP_VOLUME_ORIGIN]).mappings).find(entry => entry.chapterExternalId === id);
    return historic?.sourceFingerprint === sourceHash && historic.rootSectionId === root && snapshot.sections.some(section => section.id === root);
  })?.snapshot.state : undefined;
  const original = baseline ? chapterText(baseline, root) : null;
  const local = chapterText(document, root);
  return { original, local, incoming: chapterText(incoming), sourceChanged: sourceHash ? sourceHash !== fingerprint(source) : null,
    localTextChanged: original && !original.truncated && !local.truncated ? original.text !== local.text : null,
    canKeepLocal: !review.publicationChanged && !review.representationChanged && previous.workType === launch.workType,
    canAcceptIncoming: !!planOmpChapterReplacement(document, launch, id, incoming, baseline) };
}

/** Record an explicit editorial decision without claiming the new source was imported. */
export function keepLocalOmpChapter(document: OmiManuscript, launch: OmpVolumeHandoff, id: string): OmiManuscript {
  const previous = origin(document, launch);
  if (!previewOmpChapter(document, launch, id).canKeepLocal) throw new Error('Chapter review requires the same publication and representation.');
  const decisions = obj(previous.chapterReviewDecisions);
  const incomingFingerprint = incomingChapterFingerprint(launch, id);
  if (obj(decisions[id]).incomingFingerprint === incomingFingerprint && obj(decisions[id]).action === 'keep-local') return document;
  const timestamp = new Date().toISOString();
  const nextOrigin = { ...previous, chapterReviewDecisions: { ...decisions,
    [id]: { action: 'keep-local', incomingFingerprint, reviewedAt: timestamp } } };
  const state = extractManuscriptState(document);
  state.extensions = { ...state.extensions, [OMP_VOLUME_ORIGIN]: nextOrigin };
  return ensureManuscriptRevisionStateDigests(commitManuscriptRevision(document, state, {
    summary: 'Kept local OMP chapter after review', timestamp,
    events: [{ operation: 'manuscript.snapshot.create', targetId: document.id,
      path: '/extensions/' + OMP_VOLUME_ORIGIN, previousValue: previous, nextValue: nextOrigin }],
  }));
}

/** Deliberately small allowlist of text-only Tiptap nodes. Anchors, hyperlinks,
 * media, arbitrary attributes and unknown extensions require a richer merge. */
function safeTextBlock(block: OmiBlock, allowNotes = false): boolean {
  if (!['paragraph', 'heading'].includes(block.type) || block.visual || block.children?.length) return false;
  function safeNode(value: unknown): boolean {
    const node = obj(value);
    if (allowNotes && node.type === 'omiCitation') {
      const attrs = obj(node.attrs);
      return Object.keys(node).every(key => key === 'type' || key === 'attrs') &&
        Object.keys(attrs).every(key => ['citationId', 'citationIds', 'clusterId', 'anchorId', 'label'].includes(key)) &&
        !!str(attrs.citationId) && !!str(attrs.anchorId) && !!str(attrs.clusterId) &&
        Array.isArray(attrs.citationIds) && attrs.citationIds.length > 0 && attrs.citationIds.every(id => !!str(id));
    }
    if (allowNotes && node.type === 'omiNote') {
      const attrs = obj(node.attrs);
      return Object.keys(node).every(key => key === 'type' || key === 'attrs') &&
        Object.keys(attrs).every(key => ['noteId', 'anchorId', 'label', 'noteType'].includes(key)) &&
        !!str(attrs.noteId) && !!str(attrs.anchorId) && ['footnote', 'endnote'].includes(str(attrs.noteType));
    }
    if (!['doc', 'paragraph', 'heading', 'text', 'hardBreak'].includes(str(node.type)) ||
        Object.keys(node).some(key => !['type', 'text', 'content', 'attrs', 'marks'].includes(key))) return false;
    if (node.attrs !== undefined && (node.type !== 'heading' ||
        Object.keys(obj(node.attrs)).some(key => key !== 'level') ||
        ![1, 2, 3, 4, 5, 6].includes(Number(obj(node.attrs).level)))) return false;
    if (node.type === 'text' && typeof node.text !== 'string') return false;
    if (node.marks !== undefined && (!Array.isArray(node.marks) || !node.marks.every(mark =>
      ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript'].includes(str(obj(mark).type)) &&
      Object.keys(obj(mark)).every(key => key === 'type')))) return false;
    return node.content === undefined || (Array.isArray(node.content) && node.content.every(safeNode));
  }
  const raw = block.content.trimStart();
  if (!raw.startsWith('{') && !raw.startsWith('[')) return true;
  try { return safeNode(JSON.parse(raw)); } catch { return false; }
}
/** Native DOCX import currently emits these self-contained visuals.
 * Preserve them verbatim; asset-backed and edited graphics remain review-only. */
function preservedVisual(block: OmiBlock): boolean {
  if (block.content !== '' || block.children?.length || !block.visual) return false;
  const visual = obj(block.visual);
  if (block.type !== visual.kind) return false;
  if (visual.kind === 'image') return typeof visual.src === 'string' &&
    /^data:image\/(png|jpeg|gif|webp|bmp|tiff);base64,/i.test(visual.src) &&
    Object.keys(visual).every(key => ['kind', 'src', 'mediaType', 'fileName', 'alt'].includes(key));
  if (visual.kind === 'table' || visual.kind === 'chart') {
    const cells = visual.cells;
    return Array.isArray(cells) && cells.every(row => Array.isArray(row) && row.every(cell => typeof cell === 'string')) &&
      Object.keys(visual).every(key => (visual.kind === 'table' ? ['kind', 'cells', 'headerRows'] : ['kind', 'cells', 'chartType', 'title']).includes(key));
  }
  return false;
}
function sameVisual(a: OmiBlock, b: OmiBlock): boolean {
  if (!preservedVisual(a) || !preservedVisual(b)) return false;
  const { id: _a, ...old } = a;
  const { id: _b, ...incoming } = b;
  return fingerprint(old) === fingerprint(incoming);
}
function chapterSections(state: OmiManuscriptState, root: string): OmiSection[] {
  return partitionManuscriptStudies(state.sections).find(study => study.rootSectionId === root)?.sections ?? [];
}
type NoteWithBody = OmiAnnotation & { bodyContent?: string };
interface ChapterReplacementPlan { sections: OmiSection[]; annotations: OmiAnnotation[] }
function noteMarkers(block: OmiBlock, type = 'omiNote'): Data[] {
  const markers: Data[] = [];
  const visit = (value: unknown) => {
    const node = obj(value);
    if (node.type === type) markers.push(obj(node.attrs));
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  try { visit(JSON.parse(block.content)); } catch { /* legacy text */ }
  return markers;
}
function remapNoteMarkers(block: OmiBlock, map: Map<string, string>): string {
  if (!map.size) return block.content;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (typeof value === 'string') return map.get(value) ?? value;
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return value;
  };
  return JSON.stringify(visit(JSON.parse(block.content)));
}
function noteStructure(note: NoteWithBody): Data {
  const { id: _id, anchorId: _anchor, targetBlockId: _target, body: _body, bodyContent: _rich,
    createdAt: _created, modifiedAt: _modified, ...other } = note;
  return other;
}
function safeNoteBody(note: NoteWithBody): boolean {
  return typeof note.body === 'string' && (!note.bodyContent ||
    safeTextBlock({ id: note.id, type: 'paragraph', content: note.bodyContent }));
}
/** Compare bibliography semantics without the importer's generated IDs/timestamps. */
function recordSignature(record: OmiBibliographicRecord): string {
  const { id: _id, createdAt: _created, modifiedAt: _modified, contributors, ...rest } = record;
  return fingerprint({ ...rest, contributors: contributors.map(({ id: _contributorId, ...person }) => person) });
}
function withoutImportTimes(value: Data): Data {
  const { createdAt: _created, modifiedAt: _modified, ...rest } = value;
  return rest;
}
function planOmpChapterReplacement(document: OmiManuscript, launch: OmpVolumeHandoff, id: string,
  incoming: OmiManuscript, baseline: OmiManuscriptState | undefined): ChapterReplacementPlan | null {
  const previous = origin(document, launch);
  if (!baseline || previous.publicationExternalId !== launch.volume.publicationExternalId ||
      previous.mode !== 'chapters' || launch.mode !== 'chapters' || previous.workType !== launch.workType) return null;
  const mapping = rows(previous.mappings).find(entry => entry.chapterExternalId === id);
  const chapter = launch.chapters.find(entry => entry.externalId === id);
  const oldChapter = rows(previous.chapters).find(entry => entry.externalId === id);
  const source = launch.sources.find(entry => entry.chapterExternalId === id)?.sourceDocument;
  const root = str(mapping?.rootSectionId);
  if (!root || !chapter || !oldChapter || !source || !mapping?.sourceFingerprint ||
      mapping.sourceFingerprint === fingerprint(source) || fingerprint(chapter) !== fingerprint(oldChapter)) return null;
  const contributorIds = new Set(chapter.contributorExternalIds);
  const contributors = launch.contributors.filter(person => contributorIds.has(person.externalId ?? ''));
  const previousContributorHash = mapping.contributorFingerprint ?? fingerprint(rows(previous.contributors).filter(person => contributorIds.has(str(person.externalId))));
  if (previousContributorHash !== fingerprint(contributors)) return null;
  const local = chapterSections(document, root);
  const original = chapterSections(baseline, root);
  if (!local.length || fingerprint(local) !== fingerprint(original) ||
      local.some(section => section.blocks.some(block => !safeTextBlock(block, true) && !preservedVisual(block)))) return null;
  // Existing object identities must remain stable. Reject any external references
  // to the chapter's blocks or sections, including IDs inside serialized JSON,
  // print corrections, notes, citations, bookmarks, proofing and layout data.
  const ids = new Set(local.flatMap(section => [section.id, ...section.blocks.map(block => block.id)]));
  const localNotes = document.annotations.filter(note => ids.has(note.targetBlockId));
  const baselineNotes = baseline.annotations.filter(note => ids.has(note.targetBlockId));
  if (fingerprint(localNotes) !== fingerprint(baselineNotes) || localNotes.some(note => note.type !== 'note' ||
      !['footnote', 'endnote'].includes(note.noteKind ?? '') || !note.anchorId || !safeNoteBody(note))) return null;
  const noteIds = new Set(localNotes.flatMap(note => [note.id, note.anchorId!]));
  const localCitations = document.citations.filter(citation => ids.has(citation.targetBlockId));
  const localClusters = (document.citationClusters ?? []).filter(cluster => ids.has(cluster.targetBlockId));
  const recordIds = new Set(localCitations.map(citation => citation.target));
  const localRecords = (document.bibliographicRecords ?? []).filter(record => recordIds.has(record.id));
  if (localRecords.length !== recordIds.size ||
      fingerprint(localCitations) !== fingerprint(baseline.citations.filter(citation => ids.has(citation.targetBlockId))) ||
      fingerprint(localClusters) !== fingerprint((baseline.citationClusters ?? []).filter(cluster => ids.has(cluster.targetBlockId))) ||
      fingerprint(localRecords) !== fingerprint((baseline.bibliographicRecords ?? []).filter(record => recordIds.has(record.id)))) return null;
  const citationIds = new Set([...localCitations.flatMap(citation => [citation.id, citation.anchorId]),
    ...localClusters.flatMap(cluster => [cluster.id, cluster.anchorId])]);
  const localVisuals = new Map(local.flatMap(section => section.blocks.filter(preservedVisual).map(block => [block.id, block] as const)));
  // An inbound reference from another chapter can safely remain attached to
  // a verified identical visual. The actual marker must exist exactly once.
  const inbound = (document.crossReferences ?? []).filter(ref => ids.has(ref.targetId) && !ids.has(ref.sourceBlockId));
  const anchors = inbound.length ? collectCrossReferenceAnchors(document.sections) : [];
  const preservedReferences = new Set<string>();
  for (const ref of inbound) {
    const target = localVisuals.get(ref.targetId);
    if (!target || ref.targetKind !== target.type || ref.wordField ||
        anchors.filter(anchor => anchor.crossReferenceId === ref.id && anchor.anchorId === ref.anchorId &&
          anchor.sourceBlockId === ref.sourceBlockId).length !== 1 ||
        anchors.filter(anchor => anchor.crossReferenceId === ref.id).length !== 1) return null;
    preservedReferences.add(ref.id);
  }
  const outside = extractManuscriptState(document);
  outside.crossReferences = (outside.crossReferences ?? []).filter(ref => !preservedReferences.has(ref.id));
  outside.annotations = outside.annotations.filter(note => !ids.has(note.targetBlockId));
  outside.citations = outside.citations.filter(citation => !ids.has(citation.targetBlockId));
  outside.citationClusters = (outside.citationClusters ?? []).filter(cluster => !ids.has(cluster.targetBlockId));
  outside.sections = outside.sections.filter(section => !ids.has(section.id));
  outside.contributions = outside.contributions.filter(item => !ids.has(item.targetId));
  outside.extensions = { ...outside.extensions };
  delete outside.extensions[OMP_VOLUME_ORIGIN];
  const external = JSON.stringify(outside);
  if ([...ids, ...noteIds, ...citationIds].some(key => external.includes(key))) return null;
  // Incoming scholarly objects are not silently discarded by this text-only
  // replacement path. More complex sources remain review-only.
  if ([incoming.crossReferences,
       incoming.sourceAttributions, incoming.assets, incoming.namedAnchors,
       incoming.semanticFields, incoming.computedFields, incoming.indexDefinitions, incoming.indexEntries,
       incoming.generatedIndexes, incoming.proofing?.changes, incoming.publicationCorrections]
      .some(items => items?.length)) return null;
  if (incoming.annotations.some(note => note.type !== 'note' || !['footnote', 'endnote'].includes(note.noteKind ?? '') ||
      !note.anchorId || !safeNoteBody(note))) return null;
  const merged = mergeOmiDocumentAsStudy(extractManuscriptState(document), extractManuscriptState(incoming),
    { importedAt: document.updatedAt });
  const projected = merged.importedSections;
  const incomingNotes = merged.state.annotations.slice(document.annotations.length);
  const newCitations = merged.state.citations.slice(document.citations.length);
  const newClusters = (merged.state.citationClusters ?? []).slice((document.citationClusters ?? []).length);
  const newRecords = (merged.state.bibliographicRecords ?? []).slice((document.bibliographicRecords ?? []).length);
  if (newCitations.length !== localCitations.length || newClusters.length !== localClusters.length ||
      newRecords.length !== localRecords.length) return null;
  const usedCitations = new Set<string>(), usedClusters = new Set<string>();
  const recordMap = new Map<string, string>();
  if (projected.length !== local.length || incomingNotes.length !== localNotes.length) return null;
  const replacements: OmiSection[] = [];
  const noteUpdates = new Map<string, OmiAnnotation>();
  const usedIncoming = new Set<string>();
  for (let index = 0; index < local.length; index++) {
    const old = local[index]!, next = projected[index]!;
    const oldParent = getParentSectionId(old), newParent = getParentSectionId(next);
    if (local.findIndex(item => item.id === oldParent) !== projected.findIndex(item => item.id === newParent) ||
        old.blocks.length !== next.blocks.length ||
        next.blocks.some((block, j) => block.type !== old.blocks[j]?.type || (!safeTextBlock(block, true) && !preservedVisual(block)))) return null;
    const blocks: OmiBlock[] = [];
    for (let j = 0; j < old.blocks.length; j++) {
      const oldBlock = old.blocks[j]!, newBlock = next.blocks[j]!;
      if (oldBlock.visual || newBlock.visual) {
        if (!sameVisual(oldBlock, newBlock)) return null;
        blocks.push(oldBlock);
        continue;
      }
      const oldMarkers = noteMarkers(oldBlock), newMarkers = noteMarkers(newBlock);
      if (oldMarkers.length !== newMarkers.length) return null;
      const markerMap = new Map<string, string>();
      for (let k = 0; k < oldMarkers.length; k++) {
        const oldMarker = oldMarkers[k]!, newMarker = newMarkers[k]!;
        const oldNote = localNotes.find(note => note.id === oldMarker.noteId && note.anchorId === oldMarker.anchorId && note.targetBlockId === oldBlock.id);
        const newNote = incomingNotes.find(note => note.id === newMarker.noteId && note.anchorId === newMarker.anchorId && note.targetBlockId === newBlock.id);
        if (!oldNote || !newNote || noteUpdates.has(oldNote.id) || usedIncoming.has(newNote.id) ||
            fingerprint(noteStructure(oldNote)) !== fingerprint(noteStructure(newNote))) return null;
        markerMap.set(newNote.id, oldNote.id);
        markerMap.set(newNote.anchorId!, oldNote.anchorId!);
        usedIncoming.add(newNote.id);
        const updated: NoteWithBody = { ...oldNote, body: newNote.body };
        const richBody = (newNote as NoteWithBody).bodyContent;
        if (richBody !== undefined) updated.bodyContent = richBody; else delete updated.bodyContent;
        noteUpdates.set(oldNote.id, updated);
      }
      const oldCiteMarkers = noteMarkers(oldBlock, 'omiCitation'), newCiteMarkers = noteMarkers(newBlock, 'omiCitation');
      if (oldCiteMarkers.length !== newCiteMarkers.length) return null;
      for (let k = 0; k < oldCiteMarkers.length; k++) {
        const oldMarker = oldCiteMarkers[k]!, newMarker = newCiteMarkers[k]!;
        const oldCluster = localClusters.find(cluster => cluster.id === oldMarker.clusterId && cluster.anchorId === oldMarker.anchorId && cluster.targetBlockId === oldBlock.id);
        const newCluster = newClusters.find(cluster => cluster.id === newMarker.clusterId && cluster.anchorId === newMarker.anchorId && cluster.targetBlockId === newBlock.id);
        if (!oldCluster || !newCluster || usedClusters.has(newCluster.id) ||
            oldCluster.citationIds.length !== newCluster.citationIds.length ||
            fingerprint(oldMarker.citationIds) !== fingerprint(oldCluster.citationIds) ||
            fingerprint(newMarker.citationIds) !== fingerprint(newCluster.citationIds) ||
            oldMarker.citationId !== oldCluster.citationIds[0] || newMarker.citationId !== newCluster.citationIds[0]) return null;
        usedClusters.add(newCluster.id);
        markerMap.set(newCluster.id, oldCluster.id);
        markerMap.set(newCluster.anchorId, oldCluster.anchorId);
        for (let n = 0; n < oldCluster.citationIds.length; n++) {
          const oldCitation = localCitations.find(citation => citation.id === oldCluster.citationIds[n] && citation.clusterId === oldCluster.id &&
            citation.anchorId === oldCluster.anchorId && citation.targetBlockId === oldBlock.id);
          const newCitation = newCitations.find(citation => citation.id === newCluster.citationIds[n] && citation.clusterId === newCluster.id &&
            citation.anchorId === newCluster.anchorId && citation.targetBlockId === newBlock.id);
          if (!oldCitation || !newCitation || usedCitations.has(newCitation.id)) return null;
          const oldRecord = localRecords.find(record => record.id === oldCitation.target);
          const newRecord = newRecords.find(record => record.id === newCitation.target);
          if (!oldRecord || !newRecord || recordSignature(oldRecord) !== recordSignature(newRecord) ||
              (recordMap.has(newRecord.id) && recordMap.get(newRecord.id) !== oldRecord.id) ||
              (!recordMap.has(newRecord.id) && [...recordMap.values()].includes(oldRecord.id))) return null;
          recordMap.set(newRecord.id, oldRecord.id);
          const normalize = (value: typeof oldCitation) => {
            const { id: _id, target: _target, anchorId: _anchor, targetBlockId: _block, clusterId: _cluster, ...rest } = value;
            return fingerprint(withoutImportTimes(rest));
          };
          if (normalize(oldCitation) !== normalize(newCitation)) return null;
          usedCitations.add(newCitation.id);
          markerMap.set(newCitation.id, oldCitation.id);
        }
      }
      // The entire marker-bearing block must match after restoring identities.
      // Even a shifted marker or changed adjacent text requires manual review.
      const content = remapNoteMarkers(newBlock, markerMap);
      const anchored = oldMarkers.length > 0 || oldCiteMarkers.length > 0;
      if (anchored && fingerprint(JSON.parse(oldBlock.content)) !== fingerprint(JSON.parse(content))) return null;
      blocks.push({ ...oldBlock, content: anchored ? oldBlock.content : content });
    }
    replacements.push({ ...old, title: next.title, blocks });
  }
  if (noteUpdates.size !== localNotes.length || usedIncoming.size !== incomingNotes.length ||
      usedCitations.size !== newCitations.length || usedClusters.size !== newClusters.length || recordMap.size !== newRecords.length) return null;
  return { sections: replacements, annotations: document.annotations.map(note => noteUpdates.get(note.id) ?? note) };
}

/** Explicit source adoption for verified unchanged text and stable note anchors.
 * Retains every local section/block ID and the previous revision. */
export function acceptIncomingOmpChapter(document: OmiManuscript, launch: OmpVolumeHandoff, id: string): OmiManuscript {
  const previous = origin(document, launch);
  const review = compareOmpVolume(document, launch);
  const chapter = launch.chapters.find(item => item.externalId === id);
  const source = launch.sources.find(item => item.chapterExternalId === id)?.sourceDocument;
  const mapping = rows(previous.mappings).find(item => item.chapterExternalId === id);
  if (!chapter || !source || !mapping || review.items.find(item => item.id === id)?.status !== 'changed') throw new Error('No changed OMP chapter.');
  const root = str(mapping.rootSectionId);
  const baseline = document.revisionHistory.revisions.find(revision => {
    const snapshot = revision.snapshot.state;
    const historic = rows(obj(snapshot.extensions?.[OMP_VOLUME_ORIGIN]).mappings).find(item => item.chapterExternalId === id);
    return historic?.sourceFingerprint === mapping.sourceFingerprint && historic?.rootSectionId === root && snapshot.sections.some(section => section.id === root);
  })?.snapshot.state;
  const incoming = importedSource(launch, { externalId: id, primaryLocale: document.locale,
    title: localMap(chapter.title, document.locale), subtitle: localMap(chapter.subtitle, document.locale),
    abstract: localMap(chapter.abstract, document.locale) }, source,
    launch.contributors.filter(person => chapter.contributorExternalIds.includes(person.externalId ?? '')));
  const replacements = planOmpChapterReplacement(document, launch, id, incoming, baseline);
  if (!replacements) throw new Error('Automatic replacement would risk local edits or scholarly object integrity.');
  const state = extractManuscriptState(document);
  const updated = new Map(replacements.sections.map(section => [section.id, section]));
  state.sections = state.sections.map(section => updated.get(section.id) ?? section);
  state.annotations = replacements.annotations;
  const timestamp = new Date().toISOString();
  const decisions = obj(previous.chapterReviewDecisions);
  const nextOrigin = { ...previous,
    mappings: rows(previous.mappings).map(item => item.chapterExternalId === id ? { ...item,
      sourceFileExternalId: source.fileExternalId, sourceFingerprint: fingerprint(source) } : item),
    chapterReviewDecisions: { ...decisions, [id]: { action: 'accept-incoming', incomingFingerprint: incomingChapterFingerprint(launch, id), reviewedAt: timestamp } } };
  state.extensions = { ...state.extensions, [OMP_VOLUME_ORIGIN]: nextOrigin };
  return ensureManuscriptRevisionStateDigests(commitManuscriptRevision(document, state, {
    summary: 'Accepted new OMP chapter text', timestamp,
    events: [{ operation: 'manuscript.snapshot.create', targetId: document.id,
      path: '/sections', previousValue: chapterSections(document, root), nextValue: replacements.sections },
      { operation: 'manuscript.snapshot.create', targetId: document.id, path: '/annotations', previousValue: document.annotations, nextValue: replacements.annotations },
      { operation: 'manuscript.snapshot.create', targetId: document.id,
        path: '/extensions/' + OMP_VOLUME_ORIGIN, previousValue: previous, nextValue: nextOrigin }],
  }));
}
