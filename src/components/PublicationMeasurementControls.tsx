import { useSyncExternalStore } from 'react';
import { useTranslation } from '../i18n';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { isPublicationMeasurementUnit, type PublicationMeasurementUnit } from '../model/publicationMeasurementUnits';

const key = 'omi-publication-matter-measurement-unit-v1';
const listeners = new Set<() => void>();
let fallback: PublicationMeasurementUnit = 'mm';
function readUnit(): PublicationMeasurementUnit {
  try { const value = localStorage.getItem(key); return isPublicationMeasurementUnit(value) ? value : fallback; }
  catch { return fallback; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => { if (event.key === key || event.key === null) { fallback = isPublicationMeasurementUnit(event.newValue) ? event.newValue : 'mm'; listener(); } };
  window.addEventListener('storage', changed);
  return () => { listeners.delete(listener); window.removeEventListener('storage', changed); };
}
function setUnit(unit: PublicationMeasurementUnit) {
  fallback = unit;
  try { localStorage.setItem(key, unit); } catch { /* Keep a session preference when device storage is unavailable. */ }
  listeners.forEach((listener) => listener());
}
export function usePublicationMeasurementUnit() {
  const unit = useSyncExternalStore(subscribe, readUnit, () => 'mm' as const);
  return [unit, setUnit] as const;
}
export function PublicationMeasurementSelector() {
  const { locale } = useTranslation();
  const copy = getPublicationMatterCopy(locale);
  const [unit, changeUnit] = usePublicationMeasurementUnit();
  return <label>{copy.units}<select aria-label={copy.units} value={unit} onChange={(event) => { if (isPublicationMeasurementUnit(event.target.value)) changeUnit(event.target.value); }}>
    <option value="mm">{copy.unitMm}</option><option value="pc">{copy.unitPica}</option><option value="pt">{copy.unitPoint}</option>
  </select></label>;
}
