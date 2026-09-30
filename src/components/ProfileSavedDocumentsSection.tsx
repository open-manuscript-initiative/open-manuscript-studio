import { FolderOpen, Link2Off, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { useTranslation } from '../i18n';
import { getCloudStorageCopy } from '../i18n/cloudStorageTranslations';
import {
  downloadCloudBackup,
  listProfileSavedDocuments,
  unlinkProfileSavedDocument,
  type ProfileSavedDocument,
} from '../services/cloudStorageApi';
import { inspectOmiContainer } from '../services/omiContainerImport';

function formatBytes(value: string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProfileSavedDocumentsSection({ confirmOpen = true }: { confirmOpen?: boolean }) {
  const { locale } = useTranslation();
  const copy = getCloudStorageCopy(locale);
  const [documents, setDocuments] = useState<ProfileSavedDocument[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void listProfileSavedDocuments()
      .then((saved) => { if (active) setDocuments(saved); })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, []);

  async function openSavedDocument(document: ProfileSavedDocument): Promise<void> {
    if (confirmOpen) {
      const confirmation = (copy.confirmOpenSavedDocument ?? copy.confirmRestore).replace('{title}', document.title);
      if (!window.confirm(confirmation)) return;
    }
    setBusy(`open:${document.id}`);
    setMessage(copy.restoring);
    try {
      const bytes = await downloadCloudBackup(document.id);
      const plan = await inspectOmiContainer(bytes);
      if (!plan.validForImport || !plan.manuscript) throw new Error(copy.invalidPackage);
      await applyOmiContainerImportPlan(plan);
      setMessage(copy.restored);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function removeProfileLink(document: ProfileSavedDocument): Promise<void> {
    const confirmation = (copy.confirmRemoveProfileLink ?? 'Remove this link from your profile? The saved document will remain in cloud storage.').replace('{title}', document.title);
    if (!window.confirm(confirmation)) return;
    setBusy(`unlink:${document.id}`);
    setMessage('');
    try {
      await unlinkProfileSavedDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setMessage(copy.profileLinkRemoved ?? 'The profile link was removed. The cloud document remains in storage.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="studio-cloud-section" data-profile-saved-documents="true">
      <strong><FolderOpen size={16} aria-hidden="true" /> {copy.savedDocumentsTitle ?? 'My saved documents'}</strong>
      <p>{copy.savedDocumentsDescription ?? 'Cloud storage locations linked to this personal profile. Removing an entry does not delete the cloud file.'}</p>
      {documents.length === 0 ? <p>{copy.noSavedDocuments ?? 'No documents have been saved to cloud storage for this profile yet.'}</p> : (
        <div className="studio-language-preference-list">
          {documents.map((document) => (
            <div className="studio-language-preference" key={document.id}>
              <span className="studio-language-preference-copy">
                {document.locationUrl ? (
                  <a
                    className="studio-profile-saved-document-title"
                    href={document.locationUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {document.title}
                  </a>
                ) : <strong>{document.title}</strong>}
                <small>{document.connectionName} · {new Date(document.createdAt).toLocaleString(locale)} · {formatBytes(document.sizeBytes)}</small>
                {!document.locationUrl ? <small>{document.providerPath}</small> : null}
              </span>
              <div className="studio-profile-saved-document-actions">
                <button type="button" className="studio-menu-secondary-action" disabled={busy !== null} onClick={() => void openSavedDocument(document)}>
                  <RotateCcw size={14} aria-hidden="true" /> {busy === `open:${document.id}` ? copy.restoring : copy.openInStudio ?? copy.restore}
                </button>
                <button type="button" className="studio-menu-secondary-action studio-menu-danger-action" disabled={busy !== null} onClick={() => void removeProfileLink(document)}>
                  <Link2Off size={14} aria-hidden="true" /> {copy.removeProfileLink ?? copy.remove}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
    </div>
  );
}
