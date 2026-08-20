import { useState, type ReactNode } from 'react';
import {
  FileText,
  LogOut,
  Menu,
  Pencil,
  Search,
  SlidersHorizontal,
  User,
} from 'lucide-react';

import { AccountPanel } from '../../components/AccountPanel';
import { DocumentTree } from '../../components/DocumentTree';
import { Footer } from '../../components/Footer';
import { HeaderInsertMenu } from '../../components/HeaderInsertMenu';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { PropertiesPanel } from '../../components/PropertiesPanel';
import { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import '../styles/mobile.css';

interface MobileLayoutProps {
  children: ReactNode;
  onOpenMenu: () => void;
}

type MobileView = 'document' | 'editor' | 'details' | 'account';

const searchLabels: Record<string, string> = {
  de: 'Suchen',
  en: 'Search',
  hu: 'Keresés',
};

const navLabels: Record<
  string,
  { document: string; editor: string; details: string; account: string }
> = {
  en: { document: 'Document', editor: 'Editor', details: 'Details', account: 'Account' },
  hu: { document: 'Dokumentum', editor: 'Szerkesztő', details: 'Részletek', account: 'Fiók' },
  de: { document: 'Dokument', editor: 'Editor', details: 'Details', account: 'Konto' },
};

export function MobileLayout({ children, onOpenMenu }: MobileLayoutProps) {
  const { t, locale } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const [view, setView] = useState<MobileView>('editor');
  const searchLabel = searchLabels[locale] ?? searchLabels.en;
  const nav = navLabels[locale] ?? navLabels.en;

  const handleSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
      }),
    );
  };

  const secondaryBarTitle =
    view === 'document'
      ? nav.document
      : view === 'details'
        ? nav.details
        : nav.account;

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-icon-button"
          onClick={onOpenMenu}
          aria-label={t('studio.menu')}
        >
          <Menu size={22} aria-hidden="true" />
        </button>

        <div className="mobile-header-title">
          <img src="/studio-icon.svg" width="28" height="28" alt="" aria-hidden="true" />
          <span>Open Manuscript Studio</span>
        </div>

        <button
          type="button"
          className="mobile-icon-button"
          onClick={() => void logout().catch(() => {})}
          aria-label={t('auth.logout')}
          disabled={isAuthLoading}
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      </header>

      {view === 'editor' ? (
        <div className="mobile-action-bar">
          <button
            type="button"
            className="mobile-action-button"
            onClick={handleSearch}
            aria-label={searchLabel}
          >
            <Search size={18} aria-hidden="true" />
            <span>{searchLabel}</span>
          </button>
          <div className="mobile-insert-action">
            <HeaderInsertMenu />
          </div>
          <LanguageSwitcher />
        </div>
      ) : (
        <div className="mobile-account-bar">
          <strong>{secondaryBarTitle}</strong>
          <LanguageSwitcher />
        </div>
      )}

      <main className="mobile-workspace">
        {view === 'document' ? (
          <div className="mobile-document-view">
            <DocumentTree onNavigate={() => setView('editor')} />
          </div>
        ) : view === 'details' ? (
          <div className="mobile-details-view">
            <PropertiesPanel />
          </div>
        ) : view === 'account' ? (
          <AccountPanel />
        ) : (
          children
        )}
        <Footer />
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile Studio navigation">
        <button
          type="button"
          className={`mobile-nav-item${view === 'document' ? ' mobile-nav-item--active' : ''}`}
          aria-current={view === 'document' ? 'page' : undefined}
          onClick={() => setView('document')}
        >
          <FileText size={20} aria-hidden="true" />
          <span>{nav.document}</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item${view === 'editor' ? ' mobile-nav-item--active' : ''}`}
          aria-current={view === 'editor' ? 'page' : undefined}
          onClick={() => setView('editor')}
        >
          <Pencil size={20} aria-hidden="true" />
          <span>{nav.editor}</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item${view === 'details' ? ' mobile-nav-item--active' : ''}`}
          aria-current={view === 'details' ? 'page' : undefined}
          onClick={() => setView('details')}
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>{nav.details}</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item${view === 'account' ? ' mobile-nav-item--active' : ''}`}
          aria-current={view === 'account' ? 'page' : undefined}
          onClick={() => setView('account')}
        >
          <User size={20} aria-hidden="true" />
          <span>{nav.account}</span>
        </button>
      </nav>
    </div>
  );
}
