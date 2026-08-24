import {
  type ReactNode,
  useEffect,
  useRef,
} from 'react';

import { listenForNativeOrcidHandoff } from '../services/authApi';
import { isNativeStudio } from '../services/nativeManuscriptFile';
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
  const handledNativeUrls = useRef(new Set<string>());
  const passwordResetRequested = new URLSearchParams(window.location.search)
    .has('resetPassword');

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    const exposeNativeAuthError = (url: string) => {
      try {
        const parsed = new URL(url);
        const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const authError = params.get('authError');
        if (!authError) return;

        const currentHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        currentHash.set('authError', authError);
        const nextHash = currentHash.toString();
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ''}`,
        );
      } catch {
        // Ignore malformed or unrelated native URLs.
      }
    };

    const handleNativeUrl = (url: string) => {
      if (!active || handledNativeUrls.current.has(url)) return;
      handledNativeUrls.current.add(url);
      exposeNativeAuthError(url);
      void completeNativeOrcidHandoff(url);
    };

    const reconcileCurrentNativeUrl = async () => {
      if (!active) return;

      try {
        const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
        const urls = await getCurrent();
        if (!active || !urls?.length) return;

        for (const url of urls) {
          if (handledNativeUrls.current.has(url)) continue;

          // A cold-start deep link may already have been consumed by
          // initializeSession(). In that case remember it but do not attempt
          // to redeem the same one-time code again. If the app is still on
          // the login screen, redeem the current URL now. This covers the
          // Android resume race where the native intent arrives while the
          // WebView is suspended and the JS onOpenUrl listener misses it.
          if (getCurrentUser(useAuthStore.getState())) {
            handledNativeUrls.current.add(url);
          } else {
            handleNativeUrl(url);
          }
        }
      } catch {
        // Hosted Studio and non-mobile Tauri builds do not have a pending
        // mobile deep link. The normal session initialization remains valid.
      }
    };

    void listenForNativeOrcidHandoff(handleNativeUrl).then((dispose) => {
      if (active) {
        unlisten = dispose;
      } else {
        dispose();
      }
    });

    void initializeSession().then(() => {
      void reconcileCurrentNativeUrl();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reconcileCurrentNativeUrl();
      }
    };
    const handleWindowFocus = () => {
      void reconcileCurrentNativeUrl();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      active = false;
      unlisten?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [completeNativeOrcidHandoff, initializeSession]);

  if (!isInitialized) {
    // On the hosted web Studio, render the real public login page immediately
    // while the session check runs. This keeps the first meaningful paint and
    // crawler-visible DOM identical to the anonymous end state instead of
    // exposing a transient logo-only authentication splash. Native clients
    // retain the compact startup state while their deep-link/session bootstrap
    // completes.
    if (!isNativeStudio()) {
      return <>{fallback}</>;
    }

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

  if (!currentUser || passwordResetRequested) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
