import { useState } from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { DocumentTree } from './components/DocumentTree';
import { EditorPane } from './components/EditorPane';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import './styles/auth.css';

type AuthView =
  | 'login'
  | 'register';

export function App() {
  const [authView, setAuthView] =
    useState<AuthView>('login');

  const authenticationScreen =
    authView === 'login' ? (
      <LoginPage
        onShowRegister={() =>
          setAuthView('register')
        }
      />
    ) : (
      <RegisterPage
        onShowLogin={() =>
          setAuthView('login')
        }
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
      </div>

      <Footer />
    </div>
  );
}
