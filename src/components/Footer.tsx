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
      <div className="omi-footer-container">
        <div className="omi-footer-columns">
          <section className="omi-footer-column">
            <h2>Open Manuscript Initiative</h2>
            <a href="https://openmanuscript.org/docs/vision/" target="_blank" rel="noopener noreferrer">Vision</a>
            <a href="https://openmanuscript.org/docs/vision/" target="_blank" rel="noopener noreferrer">Documentation</a>
            <a href="https://openmanuscript.org/docs/governance/roadmap-to-omi-1.0/" target="_blank" rel="noopener noreferrer">Roadmap</a>
            <a href="https://openmanuscript.org/studio/" target="_blank" rel="noopener noreferrer">Studio</a>
          </section>

          <section className="omi-footer-column">
            <h2>Community</h2>
            <a href="https://openmanuscript.org/support/" target="_blank" rel="noopener noreferrer">Support</a>
            <a href="https://github.com/sponsors/open-manuscript-initiative" target="_blank" rel="noopener noreferrer">GitHub Sponsors</a>
            <a href="https://github.com/open-manuscript-initiative/open-manuscript-studio" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/open-manuscript-initiative/open-manuscript-studio/wiki" target="_blank" rel="noopener noreferrer">Wiki</a>
            <a href="https://www.facebook.com/share/19AmDMBVoe/" target="_blank" rel="noopener noreferrer">Facebook</a>
          </section>

          <section className="omi-footer-column">
            <h2>Project</h2>
            <a href="https://openmanuscript.org/docs/governance/funding-and-partnerships/" target="_blank" rel="noopener noreferrer">Funding &amp; Partnerships</a>
            <a href="https://openmanuscript.org/docs/governance/grant-readiness-pack/" target="_blank" rel="noopener noreferrer">Grant Readiness Pack</a>
            <a href="https://openmanuscript.org/docs/governance/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy policy</a>
            <a href="https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>
          </section>
        </div>

        <div className="omi-footer-share" aria-label="Share Open Manuscript Studio">
          <span className="omi-footer-share__label">Share</span>
          {nativeShareSupported ? (
            <button type="button" onClick={() => void shareStudio()}>Share…</button>
          ) : null}
          <a href={socialShareUrl('facebook')} target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href={socialShareUrl('linkedin')} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href={socialShareUrl('bluesky')} target="_blank" rel="noopener noreferrer">Bluesky</a>
        </div>

        <div className="omi-footer-message">
          <strong>Open Manuscript Studio</strong>
          <span>Write naturally. Structure once. Publish everywhere.</span>
          <span>Open standards for scholarly publishing.</span>
          <span>© {new Date().getFullYear()} Open Manuscript Initiative Contributors.</span>
        </div>

        <div className="omi-footer-build">
          {deploymentLabel ? <span>OMI Studio · {deploymentLabel}</span> : null}
          {orcidEnvironment === 'sandbox' ? <span>ORCID Sandbox</span> : null}
          <span>v{BUILD_INFO.version}</span>
          <span>Build #{BUILD_INFO.build}</span>
          <span>{BUILD_INFO.commit}</span>
        </div>
      </div>
    </footer>
  );
}
