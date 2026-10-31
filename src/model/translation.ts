import { buildStructuredTranslationPlan } from '../integrations/structuredExternalContent.ts';
import type { TranslationSegment } from '../services/integrationExecutionApi';
import type { OmiBlock, OmiManuscript, OmiSection } from '../types/omi';
import { normalizeManuscriptLanguageTag } from './manuscriptLanguage.ts';
import { sha256HexSync } from './stateDigest.ts';

/** Experimental Studio profile; OMI-SPEC-170 is Draft, not a frozen wire contract. */
export const TRANSLATION_EXTENSION = 'urn:omi:studio:translation:1' as const;
export const TRANSLATION_PROFILE = 'studio-translation-0.1' as const;
export type TranslationScope = { kind: 'manuscript' | 'section' | 'block'; id: string };
export type TranslationEquivalence = 'unassessed' | 'equivalent' | 'adapted';
export type TranslationFreshness = 'current' | 'stale' | 'missing';
export interface TranslationOrigin {
  method: 'human' | 'machine';
  provider?: string;
  actorAgentId?: string;
  createdAt: string;
}
export interface TranslationAlignment {
  id: string;
  sourceAnchor: string;
  sourceObjectId: string;
  sourceText: string;
  sourceFingerprint: string;
  targetText: string;
  status: 'draft' | 'reviewed';
  equivalence: TranslationEquivalence;
  notes: string;
  origin: TranslationOrigin;
  modifiedAt: string;
  lastEditorAgentId?: string;
  reviewedByAgentId?: string;
  reviewedAt?: string;
}
export interface ManuscriptTranslation {
  id: string;
  sourceManuscriptId: string;
  sourceRevisionId: string;
  sourceLanguage: string;
  targetLanguage: string;
  scope: TranslationScope;
  createdAt: string;
  modifiedAt: string;
  alignments: TranslationAlignment[];
  archivedAlignments: TranslationAlignment[];
}
export interface TranslationModel {
  profile: typeof TRANSLATION_PROFILE;
  variants: ManuscriptTranslation[];
}
export interface TranslationUnit {
  anchor: string;
  objectId: string;
  text: string;
  fingerprint: string;
}

/** Source snapshots include the whole addressed object to invalidate shifted JSON paths. */
export function collectTranslationUnits(manuscript: OmiManuscript, scope: TranslationScope): TranslationUnit[] {
  if (scope.kind === 'manuscript' && scope.id !== manuscript.id) throw new Error('Unknown translation scope.');
  const objects = new Map<string, OmiBlock | OmiSection>();
  function visitBlocks(blocks: OmiBlock[]): void {
    for (const block of blocks) { objects.set(block.id, block); visitBlocks(block.children ?? []); }
  }
  function visitSections(sections: OmiSection[]): void {
    for (const section of sections) { objects.set(section.id, section); visitBlocks(section.blocks); visitSections(section.children ?? []); }
  }
  visitSections(manuscript.sections);
  if (scope.kind !== 'manuscript' && !objects.has(scope.id)) throw new Error('Unknown translation scope.');
  const annotations = new Map(manuscript.annotations.map((item) => [item.id, item]));
  const fingerprints = new Map<string, string>();
  return buildStructuredTranslationPlan(manuscript, scope).segments.map((segment) => {
    const kind = segment.id.slice(0, segment.id.indexOf(':'));
    const objectId = kind === 'front' ? manuscript.id : kind === 'legacy'
      ? segment.id.slice('legacy:'.length)
      : segment.id.slice(kind.length + 1, segment.id.lastIndexOf(':'));
    const object = kind === 'annotation' ? annotations.get(objectId) : objects.get(objectId);
    // Section and front fields have independent anchors. Text/visual blocks use
    // their complete content so repeated text cannot silently rebind after edits.
    const context = kind === 'section' ? (object as OmiSection | undefined)?.title
      : kind === 'front' ? (segment.id.startsWith('front:keyword:') ? manuscript.keywords : segment.text)
      : kind === 'visual' && object && 'visual' in object && object.visual?.kind === 'image' && object.visual.assetId
        ? { ...object, visual: { ...object.visual, src: '' } } : object;
    const contextKey = kind === 'front' ? segment.id.startsWith('front:keyword:') ? 'front:keywords' : segment.id : `${kind}:${objectId}`;
    let digest = fingerprints.get(contextKey);
    if (!digest) { digest = fingerprint(context); fingerprints.set(contextKey, digest); }
    return { anchor: segment.id, objectId, text: segment.text, fingerprint: digest };
  });
}

