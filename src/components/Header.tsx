import {
  CheckCircle2,
  Clock3,
  LogOut,
  Menu,
  Search,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { HeaderInsertMenu } from './HeaderInsertMenu';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  onOpenMenu: () => void;
}

const searchLabels: Record<string, string> = {
  bg: 'Търсене',
  cs: 'Hledat',
  da: 'Søg',
  de: 'Suchen',
  el: 'Αναζήτηση',
  en: 'Search',
  es: 'Buscar',
  et: 'Otsi',
  fi: 'Haku',
  fr: 'Rechercher',
  ga: 'Cuardaigh',
  hr: 'Pretraži',
  hu: 'Keresés',
  it: 'Cerca',
  lt: 'Ieškoti',
  lv: 'Meklēt',
  mt: 'Fittex',
  nl: 'Zoeken',
  pl: 'Szukaj',
  pt: 'Pesquisar',
  ro: 'Căutare',
  sk: 'Hľadať',
  sl: 'Iskanje',
  sv: 'Sök',
};

export function Header({ onOpenMenu }: HeaderProps) {
  const { t, locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const pendingChangeSet = useStudioStore(
    (state) => state.pendingChangeSet,
  );
  const selectedSectionId = useStudioStore(
    (state) => state.selectedSectionId,
  );
  const logout = useAuthStore((state) => state.logout);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const selectedSection = manuscript.sections.find(
    (section) => section.id === selectedSectionId,
  );
  const searchLabel = searchLabels[locale] ?? searchLabels.en;

  const handleLogout = () => {
    void logout().catch(() => {
      // The auth store clears the local session in logout()'s finally block,
      // even if the server-side logout request cannot be completed.
    });
  };

  const handleSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
      }),
    );
  };

  return (
    <header className="app-header focus-header">
      <div className="focus-header-identity">
        <button
          type="button"
          className="focus-menu-button"
          aria-label={t('studio.menu')}
          title={t('studio.menu')}
          onClick={onOpenMenu}
        >
          <Menu size={19} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="focus-menu-button focus-search-button"
          aria-label={searchLabel}
          title={`${searchLabel} (Ctrl+F)`}
          onClick={handleSearch}
        >
          <Search size={18} aria-hidden="true" />
        </button>

        <div className="focus-brand-lockup" aria-label="Open Manuscript Studio">
          <span className="focus-brand-mark" aria-hidden="true">OMI</span>
          <span className="focus-brand-copy">
            <span className="focus-brand-initiative">Open Manuscript Initiative</span>
            <strong>Studio</strong>
          </span>
        </div>
      </div>

      <div className="focus-header-context" title={selectedSection?.title ?? manuscript.title}>
        <span className="focus-header-context-label">Manuscript</span>
        <span className="focus-header-manuscript-title">{manuscript.title}</span>
        {selectedSection?.title && selectedSection.title !== manuscript.title ? (
          <>
            <span className="focus-header-context-divider" aria-hidden="true">/</span>
            <span className="focus-header-section">{selectedSection.title}</span>
          </>
        ) : null}
      </div>

      <div className="focus-header-primary-action">
        <HeaderInsertMenu />
      </div>

      <div className="focus-header-actions">
        <div
          className={`focus-save-state${
            pendingChangeSet ? ' focus-save-state--pending' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          {pendingChangeSet ? (
            <Clock3 size={15} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={15} aria-hidden="true" />
          )}
          <span>
            {pendingChangeSet
              ? t('studio.pending')
              : t('studio.saved')}
          </span>
        </div>

        <LanguageSwitcher />

        <button
          type="button"
          className="focus-menu-button focus-logout-button"
          aria-label={t('auth.logout')}
          title={t('auth.logout')}
          onClick={handleLogout}
          disabled={isAuthLoading}
        >
          <LogOut size={18} aria-hidden="true" />
          <span className="focus-logout-label">
            {t('auth.logout')}
          </span>
        </button>
      </div>
    </header>
  );
}
