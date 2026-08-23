export type StudioPlatform =
  | 'android'
  | 'ios'
  | 'desktop'
  | 'web';

function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && '__TAURI_INTERNALS__' in window;
}

function userAgent(): string {
  return typeof navigator === 'undefined'
    ? ''
    : navigator.userAgent;
}

export function getStudioPlatform(): StudioPlatform {
  const native = hasTauriRuntime();
  if (!native) return 'web';

  const ua = userAgent();
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';

  return 'desktop';
}

/**
 * Installed Studio builds always use the operating system's own document/file
 * surface as their primary storage integration. Desktop exposes local,
 * network and synchronized cloud folders through the native picker; Android
 * and iOS expose their document-provider/file-provider surfaces. The hosted
 * web application cannot request the same broad system storage access.
 */
export function hasNativeSystemStorage(
  platform: StudioPlatform = getStudioPlatform(),
): boolean {
  return platform !== 'web';
}

export function isMobileStudio(): boolean {
  const platform = getStudioPlatform();
  return platform === 'android' || platform === 'ios';
}

export function isDesktopStudio(): boolean {
  return getStudioPlatform() === 'desktop';
}

export function isWebStudio(): boolean {
  return getStudioPlatform() === 'web';
}
