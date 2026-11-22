import { getStudioPlatform } from '../mobile/platform/platform';
import { readLocalManuscriptBytes } from './localManuscriptImport';
import { isWordDocxPackage } from './androidOpenedDocumentType';
import { prepareOfficeImport, type OfficeImportReceipt } from './exchangeSession';
import { parseDocxForStudio } from './docxImportStrategy';
import type { OmiManuscript } from '../types/omi';

interface DocumentReceiverPort {
  listen: (notify: () => void) => Promise<unknown>;
  takePending: () => Promise<string[]>;
  read: (uri: string) => Promise<Uint8Array>;
}
interface Receiver {
  open: (manuscript: OmiManuscript) => void;
  error: (error: unknown) => void;
  importDocx?: (receipt: OfficeImportReceipt) => void;
}

/** One transport per WebView: subscribe before draining, serialize imports and
 * retain requests across React effect replay/authentication transitions. */
export function createAndroidDocumentReceiver(port: DocumentReceiverPort) {
  let receiver: Receiver | undefined;
  let started = false;
  let draining = false;
  let drainAgain = false;
  let importing = false;
  const pending: string[] = [];

  async function pump(): Promise<void> {
    if (importing) return;
    importing = true;
    try {
      while (receiver && pending.length) {
        const current = receiver;
        const uri = pending.shift()!;
        try {
          if (!uri.startsWith('content://')) throw new Error('Unsupported Android document location.');
          const bytes = await port.read(uri);
          if (isWordDocxPackage(bytes)) {
            if (!current.importDocx) throw new Error('Word import is not available in this view.');
            // Android SAF URIs generally hide the original filename. The Word
            // package signature determines the format, not the provider URI.
            const file = new File([Uint8Array.from(bytes)], 'Android document.docx', {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const receipt = await prepareOfficeImport(file, 'docx', parseDocxForStudio);
            if (receiver !== current) {
              pending.unshift(uri);
              continue;
            }
            // Keep the original bytes and ask for import-purpose confirmation;
            // opening a Word file must never silently rewrite its source.
            current.importDocx(receipt);
          } else {
            const { manuscript } = await readLocalManuscriptBytes(bytes);
            if (receiver !== current) {
              pending.unshift(uri);
              continue;
            }
            // Open as a copy: an OS read grant is not permission to overwrite.
            current.open(manuscript);
          }
        } catch (error) {
          receiver?.error(error);
        }
      }
    } finally {
      importing = false;
    }
  }

  async function drain(): Promise<void> {
    drainAgain = true;
    if (draining) return;
    draining = true;
    try {
      do {
        drainAgain = false;
        pending.push(...await port.takePending());
        void pump();
      } while (drainAgain);
    } catch (error) {
      receiver?.error(error);
    } finally {
      draining = false;
    }
  }

  return (open: Receiver['open'], error: Receiver['error'], importDocx?: Receiver['importDocx']): (() => void) => {
    const current = { open, error, importDocx };
    receiver = current;
    if (!started) {
      started = true;
      // This native listener belongs to the WebView lifetime, not a React mount.
      void port.listen(() => { void drain(); }).then(() => drain()).catch((cause) => {
        started = false;
        receiver?.error(cause);
      });
    } else {
      void drain();
    }
    void pump();
    return () => { if (receiver === current) receiver = undefined; };
  };
}

const connect = createAndroidDocumentReceiver({
  listen: async (notify) => (await import('@tauri-apps/api/event')).listen('omi-opened-documents', notify),
  takePending: async () => (await import('@tauri-apps/api/core')).invoke<string[]>('take_opened_documents'),
  read: async (uri) => (await import('@tauri-apps/plugin-fs')).readFile(uri),
});

export function connectAndroidDocumentOpening(
  open: Receiver['open'], error: Receiver['error'], importDocx?: Receiver['importDocx'],
): () => void {
  return getStudioPlatform() === 'android' ? connect(open, error, importDocx) : () => {};
}
