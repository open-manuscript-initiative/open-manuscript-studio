import { invoke } from '@tauri-apps/api/core';
import { isNativeStudio } from './nativeManuscriptFile';

export interface DesktopUpdateInfo {
  currentVersion: string;
  version: string;
  date?: string | null;
  body?: string | null;
}

export async function checkForDesktopUpdate(): Promise<DesktopUpdateInfo | null> {
  if (!isNativeStudio()) return null;
  return invoke<DesktopUpdateInfo | null>('check_for_update');
}

export async function installDesktopUpdate(): Promise<void> {
  if (!isNativeStudio()) return;
  await invoke('install_update');
}
