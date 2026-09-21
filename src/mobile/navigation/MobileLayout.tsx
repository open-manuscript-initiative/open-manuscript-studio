import { useEffect, useState, type ReactNode } from 'react';
import {
  LogOut,
  Menu,
  Search,
  User,
  X,
} from 'lucide-react';

import { AccountPanel } from '../../components/AccountPanel';
import { Footer } from '../../components/Footer';
import { HeaderInsertMenu } from '../../components/HeaderInsertMenu';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import {
  getCloseSearchLabel,
  subscribeSearchOverlayState,
  toggleSearchOverlay,
} from '../../components/searchOverlayEvents';
import { getStudioMenuSupplementalCopy } from '../../i18n/studioMenuSupplementalTranslations';
import { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import '../styles/mobile.css';

interface MobileLayoutProps {
  children: ReactNode;
  onOpenMenu: () => void;
  onHome: () => void;
}

type MobileView = 'editor' | 'account';

const searchLabels: Record<string, string> = {
  de: 'Suchen',
  en: 'Search',
  hu: 'Keresés',
};

const navLabels: Record<
  string,
  { account: string }
> = {
  en: { account: 'Account' },
  hu: { account: 'Fiók' },
  de: { account: 'Konto' },
};

export function MobileLayout({ children, onOpenMenu, onHome }: MobileLayoutProps) {
  const { t, locale } = useTranslation();
  const menuCopy = getStudioMenuSupplementalCopy(locale);
  const logout = useAuthStore((state) => state.logout);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const [view, setView] = useState<MobileView>('editor');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonText = searchLabels[locale] ?? searchLabels.en;
  const searchLabel = searchOpen
    ? getCloseSearchLabel(locale)
    : searchButtonText;
  const nav = navLabels[locale] ?? navLabels.en;

  useEffect(() => subscribeSearchOverlayState(setSearchOpen), []);


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

        <button
          type="button"
          className="mobile-header-title mobile-header-home"
          onClick={() => {
            setView('editor');
            onHome();
          }}
          aria-label={menuCopy.home}
          title={menuCopy.home}
          data-app-home-navigation="true"
        >
          <img src="/studio-icon.svg" width="28" height="28" alt="" aria-hidden="true" />
          <span>Open Manuscript Studio</span>
        </button>

        <div className="mobile-header-actions">
          <LanguageSwitcher />
          <button
            type="button"
            className={`mobile-icon-button mobile-account-button${view === 'account' ? ' is-active' : ''}`}
            onClick={() => setView('account')}
            aria-label={nav.account}
            title={nav.account}
            aria-pressed={view === 'account'}
          >
            <User size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="mobile-icon-button mobile-top-logout"
            onClick={() => void logout().catch(() => {})}
            aria-label={t('auth.logout')}
            title={t('auth.logout')}
            disabled={isAuthLoading}
          >
            <LogOut size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {view === 'editor' ? (
        <div className="mobile-action-bar">
          <button
            type="button"
            className={`mobile-action-button${searchOpen ? ' is-active' : ''}`}
            onClick={toggleSearchOverlay}
            aria-label={searchLabel}
            aria-pressed={searchOpen}
            aria-expanded={searchOpen}
            aria-controls="omi-search-replace"
          >
            {searchOpen ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
            <span>{searchButtonText}</span>
          </button>
          <div className="mobile-insert-action">
            <HeaderInsertMenu />
          </div>
        </div>
      ) : (
        <div className="mobile-account-bar">
          <strong>{nav.account}</strong>
        </div>
      )}

      <main className="mobile-workspace">
        {view === 'account' ? <AccountPanel /> : children}
        <Footer />
      </main>

    </div>
  );
}
