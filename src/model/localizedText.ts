export interface LocalizedText {
  default: string;
  values: Record<string, string>;
}

export function createLocalizedText(locale: string, value = ''): LocalizedText {
  return {
    default: locale,
    values: { [locale]: value }
  };
}

export function getLocalizedText(
  text: LocalizedText | undefined,
  requestedLocale: string,
  fallbackLocale?: string
): string {
  if (!text) return '';

  return (
    text.values[requestedLocale] ??
    (fallbackLocale ? text.values[fallbackLocale] : undefined) ??
    text.values[text.default] ??
    Object.values(text.values)[0] ??
    ''
  );
}

export function setLocalizedText(
  text: LocalizedText,
  locale: string,
  value: string
): LocalizedText {
  return {
    ...text,
    values: {
      ...text.values,
      [locale]: value
    }
  };
}
