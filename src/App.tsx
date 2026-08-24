import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';

import {
  getRestoredDesktopSession,
  updateDesktopSessionPersistence,
} from './app/lastSessionPersistence';
import { useStudioStore } from './app/useStudioStore';
import { AppLayout } from './components/AppLayout';
import {
  DesktopDocumentTabs,
  type DesktopDocumentTabId,
  type DesktopDocumentTabItem,
} from './components/DesktopDocumentTabs';
import { DesktopUpdatePrompt } from './components/DesktopUpdatePrompt';
import { EditorPane } from './components/EditorPane';
import { ReviewPortal } from './components/ReviewPortal';
import { SearchReplaceOverlay } from './components/SearchReplaceOverlay';
import { StudioMenuWithHelp } from './components/StudioMenuWithHelp';
import {
  createManuscriptFromOmpLaunch,
  fetchOmpHandoff,
} from './integrations/omp/importOmpLaunch';
import {
  clearOjsLaunchPayload,
  readOjsLaunchPayload,
  type OjsLaunchPayload,
} from './integrations/ojs/importOjsLaunch';
import {
  createManuscriptFromOjsLaunch,
} from './integrations/ojs/importOjsLaunchLocalized';
import { MobileLayout } from './mobile/navigation/MobileLayout';
import { isMobileStudio } from './mobile/platform/platform';
import type { OjsAssignmentLaunchContext } from './services/ojsAssignmentApi';
import {
  isNativeStudio,
  openLocalManuscript,
  saveLocalManuscript,
  saveLocalManuscriptAs,
} from './services/nativeManuscriptFile';
import type { OmiManuscript } from './types/omi';

import './styles/auth.css';
import './styles/history.css';

type AuthView = 'login' | 'register';
type ExternalImportState =
  | { status: 'idle'; message?: undefined }
  | { status: 'loading'; message?: undefined }
  | { status: 'error'; message: string };

type OjsContributors = NonNullable<OjsLaunchPayload['contributors']>;
type AssignmentAwareLaunch = OjsLaunchPayload & {
  actorMode?: 'editor' | 'author' | string | null;
  assignmentContext?: OjsAssignmentLaunchContext | null;
};

type DesktopTabSession = DesktopDocumentTabItem & {
  manuscript: OmiManuscript;
};

const LEGACY_OJS_LAUNCH_STORAGE_KEY = 'omi:ojs-launch';

