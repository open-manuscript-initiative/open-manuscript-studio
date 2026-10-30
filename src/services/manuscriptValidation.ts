import type { OmiBlock, OmiManuscript, OmiSection } from '../types/omi';
import { executeValidationChecks, type ValidationCheckOutput, type ValidationFinding, type ValidationProfile } from '../model/validation';
import { validateSectionHierarchy } from '../model/sectionStructure';
import { collectNoteAnchorsInBlock, isNoteAnnotation } from '../model/notes';
import { validateNamedAnchors } from '../model/namedAnchors';
import { collectCrossReferenceAnchors, collectCrossReferenceTargets } from '../model/crossReferences';
import { collectCitationAnchors } from '../model/citationClusters';
import { normalizeManuscriptLanguageTag } from '../model/manuscriptLanguage';
import { isValidLinearRevisionHistory } from '../model/versioning';
import { inspectRevisionHistoryIntegrity } from '../model/revisionIntegrity';
import { getTranslationModel, TRANSLATION_EXTENSION, TRANSLATION_PROFILE, translationProgress } from '../model/translation';
import { resolvePublicationProfile, validateManuscriptForPublication } from '../model/publicationProfile';
import { sha256HexSync } from '../model/stateDigest';
import { toPortableOmiManuscript } from './omiPortableFormat';

type Located<T> = { object: T; path: string; sectionId?: string };
function pointer(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }

/** Flat parentSectionId and embedded section/block trees are both retained. */
function structure(source: OmiManuscript) {
  const sections: Located<OmiSection>[] = [];
  const blocks: Located<OmiBlock>[] = [];
  const seen = new Set<object>();
  function visitBlocks(items: OmiBlock[], path: string, sectionId: string) {
    items.forEach((object, index) => {
      if (seen.has(object)) throw new Error('Cyclic document tree.');
      seen.add(object);
      const itemPath = `${path}/${index}`;
      blocks.push({ object, path: itemPath, sectionId });
      visitBlocks(object.children ?? [], `${itemPath}/children`, sectionId);
    });
  }
  function visitSections(items: OmiSection[], path: string) {
    items.forEach((object, index) => {
      if (seen.has(object)) throw new Error('Cyclic document tree.');
      seen.add(object);
      const itemPath = `${path}/${index}`;
      sections.push({ object, path: itemPath, sectionId: object.id });
      visitBlocks(object.blocks, `${itemPath}/blocks`, object.id);
      visitSections(object.children ?? [], `${itemPath}/children`);
    });
  }
  visitSections(source.sections, '/sections');
  return { sections, blocks };
}

function identifiers(source: OmiManuscript): ValidationCheckOutput {
  const tree = structure(source);
  const objects: Located<{ id: string }>[] = [{ object: source, path: '' }, ...tree.sections, ...tree.blocks];
  for (const key of ['agents', 'contributions', 'annotations', 'bibliographicRecords', 'citations', 'citationClusters', 'crossReferences', 'namedAnchors', 'assets', 'sourceAttributions', 'publicationCorrections'] as const) {
    (source[key] ?? []).forEach((object, index) => objects.push({ object, path: `/${key}/${index}` }));
  }
  source.annotations.forEach((note, index) => (note.noteCitations ?? []).forEach((object, child) => objects.push({ object, path: `/annotations/${index}/noteCitations/${child}` })));
  const seen = new Set<string>();
  const findings: ValidationFinding[] = [];
  if (!normalizeManuscriptLanguageTag(source.locale)) findings.push({ code: 'invalid-language', severity: 'error', path: '/locale', targetId: source.id });
  for (const { object, path } of objects) {
    if (typeof object.id !== 'string' || !object.id.trim()) findings.push({ code: 'invalid-id', severity: 'error', path: `${path}/id` });
    else if (seen.has(object.id)) findings.push({ code: 'duplicate-id', severity: 'error', path: `${path}/id`, targetId: object.id });
    else seen.add(object.id);
  }
  for (const issue of validateSectionHierarchy(tree.sections.map((item) => item.object))) {
    const location = tree.sections.find((item) => item.object.id === issue.sectionId);
    findings.push({ code: 'invalid-hierarchy', severity: 'error', path: `${location?.path ?? ''}/parentSectionId`, targetId: issue.sectionId });
  }
  return { findings };
}

