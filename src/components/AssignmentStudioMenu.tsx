import { CircleHelp, Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  localeLabels,
  supportedLocales,
  useTranslation,
} from '../i18n';
import { getHelpCopy } from '../i18n/help';
import { HelpPanel } from './HelpPanel';

type AssignmentMenuView = 'settings' | 'help';

export function AssignmentStudioMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale, enabledLocales, setLocaleEnabled } = useTranslation();
  const helpCopy = getHelpCopy(locale);
  const [activeView, setActiveView] = useState<AssignmentMenuView>('settings');

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="studio-menu-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="studio-menu-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-studio-menu-title"
      >
        <header className="studio-menu-header">
          <button
            type="button"
            className="studio-menu-close"
            aria-label={t('studio.closeMenu')}
            title={t('studio.closeMenu')}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <div className="studio-menu-heading">
            <span className="studio-menu-eyebrow">Open Manuscript Studio</span>
            <h2 id="assignment-studio-menu-title">{t('studio.menu')}</h2>
          </div>
          <span className="studio-menu-header-spacer" aria-hidden="true" />
        </header>

        <div className="studio-menu-body">
          <nav className="studio-menu-navigation" aria-label={t('studio.menu')}>
            <button
              type="button"
              className={`studio-menu-nav-button${activeView === 'settings' ? ' studio-menu-nav-button--active' : ''}`}
              aria-current={activeView === 'settings' ? 'page' : undefined}
              onClick={() => setActiveView('settings')}
            >
              <Settings2 size={18} aria-hidden="true" />
              <span>{t('studio.navigation.settings')}</span>
            </button>
            <button
              type="button"
              className={`studio-menu-nav-button${activeView === 'help' ? ' studio-menu-nav-button--active' : ''}`}
              aria-current={activeView === 'help' ? 'page' : undefined}
              onClick={() => setActiveView('help')}
            >
              <CircleHelp size={18} aria-hidden="true" />
              <span>{helpCopy.navigation}</span>
            </button>
          </nav>

          <div className="studio-menu-content">
            {activeView === 'settings' ? (
              <section className="studio-menu-view">
                <div className="studio-menu-view-header">
                  <div>
                    <h3>{t('studio.settings.title')}</h3>
                    <p>{t('studio.settings.description')}</p>
                  </div>
                </div>
                <section className="studio-settings-card" aria-labelledby="assignment-interface-languages-title">
                  <div className="studio-settings-card-header">
                    <div>
                      <h4 id="assignment-interface-languages-title">{t('studio.settings.interfaceLanguages')}</h4>
                      <p>{t('studio.settings.interfaceLanguagesDescription')}</p>
                    </div>
                  </div>
                  <div className="studio-language-preference-list">
                    {supportedLocales.map((supportedLocale) => {
                      const enabled = enabledLocales.includes(supportedLocale);
                      const current = supportedLocale === locale;
                      return (
                        <label
                          className={`studio-language-preference${current ? ' studio-language-preference--current' : ''}`}
                          key={supportedLocale}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={current}
                            onChange={(event) => setLocaleEnabled(supportedLocale, event.target.checked)}
                          />
                          <span className="studio-language-preference-copy">
                            <strong>{localeLabels[supportedLocale]}</strong>
                            <small>
                              {current
                                ? t('studio.settings.currentLanguage')
                                : enabled
                                  ? t('studio.settings.enabledLanguage')
                                  : t('studio.settings.disabledLanguage')}
                            </small>
                          </span>
                          <code>{supportedLocale}</code>
                        </label>
                      );
                    })}
                  </div>
                  <p className="studio-settings-hint">{t('studio.settings.currentLanguageHint')}</p>
                </section>
                <div className="studio-settings-future-note">{t('studio.settings.futureLanguages')}</div>
              </section>
            ) : (
              <HelpPanel />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
