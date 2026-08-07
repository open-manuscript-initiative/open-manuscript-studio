import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  supportedLocales,
  type SupportedLocale,
} from './config';
import {
  loadEnabledUiLocales,
  loadUiLocale,
  saveEnabledUiLocales,
  saveUiLocale,
} from './storage';
import { translate } from './translate';
import type { TranslationKey } from './types';

export interface I18nContextValue {
  locale: SupportedLocale;
  enabledLocales: readonly SupportedLocale[];
  setLocale: (locale: SupportedLocale) => void;
  setLocaleEnabled: (
    locale: SupportedLocale,
    enabled: boolean,
  ) => void;
  t: (key: TranslationKey) => string;
}

export const I18nContext =
  createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [enabledLocales, setEnabledLocales] = useState<
    SupportedLocale[]
  >(() => loadEnabledUiLocales());
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    const preferredLocale = loadUiLocale();
    const enabled = loadEnabledUiLocales();

    return enabled.includes(preferredLocale)
      ? preferredLocale
      : enabled[0] ?? preferredLocale;
  });

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    setEnabledLocales((currentEnabledLocales) => {
      if (currentEnabledLocales.includes(nextLocale)) {
        return currentEnabledLocales;
      }

      const nextEnabledLocales = supportedLocales.filter(
        (candidate) =>
          currentEnabledLocales.includes(candidate) ||
          candidate === nextLocale,
      );
      saveEnabledUiLocales(nextEnabledLocales);
      return nextEnabledLocales;
    });

    setLocaleState(nextLocale);
    saveUiLocale(nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);

  const setLocaleEnabled = useCallback(
    (targetLocale: SupportedLocale, enabled: boolean) => {
      setEnabledLocales((currentEnabledLocales) => {
        if (!enabled && targetLocale === locale) {
          return currentEnabledLocales;
        }

        const nextLocaleSet = new Set(currentEnabledLocales);

        if (enabled) {
          nextLocaleSet.add(targetLocale);
        } else if (nextLocaleSet.size > 1) {
          nextLocaleSet.delete(targetLocale);
        }

        const nextEnabledLocales = supportedLocales.filter(
          (candidate) => nextLocaleSet.has(candidate),
        );

        saveEnabledUiLocales(nextEnabledLocales);
        return nextEnabledLocales;
      });
    },
    [locale],
  );

  const t = useCallback(
    (key: TranslationKey) => translate(locale, key),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      enabledLocales,
      setLocale,
      setLocaleEnabled,
      t,
    }),
    [
      locale,
      enabledLocales,
      setLocale,
      setLocaleEnabled,
      t,
    ],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
