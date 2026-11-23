export const NON_PRINTING_MARKS_STORAGE_KEY = 'omi.show-nonprinting-marks';
export const NON_PRINTING_MARKS_CLASS = 'omi-show-nonprinting-marks';

export function readStoredNonPrintingMarks(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(NON_PRINTING_MARKS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export const NON_PRINTING_MARKS_EVENT = 'omi:non-printing-marks-changed';

/** Shared by the manuscript toolbar and publication ruler. */
export function setNonPrintingMarksVisibility(visible: boolean): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle(NON_PRINTING_MARKS_CLASS, visible);
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(NON_PRINTING_MARKS_STORAGE_KEY, String(visible));
    } catch {
      // Local preferences can be unavailable in private browsing.
    }
    window.dispatchEvent(new CustomEvent<boolean>(NON_PRINTING_MARKS_EVENT, { detail: visible }));
  }
}