function references(source: OmiManuscript): ValidationCheckOutput {
  const { sections, blocks } = structure(source);
  const ids = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id));
  const agents = ids(source.agents);
  const blockIds = ids(blocks.map((item) => item.object));
  const sectionIds = ids(sections.map((item) => item.object));
  const objectIds = new Set([source.id, ...sectionIds, ...blockIds, ...ids(source.annotations), ...ids(source.bibliographicRecords ?? [])]);
  const bibliography = ids(source.bibliographicRecords ?? []);
  const citations = ids(source.citations);
  const findings: ValidationFinding[] = [];
  function ref(value: string, allowed: Set<string>, path: string, targetId: string, code = 'unresolved-reference') {
    if (!allowed.has(value)) findings.push({ code, severity: 'error', path, targetId, ...(typeof value === 'string' ? { relatedId: value } : {}) });
  }
  source.contributions.forEach((item, index) => {
    ref(item.agentId, agents, `/contributions/${index}/agentId`, item.id);
    ref(item.targetId, objectIds, `/contributions/${index}/targetId`, item.id);
  });
  source.citations.forEach((item, index) => {
    ref(item.target, bibliography, `/citations/${index}/target`, item.id);
    ref(item.targetBlockId, blockIds, `/citations/${index}/targetBlockId`, item.id);
  });
  (source.crossReferences ?? []).forEach((item, index) => {
    const targets = item.targetKind === 'section' ? sectionIds : item.targetKind === 'bookmark' ? ids(source.namedAnchors ?? []) : blockIds;
    ref(item.targetId, targets, `/crossReferences/${index}/targetId`, item.id);
    ref(item.sourceBlockId, blockIds, `/crossReferences/${index}/sourceBlockId`, item.id);
  });
  source.annotations.forEach((item, index) => {
    ref(item.targetBlockId, blockIds, `/annotations/${index}/targetBlockId`, item.id);
    if (item.creatorAgentId) ref(item.creatorAgentId, agents, `/annotations/${index}/creatorAgentId`, item.id);
    (item.noteCitations ?? []).forEach((citation, child) => ref(citation.target, bibliography, `/annotations/${index}/noteCitations/${child}/target`, item.id));
  });
  (source.citationClusters ?? []).forEach((item, index) => {
    ref(item.targetBlockId, blockIds, `/citationClusters/${index}/targetBlockId`, item.id);
    item.citationIds.forEach((id, child) => ref(id, citations, `/citationClusters/${index}/citationIds/${child}`, item.id));
  });
  (source.bibliographyAdditionalRecordIds ?? []).forEach((id, index) => ref(id, bibliography, `/bibliographyAdditionalRecordIds/${index}`, source.id));
  (source.sourceAttributions ?? []).forEach((item, index) => {
    ref(item.sourceObjectId, objectIds, `/sourceAttributions/${index}/sourceObjectId`, item.id);
    ref(item.targetBibliographicRecordId, bibliography, `/sourceAttributions/${index}/targetBibliographicRecordId`, item.id);
  });
  const assetIds = ids(source.assets ?? []);
  for (const { object, path } of blocks) {
    if (object.visual?.kind === 'image' && object.visual.assetId) ref(object.visual.assetId, assetIds, `${path}/visual/assetId`, object.id);
  }
  return { findings };
}

