import { useStudioStore } from './useStudioStore';
import {
  createManuscriptTranslation, editTranslationAlignment, getTranslationModel,
  archiveMissingTranslation,
  synchronizeTranslation, withTranslationModel, TRANSLATION_EXTENSION,
  type ManuscriptTranslation, type TranslationAlignment, type TranslationModel,
  type TranslationScope, type TranslationOrigin,
} from '../model/translation.ts';
import { stagePendingChanges } from '../model/workingState';
import type { OmiManuscript } from '../types/omi';
import type { TranslationSegment } from '../services/integrationExecutionApi';
import { getCurrentUser, useAuthStore } from '../store/authStore';

function currentActor(source: OmiManuscript): string | undefined {
  const user = getCurrentUser(useAuthStore.getState());
  return source.agents.some((agent) => agent.id === user?.agentId) ? user?.agentId : undefined;
}

/** Uses the same working-state/checkpoint ledger as ordinary manuscript edits. */
function mutateTranslations(transform: (source: OmiManuscript, model: TranslationModel) => TranslationModel): void {
  useStudioStore.setState((state) => {
    const previous = getTranslationModel(state.manuscript);
    const next = transform(state.manuscript, previous);
    const manuscript = withTranslationModel(state.manuscript, next);
    const timestamp = new Date().toISOString();
    return {
      manuscript: { ...manuscript, updatedAt: timestamp },
      pendingChangeSet: stagePendingChanges(state.pendingChangeSet, {
        baseRevisionId: manuscript.headRevisionId, summary: 'Updated manuscript translations', timestamp, actorAgentId: currentActor(manuscript),
        events: [{ operation: 'translation.model.set', targetId: manuscript.id,
          path: `/extensions/${TRANSLATION_EXTENSION}`, previousValue: previous, nextValue: next }],
      }),
    };
  });
  // Translation actions are explicit saves, not keystrokes. Commit the grouped
  // working state immediately and retain an immutable snapshot for reversion.
  useStudioStore.getState().checkpoint('manual');
}

export function addManuscriptTranslation(
  scope: TranslationScope, targetLanguage: string, translated: TranslationSegment[] = [],
  basis?: OmiManuscript, origin?: TranslationOrigin,
): string {
  if (!basis) useStudioStore.getState().checkpoint('manual');
  let id = '';
  mutateTranslations((source, model) => {
    if (basis && basis.id !== source.id) throw new Error('The active manuscript changed.');
    const variant = createManuscriptTranslation(basis ?? source, scope, targetLanguage, translated, origin ?? { method: 'human', createdAt: new Date().toISOString(), actorAgentId: currentActor(source) });
    id = variant.id;
    return { ...model, variants: [...model.variants, variant] };
  });
  return id;
}

function updateVariant(id: string, transform: (source: OmiManuscript, variant: ManuscriptTranslation) => ManuscriptTranslation): void {
  mutateTranslations((source, model) => {
    if (!model.variants.some((variant) => variant.id === id)) throw new Error('Unknown translation variant.');
    return { ...model, variants: model.variants.map((variant) => variant.id === id ? transform(source, variant) : variant) };
  });
}

export function saveTranslationAlignment(variantId: string, alignmentId: string,
  input: Partial<Pick<TranslationAlignment, 'targetText' | 'notes' | 'equivalence' | 'status'>>): void {
  updateVariant(variantId, (source, variant) => editTranslationAlignment(source, variant, alignmentId, input, currentActor(source)));
}

export function synchronizeManuscriptTranslation(id: string): void {
  updateVariant(id, synchronizeTranslation);
}

export function archiveTranslationAlignment(variantId: string, alignmentId: string): void {
  updateVariant(variantId, (source, variant) => archiveMissingTranslation(source, variant, alignmentId));
}

export function removeManuscriptTranslation(id: string): void {
  mutateTranslations((_source, model) => ({ ...model, variants: model.variants.filter((variant) => variant.id !== id) }));
}
