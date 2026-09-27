export const DEFAULT_MENU_FONT_SCALE = 100;
export const MENU_FONT_SCALE_MIN = 80;
export const MENU_FONT_SCALE_MAX = 140;
export const MENU_FONT_SCALE_STEP = 5;

const STORAGE_KEY = 'omi-studio-menu-font-scale';
const DESKTOP_BASE_REM = 0.76;
const MOBILE_BASE_REM = 0.72;

export function normalizeMenuFontScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MENU_FONT_SCALE;
  const clamped = Math.min(MENU_FONT_SCALE_MAX, Math.max(MENU_FONT_SCALE_MIN, value));
  return Math.round(clamped / MENU_FONT_SCALE_STEP) * MENU_FONT_SCALE_STEP;
}

export function getMenuFontSizeRem(scale: number): {
  desktop: number;
  mobile: number;
} {
  const normalized = normalizeMenuFontScale(scale) / 100;
  return {
    desktop: DESKTOP_BASE_REM * normalized,
    mobile: MOBILE_BASE_REM * normalized,
  };
}

export function loadMenuFontScale(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_MENU_FONT_SCALE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MENU_FONT_SCALE;
    return normalizeMenuFontScale(Number(raw));
  } catch {
    return DEFAULT_MENU_FONT_SCALE;
  }
}

export function applyMenuFontScale(scale: number): number {
  const normalized = normalizeMenuFontScale(scale);
  if (typeof document === 'undefined') return normalized;

  const sizes = getMenuFontSizeRem(normalized);
  document.documentElement.style.setProperty(
    '--omi-menu-nav-font-size-desktop',
    `${sizes.desktop.toFixed(3)}rem`,
  );
  document.documentElement.style.setProperty(
    '--omi-menu-nav-font-size-mobile',
    `${sizes.mobile.toFixed(3)}rem`,
  );
  document.documentElement.dataset.menuFontScale = String(normalized);
  return normalized;
}

export function saveMenuFontScale(scale: number): number {
  const normalized = applyMenuFontScale(scale);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, String(normalized));
    } catch {
      // A blocked storage backend should not prevent the live preference.
    }
  }
  return normalized;
}

export function initializeMenuAppearancePreferences(): number {
  return applyMenuFontScale(loadMenuFontScale());
}
