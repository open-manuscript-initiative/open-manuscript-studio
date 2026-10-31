import {
  createManuscriptTranslation, editTranslationAlignment, getTranslationModel,
  archiveMissingTranslation, synchronizeTranslation, withTranslationModel, TRANSLATION_EXTENSION,
  type ManuscriptTranslation, type TranslationAlignment, type TranslationModel,
  type TranslationScope, type TranslationOrigin,
} from '../model/translation';
import { stagePendingChanges, type OmiPendingChangeSet } from '../model/workingState';
import type { OmiManuscript } from '../types/omi';
import type { TranslationSegment } from './integrationExecutionApi';

export interface TranslationWorkingState {
  manuscript: OmiManuscript;
  pendingChangeSet: OmiPendingChangeSet | null;
}

/** Synchronous port: the adapter commits the transform atomically. */
export interface TranslationSessionPort {
  update(transform: (state: TranslationWorkingState) => TranslationWorkingState): void;
  checkpoint(): void;
  actorAgentId(): string | undefined;
}

/** Platform-independent use cases retaining the existing checkpoint engine. */
export function createTranslationCommands(session: TranslationSessionPort) {
  function actor(source: OmiManuscript): string | undefined {
    const id = session.actorAgentId();
    return source.agents.some((agent) => agent.id === id) ? id : undefined;
  }
  function mutate(transform: (source: OmiManuscript, model: TranslationModel) => TranslationModel): void {
    session.update((state) => {
      const previous = getTranslationModel(state.manuscript);
      const next = transform(state.manuscript, previous);
      const manuscript = withTranslationModel(state.manuscript, next);
      const timestamp = new Date().toISOString();
      return {
        manuscript: { ...manuscript, updatedAt: timestamp },
        pendingChangeSet: stagePendingChanges(state.pendingChangeSet, {
          baseRevisionId: manuscript.headRevisionId, summary: 'Updated manuscript translations', timestamp, actorAgentId: actor(manuscript),
          events: [{ operation: 'translation.model.set', targetId: manuscript.id,
            path: `/extensions/${TRANSLATION_EXTENSION}`, previousValue: previous, nextValue: next }],
        }),
      };
    });
    session.checkpoint();
  }
  function updateVariant(id: string, transform: (source: OmiManuscript, variant: ManuscriptTranslation) => ManuscriptTranslation): void {
    mutate((source, model) => {
      if (!model.variants.some((variant) => variant.id === id)) throw new Error('Unknown translation variant.');
      return { ...model, variants: model.variants.map((variant) => variant.id === id ? transform(source, variant) : variant) };
    });
  }
  return {
    addManuscriptTranslation(scope: TranslationScope, targetLanguage: string, translated: TranslationSegment[] = [], basis?: OmiManuscript, origin?: TranslationOrigin): string {
      if (!basis) session.checkpoint();
      let id = '';
      mutate((source, model) => {
        if (basis && basis.id !== source.id) throw new Error('The active manuscript changed.');
        const variant = createManuscriptTranslation(basis ?? source, scope, targetLanguage, translated,
          origin ?? { method: 'human', createdAt: new Date().toISOString(), actorAgentId: actor(source) });
        id = variant.id;
        return { ...model, variants: [...model.variants, variant] };
      });
      return id;
    },
    saveTranslationAlignment(variantId: string, alignmentId: string, input: Partial<Pick<TranslationAlignment, 'targetText' | 'notes' | 'equivalence' | 'status'>>): void {
      updateVariant(variantId, (source, variant) => editTranslationAlignment(source, variant, alignmentId, input, actor(source)));
    },
    synchronizeManuscriptTranslation(id: string): void { updateVariant(id, synchronizeTranslation); },
    archiveTranslationAlignment(variantId: string, alignmentId: string): void {
      updateVariant(variantId, (source, variant) => archiveMissingTranslation(source, variant, alignmentId));
    },
    removeManuscriptTranslation(id: string): void {
      mutate((_source, model) => ({ ...model, variants: model.variants.filter((variant) => variant.id !== id) }));
    },
  };
}
