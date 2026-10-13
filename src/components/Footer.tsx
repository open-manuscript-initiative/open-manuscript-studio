import { getStudioApiBaseUrl } from '../services/studioServer';
import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

import { BUILD_INFO } from '../version';
import { tCatalog } from '../i18n';

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

const STUDIO_SHARE_URL = 'https://openmanuscript.org/studio/';
const STUDIO_SHARE_TITLE = 'Open Manuscript Studio';

function providerStatusUrl(): string {
  const location = globalThis.location;
  const nativeRuntime = isTauri()
    || location?.protocol === 'tauri:'
    || location?.hostname === 'tauri.localhost';

  return nativeRuntime && !import.meta.env.DEV
    ? `${getStudioApiBaseUrl()}/api/auth/providers`
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
            <a href="https://openmanuscript.org/docs/vision/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/vision-40b0906")}</a>
            <a href="https://openmanuscript.org/docs/vision/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/documentation-9e9cf32")}</a>
            <a href="https://openmanuscript.org/docs/governance/roadmap-to-omi-1.0/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/roadmap-8119e7f")}</a>
            <a href="https://openmanuscript.org/studio/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/studio-5b23bd7")}</a>
          </section>

          <section className="omi-footer-column">
            <h2>{tCatalog("/uncataloguedUi/components-footer/community-bfd58ee")}</h2>
            <a href="https://openmanuscript.org/support/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/support-f32d5a3")}</a>
            <a href="https://github.com/sponsors/open-manuscript-initiative" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/github-sponsors-2bdab7e")}</a>
            <a href="https://github.com/open-manuscript-initiative/open-manuscript-studio" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/open-manuscript-initiative/open-manuscript-studio/wiki" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/wiki-4f983a6")}</a>
            <a href="https://www.facebook.com/share/19AmDMBVoe/" target="_blank" rel="noopener noreferrer">Facebook</a>
          </section>

          <section className="omi-footer-column">
            <h2>{tCatalog("/uncataloguedUi/components-footer/project-f6f4da8")}</h2>
            <a href="https://openmanuscript.org/docs/governance/funding-and-partnerships/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/funding-partnerships-6f9e7ea")}</a>
            <a href="https://openmanuscript.org/docs/governance/grant-readiness-pack/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/grant-readiness-pack-b5f8c28")}</a>
            <a href="https://openmanuscript.org/docs/governance/privacy-policy/" target="_blank" rel="noopener noreferrer">{tCatalog("/uncataloguedUi/components-footer/privacy-policy-7ceacdc")}</a>
            <a href="https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>
          </section>
        </div>

        <div className="omi-footer-share" aria-label={tCatalog("/uncataloguedUi/components-footer/share-open-manuscript-studio-63a31e8")}>
          <span className="omi-footer-share__label">{tCatalog("/uncataloguedUi/components-footer/share-09ca55c")}</span>
          {nativeShareSupported ? (
            <button type="button" onClick={() => void shareStudio()}>{tCatalog("/uncataloguedUi/components-footer/share-24897bc")}</button>
          ) : null}
          <a href={socialShareUrl('facebook')} target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href={socialShareUrl('linkedin')} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href={socialShareUrl('bluesky')} target="_blank" rel="noopener noreferrer">Bluesky</a>
        </div>

        <div className="omi-footer-message">
          <strong>Open Manuscript Studio</strong>
          <span>Write naturally. Structure once. Publish everywhere.</span>
          <span>{tCatalog("/uncataloguedUi/components-footer/open-standards-for-scholarly-publishing-963cefb")}</span>
          <span>© {new Date().getFullYear()} {tCatalog("/uncataloguedUi/components-footer/open-manuscript-initiative-contributors-3561518")}</span>
        </div>

        <div className="omi-footer-build">
          {deploymentLabel ? <span>{tCatalog("/uncataloguedUi/components-footer/omi-studio-9672390")} {deploymentLabel}</span> : null}
          {orcidEnvironment === 'sandbox' ? <span>ORCID Sandbox</span> : null}
          <span>v{BUILD_INFO.version}</span>
          <span>Build #{BUILD_INFO.build}</span>
          <span>{BUILD_INFO.commit}</span>
        </div>
      </div>
    </footer>
  );
}
