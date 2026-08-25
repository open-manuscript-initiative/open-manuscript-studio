import { clearLastSessionPersistence } from './lastSessionPersistence';
import { markDocumentClosedState } from './documentCloseState';
import { useStudioStore } from './useStudioStore';
import { clearCurrentManuscriptFilePath } from '../services/nativeManuscriptFile';

export async function closeCurrentDocument(): Promise<void> {
  useStudioStore.getState().checkpoint('manual');
  markDocumentClosedState();
  clearCurrentManuscriptFilePath();
  await clearLastSessionPersistence();
  window.location.reload();
}