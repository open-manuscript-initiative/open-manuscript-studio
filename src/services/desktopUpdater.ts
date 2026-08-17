import { isNativeStudio } from './nativeManuscriptFile';

export type UpdateChannel = 'stable' | 'beta';

export interface DesktopUpdateInfo {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
}

export interface DesktopUpdateProgress {
  downloaded: number;
  total?: number;
}

export interface DesktopUpdatePreferences {
  checkAutomatically: boolean;
  channel: UpdateChannel;
}

const STORAGE_KEY = 'omi.desktopUpdater.preferences.v1';
const DEFAULT_PREFERENCES: DesktopUpdatePreferences = {
  checkAutomatically: true,
  channel: 'stable',
};

export function readUpdatePreferences(): DesktopUpdatePreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<DesktopUpdatePreferences>;
    return {
      checkAutomatically: parsed.checkAutomatically !== false,
      channel: parsed.channel === 'beta' ? 'beta' : 'stable',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUpdatePreferences(preferences: DesktopUpdatePreferences): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export async function checkForDesktopUpdate(): Promise<DesktopUpdateInfo | null> {
  if (!isNativeStudio()) return null;

  const [{ check }, { getVersion }] = await Promise.all([
    import('@tauri-apps/plugin-updater'),
    import('@tauri-apps/api/app'),
  ]);

  const currentVersion = await getVersion();
  const update = await check();
  if (!update) return null;

  return {
    currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
  };
}

export async function downloadAndInstallDesktopUpdate(
  onProgress?: (progress: DesktopUpdateProgress) => void,
): Promise<void> {
  if (!isNativeStudio()) return;

  const [{ check }, { relaunch }] = await Promise.all([
    import('@tauri-apps/plugin-updater'),
    import('@tauri-apps/plugin-process'),
  ]);

  const update = await check();
  if (!update) return;

  let downloaded = 0;
  let total: number | undefined;

  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? undefined;
      downloaded = 0;
      onProgress?.({ downloaded, total });
      return;
    }

    if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      onProgress?.({ downloaded, total });
    }
  });

  await relaunch();
}
