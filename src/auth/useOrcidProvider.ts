import { useEffect, useState } from 'react';

import {
  getAuthProviders,
  type AuthProviders,
} from '../services/authApi';

export function useOrcidProvider(): AuthProviders['orcid'] | null {
  const [provider, setProvider] = useState<AuthProviders['orcid'] | null>(null);

  useEffect(() => {
    let active = true;

    void getAuthProviders()
      .then((providers) => {
        if (active) setProvider(providers.orcid);
      })
      .catch(() => {
        if (active) setProvider(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return provider;
}
