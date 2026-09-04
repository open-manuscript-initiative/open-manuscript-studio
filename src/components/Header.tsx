import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  StickyNote,
  UserRound,
  X,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { getCurrentStudyNotesCopy } from '../i18n/currentStudyNotes';
import { getHeaderSupplementalCopy } from '../i18n/headerSupplementalTranslations';
import { useTranslation } from '../i18n';
import {
  countStudyNotes,
  resolveCurrentStudy,
} from '../model/currentStudyNotes';
import { useAuthStore } from '../store/authStore';
import { AccountPanel } from './AccountPanel';
import { DesktopDocumentOutline } from './DesktopDocumentOutline';
import { HeaderInsertMenu } from './HeaderInsertMenu';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ProofingPanel } from './ProofingPanel';
import {
  getCloseSearchLabel,
  subscribeSearchOverlayState,
  toggleSearchOverlay,
} from './searchOverlayEvents';

interface HeaderProps {
  onOpenMenu: () => void;
}

export function Header({ onOpenMenu }: HeaderProps) {
  const { t, locale } = useTranslation();
  const headerCopy = getHeaderSupplementalCopy(locale);
  const currentNotesCopy = getCurrentStudyNotesCopy(locale);
  const [accountOpen, setAccountOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [outlineHost, setOutlineHost] = useState<HTMLElement | null>(null);
  const manuscript = useStudioStore((state) => state.manuscript);
  const pending = useStudioStore((state) => state.pendingChangeSet);
  const selectedId = useStudioStore((state) => state.selectedSectionId);
  const currentStudyNotesVisible = useStudioStore(
    (state) => state.currentStudyNotesVisible,
  );
  const toggleCurrentStudyNotes = useStudioStore(
    (state) => state.toggleCurrentStudyNotes,
  );
  const proofingPanelOpen = useStudioStore((state) => state.proofingPanelOpen);
  const toggleProofingPanel = useStudioStore((state) => state.toggleProofingPanel);
  const closeProofingPanel = useStudioStore((state) => state.closeProofingPanel);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.isLoading);
  const section = manuscript.sections.find((candidate) => candidate.id === selectedId);
  const outlineLabel = outlineOpen ? headerCopy.hideOutline : headerCopy.showOutline;
  const currentStudy = resolveCurrentStudy(manuscript, selectedId);
  const currentStudyNoteCount = currentStudy
    ? countStudyNotes(manuscript, currentStudy)
    : 0;
  const notesLabel = currentStudyNotesVisible
    ? currentNotesCopy.hide
    : currentNotesCopy.show;
  const proofingLabel = locale === 'hu'
    ? 'Korrektúra és változáskövetés'
    : locale === 'de'
      ? 'Korrektur und Änderungsverfolgung'
      : 'Proofing and tracked changes';

  useEffect(() => {
    const host = document.querySelector<HTMLElement>('.focus-workspace');
    setOutlineHost(host);
    if (!host) return;

    host.classList.toggle('focus-workspace--outline', outlineOpen);
    host.classList.toggle('focus-workspace--proofing', proofingPanelOpen);
    return () => {
      host.classList.remove('focus-workspace--outline');
      host.classList.remove('focus-workspace--proofing');
    };
  }, [outlineOpen, proofingPanelOpen]);

  useEffect(() => subscribeSearchOverlayState(setSearchOpen), []);

  const searchLabel = searchOpen
    ? getCloseSearchLabel(locale)
    : headerCopy.search;

  return (
    <>
      <header className="app-header focus-header">
        <div className="focus-header-identity">
          <button
            type="button"
            className="focus-menu-button"
            onClick={onOpenMenu}
            aria-label={t('studio.menu')}
          >
            <Menu size={19} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="focus-menu-button focus-outline-button"
            onClick={() => {
              closeProofingPanel();
              setOutlineOpen((current) => !current);
            }}
            aria-label={outlineLabel}
            title={outlineLabel}
            aria-pressed={outlineOpen}
          >
            {outlineOpen ? (
              <PanelLeftClose size={18} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={18} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className={`focus-menu-button focus-proofing-button${
              proofingPanelOpen ? ' is-active' : ''
            }`}
            onClick={() => {
              setOutlineOpen(false);
              toggleProofingPanel();
            }}
            aria-label={proofingLabel}
            title={proofingLabel}
            aria-pressed={proofingPanelOpen}
            aria-expanded={proofingPanelOpen}
            aria-controls="omi-proofing-panel"
          >
            <FileCheck2 size={18} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`focus-menu-button focus-current-notes-button${
              currentStudyNotesVisible ? ' is-active' : ''
            }`}
            onClick={toggleCurrentStudyNotes}
            aria-label={notesLabel}
            title={notesLabel}
            aria-pressed={currentStudyNotesVisible}
            aria-expanded={currentStudyNotesVisible}
            aria-controls="omi-current-study-notes"
          >
            <StickyNote size={18} aria-hidden="true" />
            <span className="focus-current-notes-button__count" aria-hidden="true">
              {currentStudyNoteCount}
            </span>
          </button>

          <button
            type="button"
            className={`focus-menu-button focus-search-button${searchOpen ? ' is-active' : ''}`}
            onClick={toggleSearchOverlay}
            aria-label={searchLabel}
            title={searchLabel}
            aria-pressed={searchOpen}
            aria-expanded={searchOpen}
            aria-controls="omi-search-replace"
          >
            {searchOpen ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
          </button>

          <div className="focus-brand-lockup">
            <img
              className="focus-brand-mark"
              src="/studio-icon.svg"
              width="34"
              height="34"
              alt=""
            />
            <span className="focus-brand-copy">
              <span className="focus-brand-initiative">Open Manuscript Initiative</span>
              <strong>Studio</strong>
            </span>
          </div>
        </div>

        <div className="focus-header-context" title={section?.title ?? manuscript.title}>
          <span className="focus-header-context-label">{headerCopy.manuscript}</span>
          <span className="focus-header-manuscript-title">{manuscript.title}</span>
          {section?.title && section.title !== manuscript.title ? (
            <>
              <span className="focus-header-context-divider">/</span>
              <span className="focus-header-section">{section.title}</span>
            </>
          ) : null}
        </div>

        <div className="focus-header-primary-action">
          <HeaderInsertMenu />
        </div>

        <div className="focus-header-actions">
          <div className={`focus-save-state${pending ? ' focus-save-state--pending' : ''}`}>
            {pending ? (
              <Clock3 size={15} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={15} aria-hidden="true" />
            )}
            <span>{pending ? t('studio.pending') : t('studio.saved')}</span>
          </div>
          <LanguageSwitcher />
          <button
            type="button"
            className="focus-menu-button"
            onClick={() => setAccountOpen(true)}
            aria-label={headerCopy.account}
            title={headerCopy.account}
          >
            <UserRound size={18} aria-hidden="true" />
            <span className="focus-logout-label">{headerCopy.account}</span>
          </button>
          <button
            type="button"
            className="focus-menu-button focus-logout-button"
            onClick={() => void logout().catch(() => {})}
            disabled={loading}
            aria-label={t('auth.logout')}
          >
            <LogOut size={18} aria-hidden="true" />
            <span className="focus-logout-label">{t('auth.logout')}</span>
          </button>
        </div>
      </header>

      {outlineOpen && outlineHost
        ? createPortal(
            <DesktopDocumentOutline onClose={() => setOutlineOpen(false)} />,
            outlineHost,
          )
        : null}

      {proofingPanelOpen && outlineHost
        ? createPortal(
            <ProofingPanel onClose={closeProofingPanel} />,
            outlineHost,
          )
        : null}

      {accountOpen ? (
        <div className="account-overlay" role="dialog" aria-modal="true" aria-label={headerCopy.account}>
          <div className="account-overlay-backdrop" onClick={() => setAccountOpen(false)} />
          <div className="account-drawer">
            <button
              type="button"
              className="account-close"
              onClick={() => setAccountOpen(false)}
              aria-label={t('common.close')}
            >
              <X size={22} aria-hidden="true" />
            </button>
            <AccountPanel />
          </div>
        </div>
      ) : null}
    </>
  );
}
