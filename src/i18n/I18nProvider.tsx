import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  isTranslationDictionaryLoaded,
  loadTranslationDictionary,
  supportedLocales,
} from './config';
import {
  loadEnabledUiLocales,
  resolveInitialUiLocale,
  saveEnabledUiLocales,
  saveUiLocale,
} from './storage';
import { getStudioLocaleDirection } from './platformLocales';
import { translate, type AppTranslationKey } from './translate';
import type { SupportedLocale } from './types';

export interface I18nContextValue {
  locale: SupportedLocale;
  enabledLocales: readonly SupportedLocale[];
  setLocale: (locale: SupportedLocale) => void;
  setLocaleEnabled: (
    locale: SupportedLocale,
    enabled: boolean,
  ) => void;
  t: (key: AppTranslationKey) => string;
}

export const I18nContext =
  createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [enabledLocales, setEnabledLocales] = useState<
    SupportedLocale[]
  >(() => loadEnabledUiLocales());
  const [locale, setLocaleState] = useState<SupportedLocale>(
    () => resolveInitialUiLocale(),
  );
  const [translationRevision, setTranslationRevision] = useState(0);
  const localeRequestId = useRef(0);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    const requestId = ++localeRequestId.current;

    void loadTranslationDictionary(nextLocale)
      .then(() => {
        if (requestId !== localeRequestId.current) {
          return;
        }

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
          return [...nextEnabledLocales];
        });

        setLocaleState(nextLocale);
        saveUiLocale(nextLocale);
      })
      .catch((error) => {
        console.warn(
          `Studio locale ${nextLocale} could not be loaded.`,
          error,
        );
      });
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
        return [...nextEnabledLocales];
      });
    },
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getStudioLocaleDirection(locale);
  }, [locale]);

  useEffect(() => {
    if (isTranslationDictionaryLoaded(locale)) {
      return;
    }

    let cancelled = false;
    void loadTranslationDictionary(locale)
      .then(() => {
        if (!cancelled) {
          setTranslationRevision((current) => current + 1);
        }
      })
      .catch((error) => {
        console.warn(
          `Studio locale ${locale} could not be loaded.`,
          error,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useCallback(
    (key: AppTranslationKey) => translate(locale, key),
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
      translationRevision,
    ],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
