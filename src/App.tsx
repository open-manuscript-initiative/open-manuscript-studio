import {
  useEffect,
  useState,
} from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';

import { useStudioStore } from './app/useStudioStore';
import { AppLayout } from './components/AppLayout';
import { EditorPane } from './components/EditorPane';
import { ReviewPortal } from './components/ReviewPortal';
import { StudioMenuWithHelp } from './components/StudioMenuWithHelp';
import {
  clearOjsLaunchPayload,
  readOjsLaunchPayload,
  type OjsLaunchPayload,
} from './integrations/ojs/importOjsLaunch';
import {
  createManuscriptFromOjsLaunch,
} from './integrations/ojs/importOjsLaunchLocalized';
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

export function App() {
  const [authView, setAuthView] =
    useState<AuthView>('login');

  const authScreen =
    authView === 'login' ? (
      <LoginPage
        onShowRegister={() => {
          setAuthView('register');
        }}
      />
    ) : (
      <RegisterPage
        onShowLogin={() => {
          setAuthView('login');
        }}
      />
    );

  return (
    <AuthGate fallback={authScreen}>
      <StudioApplication />
    </AuthGate>
  );
}

function StudioApplication() {
  const reviewMode = new URLSearchParams(window.location.search).get('review') === '1';
  const [menuOpen, setMenuOpen] = useState(false);
  const [ojsContributors, setOjsContributors] = useState<OjsContributors>([]);
  const loadManuscript = useStudioStore(
    (state) => state.loadManuscript,
  );

  useEffect(() => {
    if (reviewMode) {
      setOjsContributors([]);
      return;
    }

    const launch = readOjsLaunchPayload();

    if (!launch) {
      return;
    }

    const manuscript =
      createManuscriptFromOjsLaunch(launch);

    if (!manuscript) {
      return;
    }

    // Keep the original OJS contributor records only in the current editor
    // session. This preserves editor-visible fields such as email while the
    // manuscript identity model continues to store portable author metadata.
    // Review mode never receives this state.
    setOjsContributors(
      launch.scope?.includes('contributors.read')
        ? launch.contributors ?? []
        : [],
    );

    loadManuscript(manuscript);
    clearOjsLaunchPayload();

    const url = new URL(window.location.href);
    if (url.searchParams.has('omiOjsLaunch')) {
      url.searchParams.delete('omiOjsLaunch');
      window.history.replaceState(
        null,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
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
      if (event.shiftKey) {
        void saveLocalManuscriptAs(manuscript);
      } else {
        void saveLocalManuscript(manuscript);
      }
    };

    window.addEventListener('keydown', handleNativeFileShortcut);
    return () => window.removeEventListener('keydown', handleNativeFileShortcut);
  }, [loadManuscript, reviewMode]);

  if (reviewMode) {
    return <ReviewPortal />;
  }

  return (
    <AppLayout onOpenMenu={() => setMenuOpen(true)}>
      <div className="focus-workspace">
        <EditorPane ojsContributors={ojsContributors} />
      </div>

      <StudioMenuWithHelp
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </AppLayout>
  );
}
