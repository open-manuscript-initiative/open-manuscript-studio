import { localeLabels, supportedLocales, useTranslation } from '../i18n';
import type { SupportedLocale } from '../i18n';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <label>
      <span>{t('common.language')}</span>
      <select
        value={locale}
        onChange={(event) =>
          setLocale(event.target.value as SupportedLocale)
        }
      >
        {supportedLocales.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {localeLabels[supportedLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
