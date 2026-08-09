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
import { ReviewMode } from './components/ReviewMode';
import { StudioMenuWithHelp } from './components/StudioMenuWithHelp';
import {
  clearOjsLaunchPayload,
  readOjsLaunchPayload,
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
  const loadManuscript = useStudioStore(
    (state) => state.loadManuscript,
  );

  useEffect(() => {
    if (reviewMode) return;

    // AuthGate mounts StudioApplication only after the Studio session has
    // been established. A verified OJS handoff can therefore wait safely in
    // sessionStorage while the user signs in and resume automatically here.
    const launch = readOjsLaunchPayload();

    if (!launch) {
      return;
    }

    const manuscript =
      createManuscriptFromOjsLaunch(launch);

    if (!manuscript) {
      // Keep the handoff available for diagnostics/retry instead of losing it
      // on a malformed or temporarily unsupported import payload.
      return;
    }

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
    return <ReviewMode />;
  }

  return (
    <AppLayout onOpenMenu={() => setMenuOpen(true)}>
      <div className="focus-workspace">
        <EditorPane />
      </div>

      <StudioMenuWithHelp
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </AppLayout>
  );
}
