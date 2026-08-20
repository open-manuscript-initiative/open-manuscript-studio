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
