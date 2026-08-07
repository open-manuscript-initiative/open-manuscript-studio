import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { I18nProvider } from './i18n';

import './styles/global.css';
import './styles/editor.css';
import './styles/rich-text.css';
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
import './styles/cross-references.css';
import './styles/ror-affiliation.css';
import './styles/orcid-lookup.css';
import './styles/editor-i18n.css';
import './styles/docx-import.css';
import './styles/publication-profile.css';

ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
