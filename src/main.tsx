import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { initializeLastSessionPersistence } from './app/lastSessionPersistence';
import { initializeRevisionIntegrity } from './app/revisionIntegrity';
import {
  I18nProvider,
  loadTranslationDictionary,
  resolveInitialUiLocale,
} from './i18n';
import { restorePendingExternalLaunchToLocation } from './services/pendingExternalLaunch';

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
import './styles/scholarly-metadata.css';
import './styles/ui-density.css';

restorePendingExternalLaunchToLocation();
initializeRevisionIntegrity();

const SESSION_RESTORE_BOOT_BUDGET_MS = 1200;
const LOCALE_BOOT_BUDGET_MS = 1500;

function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function bootstrap(): Promise<void> {
  const sessionRestore = initializeLastSessionPersistence();
  const initialLocale = resolveInitialUiLocale();
  const localeReady = loadTranslationDictionary(initialLocale).catch((error) => {
    console.warn(
      `Studio locale ${initialLocale} could not be loaded during bootstrap.`,
      error,
    );
  });

  await Promise.all([
    Promise.race([
      sessionRestore,
      delay(SESSION_RESTORE_BOOT_BUDGET_MS),
    ]).catch((error) => {
      console.warn('Studio session restore failed during bootstrap.', error);
    }),
    Promise.race([
      localeReady,
      delay(LOCALE_BOOT_BUDGET_MS),
    ]),
  ]);

  // A slow or blocked IndexedDB restore must never prevent the first frame.
  // Keep it alive in the background so a late successful restore can still
  // populate the Zustand store after the UI has mounted.
  void sessionRestore.catch((error) => {
    console.warn('Studio session restore could not complete.', error);
  });

  ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  ).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );
}

void bootstrap();
