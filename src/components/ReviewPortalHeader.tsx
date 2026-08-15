import { LogOut, Menu } from 'lucide-react';

import { useTranslation } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { LanguageSwitcher } from './LanguageSwitcher';

export function ReviewPortalHeader({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  const { t } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const isAuthLoading = useAuthStore((state) => state.isLoading);

  const handleLogout = () => {
    void logout().catch(() => {
      // logout() clears the local session in its finally block.
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
        <span className="focus-header-brand">Open Manuscript Studio</span>
        <span className="focus-header-section">{t('studio.menu')}</span>
      </div>

      <div className="focus-header-actions">
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
          <span className="focus-logout-label">{t('auth.logout')}</span>
        </button>
      </div>
    </header>
  );
}
