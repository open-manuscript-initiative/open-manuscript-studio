import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

import { BUILD_INFO } from '../version';

type DeploymentMode = 'personal' | 'institutional';

type ProviderStatus = {
  deployment?: {
    mode?: DeploymentMode;
    label?: string;
  };
  providers?: {
    orcid?: {
      environment?: 'sandbox' | 'production';
    };
  };
};

const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

function providerStatusUrl(): string {
  const location = globalThis.location;
  const nativeRuntime = isTauri()
    || location?.protocol === 'tauri:'
    || location?.hostname === 'tauri.localhost';

  return nativeRuntime && !import.meta.env.DEV
    ? `${NATIVE_API_BASE_URL}/api/auth/providers`
    : '/api/auth/providers';
}

export function Footer() {
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode | null>(null);
  const [orcidEnvironment, setOrcidEnvironment] = useState<'sandbox' | 'production' | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch(providerStatusUrl(), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as ProviderStatus;
      })
      .then((status) => {
        if (cancelled || !status) return;
        const mode = status.deployment?.mode;
        if (mode === 'personal' || mode === 'institutional') setDeploymentMode(mode);
        const environment = status.providers?.orcid?.environment;
        if (environment === 'sandbox' || environment === 'production') {
          setOrcidEnvironment(environment);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const deploymentLabel = deploymentMode === 'institutional'
    ? 'Institutional'
    : deploymentMode === 'personal'
      ? 'Personal'
      : null;

  return (
    <footer className="omi-footer" aria-label="Open Manuscript Studio">
      <div className="omi-footer-accent" aria-hidden="true" />

      <div className="omi-footer-container">
        <div className="omi-footer-identity">
          <div className="omi-footer-mark" aria-hidden="true">OMI</div>

          <div className="omi-footer-brand">
            <strong>Open Manuscript Studio</strong>
            <span>Scholarly writing and publishing infrastructure</span>
          </div>
        </div>

        <div className="omi-footer-meta">
          <nav className="omi-footer-links" aria-label="Studio links">
            <a
              href="https://openmanuscript.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Manuscript Initiative
            </a>
            <a
              href="https://openmanuscript.org/docs/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>
            <a
              href="https://github.com/open-manuscript-initiative/open-manuscript-studio"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
          </nav>

          <div className="omi-footer-build">
            {deploymentLabel ? (
              <>
                <span
                  title={deploymentMode === 'institutional'
                    ? 'Institutional deployment'
                    : 'Personal deployment'}
                >
                  OMI Studio · {deploymentLabel}
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {orcidEnvironment === 'sandbox' ? (
              <>
                <span title="ORCID test environment">ORCID Sandbox</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span>v{BUILD_INFO.version}</span>
            <span aria-hidden="true">·</span>
            <span>Build #{BUILD_INFO.build}</span>
            <span aria-hidden="true">·</span>
            <span>{BUILD_INFO.commit}</span>
          </div>
        </div>
      </div>

      <div className="omi-footer-copyright">
        © 2026 Open Manuscript Initiative · Open infrastructure for scholarly communication
      </div>
    </footer>
  );
}
