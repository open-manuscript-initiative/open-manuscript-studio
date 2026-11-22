import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

import { getStudioPlatform } from '../mobile/platform/platform';

// This is the Play Console listing for the Android application, not a URL to
// any specific private-feedback form (Google does not expose such a deep link).
export const STUDIO_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=org.openmanuscript.studio';

/**
 * Initiated only by an explicit user action on Android. Prefer the native
 * Android intent targeting com.android.vending; older native builds can still
 * open the HTTPS listing using the existing Tauri opener permission.
 */
export async function openStudioGooglePlay(): Promise<void> {
  if (getStudioPlatform() !== 'android') {
    throw new Error('Google Play feedback is only available in the Android app.');
  }
  try {
    await invoke('plugin:android-updater|open_play_store');
  } catch {
    await openUrl(STUDIO_PLAY_STORE_URL);
  }
}
