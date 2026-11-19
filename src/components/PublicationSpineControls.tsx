import { useState } from 'react';
import type { PublicationMatter } from '../model/publicationMatter';
import { calculatedSpineWidthMm, defaultSpineCalculation, paperThicknessMm, PUBLICATION_PAPERS, publicationSpineWidth, validateSpineCalculation, withPublicationSpineWidth, type PublicationSpineCalculation } from '../model/publicationSpine';
import { formatPublicationMeasurement, type PublicationMeasurementUnit } from '../model/publicationMeasurementUnits';
import { getPublicationSpineCopy } from '../i18n/publicationSpine';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { useTranslation } from '../i18n';
import { MatterNumber } from './PublicationMatterControls';

export function PublicationSpineControls({ model, insidePageCount, unit, readOnly, onChange }: {
  model: PublicationMatter; insidePageCount?: number; unit: PublicationMeasurementUnit; readOnly: boolean; onChange(model: PublicationMatter): void;
}) {
  const { locale } = useTranslation();
  const copy = getPublicationSpineCopy(locale), matter = getPublicationMatterCopy(locale);
  const calculation = model.spineCalculation ?? defaultSpineCalculation(insidePageCount);
  const preset = PUBLICATION_PAPERS.find((paper) => paper.id === calculation.paperId);
  const [error, setError] = useState(false);
  function update(patch: Partial<PublicationSpineCalculation>) {
    if (readOnly) return;
    const next = { ...calculation, ...patch };
    if (next.pageCountSource === 'layout' && insidePageCount) next.pageCount = insidePageCount;
    try {
      validateSpineCalculation(next);
      onChange({ ...withPublicationSpineWidth(model, next.mode === 'automatic' ? calculatedSpineWidthMm(next) : publicationSpineWidth(model)), spineCalculation: next });
      setError(false);
    } catch { setError(true); }
  }
  return <fieldset className="omi-publication-spine-controls" disabled={readOnly}>
    <legend>{copy.title}</legend>
    <label className="omi-publication-matter-include"><input type="checkbox" checked={calculation.mode === 'automatic'} onChange={(event) => update({ mode: event.target.checked ? 'automatic' : 'manual' })} />{copy.automatic}</label>
    <label className="omi-publication-matter-include"><input type="checkbox" checked={calculation.pageCountSource === 'layout'} disabled={!insidePageCount} onChange={(event) => update({ pageCountSource: event.target.checked ? 'layout' : 'manual' })} />{copy.live}</label>
    {!insidePageCount ? <p>{copy.pending}</p> : null}
    <div className="omi-publication-matter-settings">
      <MatterNumber label={copy.pages} min={1} max={100000} value={calculation.pageCountSource === 'layout' ? insidePageCount ?? calculation.pageCount : calculation.pageCount} disabled={readOnly || calculation.pageCountSource === 'layout'} onCommit={(pageCount) => update({ pageCount })} />
      <label>{copy.paper}<select aria-label={copy.paper} value={calculation.paperId} onChange={(event) => {
        const paper = PUBLICATION_PAPERS.find((item) => item.id === event.target.value);
        update(paper ? { paperId: paper.id, grammageGsm: paper.grammageGsm, bulkCm3PerG: paper.thicknessMm * 1000 / paper.grammageGsm } : { paperId: 'custom' });
      }}><option value="custom">{copy.custom}</option>{PUBLICATION_PAPERS.map((paper) => <option key={paper.id} value={paper.id}>{copy[paper.type as 'uncoated' | 'coated' | 'book']} – {paper.name} {paper.grammageGsm} g/m²</option>)}</select></label>
      <MatterNumber label={copy.grammage} min={30} max={400} value={calculation.grammageGsm} disabled={readOnly} onCommit={(grammageGsm) => update({ paperId: 'custom', grammageGsm })} />
      <MatterNumber label={copy.bulk} min={.2} max={5} value={calculation.bulkCm3PerG} disabled={readOnly} onCommit={(bulkCm3PerG) => update({ paperId: 'custom', bulkCm3PerG })} />
      <MatterNumber label={copy.thickness} unit={unit} min={.006} max={2} value={paperThicknessMm(calculation)} disabled={readOnly} onCommit={(thickness) => update({ paperId: 'custom', bulkCm3PerG: thickness * 1000 / calculation.grammageGsm })} />
      <MatterNumber label={copy.allowance} unit={unit} min={0} max={20} value={calculation.allowanceMm} disabled={readOnly} onCommit={(allowanceMm) => update({ allowanceMm })} />
      <MatterNumber label={matter.spineWidth} unit={unit} min={0} max={100} value={publicationSpineWidth(model)} disabled={readOnly} onCommit={(spineWidthMm) => { setError(false); onChange({ ...withPublicationSpineWidth(model, spineWidthMm), spineCalculation: { ...calculation, mode: 'manual' } }); }} />
    </div>
    <p><output aria-label={copy.result}>{copy.result}: {formatPublicationMeasurement(calculatedSpineWidthMm(calculation), unit)} {unit}</output></p>
    <p>{copy.help}</p><p>{copy.manualHelp}</p><p>{copy.estimate} {preset ? <a href={preset.source} target="_blank" rel="noreferrer">{copy.paperData}</a> : null}</p>
    {error ? <p role="alert">{copy.error}</p> : null}
  </fieldset>;
}
