import { collectTranslationUnits, createManuscriptTranslation, type TranslationScope, type TranslationUnit } from '../model/translation';
import type { OmiManuscript } from '../types/omi';
import { translateWithDeepL, type TranslationSegment } from './integrationExecutionApi';

export interface MachineTranslationSuggestion {
  id: string;
  sourceText: string;
  text: string;
  included: boolean;
}

/** Ephemeral proposal. Only explicit acceptance may create portable translations. */
export interface MachineTranslationProposal {
  basis: OmiManuscript;
  scope: TranslationScope;
  targetLanguage: string;
  createdAt: string;
  sourceUnits: TranslationUnit[];
  suggestions: MachineTranslationSuggestion[];
}

export async function requestMachineTranslationSuggestions(
  source: OmiManuscript,
  scope: TranslationScope,
  targetLanguage: string,
  signal?: AbortSignal,
  translate: typeof translateWithDeepL = translateWithDeepL,
): Promise<MachineTranslationProposal> {
  signal?.throwIfAborted();
  const basis = structuredClone(source);
  const createdAt = new Date().toISOString();
  // Validate the language/scope and use the same scholarly-object anchors as
  // the portable translation ledger, without writing that ledger yet.
  const draft = createManuscriptTranslation(basis, scope, targetLanguage);
  const segments = draft.alignments.map((alignment) => ({ id: alignment.sourceAnchor, text: alignment.sourceText }));
  if (segments.some((segment) => segment.text.length > 75_000)) throw new Error('A translation segment is too long.');
  const translated = new Map<string, string>();
  let batch: TranslationSegment[] = [];
  let characters = 0;
  async function flush() {
    if (!batch.length) return;
    signal?.throwIfAborted();
    const result = await translate({ sourceLanguage: draft.sourceLanguage, targetLanguage: draft.targetLanguage, scope: draft.scope, segments: batch }, signal);
    signal?.throwIfAborted();
    const expected = new Set(batch.map((segment) => segment.id));
    if (result.segments.length !== batch.length) throw new Error('Incomplete machine translation response.');
    for (const segment of result.segments) {
      if (!expected.delete(segment.id) || typeof segment.text !== 'string') throw new Error('Invalid machine translation response.');
      translated.set(segment.id, segment.text);
    }
    batch = []; characters = 0;
  }
  for (const segment of segments) {
    if (batch.length >= 150 || characters + segment.text.length > 75_000) await flush();
    batch.push(segment); characters += segment.text.length;
  }
  await flush();
  return {
    basis, scope: draft.scope, targetLanguage: draft.targetLanguage, createdAt,
    sourceUnits: draft.alignments.map((item) => ({ anchor: item.sourceAnchor, objectId: item.sourceObjectId, text: item.sourceText, fingerprint: item.sourceFingerprint })),
    suggestions: segments.map((segment) => ({ id: segment.id, sourceText: segment.text, text: translated.get(segment.id)!, included: true })),
  };
}

export function machineTranslationSourceChanged(manuscript: OmiManuscript, proposal: Pick<MachineTranslationProposal, 'basis' | 'scope' | 'sourceUnits'>): boolean {
  if (manuscript.id !== proposal.basis.id || manuscript.locale !== proposal.basis.locale) return true;
  try {
    const current = new Map(collectTranslationUnits(manuscript, proposal.scope).map((unit) => [unit.anchor, unit]));
    return current.size !== proposal.sourceUnits.length || proposal.sourceUnits.some((unit) => {
      const next = current.get(unit.anchor);
      return !next || next.objectId !== unit.objectId || next.text !== unit.text || next.fingerprint !== unit.fingerprint;
    });
  } catch { return true; }
}

export function selectedMachineTranslationSegments(proposal: MachineTranslationProposal): TranslationSegment[] {
  const selected = proposal.suggestions.filter((item) => item.included && item.text.trim()).map(({ id, text }) => ({ id, text }));
  if (!selected.length) throw new Error('Select a nonempty translation suggestion.');
  return selected;
}
