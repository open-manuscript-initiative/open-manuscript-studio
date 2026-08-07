import { Languages } from 'lucide-react';

import {
  localeLabels,
  useTranslation,
} from '../i18n';
import type { SupportedLocale } from '../i18n';

export function LanguageSwitcher() {
  const {
    locale,
    enabledLocales,
    setLocale,
    t,
  } = useTranslation();

  return (
    <label
      className="focus-language-switcher"
      title={t('studio.languageSwitcher')}
    >
      <Languages size={16} aria-hidden="true" />
      <span className="sr-only">
        {t('studio.languageSwitcher')}
      </span>
      <select
        value={locale}
        aria-label={t('studio.languageSwitcher')}
        onChange={(event) =>
          setLocale(event.target.value as SupportedLocale)
        }
      >
        {enabledLocales.map((enabledLocale) => (
          <option
            key={enabledLocale}
            value={enabledLocale}
          >
            {localeLabels[enabledLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
