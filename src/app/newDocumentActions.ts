import { clearDocumentClosedState } from './documentCloseState';
import { useStudioStore } from './useStudioStore';
import { createBlankManuscript } from '../document/createBlankManuscript';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import type { OmiDocumentKind, OmiVolumeKind } from '../model/documentProfile';
import { clearCurrentManuscriptFilePath } from '../services/nativeManuscriptFile';
import type { OmiManuscript } from '../types/omi';

export function createAndOpenBlankOmiDocument(input: {
  kind: OmiDocumentKind;
  volumeKind?: OmiVolumeKind;
  locale: string;
}): OmiManuscript {
  if (useStudioStore.getState().hasOpenDocument) {
    useStudioStore.getState().checkpoint('manual');
  }

  const user = getCurrentUser(useAuthStore.getState());
  const manuscript = createBlankManuscript({
    ...input,
    author: user ? {
      displayName: user.profile.fullName,
      email: user.email,
      affiliation: user.profile.affiliation,
      affiliationRorId: user.profile.affiliationRorId,
      orcid: user.profile.orcid,
    } : undefined,
  });
  clearCurrentManuscriptFilePath();
  clearDocumentClosedState();
  useStudioStore.getState().loadManuscript(manuscript);
  return manuscript;
}
