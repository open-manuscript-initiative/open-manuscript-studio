import { useState } from 'react';
import { useTranslation } from '../i18n';
import { getPublicationFramesCopy } from '../i18n/publicationFrames';
import { deleteFramePage, framePages, framePageStyle, framePageStyles, insertFramePage, withFramePages,
  type FrameHeaderFields, type FramePageStyle, type FrameRunningHeader } from '../model/publicationFramePages';
import type { PublicationFrameLayout } from '../model/publicationFrames';

export function PublicationFramePagePanel({ layout, pageIndex, onChange, onSelect }: {
  layout: PublicationFrameLayout; pageIndex: number; onChange: (layout: PublicationFrameLayout) => void; onSelect: (index: number) => void;
}) {
  const { locale } = useTranslation(); const copy = getPublicationFramesCopy(locale);
  const styles = framePageStyles(layout), pages = framePages(layout), current = framePageStyle(layout, pageIndex);
  const [addStyle, setAddStyle] = useState('');
  function updateStyle(patch: Partial<FramePageStyle>) {
    const next = withFramePages(layout);
    next.pageStyles = next.pageStyles!.map((style) => style.id === current.id ? { ...style, ...patch } : style);
    onChange(next);
  }
  function updateHeader(patch: Partial<FrameRunningHeader>) { updateStyle({ runningHeader: { ...current.runningHeader, ...patch } }); }
  function headerFields(fields: FrameHeaderFields, even: boolean) {
    return (['left', 'center', 'right'] as const).map((key) => {
      const names = even ? { left: copy.evenHeaderLeft, center: copy.evenHeaderCenter, right: copy.evenHeaderRight } : { left: copy.headerLeft, center: copy.headerCenter, right: copy.headerRight };
      return <label key={key}>{names[key]}<textarea rows={2} value={fields[key]} onChange={(event) => updateHeader({ [even ? 'even' : 'odd']: { ...fields, [key]: event.target.value } })} /></label>;
    });
  }
  const header = current.runningHeader;
  return <fieldset className="omi-frame-page-panel">
    <legend>{copy.pageStyles}</legend>
    <label>{copy.selectedPage}<select value={pageIndex} onChange={(event) => onSelect(Number(event.target.value))}>{pages.map((page, index) => <option key={page.id} value={index}>{copy.page} {index + 1}</option>)}</select></label>
    <label>{copy.pageStyle}<select value={current.id} onChange={(event) => { const next = withFramePages(layout); next.pages![pageIndex]!.styleId = event.target.value; onChange(next); }}>{styles.map((style) => <option value={style.id} key={style.id}>{style.name}</option>)}</select></label>
    <button type="button" disabled={styles.length >= 100} onClick={() => {
      const next = withFramePages(layout); const id = crypto.randomUUID();
      next.pageStyles!.push({ ...structuredClone(current), id, name: `${copy.pageStyle} ${styles.length + 1}` });
      next.pages![pageIndex]!.styleId = id; onChange(next); setAddStyle(id);
    }}>{copy.newPageStyle}</button>
    <label>{copy.addPageStyle}<select value={styles.some((style) => style.id === addStyle) ? addStyle : current.id} onChange={(event) => setAddStyle(event.target.value)}>{styles.map((style) => <option value={style.id} key={style.id}>{style.name}</option>)}</select></label>
    <button type="button" disabled={layout.page.count >= 100} onClick={() => { onChange(insertFramePage(layout, pageIndex, styles.some((style) => style.id === addStyle) ? addStyle : current.id, crypto.randomUUID())); onSelect(pageIndex + 1); }}>{copy.addPage}</button>
    <button type="button" disabled={layout.page.count <= 1} onClick={() => { onChange(deleteFramePage(layout, pageIndex)); onSelect(Math.min(pageIndex, layout.page.count - 2)); }}>{copy.deletePage}</button>
    <details><summary>{copy.editPageStyle}</summary>
      <label>{copy.pageStyleName}<input value={current.name} onChange={(event) => updateStyle({ name: event.target.value })} /></label>
      <NumberField label={copy.pageWidth} value={current.widthMm} min={30} max={1200} onChange={(widthMm) => updateStyle({ widthMm })} />
      <NumberField label={copy.pageHeight} value={current.heightMm} min={30} max={1200} onChange={(heightMm) => updateStyle({ heightMm })} />
      <label>{copy.background}<input type="color" value={current.background} onChange={(event) => updateStyle({ background: event.target.value })} /></label>
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => <NumberField key={side} label={copy[({ top: 'marginTop', right: 'marginRight', bottom: 'marginBottom', left: 'marginLeft' } as const)[side]]} value={current.margins[side]} min={0} max={600} onChange={(value) => updateStyle({ margins: { ...current.margins, [side]: value } })} />)}
      <NumberField label={copy.pageNumberStart} value={layout.pageNumberStart ?? 1} min={0} max={1000000} step={1} onChange={(value) => onChange({ ...layout, pageNumberStart: Math.round(value) })} />
    </details>
    <details><summary>{copy.runningHeaders}</summary>
      <label className="omi-frame-checkbox"><input type="checkbox" checked={header.enabled} onChange={(event) => updateHeader({ enabled: event.target.checked })} />{copy.headersEnabled}</label>
      {header.enabled ? <>
        <label className="omi-frame-checkbox"><input type="checkbox" checked={header.showFirstPage} onChange={(event) => updateHeader({ showFirstPage: event.target.checked })} />{copy.showFirstPage}</label>
        <label className="omi-frame-checkbox"><input type="checkbox" checked={header.differentEvenPages} onChange={(event) => updateHeader({ differentEvenPages: event.target.checked })} />{copy.differentEvenPages}</label>
        {headerFields(header.odd, false)}
        {header.differentEvenPages ? headerFields(header.even, true) : null}
        <small>{copy.headerTokens}</small>
        <label>{copy.headerFont}<input value={header.fontFamily} onChange={(event) => updateHeader({ fontFamily: event.target.value || 'serif' })} /></label>
        <NumberField label={copy.headerSize} value={header.fontSizePt} min={1} max={100} onChange={(fontSizePt) => updateHeader({ fontSizePt })} />
        <label>{copy.headerColor}<input type="color" value={header.color} onChange={(event) => updateHeader({ color: event.target.value })} /></label>
        <NumberField label={copy.headerTop} value={header.topMm} min={0} max={1200} onChange={(topMm) => updateHeader({ topMm })} />
        <NumberField label={copy.headerHeight} value={header.heightMm} min={1} max={100} onChange={(heightMm) => updateHeader({ heightMm })} />
      </> : null}
    </details>
  </fieldset>;
}
function NumberField({ label, value, min, max, step = 0.1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label>{label}<input type="number" min={min} max={max} step={step} value={value} onChange={(event) => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next))); }} /></label>;
}
