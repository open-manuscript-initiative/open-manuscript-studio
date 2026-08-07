import { useState } from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';

import { AppLayout } from './components/AppLayout';
import { EditorPane } from './components/EditorPane';
import { StudioMenu } from './components/StudioMenu';

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

  return (
    <AppLayout onOpenMenu={() => setMenuOpen(true)}>
      <div className="focus-workspace">
        <EditorPane />
      </div>

      <StudioMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </AppLayout>
  );
}
