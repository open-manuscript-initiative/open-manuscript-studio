import {
  type ReactNode,
  useEffect,
} from 'react';

import { listenForNativeOrcidHandoff } from '../services/authApi';
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
  const completeNativeOrcidHandoff = useAuthStore(
    (state) => state.completeNativeOrcidHandoff,
  );

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    void listenForNativeOrcidHandoff((url) => {
      void completeNativeOrcidHandoff(url);
    }).then((dispose) => {
      if (active) {
        unlisten = dispose;
      } else {
        dispose();
      }
    });

    void initializeSession();

    return () => {
      active = false;
      unlisten?.();
    };
  }, [completeNativeOrcidHandoff, initializeSession]);

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
