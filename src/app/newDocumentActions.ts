import { clearDocumentClosedState, isDocumentClosedState } from './documentCloseState';
import { useStudioStore } from './useStudioStore';
import { createBlankManuscript } from '../document/createBlankManuscript';
import type { OmiDocumentKind, OmiVolumeKind } from '../model/documentProfile';
import { clearCurrentManuscriptFilePath } from '../services/nativeManuscriptFile';
import type { OmiManuscript } from '../types/omi';

export function createAndOpenBlankOmiDocument(input: {
  kind: OmiDocumentKind;
  volumeKind?: OmiVolumeKind;
  locale: string;
}): OmiManuscript {
  if (!isDocumentClosedState()) {
    useStudioStore.getState().checkpoint('manual');
  }

  const manuscript = createBlankManuscript(input);
  clearCurrentManuscriptFilePath();
  clearDocumentClosedState();
  useStudioStore.getState().loadManuscript(manuscript);
  return manuscript;
}
