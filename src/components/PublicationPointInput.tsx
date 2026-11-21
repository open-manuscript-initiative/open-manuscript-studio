import { useEffect, useId, useState } from 'react';

export const PUBLICATION_FONT_SIZE_PRESETS = [6, 7, 8, 9, 9.5, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 60, 72];
export const PUBLICATION_LEADING_PRESETS = [8, 9, 10, 11, 12, 12.5, 13, 14, 15, 16, 18, 20, 21, 24, 28, 30, 36, 42, 48, 60, 72];

/** Native editable combo: choose a suggested point value or type any valid size. */
export function PublicationPointInput({ label, value, onChange, leading = false, min = 1, max = 600, disabled = false }: {
  label: string; value: number; onChange: (value: number) => void; leading?: boolean; min?: number; max?: number; disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="publication-point-input"><span>{label}</span>
    <input type="number" list={id} value={draft} min={min} max={max} step="0.1" disabled={disabled}
      onChange={(event) => { setDraft(event.target.value); const next = event.target.valueAsNumber; if (Number.isFinite(next) && next >= min && next <= max) onChange(next); }}
      onBlur={() => setDraft(String(value))} />
    <datalist id={id}>{(leading ? PUBLICATION_LEADING_PRESETS : PUBLICATION_FONT_SIZE_PRESETS).filter((preset) => preset >= min && preset <= max).map((preset) => <option key={preset} value={preset}>{preset} pt</option>)}</datalist>
  </label>;
}
