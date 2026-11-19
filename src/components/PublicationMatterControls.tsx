import { useEffect, useState } from 'react';

export function MatterNumber({ label, min, max, value, disabled, onCommit }: {
  label: string; min: number; max: number; value: number; disabled: boolean; onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label>{label}<input type="number" min={min} max={max} value={draft} disabled={disabled}
    onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    onBlur={() => { const next = Number(draft); if (draft.trim() && Number.isFinite(next) && next >= min && next <= max) onCommit(next); else setDraft(String(value)); }} /></label>;
}
