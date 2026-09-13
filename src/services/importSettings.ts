export interface ImportFormatSettings {
  docx: boolean;
  xlsx: boolean;
  csv: boolean;
  html: boolean;
  tex: boolean;
  images: boolean;
  musicXml: boolean;
  midi: boolean;
}

export const DEFAULT_IMPORT_FORMAT_SETTINGS: ImportFormatSettings = {
  docx: true,
  xlsx: true,
  csv: true,
  html: true,
  tex: true,
  images: true,
  musicXml: false,
  midi: false,
};

const STORAGE_KEY = 'omi-studio-import-format-settings';

export function loadImportFormatSettings(): ImportFormatSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_IMPORT_FORMAT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ImportFormatSettings>;
    return Object.fromEntries(
      Object.keys(DEFAULT_IMPORT_FORMAT_SETTINGS).map((key) => [
        key,
        typeof parsed[key as keyof ImportFormatSettings] === 'boolean'
          ? parsed[key as keyof ImportFormatSettings]
          : DEFAULT_IMPORT_FORMAT_SETTINGS[key as keyof ImportFormatSettings],
      ]),
    ) as unknown as ImportFormatSettings;
  } catch {
    return { ...DEFAULT_IMPORT_FORMAT_SETTINGS };
  }
}

export function saveImportFormatSettings(settings: ImportFormatSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function importFormatEnabled(format: keyof ImportFormatSettings): boolean {
  return loadImportFormatSettings()[format];
}