function anchors(source: OmiManuscript): ValidationCheckOutput {
  const { sections, blocks } = structure(source);
  const flatSource = { ...source, sections: sections.map(({ object }) => ({ ...object, children: undefined,
    blocks: blocks.filter((item) => item.sectionId === object.id).map((item) => item.object),
  })) };
  const findings: ValidationFinding[] = validateNamedAnchors(flatSource).map((issue) => ({
    code: 'invalid-bookmark', severity: 'error', path: `/namedAnchors/${(source.namedAnchors ?? []).findIndex((item) => item.id === issue.anchorId)}`, targetId: issue.anchorId,
  }));
  const notes = new Map(source.annotations.filter(isNoteAnnotation).map((note) => [note.id, note]));
  const occurrences = new Map<string, number>();
  for (const { object, path, sectionId } of blocks) {
    for (const anchor of collectNoteAnchorsInBlock(object.content, sectionId!, object.id)) {
      occurrences.set(anchor.noteId, (occurrences.get(anchor.noteId) ?? 0) + 1);
      const note = notes.get(anchor.noteId);
      if (!note || note.anchorId !== anchor.anchorId || note.targetBlockId !== object.id) findings.push({ code: 'invalid-note-anchor', severity: 'error', path: `${path}/content`, targetId: object.id, relatedId: anchor.noteId });
    }
  }
  source.annotations.forEach((note, index) => {
    if (notes.has(note.id) && occurrences.get(note.id) !== 1) findings.push({ code: 'invalid-note-anchor', severity: 'error', path: `/annotations/${index}`, targetId: note.id });
  });
  const citationAnchors = collectCitationAnchors(flatSource.sections);
  const citationMap = new Map(source.citations.map((item) => [item.id, item]));
  source.citations.forEach((citation, index) => {
    const matches = citationAnchors.filter((anchor) => anchor.citationId === citation.id);
    if (matches.length !== 1 || matches[0]!.anchorId !== citation.anchorId || matches[0]!.targetBlockId !== citation.targetBlockId
      || matches[0]!.clusterId !== citation.clusterId) findings.push({ code: 'invalid-citation-anchor', severity: 'error', path: `/citations/${index}`, targetId: citation.id });
  });
  for (const anchor of citationAnchors) {
    if (!citationMap.has(anchor.citationId)) findings.push({ code: 'invalid-citation-anchor', severity: 'error', path: '', targetId: anchor.targetBlockId });
  }
  const xrefAnchors = collectCrossReferenceAnchors(flatSource.sections);
  const targets = collectCrossReferenceTargets(flatSource);
  (source.crossReferences ?? []).forEach((xref, index) => {
    const matches = xrefAnchors.filter((anchor) => anchor.crossReferenceId === xref.id);
    if (matches.length !== 1 || matches[0]!.anchorId !== xref.anchorId || matches[0]!.sourceBlockId !== xref.sourceBlockId
      || !targets.some((target) => target.id === xref.targetId && target.kind === xref.targetKind)) findings.push({ code: 'invalid-cross-reference', severity: 'error', path: `/crossReferences/${index}`, targetId: xref.id });
  });
  const xrefIds = new Set((source.crossReferences ?? []).map((item) => item.id));
  for (const anchor of xrefAnchors) {
    if (!xrefIds.has(anchor.crossReferenceId)) findings.push({ code: 'invalid-cross-reference', severity: 'error', path: '', targetId: anchor.sourceBlockId });
  }
  return { findings };
}

function history(source: OmiManuscript): ValidationCheckOutput {
  const findings: ValidationFinding[] = [];
  if (!isValidLinearRevisionHistory(source.revisionHistory) || source.headRevisionId !== source.revisionHistory.headRevisionId
    || source.revisionHistory.revisions.some((revision) => revision.snapshot.manuscriptId !== source.id)) {
    findings.push({ code: 'invalid-history', severity: 'error', path: '/revisionHistory', targetId: source.id });
  }
  for (const [index, result] of inspectRevisionHistoryIntegrity(source.revisionHistory).results.entries()) {
    if (result.status === 'verified') continue;
    findings.push({ code: result.status === 'missing' ? 'missing-digest' : 'invalid-digest', severity: result.status === 'missing' ? 'warning' : 'error', path: `/revisionHistory/revisions/${index}`, targetId: result.revisionId });
  }
  if (source.revisionHistory.completeness === 'shallow') findings.push({ code: 'shallow-history', severity: 'info', path: '/revisionHistory/completeness' });
  return { findings, skipped: findings.some((item) => item.code === 'missing-digest') };
}

