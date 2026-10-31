import { useStudioStore } from './useStudioStore';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { createTranslationCommands } from '../services/translationCommands';

// Composition adapter only: account lookup and Zustand stay outside use cases.
const commands = createTranslationCommands({
  update: (transform) => useStudioStore.setState((state) => transform(state)),
  checkpoint: () => useStudioStore.getState().checkpoint('manual'),
  actorAgentId: () => getCurrentUser(useAuthStore.getState())?.agentId,
});

export const {
  addManuscriptTranslation, saveTranslationAlignment, synchronizeManuscriptTranslation,
  archiveTranslationAlignment, removeManuscriptTranslation,
} = commands;
