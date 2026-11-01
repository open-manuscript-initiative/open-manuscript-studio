import { createStudioDocumentSessions } from './app/documentSessions';
import {
  useCallback,
  useSyncExternalStore,
  useEffect,
  useRef,
  useState,
} from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { CollaborationInvitationGate } from './components/CollaborationInvitationGate';
import { CollaborationInbox } from './components/CollaborationInbox';

import {
  getRestoredDesktopSession,
} from './app/lastSessionPersistence';
import { useStudioStore } from './app/useStudioStore';
import { AppLayout } from './components/AppLayout';
import { ClosedDocumentScreen } from './components/ClosedDocumentScreen';
import { ProofreadingController } from './components/ProofreadingController';
import {
  DesktopDocumentTabs,
} from './components/DesktopDocumentTabs';
import { StudioUpdatePrompt } from './components/DesktopUpdatePrompt';
import { EditorPane } from './components/EditorPane';
import { PlainDocumentWorkspace } from './components/PlainDocumentWorkspace';
import { ReviewPortal } from './components/ReviewPortal';
import { SearchReplaceOverlay } from './components/SearchReplaceOverlay';
import { StudioMenuWithHelp } from './components/StudioMenuWithHelp';
import {
  createManuscriptFromOmpLaunch,
  fetchOmpHandoff,
  type OmpNativeAuthorContext,
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

import './styles/auth.css';
import './styles/history.css';
import { tCatalog } from './i18n';

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

  return (
    <>
      <AuthGate fallback={authScreen}>
        <CollaborationInbox>
          {new URLSearchParams(window.location.search).get('collaborationInvite') ? (
            <CollaborationInvitationGate
              token={new URLSearchParams(window.location.search).get('collaborationInvite')!}
            >
              <StudioApplication />
            </CollaborationInvitationGate>
          ) : <StudioApplication />}
        </CollaborationInbox>
      </AuthGate>
      <StudioUpdatePrompt />
    </>
  );
}

function StudioApplication() {
  const reviewMode = new URLSearchParams(window.location.search).get('review') === '1';
  const mobileStudio = isMobileStudio();
  const hasOpenDocument = useStudioStore((state) => state.hasOpenDocument);
  const activeManuscriptId = useStudioStore((state) => state.manuscript.id);
  const restoredDesktopSession = useRef(
    !reviewMode ? getRestoredDesktopSession() : null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [plainDocumentWorkspace, setPlainDocumentWorkspace] = useState<{
    open: boolean;
    documentId: string | null;
  }>({ open: false, documentId: null });
  const navigateHome = useCallback(() => setMenuOpen(false), []);
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
  const [ompAuthorAssignment, setOmpAuthorAssignment] = useState<{
    manuscriptId: string;
    context: OmpNativeAuthorContext;
  } | null>(null);
  const [documentSessions] = useState(() => createStudioDocumentSessions(restoredDesktopSession.current));
  const sessionSnapshot = useSyncExternalStore(documentSessions.subscribe, documentSessions.getSnapshot);
  const { tabs: desktopTabs, activeTabId: activeDesktopTabId } = sessionSnapshot;
  useEffect(() => reviewMode ? undefined : documentSessions.connect(), [documentSessions, reviewMode]);
  const activateDesktopTab = documentSessions.activate;
  const closeDesktopTab = documentSessions.close;
  const loadManuscript = useStudioStore((state) => state.loadManuscript);

  useEffect(() => {
    const openPlainDocument = (event: Event) => {
      const detail = (event as CustomEvent<{ documentId?: unknown }>).detail;
      const documentId = typeof detail?.documentId === 'string' && detail.documentId
        ? detail.documentId
        : null;
      setPlainDocumentWorkspace({ open: true, documentId });
    };
    window.addEventListener('omi-open-plain-document', openPlainDocument);
    return () => window.removeEventListener('omi-open-plain-document', openPlainDocument);
  }, []);
  // Effect cleanup must not discard a redeemed one-time token. Reuse the
  // request when React replays the effect while its first fetch is pending.
  const ojsHandoffRequests = useRef(new Map<string, Promise<AssignmentAwareLaunch | null>>());

  useEffect(() => {
    if (reviewMode) {
      setOjsContributors([]);
      setOjsAssignment(null);
      setOmpAuthorAssignment(null);
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
          setOmpAuthorAssignment(
            launch.actorMode === 'author' && launch.nativeContext?.actorMode === 'author'
              ? { manuscriptId: manuscript.id, context: launch.nativeContext }
              : null,
          );
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
          let request = ojsHandoffRequests.current.get(ojsHandoffToken);
          if (!request) {
            request = fetchOjsHandoff(ojsHandoffToken);
            ojsHandoffRequests.current.set(ojsHandoffToken, request);
          }
          launch = await request;
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
        setOmpAuthorAssignment(null);
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
      if (!useStudioStore.getState().hasOpenDocument) return;
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
            <div className="auth-brand-description">{tCatalog("/uncataloguedUi/app/loading-external-manuscript-fb96d07")}</div>
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
            <h1>{tCatalog("/uncataloguedUi/app/unable-to-load-manuscript-29ad65e")}</h1>
            <p>{externalImportState.message}</p>
          </div>
        </section>
      </main>
    );
  }

  if (plainDocumentWorkspace.open) {
    return (
      <PlainDocumentWorkspace
        documentId={plainDocumentWorkspace.documentId}
        onClose={() => setPlainDocumentWorkspace({ open: false, documentId: null })}
        onSelectDocument={(documentId) => setPlainDocumentWorkspace({ open: true, documentId: documentId || null })}
      />
    );
  }

  if (!hasOpenDocument) return <ClosedDocumentScreen />;

  if (mobileStudio) {
    return (
      <>
        <ProofreadingController />
        <MobileLayout
          onOpenMenu={() => setMenuOpen(true)}
          onHome={navigateHome}
          documentTabs={
            <DesktopDocumentTabs
              tabs={desktopTabs}
              activeTabId={activeDesktopTabId}
              onActivate={activateDesktopTab}
              onClose={closeDesktopTab}
            />
          }
        >
          <div className="focus-workspace">
            <EditorPane ojsContributors={ojsContributors} />
          </div>
          <SearchReplaceOverlay />
        </MobileLayout>
        <StudioMenuWithHelp
          open={menuOpen}
          onClose={navigateHome}
          ojsAssignment={ojsAssignment}
          ompAuthorContext={
            ompAuthorAssignment?.manuscriptId === activeManuscriptId
              ? ompAuthorAssignment.context
              : null
          }
        />
      </>
    );
  }

  return (
    <AppLayout
      onOpenMenu={() => setMenuOpen(true)}
      onHome={navigateHome}
    >
      <ProofreadingController />
      <DesktopDocumentTabs
        tabs={desktopTabs}
        activeTabId={activeDesktopTabId}
        onActivate={activateDesktopTab}
        onClose={closeDesktopTab}
      />
      <div className="focus-workspace"><EditorPane ojsContributors={ojsContributors} /></div>
      <SearchReplaceOverlay />
      <StudioMenuWithHelp
        open={menuOpen}
        onClose={navigateHome}
        ojsAssignment={ojsAssignment}
        ompAuthorContext={
          ompAuthorAssignment?.manuscriptId === activeManuscriptId
            ? ompAuthorAssignment.context
            : null
        }
      />
    </AppLayout>
  );
}
