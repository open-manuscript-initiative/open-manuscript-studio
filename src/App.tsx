import { useState } from 'react';

import { AuthGate } from './auth/AuthGate';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';

import { AppLayout } from './components/AppLayout';
import { DocumentTree } from './components/DocumentTree';
import { EditorPane } from './components/EditorPane';
import { PropertiesPanel } from './components/PropertiesPanel';

import './styles/auth.css';

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
  return (
    <AppLayout>
      <div className="workspace">
        <DocumentTree />
        <EditorPane />
        <PropertiesPanel />
      </div>
    </AppLayout>
  );
}
