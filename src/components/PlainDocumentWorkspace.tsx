import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FilePlus2, FileText, LoaderCircle, X } from 'lucide-react';
import {
  createEuroOfficeSession,
  createPlainDocument,
  listPlainDocuments,
  type PlainDocumentSummary,
  type EuroOfficeLaunch,
} from '../services/euroOfficeApi';
import { useTranslation } from '../i18n';
import './PlainDocumentWorkspace.css';

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: Record<string, unknown>) => {
        destroyEditor?: () => void;
      };
    };
  }
}

let loadedApiScript: string | null = null;

function loadApiScript(url: string): Promise<void> {
  if (window.DocsAPI && loadedApiScript === url) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>('script[data-eurooffice-api="true"]');
    if (current && current.src === url && window.DocsAPI) {
      loadedApiScript = url;
      resolve();
      return;
    }
    current?.remove();
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.euroofficeApi = 'true';
    script.onload = () => {
      if (!window.DocsAPI) {
        reject(new Error('The EuroOffice editor API did not initialize.'));
        return;
      }
      loadedApiScript = url;
      resolve();
    };
    script.onerror = () => reject(new Error('The EuroOffice editor API could not be loaded.'));
    document.head.append(script);
  });
}

interface PlainDocumentWorkspaceProps {
  documentId: string | null;
  onClose: () => void;
  onSelectDocument: (documentId: string) => void;
}

export function PlainDocumentWorkspace({ documentId, onClose, onSelectDocument }: PlainDocumentWorkspaceProps) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const fallbackDocumentTitle = copy.document;
  const [documents, setDocuments] = useState<PlainDocumentSummary[]>([]);
  const [launch, setLaunch] = useState<EuroOfficeLaunch | null>(null);
  const [title, setTitle] = useState('');
  const [editorTitle, setEditorTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const [editorTarget, setEditorTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (documentId) return;
    let cancelled = false;
    setBusy(true);
    listPlainDocuments()
      .then((items) => { if (!cancelled) setDocuments(items); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      setLaunch(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError('');
    const editorType = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
      ? 'mobile'
      : 'desktop';
    createEuroOfficeSession(documentId, editorType)
      .then(async (session) => {
        await loadApiScript(session.apiScriptUrl);
        if (!cancelled) {
          const documentConfig = session.config.document as { title?: string } | undefined;
          setEditorTitle((documentConfig?.title ?? fallbackDocumentTitle).replace(/\.docx$/i, ''));
          setLaunch(session);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [documentId, fallbackDocumentTitle]);

  useEffect(() => {
    if (!launch || !editorTarget || !window.DocsAPI) return;
    editorTarget.id = 'eurooffice-editor-frame';
    editorRef.current = new window.DocsAPI.DocEditor(editorTarget.id, launch.config);
    return () => {
      editorRef.current?.destroyEditor?.();
      editorRef.current = null;
      editorTarget.replaceChildren();
    };
  }, [editorTarget, launch]);

  async function createDocument(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const created = await createPlainDocument(title.trim() || copy.untitled);
      setTitle('');
      setDocuments((items) => [created, ...items.filter((item) => item.id !== created.id)]);
      onSelectDocument(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="plain-document-workspace" aria-label={copy.workspace}>
      <header className="plain-document-header">
        {documentId ? (
          <button type="button" className="plain-document-toolbar-button" onClick={() => onSelectDocument('')}>
            <ArrowLeft size={17} aria-hidden="true" />{copy.documents}
          </button>
        ) : <span className="plain-document-brand"><FileText size={18} aria-hidden="true" />{copy.workspace}</span>}
        <h1>{documentId ? (documents.find((item) => item.id === documentId)?.title || editorTitle || copy.document) : copy.documents}</h1>
        <button type="button" className="plain-document-close" onClick={onClose} aria-label={copy.close} title={copy.close}>
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      {error ? <div className="plain-document-error" role="alert">{error}</div> : null}
      {documentId ? (
        <div className="plain-document-editor" ref={setEditorTarget}>
          {busy ? <div className="plain-document-loading"><LoaderCircle size={22} className="plain-document-spinner" />{copy.loading}</div> : null}
          {!busy && error ? <div className="plain-document-editor-error">{copy.editorUnavailable}</div> : null}
          <span className="sr-only">{launch ? copy.autosave : ''}</span>
        </div>
      ) : (
        <section className="plain-document-list" aria-labelledby="plain-document-list-title">
          <div className="plain-document-create">
            <h2 id="plain-document-list-title">{copy.documents}</h2>
            <p>{copy.description}</p>
            <form onSubmit={(event) => { event.preventDefault(); void createDocument(); }}>
              <label htmlFor="plain-document-title">{copy.titleLabel}</label>
              <input id="plain-document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} placeholder={copy.untitled} />
              <button type="submit" disabled={busy}><FilePlus2 size={17} aria-hidden="true" />{copy.create}</button>
            </form>
          </div>
          <div className="plain-document-items" aria-busy={busy}>
            {busy ? <p className="plain-document-muted"><LoaderCircle size={16} className="plain-document-spinner" />{copy.loading}</p> : null}
            {!busy && documents.length === 0 ? <p className="plain-document-muted">{copy.empty}</p> : null}
            {documents.map((item) => (
              <button key={item.id} type="button" className="plain-document-item" onClick={() => onSelectDocument(item.id)}>
                <FileText size={18} aria-hidden="true" />
                <span><strong>{item.title}</strong><small>{copy.updated}: {new Date(item.updatedAt).toLocaleDateString(locale)}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    workspace: 'Word-dokumentumok', documents: 'Dokumentumaim', document: 'Dokumentum', titleLabel: 'Dokumentum címe',
    untitled: 'Névtelen dokumentum', create: 'Új DOCX létrehozása', description: 'Egyszerű, DOCX-formátumú dokumentumok szerkesztése a EuroOffice beágyazott szövegszerkesztőjével.',
    loading: 'Betöltés…', empty: 'Még nincs DOCX-dokumentuma.', updated: 'Módosítva', close: 'Bezárás', autosave: 'A EuroOffice menti a módosításokat.', editorUnavailable: 'A EuroOffice szerkesztő nem érhető el.',
  };
  if (locale === 'de') return {
    workspace: 'Word-Dokumente', documents: 'Meine Dokumente', document: 'Dokument', titleLabel: 'Dokumenttitel',
    untitled: 'Unbenanntes Dokument', create: 'Neues DOCX erstellen', description: 'Einfache DOCX-Dokumente mit dem eingebetteten EuroOffice-Editor bearbeiten.',
    loading: 'Wird geladen…', empty: 'Sie haben noch keine DOCX-Dokumente.', updated: 'Geändert', close: 'Schließen', autosave: 'EuroOffice speichert Änderungen.', editorUnavailable: 'Der EuroOffice-Editor ist nicht verfügbar.',
  };
  return {
    workspace: 'Word documents', documents: 'My documents', document: 'Document', titleLabel: 'Document title',
    untitled: 'Untitled document', create: 'Create DOCX document', description: 'Write ordinary DOCX documents with the embedded EuroOffice editor.',
    loading: 'Loading…', empty: 'You do not have any DOCX documents yet.', updated: 'Updated', close: 'Close', autosave: 'EuroOffice saves your changes.', editorUnavailable: 'The EuroOffice editor is unavailable.',
  };
}
