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
