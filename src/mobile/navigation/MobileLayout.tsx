import type { ReactNode } from 'react';
import {
  FileText,
  LogOut,
  Menu,
  Pencil,
  Search,
  SlidersHorizontal,
  User,
} from 'lucide-react';

import { Footer } from '../../components/Footer';
import { HeaderInsertMenu } from '../../components/HeaderInsertMenu';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import '../styles/mobile.css';

interface MobileLayoutProps {
  children: ReactNode;
  onOpenMenu: () => void;
}

const searchLabels: Record<string, string> = {
  de: 'Suchen',
  en: 'Search',
  hu: 'Keresés',
};

export function MobileLayout({
  children,
  onOpenMenu,
}: MobileLayoutProps) {
  const { t, locale } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const searchLabel = searchLabels[locale] ?? searchLabels.en;

  const handleSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
      }),
    );
  };

  const handleLogout = () => {
    void logout().catch(() => {
      // logout() clears the local native session in its finally path.
    });
  };

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-icon-button"
          onClick={onOpenMenu}
          aria-label={t('studio.menu')}
          title={t('studio.menu')}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <div className="mobile-header-title">Open Manuscript Studio</div>
        <button
          type="button"
          className="mobile-icon-button"
          onClick={handleLogout}
          aria-label={t('auth.logout')}
          title={t('auth.logout')}
          disabled={isAuthLoading}
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="mobile-action-bar" aria-label="Studio actions">
        <button
          type="button"
          className="mobile-action-button"
          onClick={handleSearch}
          aria-label={searchLabel}
          title={searchLabel}
        >
          <Search size={18} aria-hidden="true" />
          <span>{searchLabel}</span>
        </button>
        <div className="mobile-insert-action">
          <HeaderInsertMenu />
        </div>
        <LanguageSwitcher />
      </div>

      <main className="mobile-workspace">
        {children}
        <Footer />
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile Studio navigation">
        <button type="button" className="mobile-nav-item" disabled>
          <FileText size={20} aria-hidden="true" />
          <span>Document</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item mobile-nav-item--active"
          aria-current="page"
        >
          <Pencil size={20} aria-hidden="true" />
          <span>Editor</span>
        </button>
        <button type="button" className="mobile-nav-item" disabled>
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>Details</span>
        </button>
        <button type="button" className="mobile-nav-item" disabled>
          <User size={20} aria-hidden="true" />
          <span>Account</span>
        </button>
      </nav>
    </div>
  );
}
