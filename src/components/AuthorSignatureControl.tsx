import { Fingerprint, X } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '../i18n';
import { AuthorSignaturePanel } from './AuthorSignaturePanel';

export function AuthorSignatureControl() {
  const { locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = locale === 'hu'
    ? 'Kriptográfiai aláírás'
    : locale === 'de'
      ? 'Kryptografische Signatur'
      : 'Cryptographic signature';

  return (
    <>
      <div className="studio-tool-actions" style={{ justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button type="button" className="studio-menu-secondary-action" onClick={() => setOpen(true)}>
          <Fingerprint size={16} aria-hidden="true" />
          {label}
        </button>
      </div>
      {open ? (
        <div className="studio-menu-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <aside className="studio-menu-drawer" role="dialog" aria-modal="true" aria-label={label}>
            <header className="studio-menu-header">
              <div><span className="studio-menu-eyebrow">Open Manuscript Studio</span><h2>{label}</h2></div>
              <button type="button" className="studio-menu-close" aria-label="Close" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
            </header>
            <div className="studio-menu-content"><AuthorSignaturePanel /></div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
