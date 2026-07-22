import { useEffect, useState } from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { DocumentTree } from './components/DocumentTree';
import { EditorPane } from './components/EditorPane';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useAuthStore } from './store/authStore';
import './styles/auth.css';

type AuthView = 'login' | 'register';

export function App() {
  const users = useAuthStore((state) => state.users);

  const [authView, setAuthView] = useState<AuthView>(
    users.length === 0 ? 'register' : 'login',
  );

  /**
   * When all local accounts are deleted or the local store is reset,
   * automatically return to first-account registration.
   */
  useEffect(() => {
    if (users.length === 0) {
      setAuthView('register');
    }
  }, [users.length]);

  const authenticationScreen =
    authView === 'register' ? (
      <RegisterPage
        onShowLogin={() => {
          setAuthView('login');
        }}
      />
    ) : (
      <LoginPage
        onShowRegister={() => {
          setAuthView('register');
        }}
      />
    );

  return (
    <AuthGate fallback={authenticationScreen}>
      <StudioApplication />
    </AuthGate>
  );
}

function StudioApplication() {
  return (
    <div className="app-shell">
      <Header />

      <div className="workspace">
        <DocumentTree />
        <EditorPane />
        <PropertiesPanel />
      </div>

      <Footer />
    </div>
  );
}
