import {
  useEffect,
  useState,
} from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';

import { useStudioStore } from './app/useStudioStore';
import { AppLayout } from './components/AppLayout';
import { DesktopUpdatePrompt } from './components/DesktopUpdatePrompt';
import { EditorPane } from './components/EditorPane';
import { ReviewPortal } from './components/ReviewPortal';
import { SearchReplaceOverlay } from './components/SearchReplaceOverlay';
import { StudioMenuWithHelp } from './components/StudioMenuWithHelp';
import {
  clearOjsLaunchPayload,
  readOjsLaunchPayload,
  type OjsLaunchPayload,
} from './integrations/ojs/importOjsLaunch';
import {
  createManuscriptFromOjsLaunch,
} from './integrations/ojs/importOjsLaunchLocalized';
import type { OjsAssignmentLaunchContext } from './services/ojsAssignmentApi';
import {
  isNativeStudio,
  openLocalManuscript,
  saveLocalManuscript,
  saveLocalManuscriptAs,
} from './services/nativeManuscriptFile';

import './styles/auth.css';
import './styles/history.css';

type AuthView = 'login' | 'register';

type OjsContributors = NonNullable<OjsLaunchPayload['contributors']>;
type AssignmentAwareLaunch = OjsLaunchPayload & {
  actorMode?: 'editor' | 'author' | string | null;
  assignmentContext?: OjsAssignmentLaunchContext | null;
};

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [ojsContributors, setOjsContributors] = useState<OjsContributors>([]);
  const [ojsAssignment, setOjsAssignment] = useState<{
    actorMode: 'editor' | 'author';
    context: OjsAssignmentLaunchContext;
  } | null>(null);
  const loadManuscript = useStudioStore((state) => state.loadManuscript);

  useEffect(() => {
    if (reviewMode) {
      setOjsContributors([]);
      setOjsAssignment(null);
      return;
    }

    let cancelled = false;

    const importLaunch = async () => {
      const url = new URL(window.location.href);
      const handoffToken = url.searchParams.get('omiOjsLaunch');

      let launch: AssignmentAwareLaunch | null = null;
      try {
        if (handoffToken && handoffToken !== '1') {
          launch = await fetchOjsHandoff(handoffToken);
        } else {
          // Backward compatibility with the former sessionStorage handoff.
          launch = readOjsLaunchPayload() as AssignmentAwareLaunch | null;
        }
      } catch (error) {
        console.error('Unable to retrieve the OJS launch payload.', error);
        return;
      }

      if (cancelled || !launch) return;
      const manuscript = createManuscriptFromOjsLaunch(launch);
      if (!manuscript) return;

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

  return (
    <AppLayout onOpenMenu={() => setMenuOpen(true)}>
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
