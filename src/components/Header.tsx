import {
  CheckCircle2,
  Clock3,
  Menu,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';

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
  const selectedSection = manuscript.sections.find(
    (section) => section.id === selectedSectionId,
  );

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
    </header>
  );
}
