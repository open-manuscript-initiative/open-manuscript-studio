import { FolderOpen, Menu } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '../i18n';
import '../styles/closed-document.css';
import { StudioMenuWithHelp } from './StudioMenuWithHelp';
import { NewDocumentActions } from './NewDocumentActions';

export function ClosedDocumentScreen() {
  const { locale } = useTranslation();
  const copy = getClosedDocumentCopy(locale);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className="auth-page closed-document-page" aria-labelledby="closed-document-title">
      <section className="auth-card closed-document-card">
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
      description: 'Hozzon létre új tanulmányt vagy kötetet, vagy nyisson meg egy meglévő dokumentumot.',
      open: 'Dokumentum megnyitása vagy importálása',
      hint: 'A menüből OMI- vagy Word-dokumentumot is megnyithat.',
    };
  }

  if (locale === 'de') {
    return {
      brand: 'Arbeitsbereich ohne geöffnetes Dokument',
      title: 'Kein Dokument geöffnet',
      description: 'Erstellen Sie einen neuen Beitrag oder Band, oder öffnen Sie ein vorhandenes Dokument.',
      open: 'Dokument öffnen oder importieren',
      hint: 'Über das Menü können Sie OMI- oder Word-Dokumente öffnen.',
    };
  }

  return {
    brand: 'Workspace without an open document',
    title: 'No document is open',
    description: 'Create a new study or volume, or open an existing document.',
    open: 'Open or import a document',
    hint: 'Use the menu to open an OMI or Word document.',
  };
}