function hasInitialOjsLaunch(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.has('omiOjsLaunch')) return true;

  try {
    return window.sessionStorage.getItem(LEGACY_OJS_LAUNCH_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function hasInitialOmpLaunch(): boolean {
  return new URL(window.location.href).searchParams.has('omiOmpLaunch');
}

async function fetchOjsHandoff(token: string): Promise<AssignmentAwareLaunch | null> {
  const response = await fetch(
    `/integrations/ojs/handoff/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      body?.error?.message || `OJS handoff failed with HTTP ${response.status}.`,
    );
  }

  const launch = await response.json() as AssignmentAwareLaunch;
  if (
    launch.protocol !== 'omi-integration/1' ||
    launch.profile !== 'omi-integration/1/ojs'
  ) {
    throw new Error('The OJS handoff returned an invalid launch payload.');
  }
  return launch;
}

export function App() {
  const [authView, setAuthView] = useState<AuthView>(() =>
    new URLSearchParams(window.location.search).has('invite') ? 'register' : 'login',
  );

  const authScreen = authView === 'login' ? (
    <LoginPage onShowRegister={() => setAuthView('register')} />
  ) : (
    <RegisterPage onShowLogin={() => setAuthView('login')} />
  );

  return <AuthGate fallback={authScreen}><StudioApplication /></AuthGate>;
}

function StudioApplication() {
  const reviewMode = new URLSearchParams(window.location.search).get('review') === '1';
  const mobileStudio = isMobileStudio();
  const restoredDesktopSession = useRef(
    !mobileStudio && !reviewMode ? getRestoredDesktopSession() : null,
  );
  const initialDesktopManuscript = useRef(useStudioStore.getState().manuscript);
  const initialDesktopTabId = useRef<DesktopDocumentTabId>(
    restoredDesktopSession.current?.activeTabId ?? crypto.randomUUID(),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [externalImportState, setExternalImportState] = useState<ExternalImportState>(() =>
    !reviewMode && (hasInitialOjsLaunch() || hasInitialOmpLaunch())
      ? { status: 'loading' }
      : { status: 'idle' },
  );
  const [ojsContributors, setOjsContributors] = useState<OjsContributors>([]);
  const [ojsAssignment, setOjsAssignment] = useState<{
    actorMode: 'editor' | 'author';
    context: OjsAssignmentLaunchContext;
  } | null>(null);
  const [desktopTabs, setDesktopTabs] = useState<DesktopTabSession[]>(() => {
    const restored = restoredDesktopSession.current;
    if (restored?.tabs.length) {
      return restored.tabs.map((tab) => ({
        id: tab.id,
        manuscriptId: tab.manuscriptId,
        title: tab.title,
        manuscript: tab.manuscript,
      }));
    }

    return [{
      id: initialDesktopTabId.current,
      manuscriptId: initialDesktopManuscript.current.id,
      title: getDocumentTabTitle(initialDesktopManuscript.current),
      manuscript: initialDesktopManuscript.current,
    }];
  });
  const [activeDesktopTabId, setActiveDesktopTabId] = useState<DesktopDocumentTabId>(
    restoredDesktopSession.current?.activeTabId ?? initialDesktopTabId.current,
  );
  const desktopTabsRef = useRef(desktopTabs);
  const activeDesktopTabIdRef = useRef(activeDesktopTabId);
  const switchingDesktopTabRef = useRef(false);
  const loadManuscript = useStudioStore((state) => state.loadManuscript);

  useEffect(() => {
    if (reviewMode || mobileStudio) return;

    updateDesktopSessionPersistence({
      tabs: desktopTabs.map((tab) => ({
        id: tab.id,
        manuscriptId: tab.manuscriptId,
        title: tab.title,
        manuscript: tab.manuscript,
      })),
      activeTabId: activeDesktopTabId,
    });
  }, [activeDesktopTabId, desktopTabs, mobileStudio, reviewMode]);

  useEffect(() => {
    if (reviewMode || mobileStudio) return;

    return useStudioStore.subscribe((state, previousState) => {
      if (state.manuscript === previousState.manuscript) return;

      setDesktopTabs((tabs) => {
        const activeId = activeDesktopTabIdRef.current;
        const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
        if (activeIndex < 0) return tabs;

        const activeTab = tabs[activeIndex];
        if (!activeTab) return tabs;

        if (
          !switchingDesktopTabRef.current &&
          state.manuscript.id !== activeTab.manuscriptId
        ) {
          const existing = tabs.find(
            (tab) => tab.manuscriptId === state.manuscript.id,
          );

          if (existing) {
            const nextTabs = tabs.map((tab) =>
              tab.id === existing.id
                ? createDesktopTabSession(existing.id, state.manuscript)
                : tab,
            );
            desktopTabsRef.current = nextTabs;
            activeDesktopTabIdRef.current = existing.id;
            setActiveDesktopTabId(existing.id);
            return nextTabs;
          }

          const nextTab = createDesktopTabSession(
            crypto.randomUUID(),
            state.manuscript,
          );
          const nextTabs = [...tabs, nextTab];
          desktopTabsRef.current = nextTabs;
          activeDesktopTabIdRef.current = nextTab.id;
          setActiveDesktopTabId(nextTab.id);
          return nextTabs;
        }

        const nextTabs = tabs.map((tab) =>
          tab.id === activeId
            ? createDesktopTabSession(tab.id, state.manuscript)
            : tab,
        );
        desktopTabsRef.current = nextTabs;
        return nextTabs;
      });
    });
  }, [mobileStudio, reviewMode]);

  const activateDesktopTab = useCallback((tabId: DesktopDocumentTabId) => {
    if (tabId === activeDesktopTabIdRef.current) return;

    useStudioStore.getState().checkpoint('manual');
    const target = desktopTabsRef.current.find((tab) => tab.id === tabId);
    if (!target) return;

    activeDesktopTabIdRef.current = tabId;
    setActiveDesktopTabId(tabId);
    switchingDesktopTabRef.current = true;
    useStudioStore.getState().loadManuscript(target.manuscript);
    switchingDesktopTabRef.current = false;
  }, []);

  const closeDesktopTab = useCallback((tabId: DesktopDocumentTabId) => {
    const tabs = desktopTabsRef.current;
    if (tabs.length <= 1) return;

    const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (closingIndex < 0) return;

    if (tabId !== activeDesktopTabIdRef.current) {
      const nextTabs = tabs.filter((tab) => tab.id !== tabId);
      desktopTabsRef.current = nextTabs;
      setDesktopTabs(nextTabs);
      return;
    }

    useStudioStore.getState().checkpoint('manual');
    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    const nextActive = nextTabs[Math.min(closingIndex, nextTabs.length - 1)];
    if (!nextActive) return;

    desktopTabsRef.current = nextTabs;
    setDesktopTabs(nextTabs);
    activeDesktopTabIdRef.current = nextActive.id;
    setActiveDesktopTabId(nextActive.id);
    switchingDesktopTabRef.current = true;
    useStudioStore.getState().loadManuscript(nextActive.manuscript);
    switchingDesktopTabRef.current = false;
  }, []);

  useEffect(() => {
    if (reviewMode) {
      setOjsContributors([]);
      setOjsAssignment(null);
      setExternalImportState({ status: 'idle' });
      return;
    }

    let cancelled = false;

    const importLaunch = async () => {
      const url = new URL(window.location.href);
      const ompHandoffToken = url.searchParams.get('omiOmpLaunch');
      const ojsHandoffToken = url.searchParams.get('omiOjsLaunch');
      const hasLaunchRequest = Boolean(ompHandoffToken)
        || Boolean(ojsHandoffToken)
        || hasInitialOjsLaunch();

      if (!hasLaunchRequest) {
        if (!cancelled) setExternalImportState({ status: 'idle' });
        return;
      }

      if (!cancelled) setExternalImportState({ status: 'loading' });

      try {
        if (ompHandoffToken) {
          const launch = await fetchOmpHandoff(ompHandoffToken);
          if (cancelled) return;
          const manuscript = createManuscriptFromOmpLaunch(launch);
          if (!manuscript) {
            throw new Error('The OMP monograph could not be initialized.');
          }

          setOjsContributors([]);
          setOjsAssignment(null);
          loadManuscript(manuscript);
          url.searchParams.delete('omiOmpLaunch');
          window.history.replaceState(
            null,
            '',
            `${url.pathname}${url.search}${url.hash}`,
          );
          setExternalImportState({ status: 'idle' });
          return;
        }

        let launch: AssignmentAwareLaunch | null = null;
        if (ojsHandoffToken && ojsHandoffToken !== '1') {
          launch = await fetchOjsHandoff(ojsHandoffToken);
        } else {
          launch = readOjsLaunchPayload() as AssignmentAwareLaunch | null;
        }

        if (cancelled) return;
        if (!launch) {
          throw new Error('The OJS launch payload is unavailable or has expired.');
        }

        const manuscript = createManuscriptFromOjsLaunch(launch);
        if (!manuscript) {
          throw new Error('The OJS manuscript could not be imported.');
        }

        setOjsContributors(
          launch.scope?.includes('contributors.read') ? launch.contributors ?? [] : [],
        );
        if (
          (launch.actorMode === 'editor' || launch.actorMode === 'author') &&
          launch.assignmentContext?.grant
        ) {
          setOjsAssignment({
            actorMode: launch.actorMode,
            context: launch.assignmentContext,
          });
        } else {
          setOjsAssignment(null);
        }

        loadManuscript(manuscript);
        clearOjsLaunchPayload();
        if (url.searchParams.has('omiOjsLaunch')) {
          url.searchParams.delete('omiOjsLaunch');
          window.history.replaceState(
            null,
            '',
            `${url.pathname}${url.search}${url.hash}`,
          );
        }
        setExternalImportState({ status: 'idle' });
      } catch (error) {
        console.error('Unable to retrieve or import the external launch payload.', error);
        if (!cancelled) {
          setExternalImportState({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'Unable to import the external manuscript.',
          });
        }
      }
    };

    void importLaunch();
    return () => {
      cancelled = true;
    };
  }, [loadManuscript, reviewMode]);

  useEffect(() => {
    if (reviewMode || !isNativeStudio()) return;
    const handleNativeFileShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 's' && key !== 'o') return;
      event.preventDefault();
      if (key === 'o') {
        void openLocalManuscript().then((result) => {
          if (result) loadManuscript(result.manuscript);
        });
        return;
      }
      const manuscript = useStudioStore.getState().manuscript;
      if (event.shiftKey) void saveLocalManuscriptAs(manuscript);
      else void saveLocalManuscript(manuscript);
    };
    window.addEventListener('keydown', handleNativeFileShortcut);
    return () => window.removeEventListener('keydown', handleNativeFileShortcut);
  }, [loadManuscript, reviewMode]);

  if (reviewMode) return <ReviewPortal />;

  if (externalImportState.status === 'loading') {
    return (
      <main className="auth-page" aria-busy="true" aria-live="polite">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-name">Open Manuscript Studio</div>
            <div className="auth-brand-description">Loading external manuscript…</div>
          </div>
        </section>
      </main>
    );
  }

  if (externalImportState.status === 'error') {
    return (
      <main className="auth-page" aria-live="assertive">
        <section className="auth-card">
          <div className="auth-header">
            <h1>Unable to load manuscript</h1>
            <p>{externalImportState.message}</p>
          </div>
        </section>
      </main>
    );
  }

  if (mobileStudio) {
    return (
      <>
        <MobileLayout onOpenMenu={() => setMenuOpen(true)}>
          <div className="focus-workspace">
            <EditorPane ojsContributors={ojsContributors} />
          </div>
          <SearchReplaceOverlay />
        </MobileLayout>
        <StudioMenuWithHelp
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          ojsAssignment={ojsAssignment}
        />
      </>
    );
  }

  return (
    <AppLayout onOpenMenu={() => setMenuOpen(true)}>
      <DesktopDocumentTabs
        tabs={desktopTabs}
        activeTabId={activeDesktopTabId}
        onActivate={activateDesktopTab}
        onClose={closeDesktopTab}
      />
      <div className="focus-workspace"><EditorPane ojsContributors={ojsContributors} /></div>
      <SearchReplaceOverlay />
      <DesktopUpdatePrompt />
      <StudioMenuWithHelp
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        ojsAssignment={ojsAssignment}
      />
    </AppLayout>
  );
}

function createDesktopTabSession(
  id: DesktopDocumentTabId,
  manuscript: OmiManuscript,
): DesktopTabSession {
  return {
    id,
    manuscriptId: manuscript.id,
    title: getDocumentTabTitle(manuscript),
    manuscript,
  };
}

function getDocumentTabTitle(manuscript: OmiManuscript): string {
  const title = manuscript.title?.trim();
  return title || 'Untitled manuscript';
}