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
import { StudioMenuWithHelp } from './components/StudioMenuWithHelp';
import {
  clearOjsLaunchPayload,
  readOjsLaunchPayload,
} from './integrations/ojs/importOjsLaunch';
import {
  createManuscriptFromOjsLaunch,
} from './integrations/ojs/importOjsLaunchLocalized';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const loadManuscript = useStudioStore(
    (state) => state.loadManuscript,
  );

  useEffect(() => {
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
  }, [loadManuscript]);

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
