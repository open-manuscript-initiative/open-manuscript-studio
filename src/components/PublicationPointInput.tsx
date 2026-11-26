import { useEffect, useState } from 'react';

export const PUBLICATION_FONT_SIZE_PRESETS = [6, 7, 8, 9, 9.5, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 60, 72, 96];
export const PUBLICATION_LEADING_PRESETS = [8, 9, 10, 11, 12, 12.5, 13, 14, 15, 16, 18, 20, 21, 24, 28, 30, 36, 42, 48, 60, 72];

/** Explicit native select plus editable numeric input, including Android WebViews. */
export function PublicationPointInput({ label, value, onChange, leading = false, min = 1, max = 600, disabled = false }: {
  label: string; value: number; onChange: (value: number) => void; leading?: boolean; min?: number; max?: number; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const presets = (leading ? PUBLICATION_LEADING_PRESETS : PUBLICATION_FONT_SIZE_PRESETS).filter((preset) => preset >= min && preset <= max);
  const sizes = [...new Set([...presets, ...(Number.isFinite(value) && value >= min && value <= max ? [value] : [])])].sort((a, b) => a - b);
  return <label className="publication-point-input"><span>{label}</span>
    <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', minWidth: 0 }}>
      <input aria-label={label} type="number" value={draft} min={min} max={max} step="any" disabled={disabled} style={{ flex: 1, minWidth: 0 }}
        onChange={(event) => { setDraft(event.target.value); const next = event.target.valueAsNumber; if (Number.isFinite(next) && next >= min && next <= max) onChange(next); }}
        onBlur={() => setDraft(String(value))} />
      <select aria-label={label} disabled={disabled} value={sizes.includes(value) ? String(value) : ''} style={{ flex: 1, minWidth: 0 }}
        onChange={(event) => { const next = Number(event.target.value); if (event.target.value && sizes.includes(next)) { setDraft(String(next)); onChange(next); } }}>
        <option value="" disabled>—</option>
        {sizes.map((preset) => <option key={preset} value={preset}>{preset} pt</option>)}
      </select>
    </span>
  </label>;
}
