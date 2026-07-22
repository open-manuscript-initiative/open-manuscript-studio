import type { ReactNode } from 'react';

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

  if (!currentUser) {
    return fallback;
  }

  return children;
}
