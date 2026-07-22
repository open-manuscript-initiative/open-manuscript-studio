import type { ReactNode } from 'react';

import { isAuthenticated, useAuthStore } from '../store/authStore';

interface AuthGateProps {
  children: ReactNode;
  fallback: ReactNode;
}

/**
 * Only renders the Studio when an authenticated user exists.
 */
export function AuthGate({
  children,
  fallback,
}: AuthGateProps) {
  const authenticated = useAuthStore(isAuthenticated);

  return authenticated ? children : fallback;
}