export function getTranslationModel(manuscript: OmiManuscript): TranslationModel {
  const value = manuscript.extensions?.[TRANSLATION_EXTENSION];
  if (value === undefined) return { profile: TRANSLATION_PROFILE, variants: [] };
  validateTranslationModel(value, manuscript.id);
  return value as TranslationModel;
}

export function withTranslationModel(manuscript: OmiManuscript, model: TranslationModel): OmiManuscript {
  validateTranslationModel(model, manuscript.id);
  return { ...manuscript, extensions: { ...manuscript.extensions, [TRANSLATION_EXTENSION]: model } };
}

export function createManuscriptTranslation(
  source: OmiManuscript,
  scope: TranslationScope,
  targetLanguage: string,
  translated: TranslationSegment[] = [],
  origin: TranslationOrigin = { method: 'human', createdAt: new Date().toISOString() },
): ManuscriptTranslation {
  const sourceLanguage = requireLanguage(source.locale);
  const target = requireLanguage(targetLanguage);
  if (sourceLanguage === target) throw new Error('Source and target languages must differ.');
  const units = collectTranslationUnits(source, scope);
  if (!units.length) throw new Error('The translation scope contains no supported text.');
  const allowed = new Set(units.map((unit) => unit.anchor));
  const supplied = new Map<string, string>();
  for (const item of translated) {
    if (!allowed.has(item.id) || supplied.has(item.id) || typeof item.text !== 'string') throw new Error('Invalid or duplicate translation anchor.');
    supplied.set(item.id, item.text);
  }
  const timestamp = origin.createdAt;
  return {
    id: crypto.randomUUID(), sourceManuscriptId: source.id,
    sourceRevisionId: source.headRevisionId, sourceLanguage, targetLanguage: target,
    scope: { ...scope }, createdAt: timestamp, modifiedAt: timestamp,
    archivedAlignments: [], alignments: units.map((unit) => ({
      id: crypto.randomUUID(), sourceAnchor: unit.anchor, sourceObjectId: unit.objectId,
      sourceText: unit.text, sourceFingerprint: unit.fingerprint,
      targetText: supplied.get(unit.anchor) ?? '', status: 'draft', equivalence: 'unassessed',
      notes: '', origin: { ...origin }, modifiedAt: timestamp,
    })),
  };
}

export function translationFreshness(
  manuscript: OmiManuscript,
  variant: ManuscriptTranslation,
  alignment: TranslationAlignment,
  units = currentUnits(manuscript, variant),
): TranslationFreshness {
  const current = units.get(alignment.sourceAnchor);
  if (!current) return 'missing';
  if (variant.sourceManuscriptId !== manuscript.id || variant.sourceLanguage !== normalizeManuscriptLanguageTag(manuscript.locale)
    || current.objectId !== alignment.sourceObjectId || current.text !== alignment.sourceText || current.fingerprint !== alignment.sourceFingerprint) return 'stale';
  return 'current';
}

export function currentUnits(manuscript: OmiManuscript, variant: ManuscriptTranslation): Map<string, TranslationUnit> {
  // A deleted scope remains readable in the translation ledger.
  try { return new Map(collectTranslationUnits(manuscript, variant.scope).map((unit) => [unit.anchor, unit])); }
  catch { return new Map(); }
}

export function translationProgress(manuscript: OmiManuscript, variant: ManuscriptTranslation) {
  const units = currentUnits(manuscript, variant);
  const stale = variant.alignments.filter((item) => translationFreshness(manuscript, variant, item, units) !== 'current').length;
  const aligned = new Set(variant.alignments.map((item) => item.sourceAnchor));
  const added = [...units.keys()].filter((anchor) => !aligned.has(anchor)).length;
  const reviewed = variant.alignments.filter((item) => item.status === 'reviewed' && item.targetText.trim()
    && translationFreshness(manuscript, variant, item, units) === 'current').length;
  return { total: variant.alignments.length + added, reviewed, stale, added,
    ready: variant.alignments.length > 0 && stale === 0 && added === 0 && reviewed === variant.alignments.length };
}

