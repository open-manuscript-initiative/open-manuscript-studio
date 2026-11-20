import { useState } from 'react';
import type { OmiSection } from '../types/omi';
import type { PublicationStyle } from '../services/publicationStyleExport';
import { capturePublicationPageStyle, publicationPageStyles, removePublicationPageStyle, resolvePublicationPageStyle,
  validatePublicationPageStyles, type PublicationPageStyle, type PublicationPageStyleCollection, type PublicationSectionPageRule } from '../model/publicationPageStyles';
import { publicationPageStylesCopy } from '../i18n/publicationPageStyles';
import { usePublicationMeasurementUnit } from './PublicationMeasurementControls';
import { MatterNumber } from './PublicationMatterControls';

export function PublicationPageStylesPanel({ style, sections, locale, selectedSectionId, onChange }: {
  style: PublicationStyle; sections: OmiSection[]; locale: string; selectedSectionId?: string | null; onChange: (style: PublicationStyle) => void;
}) {
  const copy = publicationPageStylesCopy(locale), collection = publicationPageStyles(style);
  const [masterId, setMasterId] = useState('');
  const [sectionId, setSectionId] = useState(selectedSectionId ?? sections[0]?.id ?? '');
  const [from, setFrom] = useState(style.page.pageNumberStart ?? 1), [to, setTo] = useState(style.page.pageNumberStart ?? 1);
  const [error, setError] = useState('');
  const [unit] = usePublicationMeasurementUnit();
  const master = collection.styles.find((item) => item.id === masterId) ?? collection.styles[0];
  const availableSections: OmiSection[] = [];
  const visit = (items: OmiSection[]) => { for (const item of items) { if (availableSections.some((s) => s.id === item.id)) continue; availableSections.push(item); visit(item.children ?? []); } };
  visit(sections);
  const section = availableSections.find((item) => item.id === sectionId) ?? availableSections[0];
  const rule = collection.sections.find((item) => item.sectionId === section?.id);
  const resolved = resolvePublicationPageStyle({ ...style, pageStyles: { ...collection, pages: [] } }, sections, 0, section?.id);
  function commit(next: PublicationPageStyleCollection) {
    try { validatePublicationPageStyles(next); setError(''); onChange({ ...style, pageStyles: next }); }
    catch { setError(copy.invalid); }
  }
  function patchMaster(patch: Partial<PublicationPageStyle>) {
    if (master) commit({ ...collection, styles: collection.styles.map((item) => item.id === master.id ? { ...item, ...patch } : item) });
  }
  function patchRule(patch: Partial<PublicationSectionPageRule>) {
    if (!section) return;
    const next: PublicationSectionPageRule = { sectionId: section.id, startNewPage: true, ...rule, ...patch };
    if (next.styleId || next.runningHeaders) next.startNewPage = true;
    commit({ ...collection, sections: [...collection.sections.filter((item) => item.sectionId !== section.id), next] });
  }
  function numeric(label: string, value: number, onCommit: (value: number) => void, min = 0, max = 600) {
    return <MatterNumber key={label} label={`${label} (mm)`} value={value} min={min} max={max} disabled={false} unit={unit} commitOnChange onCommit={onCommit} />;
  }
  function headerFields(header: PublicationStyle['runningHeaders'], showFirst: boolean, update: (value: PublicationStyle['runningHeaders'], first: boolean) => void) {
    return <>
      <label className="publication-style-toggle"><input type="checkbox" checked={header.enabled} onChange={(e) => update({ ...header, enabled: e.target.checked }, showFirst)} /><span>{copy.enabled}</span></label>
      <label className="publication-style-toggle"><input type="checkbox" checked={showFirst} onChange={(e) => update(header, e.target.checked)} /><span>{copy.first}</span></label>
      <div className="publication-style-grid">{(['even', 'odd'] as const).flatMap((side) => (['left', 'right'] as const).map((position) => {
        const labels = { even: { left: copy.evenLeft, right: copy.evenRight }, odd: { left: copy.oddLeft, right: copy.oddRight } };
        return <label key={`${side}-${position}`}><span>{labels[side][position]}</span><textarea aria-label={labels[side][position]} rows={2} maxLength={1000} value={header[side][position]} onChange={(e) => update({ ...header, [side]: { ...header[side], [position]: e.target.value } }, showFirst)} /></label>;
      }))}
      <label><span>{copy.fontSize}</span><input type="number" min={1} max={100} step={0.5} value={header.fontSize} onChange={(e) => { if (e.target.valueAsNumber >= 1 && e.target.valueAsNumber <= 100) update({ ...header, fontSize: e.target.valueAsNumber }, showFirst); }} /></label>
      <label><span>{copy.ruleWidth}</span><input type="number" min={0} max={20} step={0.1} value={header.rule.width} onChange={(e) => { if (e.target.valueAsNumber >= 0 && e.target.valueAsNumber <= 20) update({ ...header, rule: { ...header.rule, width: e.target.valueAsNumber } }, showFirst); }} /></label></div>
      <label className="publication-style-toggle"><input type="checkbox" checked={header.rule.enabled} onChange={(e) => update({ ...header, rule: { ...header.rule, enabled: e.target.checked } }, showFirst)} /><span>{copy.rule}</span></label>
      <small>{copy.tokens}</small>
    </>;
  }
  return <div className="publication-page-styles-panel">
    {error ? <p role="alert">{error}</p> : null}
    <fieldset><legend>{copy.masters}</legend>
      <p>{copy.masterHelp}</p>
      <div className="publication-style-actions">
        <button type="button" disabled={collection.styles.length >= 100} onClick={() => {
          const id = crypto.randomUUID(); commit({ ...collection, styles: [...collection.styles, capturePublicationPageStyle(style, id, `${copy.style} ${collection.styles.length + 1}`)] }); setMasterId(id);
        }}>{copy.create}</button>
        <button type="button" disabled={!master || collection.styles.length >= 100} onClick={() => {
          if (!master) return; const id = crypto.randomUUID(); commit({ ...collection, styles: [...collection.styles, { ...structuredClone(master), id, name: `${master.name} (2)` }] }); setMasterId(id);
        }}>{copy.duplicate}</button>
        <button type="button" disabled={!master} onClick={() => { if (master) commit(removePublicationPageStyle(collection, master.id)); }}>{copy.remove}</button>
      </div>
      {master ? <>
        <label><span>{copy.style}</span><select aria-label={copy.style} value={master.id} onChange={(e) => setMasterId(e.target.value)}>{collection.styles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>{copy.name}</span><input aria-label={copy.name} value={master.name} maxLength={200} onChange={(e) => { if (e.target.value.trim()) patchMaster({ name: e.target.value }); }} /></label>
        <div className="publication-style-grid">
          {numeric(copy.width, master.page.width, (width) => patchMaster({ page: { ...master.page, width } }), 50, 1200)}
          {numeric(copy.height, master.page.height, (height) => patchMaster({ page: { ...master.page, height } }), 50, 1200)}
          {(['top', 'bottom', 'inner', 'outer'] as const).map((key) => numeric(copy[key], master.page.margins[key], (value) => patchMaster({ page: { ...master.page, margins: { ...master.page.margins, [key]: value } } })))}
          {numeric(copy.gutter, master.page.gutter, (gutter) => patchMaster({ page: { ...master.page, gutter } }))}
          {numeric(copy.bleed, master.page.bleed, (bleed) => patchMaster({ page: { ...master.page, bleed } }), 0, 100)}
        </div>
        <label className="publication-style-toggle"><input type="checkbox" checked={master.page.mirroredMargins} onChange={(e) => patchMaster({ page: { ...master.page, mirroredMargins: e.target.checked } })} /><span>{copy.mirror}</span></label>
        <label className="publication-style-toggle"><input type="checkbox" checked={master.page.cropMarks} onChange={(e) => patchMaster({ page: { ...master.page, cropMarks: e.target.checked } })} /><span>{copy.crop}</span></label>
        <details><summary>{copy.headers}</summary>{headerFields(master.runningHeaders, master.showFirstPage, (runningHeaders, showFirstPage) => patchMaster({ runningHeaders, showFirstPage }))}</details>
      </> : null}
    </fieldset>
    <fieldset><legend>{copy.sectionSettings}</legend>
      {section ? <>
        <label><span>{copy.section}</span><select aria-label={copy.section} value={section.id} onChange={(e) => setSectionId(e.target.value)}>{availableSections.map((item, index) => <option key={item.id} value={item.id}>{item.title || `${copy.section} ${index + 1}`}</option>)}</select></label>
        <label><span>{copy.sectionStyle}</span><select aria-label={copy.sectionStyle} value={rule?.styleId ?? ''} onChange={(e) => patchRule({ styleId: e.target.value || undefined })}><option value="">{copy.inherit}</option>{collection.styles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="publication-style-toggle"><input type="checkbox" disabled={!!(rule?.styleId || rule?.runningHeaders)} checked={rule?.startNewPage ?? false} onChange={(e) => patchRule({ startNewPage: e.target.checked })} /><span>{copy.start}</span></label>
        <label className="publication-style-toggle"><input type="checkbox" checked={!!rule?.runningHeaders} onChange={(e) => patchRule({ runningHeaders: e.target.checked ? structuredClone(resolved.runningHeaders) : undefined, showFirstPage: e.target.checked ? resolved.showFirstPage : undefined })} /><span>{copy.ownHeader}</span></label>
        {rule?.runningHeaders ? headerFields(rule.runningHeaders, rule.showFirstPage ?? resolved.showFirstPage, (runningHeaders, showFirstPage) => patchRule({ runningHeaders, showFirstPage })) : null}
        <button type="button" disabled={!rule} onClick={() => commit({ ...collection, sections: collection.sections.filter((item) => item.sectionId !== section.id) })}>{copy.reset}</button>
      </> : <p>{copy.empty}</p>}
    </fieldset>
    <fieldset><legend>{copy.pages}</legend><p>{copy.help}</p>
      <div className="publication-style-grid">
        <label><span>{copy.from}</span><input type="number" min={0} max={1000000} value={from} onChange={(e) => { if (Number.isInteger(e.target.valueAsNumber)) setFrom(e.target.valueAsNumber); }} /></label>
        <label><span>{copy.to}</span><input type="number" min={from} max={1000000} value={to} onChange={(e) => { if (Number.isInteger(e.target.valueAsNumber)) setTo(e.target.valueAsNumber); }} /></label>
      </div>
      <button type="button" disabled={!master || from < 0 || to < from || to > 1000000 || collection.pages.length >= 5000} onClick={() => { if (master) commit({ ...collection, pages: [...collection.pages, { from, to, styleId: master.id }] }); }}>{copy.apply}</button>
      {collection.pages.map((item, index) => <div className="publication-page-style-assignment" key={`${index}-${item.from}`}><span>{item.from}–{item.to}: {collection.styles.find((s) => s.id === item.styleId)?.name}</span><button type="button" aria-label={`${copy.clear}: ${item.from}–${item.to}`} onClick={() => commit({ ...collection, pages: collection.pages.filter((_, i) => i !== index) })}>{copy.clear}</button></div>)}
    </fieldset>
  </div>;
}
