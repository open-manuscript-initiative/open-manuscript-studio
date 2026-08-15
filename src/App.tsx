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

export function App() {
  const [authView, setAuthView] = useState<AuthView>(() =>
    new URLSearchParams(window.location.search).has('invite') ? 'register' : 'login',
  );

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
  const [ojsAssignment, setOjsAssignment] = useState<{
    actorMode: 'editor' | 'author';
    context: OjsAssignmentLaunchContext;
  } | null>(null);
  const loadManuscript = useStudioStore(
    (state) => state.loadManuscript,
  );

  useEffect(() => {
    if (reviewMode) {
      setOjsContributors([]);
      setOjsAssignment(null);
      return;
    }

    const launch = readOjsLaunchPayload() as AssignmentAwareLaunch | null;

    if (!launch) {
      return;
    }

    const manuscript =
      createManuscriptFromOjsLaunch(launch);

    if (!manuscript) {
      return;
    }

    setOjsContributors(
      launch.scope?.includes('contributors.read')
        ? launch.contributors ?? []
        : [],
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
  }, [loadManuscript, reviewMode]);

  if (reviewMode) {
    return <ReviewPortal />;
  }

  return (
    <AppLayout>
      <EditorPane
        ojsContributors={ojsContributors}
        onOpenMenu={() => setMenuOpen(true)}
        nativeFileActions={isNativeStudio() ? {
          onOpen: async () => {
            const manuscript = await openLocalManuscript();
            if (manuscript) loadManuscript(manuscript);
          },
          onSave: saveLocalManuscript,
          onSaveAs: saveLocalManuscriptAs,
        } : undefined}
      />
      <StudioMenuWithHelp
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        ojsAssignment={ojsAssignment}
      />
    </AppLayout>
  );
}
