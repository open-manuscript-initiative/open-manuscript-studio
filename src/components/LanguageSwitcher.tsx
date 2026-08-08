import { Languages } from 'lucide-react';

import {
  localeLabels,
  supportedLocales,
  useTranslation,
} from '../i18n';
import type { SupportedLocale } from '../i18n';

interface LanguageSwitcherProps {
  showAllLocales?: boolean;
}

export function LanguageSwitcher({
  showAllLocales = false,
}: LanguageSwitcherProps) {
  const {
    locale,
    enabledLocales,
    setLocale,
    t,
  } = useTranslation();

  const locales = showAllLocales
    ? supportedLocales
    : enabledLocales;

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
        {locales.map((availableLocale) => (
          <option
            key={availableLocale}
            value={availableLocale}
          >
            {localeLabels[availableLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
