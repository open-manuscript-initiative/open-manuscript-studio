import { FilePlus2, FileUp, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createBlankManuscript } from '../document/createBlankManuscript';
import { getEuroOfficeCopy } from '../i18n/euroOfficeTranslations';
import { useTranslation } from '../i18n';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { buildDocxExport } from '../services/exportDocx';
import {
  createOfficeDocument,
  deleteOfficeDocument,
  getOfficeDocumentStatus,
  getOfficeEditorConfig,
  listOfficeDocuments,
  uploadOfficeDocument,
  type OfficeDocumentSummary,
  type OfficeEditorConfig,
} from '../services/officeDocumentApi';
import './EuroOfficeWorkspace.css';

declare global {
  interface Window {
    DocsAPI?: { DocEditor: new (elementId: string, config: Record<string, unknown>) => { destroyEditor?: () => void } };
  }
}

export function EuroOfficeWorkspace() {
  const { locale } = useTranslation();
  const words = getEuroOfficeCopy(locale);
  const user = useAuthStore(getCurrentUser);
  const authorName = user?.profile.fullName.trim() ?? '';
  const authorEmail = user?.email.trim() ?? '';
  const [title, setTitle] = useState('');
  const [documents, setDocuments] = useState<OfficeDocumentSummary[]>([]);
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeDocument, setActiveDocument] = useState<OfficeDocumentSummary | null>(null);
  const [editorConfig, setEditorConfig] = useState<OfficeEditorConfig | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const editorElementId = useRef(`euro-office-${crypto.randomUUID()}`);
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const status = await getOfficeDocumentStatus();
      setServerEnabled(status.enabled);
      if (status.enabled) setDocuments(await listOfficeDocuments());
    } catch {
      setServerEnabled(false);
      setError(words.unavailable);
    }
  }, [words.unavailable]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let script: HTMLScriptElement | null = null;
    async function mountEditor() {
      if (!editorConfig || !activeDocument) return;
      try {
        if (!window.DocsAPI) {
          script = document.createElement('script');
          script.src = editorConfig.apiScriptUrl;
          script.async = true;
          await new Promise<void>((resolve, reject) => {
            script!.onload = () => resolve();
            script!.onerror = () => reject(new Error(words.genericError));
            document.head.appendChild(script!);
          });
        }
        if (cancelled || !window.DocsAPI) return;
        editorRef.current?.destroyEditor?.();
        editorRef.current = new window.DocsAPI.DocEditor(editorElementId.current, editorConfig.config);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : words.genericError);
      }
    }
    void mountEditor();
    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor?.();
      editorRef.current = null;
      if (script && !window.DocsAPI) script.remove();
    };
  }, [activeDocument, editorConfig, words.genericError]);

  async function openDocument(document: OfficeDocumentSummary) {
    setBusy(true); setError(''); setMessage('');
    try {
      const config = await getOfficeEditorConfig(document.id, locale);
      setActiveDocument(document);
      setEditorConfig(config);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : words.genericError);
    } finally { setBusy(false); }
  }

  async function deleteDocument(document: OfficeDocumentSummary) {
    if (!window.confirm(words.deleteConfirmation(document.title))) return;
    setBusy(true); setError('');
    try {
      await deleteOfficeDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : words.genericError);
    } finally { setBusy(false); }
  }

  async function createBlank() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || !authorName || !authorEmail) return;
    setBusy(true); setError(''); setMessage(words.saving);
    try {
      const manuscript = createBlankManuscript({
        kind: 'study', locale, title: normalizedTitle,
        author: {
          displayName: authorName,
          email: authorEmail,
          affiliation: user?.profile.affiliation,
          orcid: user?.profile.orcid,
        },
      });
      const exported = buildDocxExport(manuscript);
      const fileName = `${safeName(normalizedTitle)}.docx`;
      const created = await createOfficeDocument({
        title: normalizedTitle, fileName, file: exported.blob, authorName, authorEmail,
      });
      setDocuments((current) => [created, ...current]);
      setTitle('');
      setMessage('');
      await openDocument(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : words.genericError);
      setMessage('');
    } finally { setBusy(false); }
  }

  async function uploadFile(file?: File) {
    if (!file) return;
    if (!/\.docx$/iu.test(file.name)) { setError(words.uploadInvalid); return; }
    if (!authorName || !authorEmail) { setError(words.genericError); return; }
    setBusy(true); setError(''); setMessage(words.saving);
    try {
      const uploaded = await uploadOfficeDocument({
        title: file.name.replace(/\.docx$/iu, ''), file, authorName, authorEmail,
      });
      setDocuments((current) => [uploaded, ...current]);
      setMessage('');
      await openDocument(uploaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : words.genericError);
      setMessage('');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function closeEditor() {
    editorRef.current?.destroyEditor?.();
    editorRef.current = null;
    setActiveDocument(null);
    setEditorConfig(null);
    void refresh();
  }

  return (
    <section className="studio-menu-view euro-office-workspace">
      <div className="studio-menu-view-header">
        <div><h3>{words.title}</h3><p>{words.description}</p></div>
        {serverEnabled && !activeDocument ? <button type="button" className="euro-office-refresh" onClick={() => void refresh()} aria-label={words.refresh}><RefreshCw size={16} aria-hidden="true" /></button> : null}
      </div>
      {error ? <p className="euro-office-message euro-office-message--error" role="alert">{error}</p> : null}
      {message ? <p className="euro-office-message" role="status">{message}</p> : null}
      {serverEnabled === null && !error ? <p className="euro-office-message"><LoaderCircle size={16} className="euro-office-spin" aria-hidden="true" />{words.loading}</p> : null}
      {serverEnabled === false ? <div className="euro-office-not-configured"><strong>{words.notConfigured}</strong><p>{words.notConfiguredHelp}</p></div> : null}
      {serverEnabled && activeDocument ? <div className="euro-office-editor-shell">
        <div className="euro-office-editor-toolbar"><strong>{activeDocument.title}</strong><button type="button" onClick={closeEditor}><X size={16} aria-hidden="true" />{words.close}</button></div>
        <div id={editorElementId.current} className="euro-office-editor" />
      </div> : null}
      {serverEnabled && !activeDocument ? <>
        <div className="euro-office-create">
          <h4>{words.newTitle}</h4>
          <label><span>{words.titleLabel}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} /></label>
          <div className="euro-office-author"><span>{words.author}: <strong>{authorName || '—'}</strong></span><span>{words.email}: <strong>{authorEmail || '—'}</strong></span></div>
          <p>{words.attribution}</p>
          <div className="euro-office-actions">
            <button type="button" onClick={() => void createBlank()} disabled={busy || !title.trim() || !authorName || !authorEmail}><FilePlus2 size={16} aria-hidden="true" />{words.create}</button>
            <button type="button" className="euro-office-secondary" onClick={() => fileInputRef.current?.click()} disabled={busy || !authorName || !authorEmail}><FileUp size={16} aria-hidden="true" />{words.upload}</button>
            <input ref={fileInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(event) => { void uploadFile(event.currentTarget.files?.[0]); }} />
          </div>
        </div>
        <div className="euro-office-documents"><div className="euro-office-documents-heading"><h4>{words.documents}</h4><button type="button" onClick={() => void refresh()}>{words.refresh}</button></div>
          {documents.length === 0 ? <p>{words.empty}</p> : <ul>{documents.map((document) => <li key={document.id}><div><strong>{document.title}</strong><span>{document.authorName} · {new Date(document.updatedAt).toLocaleDateString(locale)}</span></div><div className="euro-office-document-actions"><button type="button" onClick={() => void openDocument(document)} disabled={busy}>{words.open}</button><button type="button" className="euro-office-delete" onClick={() => void deleteDocument(document)} disabled={busy}>{words.delete}</button></div></li>)}</ul>}
        </div>
      </> : null}
    </section>
  );
}

function safeName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/gu, '-').slice(0, 120) || 'document';
}
