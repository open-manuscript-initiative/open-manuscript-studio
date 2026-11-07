import { clearLastSessionPersistence } from './lastSessionPersistence';
import { markDocumentClosedState } from './documentCloseState';
import { useStudioStore } from './useStudioStore';
import { forgetManuscriptFilePath } from '../services/nativeManuscriptFile';

export async function closeCurrentDocument(): Promise<void> {
  const current = useStudioStore.getState();
  if (!current.hasOpenDocument) return;
  current.checkpoint('manual');
  forgetManuscriptFilePath(current.manuscript.id);
  current.closeDocumentSession();

  // The session manager synchronously activates another open document, if any.
  // Only the final close clears recovery. Authentication stays in memory and
  // neither browser nor native WebView needs to bootstrap its session again.
  if (useStudioStore.getState().hasOpenDocument) return;
  markDocumentClosedState();
  try {
    await clearLastSessionPersistence();
  } catch {
    // The closed marker still prevents restoring this document on next start.
    console.warn('Unable to clear closed-document recovery storage.');
  }
}
