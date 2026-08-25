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
const STUDIO_SHARE_URL = 'https://openmanuscript.org/studio/';
const STUDIO_SHARE_TITLE = 'Open Manuscript Studio';

function providerStatusUrl(): string {
  const location = globalThis.location;
  const nativeRuntime = isTauri()
    || location?.protocol === 'tauri:'
    || location?.hostname === 'tauri.localhost';

  return nativeRuntime && !import.meta.env.DEV
    ? `${NATIVE_API_BASE_URL}/api/auth/providers`
    : '/api/auth/providers';
}

function socialShareUrl(provider: 'facebook' | 'linkedin' | 'bluesky'): string {
  const encodedUrl = encodeURIComponent(STUDIO_SHARE_URL);
  const encodedText = encodeURIComponent(`${STUDIO_SHARE_TITLE} ${STUDIO_SHARE_URL}`);

  if (provider === 'facebook') {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  }
  if (provider === 'linkedin') {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  }
  return `https://bsky.app/intent/compose?text=${encodedText}`;
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
  const nativeShareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function shareStudio(): Promise<void> {
    if (!nativeShareSupported) return;
    try {
      await navigator.share({
        title: STUDIO_SHARE_TITLE,
        text: 'Open scholarly writing and publishing infrastructure.',
        url: STUDIO_SHARE_URL,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('Native sharing failed.', error);
    }
  }

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

          <div className="omi-footer-share" aria-label="Share Open Manuscript Studio">
            <span className="omi-footer-share__label">Share</span>
            {nativeShareSupported ? (
              <button type="button" onClick={() => void shareStudio()}>Share…</button>
            ) : null}
            <a href={socialShareUrl('facebook')} target="_blank" rel="noopener noreferrer">Facebook</a>
            <a href={socialShareUrl('linkedin')} target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href={socialShareUrl('bluesky')} target="_blank" rel="noopener noreferrer">Bluesky</a>
          </div>

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
