import { Download } from 'lucide-react';

import { useTranslation } from '../i18n';
import { downloadBlobInBrowser } from '../services/browserBlobDownload';

export interface WebPublicationDownload {
  artifact: Blob;
  fileName: string;
  sidecarText: string;
  sidecarFileName: string;
}

/**
 * Browser downloads must start from separate real user clicks. In particular,
 * two synthetic clicks following an awaited PDF render may be suppressed or
 * silently dropped by mobile browsers.
 */
export function WebPublicationDownloads({ download }: { download: WebPublicationDownload }) {
  const { locale } = useTranslation();
  const copy = locale === 'hu'
    ? {
        ready: 'Az export elkészült. Töltse le külön a dokumentumot és az ellenőrző JSON-fájlt.',
        artifact: 'Dokumentum letöltése',
        sidecar: 'Ellenőrző JSON letöltése',
      }
    : locale === 'de'
      ? {
          ready: 'Der Export ist bereit. Laden Sie das Dokument und die Prüf-JSON-Datei einzeln herunter.',
          artifact: 'Dokument herunterladen',
          sidecar: 'Prüf-JSON herunterladen',
        }
      : {
          ready: 'The export is ready. Download the document and verification JSON separately.',
          artifact: 'Download document',
          sidecar: 'Download verification JSON',
        };

  return (
    <div className="studio-settings-hint" role="group" aria-label={copy.ready}>
      <p role="status">{copy.ready}</p>
      <div className="studio-tool-actions">
        <button
          type="button"
          className="studio-menu-primary-action"
          onClick={() => downloadBlobInBrowser(download.artifact, download.fileName)}
        >
          <Download size={16} aria-hidden="true" /> {copy.artifact} ({download.fileName})
        </button>
        <button
          type="button"
          onClick={() => downloadBlobInBrowser(
            new Blob([download.sidecarText], { type: 'application/json;charset=utf-8' }),
            download.sidecarFileName,
          )}
        >
          <Download size={16} aria-hidden="true" /> {copy.sidecar}
        </button>
      </div>
    </div>
  );
}
