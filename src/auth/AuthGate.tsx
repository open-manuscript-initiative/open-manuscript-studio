import {
  type ReactNode,
  useEffect,
} from 'react';

import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';

interface AuthGateProps {
  children: ReactNode;
  fallback: ReactNode;
}

export function AuthGate({
  children,
  fallback,
}: AuthGateProps) {
  const currentUser = useAuthStore(getCurrentUser);
  const isInitialized = useAuthStore(
    (state) => state.isInitialized,
  );
  const initializeSession = useAuthStore(
    (state) => state.initializeSession,
  );

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  if (!isInitialized) {
    return (
      <main className="auth-page" aria-busy="true">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-name">
              Open Manuscript Studio
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
