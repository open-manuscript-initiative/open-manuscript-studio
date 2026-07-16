import { useContext } from 'react';
import { I18nContext } from './I18nProvider';

export function useTranslation() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation must be used inside an I18nProvider.');
  }

  return context;
}
