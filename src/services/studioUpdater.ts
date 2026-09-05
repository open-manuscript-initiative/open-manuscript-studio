import { openUrl } from '@tauri-apps/plugin-opener';

import { getStudioPlatform, type StudioPlatform } from '../mobile/platform/platform';
import { BUILD_INFO } from '../version';
import {
  checkForDesktopUpdate,
  installDesktopUpdate,
} from './desktopUpdater';
import {
  isNewerStudioVersion,
  normalizeStudioVersion,
} from './studioVersion';

const LATEST_RELEASE_API =
  'https://api.github.com/repos/open-manuscript-initiative/open-manuscript-studio/releases/latest';
const LATEST_RELEASE_PAGE =
  'https://github.com/open-manuscript-initiative/open-manuscript-studio/releases/latest';

type ReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
  body?: string | null;
  published_at?: string | null;
  assets?: ReleaseAsset[];
};

export type StudioUpdateAction = 'native-install' | 'reload' | 'download';

export interface StudioUpdateInfo {
  currentVersion: string;
  version: string;
  body?: string | null;
  date?: string | null;
  action: StudioUpdateAction;
  targetUrl?: string;
}

function currentVersion(): string {
  return normalizeStudioVersion(BUILD_INFO.version);
}

function preferredReleaseAsset(
  release: GitHubRelease,
  platform: StudioPlatform,
): string | undefined {
  const assets = release.assets ?? [];
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  let pattern: RegExp | null = null;

  if (platform === 'android') {
    pattern = /Android-universal\.apk$/i;
  } else if (platform === 'desktop' && /Windows/i.test(userAgent)) {
    pattern = /Windows-x64-Setup\.exe$/i;
  } else if (platform === 'desktop' && /Linux/i.test(userAgent)) {
    pattern = /Linux-x64\.AppImage$/i;
  }

  if (!pattern) return undefined;
  return assets.find((asset) => pattern?.test(asset.name ?? ''))
    ?.browser_download_url;
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(LATEST_RELEASE_API, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Release check failed with HTTP ${response.status}.`);
  }

  return await response.json() as GitHubRelease;
}

export async function checkForStudioUpdate(): Promise<StudioUpdateInfo | null> {
  const platform = getStudioPlatform();

  if (platform === 'desktop') {
    try {
      const nativeUpdate = await checkForDesktopUpdate();
      if (nativeUpdate) {
        return {
          ...nativeUpdate,
          currentVersion: normalizeStudioVersion(nativeUpdate.currentVersion),
          version: normalizeStudioVersion(nativeUpdate.version),
          action: 'native-install',
        };
      }
    } catch {
      // Signed updater metadata is optional during beta. The public release
      // check below still offers the correct platform download.
    }
  }

  const installedVersion = currentVersion();
  if (!installedVersion || installedVersion === 'dev') return null;

  const release = await fetchLatestRelease();
  const latestVersion = normalizeStudioVersion(release.tag_name ?? '');
  if (!latestVersion || !isNewerStudioVersion(latestVersion, installedVersion)) {
    return null;
  }

  const targetUrl = preferredReleaseAsset(release, platform)
    ?? release.html_url
    ?? LATEST_RELEASE_PAGE;

  return {
    currentVersion: installedVersion,
    version: latestVersion,
    body: release.body,
    date: release.published_at,
    action: platform === 'web' ? 'reload' : 'download',
    targetUrl,
  };
}

export async function applyStudioUpdate(
  update: StudioUpdateInfo,
): Promise<void> {
  if (update.action === 'native-install') {
    await installDesktopUpdate();
    return;
  }

  if (update.action === 'reload') {
    globalThis.location.reload();
    return;
  }

  const targetUrl = update.targetUrl ?? LATEST_RELEASE_PAGE;
  if (getStudioPlatform() === 'web') {
    globalThis.location.assign(targetUrl);
    return;
  }

  await openUrl(targetUrl);
}
