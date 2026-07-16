# OMI Studio i18n integration

1. Copy the `src/` directory into the repository root.
2. Wrap the application in `I18nProvider` in `src/main.tsx`.
3. Use `useTranslation()` in components.
4. Add `LanguageSwitcher` where the interface language selector should appear.
5. Keep `metadata.language` independent from the UI language.

Example `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
```

Build:

```bash
npm run build
```
