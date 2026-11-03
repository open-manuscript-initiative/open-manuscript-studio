import { useEffect, useState, type ReactNode } from 'react';
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
  User,
  X,
} from 'lucide-react';

import { AccountPanel } from '../../components/AccountPanel';
import { DesktopDocumentOutline } from '../../components/DesktopDocumentOutline';
import { ProofingPanel } from '../../components/ProofingPanel';
import { useStudioStore } from '../../app/useStudioStore';
import { countStudyNotes, resolveCurrentStudy } from '../../model/currentStudyNotes';
import { getCurrentStudyNotesCopy } from '../../i18n/currentStudyNotes';
import { getHeaderSupplementalCopy } from '../../i18n/headerSupplementalTranslations';
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
  documentTabs?: ReactNode;
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

export function MobileLayout({ children, documentTabs, onOpenMenu, onHome }: MobileLayoutProps) {
  const { t, locale } = useTranslation();
  const menuCopy = getStudioMenuSupplementalCopy(locale);
  const headerCopy = getHeaderSupplementalCopy(locale);
  const notesCopy = getCurrentStudyNotesCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const pendingChanges = useStudioStore((state) => state.pendingChangeSet);
  const notesVisible = useStudioStore((state) => state.currentStudyNotesVisible);
  const toggleNotes = useStudioStore((state) => state.toggleCurrentStudyNotes);
  const proofingOpen = useStudioStore((state) => state.proofingPanelOpen);
  const toggleProofing = useStudioStore((state) => state.toggleProofingPanel);
  const closeProofing = useStudioStore((state) => state.closeProofingPanel);
  const logout = useAuthStore((state) => state.logout);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const [view, setView] = useState<MobileView>('editor');
  const [searchOpen, setSearchOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineHost, setOutlineHost] = useState<HTMLElement | null>(null);
  const searchButtonText = searchLabels[locale] ?? searchLabels.en;
  const searchLabel = searchOpen
    ? getCloseSearchLabel(locale)
    : searchButtonText;
  const nav = navLabels[locale] ?? navLabels.en;
  const study = resolveCurrentStudy(manuscript, selectedSectionId);
  const noteCount = study ? countStudyNotes(manuscript, study) : 0;
  const noteLabel = notesVisible ? notesCopy.hide : notesCopy.show;
  const outlineLabel = outlineOpen ? headerCopy.hideOutline : headerCopy.showOutline;
  const proofingLabel = locale.startsWith('hu') ? 'Korrektúra és változáskövetés'
    : locale.startsWith('de') ? 'Korrektur und Änderungsverfolgung'
      : 'Proofing and tracked changes';

  useEffect(() => subscribeSearchOverlayState(setSearchOpen), []);
  useEffect(() => {
    const host = view === 'editor'
      ? document.querySelector<HTMLElement>('.mobile-workspace .focus-workspace')
      : null;
    setOutlineHost(host);
    if (!host) return;
    host.classList.toggle('focus-workspace--outline', outlineOpen);
    host.classList.toggle('focus-workspace--proofing', proofingOpen);
    return () => {
      host.classList.remove('focus-workspace--outline');
      host.classList.remove('focus-workspace--proofing');
    };
  }, [view, outlineOpen, proofingOpen]);

  return (
    <div className={`mobile-shell${documentTabs && view === 'editor' ? ' mobile-shell--document-tabs' : ''}`}>
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
            setOutlineOpen(false);
            closeProofing();
            if (searchOpen) toggleSearchOverlay();
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
            onClick={() => {
              setOutlineOpen(false);
              closeProofing();
              if (searchOpen) toggleSearchOverlay();
              setView('account');
            }}
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
            className="mobile-action-button mobile-icon-action"
            onClick={() => {
              closeProofing();
              setOutlineOpen((current) => !current);
            }}
            aria-label={outlineLabel}
            title={outlineLabel}
            aria-pressed={outlineOpen}
          >
            {outlineOpen ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={`mobile-action-button mobile-icon-action${proofingOpen ? ' is-active' : ''}`}
            onClick={() => {
              setOutlineOpen(false);
              toggleProofing();
            }}
            aria-label={proofingLabel}
            title={proofingLabel}
            aria-pressed={proofingOpen}
            aria-expanded={proofingOpen}
            aria-controls="omi-proofing-panel"
          >
            <FileCheck2 size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`mobile-action-button mobile-icon-action${notesVisible ? ' is-active' : ''}`}
            onClick={toggleNotes}
            aria-label={noteLabel}
            title={noteLabel}
            aria-pressed={notesVisible}
          >
            <StickyNote size={18} aria-hidden="true" />
            <span className="mobile-notes-count" aria-hidden="true">{noteCount}</span>
          </button>
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
          <div className={`mobile-save-state${pendingChanges ? ' mobile-save-state--pending' : ''}`}
            role="status" aria-label={pendingChanges ? t('studio.pending') : t('studio.saved')}
            title={pendingChanges ? t('studio.pending') : t('studio.saved')}>
            {pendingChanges ? <Clock3 size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
          </div>
        </div>
      ) : (
        <div className="mobile-account-bar">
          <strong>{nav.account}</strong>
        </div>
      )}

      {documentTabs && view === 'editor' ? (
        <div className="mobile-document-tab-strip">{documentTabs}</div>
      ) : null}

      <main className="mobile-workspace">
        {view === 'account' ? <AccountPanel /> : children}
        <Footer />
      </main>
      {view === 'editor' && outlineOpen && outlineHost
        ? createPortal(<DesktopDocumentOutline onClose={() => setOutlineOpen(false)} />, outlineHost)
        : null}
      {view === 'editor' && proofingOpen && outlineHost
        ? createPortal(<ProofingPanel onClose={closeProofing} />, outlineHost)
        : null}
    </div>
  );
}