function translations(source: OmiManuscript): ValidationCheckOutput {
  const value = source.extensions?.[TRANSLATION_EXTENSION];
  const path = `/extensions/${pointer(TRANSLATION_EXTENSION)}`;
  if (value === undefined) return { findings: [] };
  if (value && typeof value === 'object' && 'profile' in value && value.profile !== TRANSLATION_PROFILE) {
    return { skipped: true, findings: [{ code: 'unknown-translation-profile', severity: 'warning', path }] };
  }
  let model;
  try { model = getTranslationModel(source); }
  catch { return { findings: [{ code: 'invalid-translation-model', severity: 'error', path }] }; }
  const findings: ValidationFinding[] = [];
  model.variants.forEach((variant, index) => {
    const progress = translationProgress(source, variant);
    if (progress.stale || progress.added) findings.push({ code: 'stale-translation', severity: 'warning', path: `${path}/variants/${index}`, targetId: variant.id });
    else if (!progress.ready) findings.push({ code: 'unfinished-translation', severity: 'info', path: `${path}/variants/${index}`, targetId: variant.id });
  });
  return { findings };
}

function portability(source: OmiManuscript): ValidationCheckOutput {
  try { toPortableOmiManuscript(source); return { findings: [] }; }
  catch { return { findings: [{ code: 'invalid-portable-document', severity: 'error', path: '' }] }; }
}

function publication(source: OmiManuscript): ValidationCheckOutput {
  // Flatten embedded trees for the existing profile validator; retain nested
  // block coverage without changing the source or inventing publication state.
  const { sections, blocks } = structure(source);
  const flat = { ...source, sections: sections.map(({ object }) => ({ ...object, children: undefined,
    blocks: blocks.filter((item) => item.sectionId === object.id).map((item) => item.object),
  })) };
  const issues = validateManuscriptForPublication({ ...flat, crossReferences: [] }, resolvePublicationProfile(source));
  // Exact xref kinds and bookmark destinations are checked by the anchors
  // adapter; the legacy publication helper only understands section/block IDs.
  return { findings: issues.map((issue) => ({ code: `publication.${issue.code}`, severity: issue.severity, path: '', ...(issue.targetId ? { targetId: issue.targetId } : {}) })) };
}

export interface ManuscriptValidationOptions {
  profile?: ValidationProfile;
  /** The caller supplies local bytes. Validation never fetches remote resources. */
  loadAsset?: (manuscriptId: string, assetId: string) => Promise<Uint8Array | undefined>;
  createdAt?: string;
}

export function validateStudioManuscript(source: OmiManuscript, options: ManuscriptValidationOptions = {}) {
  return executeValidationChecks(source, options.profile ?? 'authoring', {
    identifiers, references, anchors, history, translations, portability, publication,
    assets: async (snapshot) => {
      const assets = snapshot.assets ?? [];
      if (assets.length && !options.loadAsset) return { skipped: true, findings: [{ code: 'asset-check-unavailable', severity: 'warning', path: '/assets' }] };
      const findings: ValidationFinding[] = [];
      for (const [index, asset] of assets.entries()) {
        const bytes = await options.loadAsset!(snapshot.id, asset.id);
        if (!bytes) findings.push({ code: 'missing-asset', severity: 'error', path: `/assets/${index}`, targetId: asset.id });
        else if (bytes.byteLength !== asset.size || asset.checksum.algorithm !== 'sha256' || asset.checksum.scope !== 'raw-bytes'
          || sha256HexSync(bytes).toLowerCase() !== asset.checksum.value.toLowerCase()) findings.push({ code: 'invalid-asset', severity: 'error', path: `/assets/${index}`, targetId: asset.id });
      }
      return { findings };
    },
  }, options.createdAt);
}

/** Resolves diagnostics to editor sections without mutating document content. */
export function validationTargetSection(source: OmiManuscript, targetId: string | undefined): string | undefined {
  if (!targetId) return undefined;
  const { sections, blocks } = structure(source);
  if (sections.some((item) => item.object.id === targetId)) return targetId;
  const block = blocks.find((item) => item.object.id === targetId);
  if (block) return block.sectionId;
  const annotation = source.annotations.find((item) => item.id === targetId);
  if (annotation) return blocks.find((item) => item.object.id === annotation.targetBlockId)?.sectionId;
  const citation = source.citations.find((item) => item.id === targetId);
  if (citation) return blocks.find((item) => item.object.id === citation.targetBlockId)?.sectionId;
  return undefined;
}
