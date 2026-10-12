import { normalizeModuleLocale } from '../moduleLocale';
import { useState } from 'react';
import { stageInsertBlocks } from '../../app/visualBlockActions';
import { useStudioStore } from '../../app/useStudioStore';
import { renderLatexMath } from '../../model/equationRendering';
import { createEquationBlock } from '../../model/visualBlocks';
import { EquationEditor } from './EquationEditor';

interface Props { locale: string; sectionId?: string; gapIndex?: number; onInserted?: () => void }

export function MathematicsPanel({ locale, sectionId, gapIndex, onInserted }: Props) {
  const [latex, setLatex] = useState('');
  const [label, setLabel] = useState('');
  const [caption, setCaption] = useState('');
  const [failed, setFailed] = useState(false);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const target = manuscript.sections.find((section) => section.id === (sectionId ?? selectedSectionId))
    ?? (sectionId ? undefined : manuscript.sections[0]);
  const language = normalizeModuleLocale(locale);
  const copy = language === 'hu'
    ? { insert: 'Képlet beszúrása', label: 'Képlet címkéje', caption: 'Képaláírás / magyarázat', noSection: 'Nyisson meg egy kéziratot és válasszon szakaszt.', failed: 'A képlet beszúrása nem sikerült.' }
    : language === 'de'
      ? { insert: 'Formel einfügen', label: 'Formelbezeichnung', caption: 'Beschriftung / Erklärung', noSection: 'Öffnen Sie ein Manuskript und wählen Sie einen Abschnitt.', failed: 'Die Formel konnte nicht eingefügt werden.' }
      : { insert: 'Insert equation', label: 'Equation label', caption: 'Caption / explanation', noSection: 'Open a manuscript and select a section.', failed: 'The equation could not be inserted.' };

  function insert() {
    if (!target || renderLatexMath(latex).error) return;
    const inserted = stageInsertBlocks(target.id, gapIndex ?? target.blocks.length,
      [createEquationBlock(latex, { label, caption })], 'Inserted mathematical equation');
    setFailed(!inserted);
    if (inserted) { setLatex(''); setLabel(''); setCaption(''); onInserted?.(); }
  }

  return <div className="discipline-workspace">
    <EquationEditor value={latex} onChange={setLatex} locale={locale} />
    <div className="omi-equation-meta">
      <label>{copy.label}<input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label>{copy.caption}<input value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
    </div>
    {!target && <p>{copy.noSection}</p>}
    {failed && <p role="alert">{copy.failed}</p>}
    <button type="button" disabled={!target || Boolean(renderLatexMath(latex).error)} onClick={insert}>{copy.insert}</button>
  </div>;
}
