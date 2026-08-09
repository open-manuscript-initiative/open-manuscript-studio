import {
  CheckCircle2,
  Clock3,
  LogOut,
  Menu,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { HeaderInsertMenu } from './HeaderInsertMenu';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  onOpenMenu: () => void;
}

export function Header({ onOpenMenu }: HeaderProps) {
  const { t } = useTranslation();
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

  const handleLogout = () => {
    void logout().catch(() => {
      // The auth store clears the local session in logout()'s finally block,
      // even if the server-side logout request cannot be completed.
    });
  };

  return (
    <header className="app-header focus-header">
      <button
        type="button"
        className="focus-menu-button"
        aria-label={t('studio.menu')}
        title={t('studio.menu')}
        onClick={onOpenMenu}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className="focus-header-context">
        <span className="focus-header-brand">
          Open Manuscript Studio
        </span>
        <span className="focus-header-section">
          {selectedSection?.title ?? manuscript.title}
        </span>
      </div>

      <HeaderInsertMenu />

      <div className="focus-header-actions">
        <div
          className={`focus-save-state${
            pendingChangeSet ? ' focus-save-state--pending' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          {pendingChangeSet ? (
            <Clock3 size={16} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
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
          <LogOut size={20} aria-hidden="true" />
          <span className="focus-logout-label">
            {t('auth.logout')}
          </span>
        </button>
      </div>
    </header>
  );
}
