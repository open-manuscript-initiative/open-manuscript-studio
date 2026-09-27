export const DEFAULT_MENU_FONT_SCALE = 100;
export const MENU_FONT_SCALE_MIN = 80;
export const MENU_FONT_SCALE_MAX = 140;
export const MENU_FONT_SCALE_STEP = 5;

export const DEFAULT_INTERFACE_FONT_SCALE = 100;
export const INTERFACE_FONT_SCALE_MIN = 80;
export const INTERFACE_FONT_SCALE_MAX = 140;
export const INTERFACE_FONT_SCALE_STEP = 5;

const MENU_STORAGE_KEY = 'omi-studio-menu-font-scale';
const INTERFACE_STORAGE_KEY = 'omi-studio-interface-font-scale';

const DESKTOP_MENU_BASE_REM = 0.76;
const MOBILE_MENU_BASE_REM = 0.72;

const INTERFACE_BASE_REM = {
  xs: 0.64,
  sm: 0.70,
  md: 0.76,
  lg: 0.84,
  xl: 0.95,
  title: 1.10,
} as const;

function normalizeScale(
  value: number,
  minimum: number,
  maximum: number,
  step: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  const clamped = Math.min(maximum, Math.max(minimum, value));
  return Math.round(clamped / step) * step;
}

export function normalizeMenuFontScale(value: number): number {
  return normalizeScale(
    value,
    MENU_FONT_SCALE_MIN,
    MENU_FONT_SCALE_MAX,
    MENU_FONT_SCALE_STEP,
    DEFAULT_MENU_FONT_SCALE,
  );
}

export function normalizeInterfaceFontScale(value: number): number {
  return normalizeScale(
    value,
    INTERFACE_FONT_SCALE_MIN,
    INTERFACE_FONT_SCALE_MAX,
    INTERFACE_FONT_SCALE_STEP,
    DEFAULT_INTERFACE_FONT_SCALE,
  );
}

export function getMenuFontSizeRem(scale: number): {
  desktop: number;
  mobile: number;
} {
  const normalized = normalizeMenuFontScale(scale) / 100;
  return {
    desktop: DESKTOP_MENU_BASE_REM * normalized,
    mobile: MOBILE_MENU_BASE_REM * normalized,
  };
}

export function getInterfaceMetrics(scale: number): {
  fonts: Record<keyof typeof INTERFACE_BASE_REM, number>;
  controlHeight: number;
  mobileControlHeight: number;
  controlPaddingX: number;
  controlPaddingY: number;
  textareaMinHeight: number;
  iconButtonSize: number;
} {
  const factor = normalizeInterfaceFontScale(scale) / 100;
  const mobileFactor = Math.max(1, factor);
  return {
    fonts: Object.fromEntries(
      Object.entries(INTERFACE_BASE_REM).map(([key, value]) => [
        key,
        value * factor,
      ]),
    ) as Record<keyof typeof INTERFACE_BASE_REM, number>,
    controlHeight: 1.9 * factor,
    mobileControlHeight: 2.75 * mobileFactor,
    controlPaddingX: 0.48 * factor,
    controlPaddingY: 0.30 * factor,
    textareaMinHeight: 4 * factor,
    iconButtonSize: 1.9 * factor,
  };
}

function loadScale(
  storageKey: string,
  normalize: (value: number) => number,
  fallback: number,
): number {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return normalize(Number(raw));
  } catch {
    return fallback;
  }
}

export function loadMenuFontScale(): number {
  return loadScale(
    MENU_STORAGE_KEY,
    normalizeMenuFontScale,
    DEFAULT_MENU_FONT_SCALE,
  );
}

export function loadInterfaceFontScale(): number {
  return loadScale(
    INTERFACE_STORAGE_KEY,
    normalizeInterfaceFontScale,
    DEFAULT_INTERFACE_FONT_SCALE,
  );
}

export function applyMenuFontScale(scale: number): number {
  const normalized = normalizeMenuFontScale(scale);
  if (typeof document === 'undefined') return normalized;

  const sizes = getMenuFontSizeRem(normalized);
  const factor = normalized / 100;
  const mobileFactor = Math.max(1, factor);

  document.documentElement.style.setProperty(
    '--omi-menu-nav-font-size-desktop',
    `${sizes.desktop.toFixed(3)}rem`,
  );
  document.documentElement.style.setProperty(
    '--omi-menu-nav-font-size-mobile',
    `${sizes.mobile.toFixed(3)}rem`,
  );
  document.documentElement.style.setProperty(
    '--omi-menu-nav-min-height-desktop',
    `${(2.1 * factor).toFixed(3)}rem`,
  );
  document.documentElement.style.setProperty(
    '--omi-menu-nav-min-height-mobile',
    `${(3.25 * mobileFactor).toFixed(3)}rem`,
  );
  document.documentElement.style.setProperty(
    '--omi-menu-nav-padding-y',
    `${(0.35 * factor).toFixed(3)}rem`,
  );
  document.documentElement.style.setProperty(
    '--omi-menu-nav-padding-x',
    `${(0.50 * factor).toFixed(3)}rem`,
  );
  document.documentElement.dataset.menuFontScale = String(normalized);
  return normalized;
}

export function applyInterfaceFontScale(scale: number): number {
  const normalized = normalizeInterfaceFontScale(scale);
  if (typeof document === 'undefined') return normalized;

  const metrics = getInterfaceMetrics(normalized);
  const root = document.documentElement;

  for (const [key, value] of Object.entries(metrics.fonts)) {
    root.style.setProperty(
      `--omi-interface-font-${key}`,
      `${value.toFixed(3)}rem`,
    );
  }

  root.style.setProperty(
    '--omi-interface-control-height',
    `${metrics.controlHeight.toFixed(3)}rem`,
  );
  root.style.setProperty(
    '--omi-interface-mobile-control-height',
    `${metrics.mobileControlHeight.toFixed(3)}rem`,
  );
  root.style.setProperty(
    '--omi-interface-control-padding-x',
    `${metrics.controlPaddingX.toFixed(3)}rem`,
  );
  root.style.setProperty(
    '--omi-interface-control-padding-y',
    `${metrics.controlPaddingY.toFixed(3)}rem`,
  );
  root.style.setProperty(
    '--omi-interface-textarea-min-height',
    `${metrics.textareaMinHeight.toFixed(3)}rem`,
  );
  root.style.setProperty(
    '--omi-interface-icon-button-size',
    `${metrics.iconButtonSize.toFixed(3)}rem`,
  );
  root.dataset.interfaceFontScale = String(normalized);
  return normalized;
}

function saveScale(
  storageKey: string,
  value: number,
  apply: (value: number) => number,
): number {
  const normalized = apply(value);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey, String(normalized));
    } catch {
      // A blocked storage backend should not prevent the live preference.
    }
  }
  return normalized;
}

export function saveMenuFontScale(scale: number): number {
  return saveScale(MENU_STORAGE_KEY, scale, applyMenuFontScale);
}

export function saveInterfaceFontScale(scale: number): number {
  return saveScale(INTERFACE_STORAGE_KEY, scale, applyInterfaceFontScale);
}

export function initializeMenuAppearancePreferences(): number {
  const menuScale = applyMenuFontScale(loadMenuFontScale());
  applyInterfaceFontScale(loadInterfaceFontScale());
  return menuScale;
}
