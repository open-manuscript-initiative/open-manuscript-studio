import { useEffect, useState } from 'react';

import {
  getAuthProviders,
  type AuthProviders,
} from '../services/authApi';

export function useAuthProviders(): AuthProviders | null {
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  useEffect(() => {
    let active = true;

    void getAuthProviders()
      .then((value) => {
        if (active) setProviders(value);
      })
      .catch(() => {
        if (active) setProviders(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return providers;
}

export function useOrcidProvider(): AuthProviders['orcid'] | null {
  return useAuthProviders()?.orcid ?? null;
}