export function editTranslationAlignment(
  manuscript: OmiManuscript,
  variant: ManuscriptTranslation,
  alignmentId: string,
  input: Partial<Pick<TranslationAlignment, 'targetText' | 'notes' | 'equivalence' | 'status'>>,
  actorAgentId?: string,
): ManuscriptTranslation {
  const alignment = variant.alignments.find((item) => item.id === alignmentId);
  if (!alignment) throw new Error('Unknown translation alignment.');
  const now = new Date().toISOString();
  const edited = { ...alignment, ...input, modifiedAt: now };
  // A target edit always needs another human review, even if a caller also supplies reviewed.
  if (input.targetText !== undefined && input.targetText !== alignment.targetText) edited.status = 'draft';
  if (input.equivalence !== undefined && input.equivalence !== alignment.equivalence) edited.status = 'draft';
  if (input.status !== 'reviewed' && translationFreshness(manuscript, variant, alignment) !== 'current') edited.status = 'draft';
  if (edited.status === 'reviewed' && (!edited.targetText.trim() || edited.equivalence === 'unassessed'
    || translationFreshness(manuscript, variant, alignment) !== 'current')) throw new Error('Only current, nonempty, assessed translations can be reviewed.');
  if (actorAgentId && !manuscript.agents.some((agent) => agent.id === actorAgentId)) throw new Error('Unknown translator agent.');
  if (actorAgentId) edited.lastEditorAgentId = actorAgentId;
  else delete edited.lastEditorAgentId;
  if (input.status === 'reviewed') {
    if (actorAgentId) edited.reviewedByAgentId = actorAgentId;
    else delete edited.reviewedByAgentId;
    edited.reviewedAt = now;
  }
  if (edited.status === 'draft') { delete edited.reviewedByAgentId; delete edited.reviewedAt; }
  return { ...variant, modifiedAt: now, alignments: variant.alignments.map((item) => item.id === alignmentId ? edited : item) };
}

/** Explicit rebase keeps target text and missing objects; all changed mappings need review. */
export function synchronizeTranslation(manuscript: OmiManuscript, variant: ManuscriptTranslation): ManuscriptTranslation {
  if (variant.sourceLanguage !== requireLanguage(manuscript.locale)) throw new Error('The source language changed; create a new language relationship.');
  const units = currentUnits(manuscript, variant);
  const now = new Date().toISOString();
  const alignments = variant.alignments.map((item) => {
    const unit = units.get(item.sourceAnchor);
    units.delete(item.sourceAnchor);
    if (!unit || unit.fingerprint === item.sourceFingerprint) return item;
    const rebased = { ...item, sourceText: unit.text, sourceFingerprint: unit.fingerprint, sourceObjectId: unit.objectId,
      status: 'draft' as const, equivalence: 'unassessed' as const, modifiedAt: now };
    delete rebased.reviewedAt; delete rebased.reviewedByAgentId;
    return rebased;
  });
  for (const unit of units.values()) alignments.push({
    id: crypto.randomUUID(), sourceAnchor: unit.anchor, sourceObjectId: unit.objectId,
    sourceText: unit.text, sourceFingerprint: unit.fingerprint, targetText: '',
    status: 'draft', equivalence: 'unassessed', notes: '', origin: { method: 'human', createdAt: now }, modifiedAt: now,
  });
  return { ...variant, sourceRevisionId: manuscript.headRevisionId, modifiedAt: now, alignments };
}

/** Explicitly omit a deleted source object from release without losing its translation. */
export function archiveMissingTranslation(manuscript: OmiManuscript, variant: ManuscriptTranslation, alignmentId: string): ManuscriptTranslation {
  const item = variant.alignments.find((item) => item.id === alignmentId);
  if (!item || translationFreshness(manuscript, variant, item) !== 'missing') throw new Error('Only missing source alignments can be archived.');
  return { ...variant, modifiedAt: new Date().toISOString(), alignments: variant.alignments.filter((item) => item.id !== alignmentId),
    archivedAlignments: [...variant.archivedAlignments, item] };
}

