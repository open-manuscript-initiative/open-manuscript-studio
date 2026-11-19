import { useEffect, useState } from 'react';
import { formatPublicationMeasurement, parsePublicationMeasurement, type PublicationMeasurementUnit } from '../model/publicationMeasurementUnits';

export function MatterNumber({ label, min, max, value, disabled, onCommit, unit, commitOnChange = false }: {
  label: string; min: number; max: number; value: number; disabled: boolean; onCommit(value: number): void; unit?: PublicationMeasurementUnit; commitOnChange?: boolean;
}) {
  const display = unit ? formatPublicationMeasurement(value, unit) : String(value);
  const [draft, setDraft] = useState(display);
  useEffect(() => setDraft(display), [display, unit]);
  return <label>{unit ? label.replace(/\(mm\)$/, `(${unit})`) : label}<input type="number" step="any" min={unit ? Number(formatPublicationMeasurement(min, unit)) : min} max={unit ? Number(formatPublicationMeasurement(max, unit)) : max} value={draft} disabled={disabled}
    onChange={(event) => {
      setDraft(event.target.value);
      if (commitOnChange && unit) {
        const next = parsePublicationMeasurement(event.target.value, unit, min, max);
        if (next !== undefined) onCommit(next);
      }
    }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    onBlur={() => {
      if (draft === display) return;
      const next = unit ? parsePublicationMeasurement(draft, unit, min, max) : Number(draft);
      if (draft.trim() && next !== undefined && Number.isFinite(next) && next >= min && next <= max) onCommit(next);
      else setDraft(display);
    }} /></label>;
}
