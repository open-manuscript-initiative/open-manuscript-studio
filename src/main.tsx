import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { isDocumentClosedState } from './app/documentCloseState';
import { initializeLastSessionPersistence } from './app/lastSessionPersistence';
import { initializeRevisionIntegrity } from './app/revisionIntegrity';
import { ClosedDocumentScreen } from './components/ClosedDocumentScreen';
import { ProofreadingController } from './components/ProofreadingController';
import { I18nProvider } from './i18n';

import './styles/global.css';
import './styles/editor.css';
import './styles/continuous-editor.css';
import './styles/front-matter.css';
import './styles/rich-text.css';
import './styles/selection-toolbar.css';
import './styles/studio-shell.css';
import './styles/settings.css';
import './styles/manuscript-language.css';
import './styles/notes.css';
import './styles/section-numbering.css';
import './styles/section-structure.css';
import './styles/keyword-editor.css';
import './styles/citation-system.css';
import './styles/reference-lookup.css';
import './styles/csl-rendering.css';
import './styles/visual-elements.css';
import './styles/insert-menu-opaque.css';
import './styles/cross-references.css';
import './styles/ror-affiliation.css';
import './styles/orcid-lookup.css';
import './styles/editor-i18n.css';
import './styles/docx-import.css';
import './styles/publication-profile.css';
import './styles/publisher-profile.css';
import './styles/publication-style-export.css';
import './styles/jats-export.css';
import './styles/html-export.css';
import './styles/asset-container.css';
import './styles/state-digest.css';
import './styles/footer.css';
import './styles/academic-shell.css';
import './styles/mobile-language-switcher.css';
import './styles/desktop-fullscreen-panels.css';
import './styles/desktop-document-tabs.css';
import './styles/proofreading.css';
import './styles/account-profiles.css';

initializeRevisionIntegrity();

const SESSION_RESTORE_BOOT_BUDGET_MS = 1200;

async function bootstrap(): Promise<void> {
  const sessionRestore = initializeLastSessionPersistence();
  await Promise.race([
    sessionRestore,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, SESSION_RESTORE_BOOT_BUDGET_MS);
    }),
  ]).catch((error) => {
    console.warn('Studio session restore failed during bootstrap.', error);
  });

  // A slow or blocked IndexedDB restore must never prevent the first frame.
  // Keep it alive in the background so a late successful restore can still
  // populate the Zustand store after the UI has mounted.
  void sessionRestore.catch((error) => {
    console.warn('Studio session restore could not complete.', error);
  });

  const documentClosed = isDocumentClosedState();

  ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  ).render(
    <React.StrictMode>
      <I18nProvider>
        {documentClosed ? (
          <ClosedDocumentScreen />
        ) : (
          <>
            <ProofreadingController />
            <App />
          </>
        )}
      </I18nProvider>
    </React.StrictMode>
  );
}

void bootstrap();