/** Strictly validate the profile we own; unknown future profiles stay opaque. */
export function validateTranslationModel(value: unknown, manuscriptId: string): void {
  if (!record(value) || value.profile !== TRANSLATION_PROFILE || !Array.isArray(value.variants)) throw new Error('Unsupported or invalid Studio translation profile.');
  const ids = new Set<string>();
  function unique(value: unknown): void {
    if (typeof value !== 'string' || !value.trim() || ids.has(value)) throw new Error('Duplicate or empty translation identifier.');
    ids.add(value);
  }
  for (const variant of value.variants) {
    if (!record(variant)) throw new Error('Invalid translation variant.');
    unique(variant.id);
    if (variant.sourceManuscriptId !== manuscriptId || typeof variant.sourceRevisionId !== 'string' || !variant.sourceRevisionId
      || !record(variant.scope) || !['manuscript', 'section', 'block'].includes(String(variant.scope.kind))
      || typeof variant.scope.id !== 'string' || !variant.scope.id || !Array.isArray(variant.alignments) || !Array.isArray(variant.archivedAlignments)
      || !validTime(variant.createdAt) || !validTime(variant.modifiedAt)) throw new Error('Invalid translation source or scope.');
    if (typeof variant.sourceLanguage !== 'string' || typeof variant.targetLanguage !== 'string'
      || requireLanguage(variant.sourceLanguage) !== variant.sourceLanguage || requireLanguage(variant.targetLanguage) !== variant.targetLanguage
      || variant.sourceLanguage === variant.targetLanguage) throw new Error('Translation languages must be distinct canonical BCP 47 tags.');
    const anchors = new Set<string>();
    for (const [index, item] of [...variant.alignments, ...variant.archivedAlignments].entries()) {
      const active = index < variant.alignments.length;
      if (!record(item)) throw new Error('Invalid translation alignment.');
      unique(item.id);
      if (typeof item.sourceAnchor !== 'string' || !item.sourceAnchor || (active && anchors.has(item.sourceAnchor))
        || typeof item.sourceObjectId !== 'string' || !item.sourceObjectId
        || typeof item.sourceText !== 'string' || typeof item.targetText !== 'string' || typeof item.notes !== 'string'
        || typeof item.sourceFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(item.sourceFingerprint)
        || !['draft', 'reviewed'].includes(String(item.status)) || !['unassessed', 'equivalent', 'adapted'].includes(String(item.equivalence))
        || !record(item.origin) || !['human', 'machine'].includes(String(item.origin.method))
        || !validTime(item.origin.createdAt) || !validTime(item.modifiedAt)
        || (item.origin.provider !== undefined && typeof item.origin.provider !== 'string')
        || (item.origin.method === 'machine' && (typeof item.origin.provider !== 'string' || !item.origin.provider.trim()))
        || (item.origin.actorAgentId !== undefined && typeof item.origin.actorAgentId !== 'string')
        || (item.lastEditorAgentId !== undefined && typeof item.lastEditorAgentId !== 'string')
        || (item.reviewedByAgentId !== undefined && typeof item.reviewedByAgentId !== 'string')
        || (item.reviewedAt !== undefined && !validTime(item.reviewedAt))
        || (item.status === 'reviewed' && (!item.targetText.trim() || item.equivalence === 'unassessed'))) throw new Error('Invalid translation alignment fields.');
      if (active) anchors.add(item.sourceAnchor);
    }
  }
}

function requireLanguage(value: string): string {
  const tag = normalizeManuscriptLanguageTag(value);
  if (!tag || ['mul', 'und', 'zxx'].includes(tag)) throw new Error('A concrete BCP 47 language is required.');
  return tag;
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function validTime(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4)); const month = Number(value.slice(5, 7)); const day = Number(value.slice(8, 10));
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}
function fingerprint(value: unknown): string {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : record(value) ? Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, stable(value[key])])) : value;
  return sha256HexSync(new TextEncoder().encode(JSON.stringify(stable(value)) ?? 'null'));
}
