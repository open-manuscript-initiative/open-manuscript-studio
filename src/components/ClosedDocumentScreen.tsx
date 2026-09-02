import { FolderOpen, Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { clearDocumentClosedState } from '../app/documentCloseState';
import { resumeLastSessionPersistence } from '../app/lastSessionPersistence';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { StudioMenuWithHelp } from './StudioMenuWithHelp';
import { NewDocumentActions } from './NewDocumentActions';

export function ClosedDocumentScreen() {
  const { locale } = useTranslation();
  const copy = getClosedDocumentCopy(locale);
  const [menuOpen, setMenuOpen] = useState(false);
  const closedManuscript = useRef(useStudioStore.getState().manuscript);
  const reopening = useRef(false);

  useEffect(() => {
    return useStudioStore.subscribe((state) => {
      if (reopening.current || state.manuscript === closedManuscript.current) return;
      reopening.current = true;
      clearDocumentClosedState();
      void resumeLastSessionPersistence().finally(() => window.location.reload());
    });
  }, []);

  return (
    <main className="auth-page" aria-labelledby="closed-document-title">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-name">OMI Studio</div>
          <div className="auth-brand-description">{copy.brand}</div>
        </div>
        <div className="auth-header">
          <h1 id="closed-document-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="auth-form">
          <NewDocumentActions variant="empty-workspace" />
          <button
            type="button"
            className="auth-primary-button"
            onClick={() => setMenuOpen(true)}
          >
            <FolderOpen size={18} aria-hidden="true" />
            {copy.open}
          </button>
          <p className="auth-field-hint">
            <Menu size={15} aria-hidden="true" /> {copy.hint}
          </p>
        </div>
      </section>

      <StudioMenuWithHelp
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </main>
  );
}

function getClosedDocumentCopy(locale: string) {
  if (locale === 'hu') {
    return {
      brand: 'Dokumentum nélküli munkatér',
      title: 'Nincs megnyitott dokumentum',
      description: 'Az előző dokumentum bezárult, és a következő indításkor sem nyílik meg automatikusan.',
      open: 'Dokumentum megnyitása vagy importálása',
      hint: 'A menüből OMI- vagy Word-dokumentumot is megnyithat.',
    };
  }

  if (locale === 'de') {
    return {
      brand: 'Arbeitsbereich ohne geöffnetes Dokument',
      title: 'Kein Dokument geöffnet',
      description: 'Das vorherige Dokument wurde geschlossen und wird beim nächsten Start nicht automatisch wieder geöffnet.',
      open: 'Dokument öffnen oder importieren',
      hint: 'Über das Menü können Sie OMI- oder Word-Dokumente öffnen.',
    };
  }

  return {
    brand: 'Workspace without an open document',
    title: 'No document is open',
    description: 'The previous document was closed and will not reopen automatically on the next launch.',
    open: 'Open or import a document',
    hint: 'Use the menu to open an OMI or Word document.',
  };
}
