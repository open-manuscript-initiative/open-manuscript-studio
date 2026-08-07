import {
  BookOpen,
  Download,
  FileText,
  History as HistoryIcon,
  Library,
  RotateCcw,
  Settings2,
  StickyNote,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import {
  localeLabels,
  supportedLocales,
  useTranslation,
} from '../i18n';
import { downloadOmiJson } from '../services/exportOmi';
import { Footer } from './Footer';
import { HistoryPanel } from './HistoryPanel';
import { KeywordEditor } from './KeywordEditor';
import { ManuscriptLanguageField } from './ManuscriptLanguageField';
import { NotesPanel } from './NotesPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { ReferencesPanel } from './ReferencesPanel';
import { SectionNumberingControl } from './SectionNumberingControl';
import { SectionStructurePanel } from './SectionStructurePanel';

type StudioMenuView =
  | 'document'
  | 'manuscript'
  | 'notes'
  | 'references'
  | 'contributors'
  | 'history'
  | 'tools'
  | 'settings';

interface StudioMenuProps {
  open: boolean;
  onClose: () => void;
}

export function StudioMenu({
  open,
  onClose,
}: StudioMenuProps) {
  const { t } = useTranslation();
  const [activeView, setActiveView] =
    useState<StudioMenuView>('document');

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="studio-menu-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        className="studio-menu-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-menu-title"
      >
        <header className="studio-menu-header">
          <div>
            <span className="studio-menu-eyebrow">
              Open Manuscript Studio
            </span>
            <h2 id="studio-menu-title">
              {t('studio.menu')}
            </h2>
          </div>

          <button
            type="button"
            className="studio-menu-close"
            aria-label={t('studio.closeMenu')}
            title={t('studio.closeMenu')}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="studio-menu-body">
          <nav
            className="studio-menu-navigation"
            aria-label={t('studio.menu')}
          >
            <MenuButton
              active={activeView === 'document'}
              icon={<BookOpen size={18} aria-hidden="true" />}
              label={t('studio.navigation.document')}
              onClick={() => setActiveView('document')}
            />
            <MenuButton
              active={activeView === 'manuscript'}
              icon={<FileText size={18} aria-hidden="true" />}
              label={t('studio.navigation.manuscript')}
              onClick={() => setActiveView('manuscript')}
            />
            <MenuButton
              active={activeView === 'notes'}
              icon={<StickyNote size={18} aria-hidden="true" />}
              label={t('studio.navigation.notes')}
              onClick={() => setActiveView('notes')}
            />
            <MenuButton
              active={activeView === 'references'}
              icon={<Library size={18} aria-hidden="true" />}
              label={t('studio.navigation.references')}
              onClick={() => setActiveView('references')}
            />
            <MenuButton
              active={activeView === 'contributors'}
              icon={<Users size={18} aria-hidden="true" />}
              label={t('studio.navigation.contributors')}
              onClick={() => setActiveView('contributors')}
            />
            <MenuButton
              active={activeView === 'history'}
              icon={<HistoryIcon size={18} aria-hidden="true" />}
              label={t('studio.navigation.history')}
              onClick={() => setActiveView('history')}
            />
            <MenuButton
              active={activeView === 'tools'}
              icon={<Wrench size={18} aria-hidden="true" />}
              label={t('studio.navigation.tools')}
              onClick={() => setActiveView('tools')}
            />
            <MenuButton
              active={activeView === 'settings'}
              icon={<Settings2 size={18} aria-hidden="true" />}
              label={t('studio.navigation.settings')}
              onClick={() => setActiveView('settings')}
            />
          </nav>

          <div className="studio-menu-content">
            {activeView === 'document' ? (
              <DocumentMenuView onNavigate={onClose} />
            ) : null}
            {activeView === 'manuscript' ? <ManuscriptDataView /> : null}
            {activeView === 'notes' ? (
              <NotesPanel onNavigate={onClose} />
            ) : null}
            {activeView === 'references' ? <ReferencesPanel /> : null}
            {activeView === 'contributors' ? <PropertiesPanel /> : null}
            {activeView === 'history' ? <HistoryPanel /> : null}
            {activeView === 'tools' ? <ToolsView /> : null}
            {activeView === 'settings' ? <SettingsView /> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

interface MenuButtonProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function MenuButton({
  active,
  icon,
  label,
  onClick,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      className={`studio-menu-nav-button${
        active ? ' studio-menu-nav-button--active' : ''
      }`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DocumentMenuView({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{t('studio.document.title')}</h3>
          <p>{t('studio.document.description')}</p>
        </div>
      </div>

      <SectionNumberingControl />
      <SectionStructurePanel onNavigate={onNavigate} />
    </section>
  );
}

function ManuscriptDataView() {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const setAbstract = useStudioStore((state) => state.setAbstract);

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{t('studio.manuscript.title')}</h3>
          <p>{t('studio.manuscript.description')}</p>
        </div>
      </div>

      <div className="studio-manuscript-fields">
        <label>
          <span>{t('manuscript.abstract')}</span>
          <textarea
            value={manuscript.abstract ?? ''}
            onChange={(event) => setAbstract(event.target.value)}
          />
        </label>

        <KeywordEditor />
        <ManuscriptLanguageField />
      </div>
    </section>
  );
}

function ToolsView() {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore(
    (state) => state.selectedSectionId,
  );
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const resetSample = useStudioStore((state) => state.resetSample);
  const selectedSection = manuscript.sections.find(
    (section) => section.id === selectedSectionId,
  );

  const semanticSection = selectedSection
    ? {
        id: selectedSection.id,
        title: selectedSection.title,
        blocks: selectedSection.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          content: parseBlockContent(block.content),
        })),
      }
    : null;

  function exportManuscript(): void {
    checkpoint('export');
    downloadOmiJson(useStudioStore.getState().manuscript);
  }

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{t('studio.tools.title')}</h3>
          <p>{t('studio.tools.description')}</p>
        </div>
      </div>

      <div className="studio-tool-card">
        <div>
          <strong>{t('studio.tools.export')}</strong>
          <p>{t('studio.tools.exportDescription')}</p>
        </div>
        <button
          type="button"
          className="studio-menu-primary-action"
          onClick={exportManuscript}
        >
          <Download size={16} aria-hidden="true" />
          {t('studio.tools.export')}
        </button>
      </div>

      <div className="studio-tool-card">
        <div>
          <strong>{t('studio.tools.reset')}</strong>
          <p>{t('studio.tools.resetDescription')}</p>
        </div>
        <button
          type="button"
          className="studio-menu-secondary-action studio-menu-danger-action"
          onClick={() => {
            if (window.confirm(t('studio.tools.confirmReset'))) {
              resetSample();
            }
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t('studio.tools.reset')}
        </button>
      </div>

      <details className="studio-technical-details">
        <summary>{t('studio.tools.technicalData')}</summary>
        <p>{t('studio.tools.technicalDescription')}</p>
        <div className="studio-json-header">
          <strong>{t('studio.tools.liveJson')}</strong>
          <span>{t('studio.tools.synced')}</span>
        </div>
        <pre className="studio-json-view">
          <code>{JSON.stringify(semanticSection, null, 2)}</code>
        </pre>
      </details>

      <div className="studio-menu-footer-wrap">
        <Footer />
      </div>
    </section>
  );
}

function SettingsView() {
  const {
    locale,
    enabledLocales,
    setLocaleEnabled,
    t,
  } = useTranslation();

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{t('studio.settings.title')}</h3>
          <p>{t('studio.settings.description')}</p>
        </div>
      </div>

      <section
        className="studio-settings-card"
        aria-labelledby="studio-interface-languages-title"
      >
        <div className="studio-settings-card-header">
          <div>
            <h4 id="studio-interface-languages-title">
              {t('studio.settings.interfaceLanguages')}
            </h4>
            <p>{t('studio.settings.interfaceLanguagesDescription')}</p>
          </div>
        </div>

        <div className="studio-language-preference-list">
          {supportedLocales.map((supportedLocale) => {
            const enabled = enabledLocales.includes(supportedLocale);
            const current = supportedLocale === locale;

            return (
              <label
                className={`studio-language-preference${
                  current ? ' studio-language-preference--current' : ''
                }`}
                key={supportedLocale}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={current}
                  onChange={(event) =>
                    setLocaleEnabled(
                      supportedLocale,
                      event.target.checked,
                    )
                  }
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

        <p className="studio-settings-hint">
          {t('studio.settings.currentLanguageHint')}
        </p>
      </section>

      <div className="studio-settings-future-note">
        {t('studio.settings.futureLanguages')}
      </div>
    </section>
  );
}

function parseBlockContent(content: string): unknown {
  if (content.trim().length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return { legacyText: content };
  }
}
