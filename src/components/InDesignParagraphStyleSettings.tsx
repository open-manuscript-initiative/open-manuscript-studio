
import { useState, type ReactNode } from 'react';

import {
  paragraphStyleWouldCreateCycle,
  type PublicationCorners,
  type PublicationOffsets,
  type PublicationParagraphStyleCollection,
  type PublicationParagraphStyleDefinition,
  type PublicationParagraphStyleProperties,
  type ResolvedPublicationParagraphStyle,
} from '../model/publicationParagraphStyles';

type Category =
  | 'general'
  | 'basic'
  | 'advanced'
  | 'indents'
  | 'tabs'
  | 'rules'
  | 'border'
  | 'shading'
  | 'keep'
  | 'hyphenation'
  | 'justification'
  | 'columns'
  | 'nested'
  | 'grep'
  | 'bullets'
  | 'color'
  | 'opentype'
  | 'underline'
  | 'strikethrough'
  | 'export';

type SetProperty = <K extends keyof PublicationParagraphStyleProperties>(
  key: K,
  value: PublicationParagraphStyleProperties[K],
) => void;

interface Props {
  locale: string;
  collection: PublicationParagraphStyleCollection;
  definition: PublicationParagraphStyleDefinition;
  resolved: ResolvedPublicationParagraphStyle;
  fontControls: ReactNode;
  onPatchDefinition: (
    update: (definition: PublicationParagraphStyleDefinition) => PublicationParagraphStyleDefinition,
  ) => void;
  onSetProperty: SetProperty;
}

export function InDesignParagraphStyleSettings({
  locale,
  collection,
  definition,
  resolved,
  fontControls,
  onPatchDefinition,
  onSetProperty,
}: Props) {
  const copy = copyFor(locale);
  const categories = categoryItems(copy);
  const [category, setCategory] = useState<Category>('general');

  return (
    <div className="indesign-paragraph-style-settings">
      <nav className="indesign-paragraph-style-categories" aria-label={copy.settings}>
        {categories.map((item) => (
          <button
            type="button"
            className={item.id === category ? 'is-active' : ''}
            aria-pressed={item.id === category}
            onClick={() => setCategory(item.id)}
            key={item.id}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="indesign-paragraph-style-category-pane">
        <header>
          <strong>{categories.find((item) => item.id === category)?.label}</strong>
          <span>{definition.name}</span>
        </header>

        {category === 'general' ? (
          <GeneralPane
            copy={copy}
            collection={collection}
            definition={definition}
            resolved={resolved}
            onPatchDefinition={onPatchDefinition}
          />
        ) : null}

        {category === 'basic' ? (
          <>
            {fontControls}
            <Grid>
              <NumberField label={copy.size} value={resolved.fontSize} step={0.1} suffix="pt" onChange={(value) => onSetProperty('fontSize', value)} />
              <NumberField label={copy.leading} value={resolved.lineHeight} step={0.1} suffix="pt" onChange={(value) => onSetProperty('lineHeight', value)} />
              <SelectField label={copy.kerning} value={resolved.kerningMode} options={[
                ['metrics', copy.metrics], ['optical', copy.optical], ['manual', copy.manual],
              ]} onChange={(value) => onSetProperty('kerningMode', value as PublicationParagraphStyleProperties['kerningMode'])} />
              <NumberField label={copy.tracking} value={resolved.tracking} step={1} onChange={(value) => onSetProperty('tracking', value)} />
              <SelectField label={copy.capitalization} value={resolved.capitalization} options={[
                ['normal', copy.normal], ['small-caps', copy.smallCaps], ['all-caps', copy.allCaps],
              ]} onChange={(value) => onSetProperty('capitalization', value as PublicationParagraphStyleProperties['capitalization'])} />
              <SelectField label={copy.position} value={resolved.position} options={[
                ['normal', copy.normal],
                ['superscript', copy.superscript],
                ['subscript', copy.subscript],
                ['superior', copy.superior],
                ['inferior', copy.inferior],
              ]} onChange={(value) => onSetProperty('position', value as PublicationParagraphStyleProperties['position'])} />
            </Grid>
            <ToggleGrid>
              <Toggle label={copy.underline} checked={resolved.underline.enabled === true} onChange={(checked) => onSetProperty('underline', { ...resolved.underline, enabled: checked })} />
              <Toggle label={copy.ligatures} checked={resolved.openType.ligatures === true} onChange={(checked) => onSetProperty('openType', { ...resolved.openType, ligatures: checked })} />
              <Toggle label={copy.noBreak} checked={resolved.noBreak} onChange={(checked) => onSetProperty('noBreak', checked)} />
              <Toggle label={copy.strikethrough} checked={resolved.strikethrough.enabled === true} onChange={(checked) => onSetProperty('strikethrough', { ...resolved.strikethrough, enabled: checked })} />
            </ToggleGrid>
          </>
        ) : null}

        {category === 'advanced' ? (
          <Grid>
            <NumberField label={copy.horizontalScale} value={resolved.horizontalScale} step={1} suffix="%" onChange={(value) => onSetProperty('horizontalScale', value)} />
            <NumberField label={copy.verticalScale} value={resolved.verticalScale} step={1} suffix="%" onChange={(value) => onSetProperty('verticalScale', value)} />
            <NumberField label={copy.baselineShift} value={resolved.baselineShift} step={0.1} suffix="pt" onChange={(value) => onSetProperty('baselineShift', value)} />
            <NumberField label={copy.skew} value={resolved.skew} step={0.1} suffix="°" onChange={(value) => onSetProperty('skew', value)} />
            <TextField label={copy.language} value={resolved.language} onChange={(value) => onSetProperty('language', value)} />
          </Grid>
        ) : null}

        {category === 'indents' ? (
          <>
            <Grid>
              <SelectField label={copy.alignment} value={resolved.alignment} options={[
                ['left', copy.left], ['center', copy.center], ['right', copy.right], ['justify', copy.justify],
              ]} onChange={(value) => onSetProperty('alignment', value as PublicationParagraphStyleProperties['alignment'])} />
              <NumberField label={copy.leftIndent} value={resolved.leftIndent} step={0.5} suffix="mm" onChange={(value) => onSetProperty('leftIndent', value)} />
              <NumberField label={copy.rightIndent} value={resolved.rightIndent} step={0.5} suffix="mm" onChange={(value) => onSetProperty('rightIndent', value)} />
              <NumberField label={copy.firstLineIndent} value={resolved.firstLineIndent} step={0.5} suffix="mm" onChange={(value) => onSetProperty('firstLineIndent', value)} />
              <NumberField label={copy.lastLineIndent} value={resolved.lastLineIndent} step={0.5} suffix="mm" onChange={(value) => onSetProperty('lastLineIndent', value)} />
              <NumberField label={copy.spaceBefore} value={resolved.spaceBefore} step={0.5} suffix="pt" onChange={(value) => onSetProperty('spaceBefore', value)} />
              <NumberField label={copy.spaceAfter} value={resolved.spaceAfter} step={0.5} suffix="pt" onChange={(value) => onSetProperty('spaceAfter', value)} />
              <NumberField label={copy.sameStyleSpacing} value={resolved.spaceBetweenSameStyle} step={0.5} suffix="pt" onChange={(value) => onSetProperty('spaceBetweenSameStyle', value)} />
              <SelectField label={copy.baselineGrid} value={resolved.baselineGridAlignment} options={[
                ['none', copy.none],
                ['all-lines', copy.gridAllLines],
                ['first-line', copy.gridFirstLine],
                ['last-line', copy.gridLastLine],
              ]} onChange={(value) => onSetProperty('baselineGridAlignment', value as PublicationParagraphStyleProperties['baselineGridAlignment'])} />
            </Grid>
            <ToggleGrid>
              <Toggle label={copy.balanceRagged} checked={resolved.balanceRaggedLines} onChange={(checked) => onSetProperty('balanceRaggedLines', checked)} />
              <Toggle label={copy.ignoreOpticalMargin} checked={resolved.ignoreOpticalMargin} onChange={(checked) => onSetProperty('ignoreOpticalMargin', checked)} />
            </ToggleGrid>
          </>
        ) : null}

        {category === 'tabs' ? (
          <TabPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'rules' ? (
          <RulePane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'border' ? (
          <BorderPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'shading' ? (
          <ShadingPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'keep' ? (
          <KeepPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'hyphenation' ? (
          <HyphenationPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'justification' ? (
          <JustificationPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'columns' ? (
          <ColumnsPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'nested' ? (
          <NestedPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'grep' ? (
          <GrepPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'bullets' ? (
          <BulletsPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'color' ? (
          <ColorPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'opentype' ? (
          <OpenTypePane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'underline' ? (
          <DecorationPane kind="underline" copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'strikethrough' ? (
          <DecorationPane kind="strikethrough" copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}

        {category === 'export' ? (
          <ExportPane copy={copy} resolved={resolved} onSetProperty={onSetProperty} />
        ) : null}
      </section>
    </div>
  );
}

function GeneralPane({
  copy,
  collection,
  definition,
  resolved,
  onPatchDefinition,
}: {
  copy: Copy;
  collection: PublicationParagraphStyleCollection;
  definition: PublicationParagraphStyleDefinition;
  resolved: ResolvedPublicationParagraphStyle;
  onPatchDefinition: Props['onPatchDefinition'];
}) {
  return (
    <>
      <Grid>
        <TextField label={copy.styleName} value={definition.name} onChange={(name) => onPatchDefinition((current) => ({ ...current, name }))} />
        <SelectField
          label={copy.basedOn}
          value={definition.basedOnId ?? ''}
          options={[
            ['', copy.noStyle],
            ...collection.items
              .filter((item) => !paragraphStyleWouldCreateCycle(collection, definition.id, item.id))
              .map((item) => [item.id, item.name] as [string, string]),
          ]}
          onChange={(value) => onPatchDefinition((current) => ({ ...current, basedOnId: value || null }))}
        />
        <SelectField
          label={copy.nextStyle}
          value={definition.nextStyleId ?? collection.defaultStyleId}
          options={collection.items.map((item) => [item.id, item.name] as [string, string])}
          onChange={(value) => onPatchDefinition((current) => ({ ...current, nextStyleId: value }))}
        />
        <TextField label={copy.shortcut} value={definition.shortcut ?? ''} onChange={(shortcut) => onPatchDefinition((current) => ({ ...current, shortcut: shortcut || null }))} />
      </Grid>
      <div className="indesign-paragraph-style-summary">
        <strong>{copy.styleSummary}</strong>
        <p>{resolved.fontFamily} · {resolved.fontSize} pt · {resolved.lineHeight} pt · {resolved.alignment}</p>
      </div>
    </>
  );
}

function TabPane({ copy, resolved, onSetProperty }: PaneProps) {
  const stops = resolved.tabStops;
  return (
    <div className="indesign-repeatable-editor">
      {stops.map((stop, index) => (
        <div className="indesign-repeatable-row" key={index}>
          <NumberField label={copy.position} value={stop.positionMm} min={0} step={0.5} suffix="mm" onChange={(value) => onSetProperty('tabStops', stops.map((item, i) => i === index ? { ...item, positionMm: value } : item))} />
          <SelectField label={copy.alignment} value={stop.alignment ?? 'left'} options={[
            ['left', copy.left], ['center', copy.center], ['right', copy.right], ['decimal', copy.decimal],
          ]} onChange={(value) => onSetProperty('tabStops', stops.map((item, i) => i === index ? { ...item, alignment: value as 'left' | 'center' | 'right' | 'decimal' } : item))} />
          <TextField label={copy.leader} value={stop.leader ?? ''} onChange={(value) => onSetProperty('tabStops', stops.map((item, i) => i === index ? { ...item, leader: value } : item))} />
          <TextField label={copy.alignOn} value={stop.decimalCharacter ?? ''} onChange={(value) => onSetProperty('tabStops', stops.map((item, i) => i === index ? { ...item, decimalCharacter: value } : item))} />
          <button type="button" onClick={() => onSetProperty('tabStops', stops.filter((_, i) => i !== index))}>{copy.delete}</button>
        </div>
      ))}
      <button type="button" className="studio-menu-secondary-action" onClick={() => onSetProperty('tabStops', [...stops, { positionMm: (stops.at(-1)?.positionMm ?? 0) + 12.5, alignment: 'left' }])}>{copy.add}</button>
    </div>
  );
}

function RulePane({ copy, resolved, onSetProperty }: PaneProps) {
  return (
    <div className="indesign-paragraph-style-stack">
      <RuleGroup label={copy.ruleAbove} value={resolved.ruleAbove} onChange={(value) => onSetProperty('ruleAbove', value)} copy={copy} />
      <RuleGroup label={copy.ruleBelow} value={resolved.ruleBelow} onChange={(value) => onSetProperty('ruleBelow', value)} copy={copy} />
    </div>
  );
}

function RuleGroup({
  label,
  value,
  onChange,
  copy,
}: {
  label: string;
  value: ResolvedPublicationParagraphStyle['ruleAbove'];
  onChange: (value: ResolvedPublicationParagraphStyle['ruleAbove']) => void;
  copy: Copy;
}) {
  return (
    <fieldset className="indesign-subpanel">
      <legend>{label}</legend>
      <Toggle label={copy.enabled} checked={value.enabled === true} onChange={(checked) => onChange({ ...value, enabled: checked })} />
      <Grid>
        <NumberField label={copy.weight} value={value.widthPt ?? 0.5} min={0} step={0.1} suffix="pt" onChange={(next) => onChange({ ...value, widthPt: next })} />
        <SelectField label={copy.type} value={value.style ?? 'solid'} options={strokeOptions(copy)} onChange={(next) => onChange({ ...value, style: next as typeof value.style })} />
        <TextField label={copy.strokeName} value={value.strokeName ?? ''} onChange={(next) => onChange({ ...value, strokeName: next })} />
        <TextField label={copy.color} value={value.color ?? 'currentColor'} onChange={(next) => onChange({ ...value, color: next })} />
        <NumberField label={copy.tint} value={value.tint ?? 100} min={0} max={100} suffix="%" onChange={(next) => onChange({ ...value, tint: next })} />
        <TextField label={copy.gapColor} value={value.gapColor ?? 'transparent'} onChange={(next) => onChange({ ...value, gapColor: next })} />
        <NumberField label={copy.gapTint} value={value.gapTint ?? 100} min={0} max={100} suffix="%" onChange={(next) => onChange({ ...value, gapTint: next })} />
        <SelectField label={copy.widthMode} value={value.widthMode ?? 'column'} options={[
          ['column', copy.column], ['text', copy.text],
        ]} onChange={(next) => onChange({ ...value, widthMode: next as 'column' | 'text' })} />
        <NumberField label={copy.offset} value={value.offsetPt ?? 0} step={0.1} suffix="pt" onChange={(next) => onChange({ ...value, offsetPt: next })} />
        <NumberField label={copy.leftIndent} value={value.leftIndentMm ?? 0} step={0.5} suffix="mm" onChange={(next) => onChange({ ...value, leftIndentMm: next })} />
        <NumberField label={copy.rightIndent} value={value.rightIndentMm ?? 0} step={0.5} suffix="mm" onChange={(next) => onChange({ ...value, rightIndentMm: next })} />
      </Grid>
      <ToggleGrid>
        <Toggle label={copy.overprint} checked={value.overprint === true} onChange={(checked) => onChange({ ...value, overprint: checked })} />
        <Toggle label={copy.gapOverprint} checked={value.gapOverprint === true} onChange={(checked) => onChange({ ...value, gapOverprint: checked })} />
        <Toggle label={copy.keepInFrame} checked={value.keepInFrame === true} onChange={(checked) => onChange({ ...value, keepInFrame: checked })} />
      </ToggleGrid>
    </fieldset>
  );
}

function BorderPane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.border;
  const widths = value.widths ?? {};
  return (
    <>
      <Toggle label={copy.border} checked={value.enabled === true} onChange={(checked) => onSetProperty('border', { ...value, enabled: checked })} />
      <Grid>
        <NumberField label={copy.top} value={widths.topPt ?? value.widthPt ?? 0.5} min={0} suffix="pt" onChange={(next) => onSetProperty('border', { ...value, widths: { ...widths, topPt: next } })} />
        <NumberField label={copy.right} value={widths.rightPt ?? value.widthPt ?? 0.5} min={0} suffix="pt" onChange={(next) => onSetProperty('border', { ...value, widths: { ...widths, rightPt: next } })} />
        <NumberField label={copy.bottom} value={widths.bottomPt ?? value.widthPt ?? 0.5} min={0} suffix="pt" onChange={(next) => onSetProperty('border', { ...value, widths: { ...widths, bottomPt: next } })} />
        <NumberField label={copy.left} value={widths.leftPt ?? value.widthPt ?? 0.5} min={0} suffix="pt" onChange={(next) => onSetProperty('border', { ...value, widths: { ...widths, leftPt: next } })} />
        <SelectField label={copy.type} value={value.style ?? 'solid'} options={strokeOptions(copy)} onChange={(next) => onSetProperty('border', { ...value, style: next as typeof value.style })} />
        <TextField label={copy.strokeName} value={value.strokeName ?? ''} onChange={(next) => onSetProperty('border', { ...value, strokeName: next })} />
        <TextField label={copy.color} value={value.color ?? 'currentColor'} onChange={(next) => onSetProperty('border', { ...value, color: next })} />
        <NumberField label={copy.tint} value={value.tint ?? 100} min={0} max={100} suffix="%" onChange={(next) => onSetProperty('border', { ...value, tint: next })} />
        <TextField label={copy.gapColor} value={value.gapColor ?? 'transparent'} onChange={(next) => onSetProperty('border', { ...value, gapColor: next })} />
        <NumberField label={copy.gapTint} value={value.gapTint ?? 100} min={0} max={100} suffix="%" onChange={(next) => onSetProperty('border', { ...value, gapTint: next })} />
        <SelectField label={copy.cap} value={value.cap ?? 'butt'} options={[
          ['butt', copy.capButt], ['round', copy.capRound], ['projecting', copy.capProjecting],
        ]} onChange={(next) => onSetProperty('border', { ...value, cap: next as NonNullable<typeof value.cap> })} />
        <SelectField label={copy.join} value={value.join ?? 'miter'} options={[
          ['miter', copy.joinMiter], ['round', copy.joinRound], ['bevel', copy.joinBevel],
        ]} onChange={(next) => onSetProperty('border', { ...value, join: next as NonNullable<typeof value.join> })} />
        <SelectField label={copy.widthMode} value={value.widthMode ?? 'column'} options={[
          ['column', copy.column], ['text', copy.text],
        ]} onChange={(next) => onSetProperty('border', { ...value, widthMode: next as 'column' | 'text' })} />
      </Grid>
      <CornerFields copy={copy} value={value.corners ?? {}} onChange={(corners) => onSetProperty('border', { ...value, corners })} />
      <OffsetFields copy={copy} value={value.offsets ?? {}} onChange={(offsets) => onSetProperty('border', { ...value, offsets })} />
      <ToggleGrid>
        <Toggle label={copy.overprint} checked={value.overprint === true} onChange={(checked) => onSetProperty('border', { ...value, overprint: checked })} />
        <Toggle label={copy.gapOverprint} checked={value.gapOverprint === true} onChange={(checked) => onSetProperty('border', { ...value, gapOverprint: checked })} />
        <Toggle label={copy.displayAcrossFrames} checked={value.displayAcrossFrames === true} onChange={(checked) => onSetProperty('border', { ...value, displayAcrossFrames: checked })} />
        <Toggle label={copy.mergeConsecutive} checked={value.mergeConsecutive === true} onChange={(checked) => onSetProperty('border', { ...value, mergeConsecutive: checked })} />
      </ToggleGrid>
    </>
  );
}

function ShadingPane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.shading;
  return (
    <>
      <Toggle label={copy.shading} checked={value.enabled === true} onChange={(checked) => onSetProperty('shading', { ...value, enabled: checked })} />
      <Grid>
        <TextField label={copy.color} value={value.color ?? 'transparent'} onChange={(next) => onSetProperty('shading', { ...value, color: next })} />
        <NumberField label={copy.tint} value={value.tint ?? 100} min={0} max={100} suffix="%" onChange={(next) => onSetProperty('shading', { ...value, tint: next })} />
        <SelectField label={copy.widthMode} value={value.widthMode ?? 'column'} options={[
          ['column', copy.column], ['text', copy.text],
        ]} onChange={(next) => onSetProperty('shading', { ...value, widthMode: next as 'column' | 'text' })} />
      </Grid>
      <CornerFields copy={copy} value={value.corners ?? {}} onChange={(corners) => onSetProperty('shading', { ...value, corners })} />
      <OffsetFields copy={copy} value={value.offsets ?? {}} onChange={(offsets) => onSetProperty('shading', { ...value, offsets })} />
      <ToggleGrid>
        <Toggle label={copy.overprint} checked={value.overprint === true} onChange={(checked) => onSetProperty('shading', { ...value, overprint: checked })} />
        <Toggle label={copy.clipToFrame} checked={value.clipToFrame === true} onChange={(checked) => onSetProperty('shading', { ...value, clipToFrame: checked })} />
        <Toggle label={copy.suppressExport} checked={value.suppressInExport === true} onChange={(checked) => onSetProperty('shading', { ...value, suppressInExport: checked })} />
      </ToggleGrid>
    </>
  );
}

function KeepPane({ copy, resolved, onSetProperty }: PaneProps) {
  return (
    <>
      <ToggleGrid>
        <Toggle label={copy.keepWithPrevious} checked={resolved.keepWithPrevious} onChange={(checked) => onSetProperty('keepWithPrevious', checked)} />
        <Toggle label={copy.keepTogether} checked={resolved.keepTogether} onChange={(checked) => onSetProperty('keepTogether', checked)} />
      </ToggleGrid>
      <Grid>
        <NumberField label={copy.keepWithNext} value={resolved.keepWithNextLines} min={0} step={1} onChange={(value) => {
          onSetProperty('keepWithNextLines', Math.trunc(value));
          onSetProperty('keepWithNext', value > 0);
        }} />
        <NumberField label={copy.keepFirst} value={resolved.keepFirstLines} min={0} step={1} onChange={(value) => onSetProperty('keepFirstLines', Math.trunc(value))} />
        <NumberField label={copy.keepLast} value={resolved.keepLastLines} min={0} step={1} onChange={(value) => onSetProperty('keepLastLines', Math.trunc(value))} />
        <SelectField label={copy.startParagraph} value={resolved.startParagraph} options={[
          ['anywhere', copy.anywhere],
          ['next-column', copy.nextColumn],
          ['next-frame', copy.nextFrame],
          ['next-page', copy.nextPage],
          ['next-odd-page', copy.nextOddPage],
          ['next-even-page', copy.nextEvenPage],
        ]} onChange={(value) => onSetProperty('startParagraph', value as PublicationParagraphStyleProperties['startParagraph'])} />
      </Grid>
    </>
  );
}

function HyphenationPane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.hyphenationSettings;
  const set = (patch: Partial<typeof value>) => onSetProperty('hyphenationSettings', { ...value, ...patch });
  return (
    <>
      <Toggle label={copy.hyphenation} checked={resolved.hyphenation} onChange={(checked) => onSetProperty('hyphenation', checked)} />
      <Grid>
        <NumberField label={copy.wordLength} value={value.minimumWordLength ?? 5} min={0} step={1} onChange={(next) => set({ minimumWordLength: Math.trunc(next) })} />
        <NumberField label={copy.prefix} value={value.minimumPrefix ?? 2} min={0} step={1} onChange={(next) => set({ minimumPrefix: Math.trunc(next) })} />
        <NumberField label={copy.suffix} value={value.minimumSuffix ?? 2} min={0} step={1} onChange={(next) => set({ minimumSuffix: Math.trunc(next) })} />
        <NumberField label={copy.maxHyphens} value={value.maximumHyphens ?? 3} min={0} step={1} onChange={(next) => set({ maximumHyphens: Math.trunc(next) })} />
        <NumberField label={copy.hyphenZone} value={value.hyphenationZoneMm ?? 0} min={0} step={0.5} suffix="mm" onChange={(next) => set({ hyphenationZoneMm: next })} />
        <NumberField label={copy.hyphenPreference} value={value.preference ?? 50} min={0} max={100} step={1} suffix="%" onChange={(next) => set({ preference: next })} />
      </Grid>
      <ToggleGrid>
        <Toggle label={copy.hyphenCaps} checked={value.hyphenateCapitalizedWords === true} onChange={(checked) => set({ hyphenateCapitalizedWords: checked })} />
        <Toggle label={copy.hyphenLast} checked={value.hyphenateLastWord === true} onChange={(checked) => set({ hyphenateLastWord: checked })} />
        <Toggle label={copy.hyphenColumns} checked={value.hyphenateAcrossColumns === true} onChange={(checked) => set({ hyphenateAcrossColumns: checked })} />
      </ToggleGrid>
    </>
  );
}

function JustificationPane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.justification;
  const set = (patch: Partial<typeof value>) => onSetProperty('justification', { ...value, ...patch });
  return (
    <Grid>
      <NumberField label={copy.wordMin} value={value.wordSpacingMinimum ?? 80} suffix="%" onChange={(next) => set({ wordSpacingMinimum: next })} />
      <NumberField label={copy.wordDesired} value={value.wordSpacingDesired ?? 100} suffix="%" onChange={(next) => set({ wordSpacingDesired: next })} />
      <NumberField label={copy.wordMax} value={value.wordSpacingMaximum ?? 133} suffix="%" onChange={(next) => set({ wordSpacingMaximum: next })} />
      <NumberField label={copy.letterMin} value={value.letterSpacingMinimum ?? 0} suffix="%" onChange={(next) => set({ letterSpacingMinimum: next })} />
      <NumberField label={copy.letterDesired} value={value.letterSpacingDesired ?? 0} suffix="%" onChange={(next) => set({ letterSpacingDesired: next })} />
      <NumberField label={copy.letterMax} value={value.letterSpacingMaximum ?? 0} suffix="%" onChange={(next) => set({ letterSpacingMaximum: next })} />
      <NumberField label={copy.glyphMin} value={value.glyphScalingMinimum ?? 100} suffix="%" onChange={(next) => set({ glyphScalingMinimum: next })} />
      <NumberField label={copy.glyphDesired} value={value.glyphScalingDesired ?? 100} suffix="%" onChange={(next) => set({ glyphScalingDesired: next })} />
      <NumberField label={copy.glyphMax} value={value.glyphScalingMaximum ?? 100} suffix="%" onChange={(next) => set({ glyphScalingMaximum: next })} />
      <NumberField label={copy.autoLeading} value={value.autoLeadingPercent ?? 120} suffix="%" onChange={(next) => set({ autoLeadingPercent: next })} />
      <SelectField label={copy.composer} value={value.composer ?? 'adobe-paragraph'} options={[
        ['adobe-paragraph', 'Adobe Paragraph Composer'],
        ['adobe-single-line', 'Adobe Single-line Composer'],
        ['world-ready-paragraph', 'Adobe World-Ready Paragraph Composer'],
        ['world-ready-single-line', 'Adobe World-Ready Single-line Composer'],
      ]} onChange={(next) => set({ composer: next as NonNullable<typeof value.composer> })} />
    </Grid>
  );
}

function ColumnsPane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.spanColumns;
  const set = (patch: Partial<typeof value>) => onSetProperty('spanColumns', { ...value, ...patch });
  return (
    <Grid>
      <SelectField label={copy.paragraphFormat} value={value.mode ?? 'single'} options={[
        ['single', copy.singleColumn], ['span', copy.span], ['split', copy.split],
      ]} onChange={(next) => set({ mode: next as 'single' | 'span' | 'split' })} />
      <NumberField label={copy.columnCount} value={value.count ?? 1} min={1} max={16} step={1} onChange={(next) => set({ count: Math.trunc(next) })} />
      <NumberField label={copy.insideGutter} value={value.insideGutterMm ?? 0} min={0} suffix="mm" onChange={(next) => set({ insideGutterMm: next })} />
      <NumberField label={copy.outsideGutter} value={value.outsideGutterMm ?? 0} min={0} suffix="mm" onChange={(next) => set({ outsideGutterMm: next })} />
    </Grid>
  );
}

function NestedPane({ copy, resolved, onSetProperty }: PaneProps) {
  return (
    <div className="indesign-paragraph-style-stack">
      <fieldset className="indesign-subpanel">
        <legend>{copy.dropCaps}</legend>
        <Grid>
          <NumberField label={copy.lines} value={resolved.dropCaps.lines ?? 0} min={0} step={1} onChange={(next) => onSetProperty('dropCaps', { ...resolved.dropCaps, lines: Math.trunc(next) })} />
          <NumberField label={copy.characters} value={resolved.dropCaps.characters ?? 0} min={0} step={1} onChange={(next) => onSetProperty('dropCaps', { ...resolved.dropCaps, characters: Math.trunc(next) })} />
          <TextField label={copy.characterStyle} value={resolved.dropCaps.characterStyleId ?? ''} onChange={(next) => onSetProperty('dropCaps', { ...resolved.dropCaps, characterStyleId: next })} />
        </Grid>
        <ToggleGrid>
          <Toggle label={copy.alignLeftEdge} checked={resolved.dropCaps.alignLeftEdge === true} onChange={(checked) => onSetProperty('dropCaps', { ...resolved.dropCaps, alignLeftEdge: checked })} />
          <Toggle label={copy.scaleDescenders} checked={resolved.dropCaps.scaleForDescenders === true} onChange={(checked) => onSetProperty('dropCaps', { ...resolved.dropCaps, scaleForDescenders: checked })} />
        </ToggleGrid>
      </fieldset>
      <RepeatableRules
        title={copy.nestedStyles}
        rows={resolved.nestedStyles.map((rule) => ({ id: rule.id, first: rule.characterStyleId, second: rule.delimiter ?? '' }))}
        firstLabel={copy.characterStyle}
        secondLabel={copy.delimiter}
        addLabel={copy.add}
        deleteLabel={copy.delete}
        onChange={(rows) => onSetProperty('nestedStyles', rows.map((row) => ({ id: row.id, characterStyleId: row.first, delimiter: row.second, repeat: 1, through: false })))}
      />
      <RepeatableRules
        title={copy.nestedLineStyles}
        rows={resolved.nestedLineStyles.map((rule) => ({ id: rule.id, first: rule.characterStyleId, second: String(rule.lines) }))}
        firstLabel={copy.characterStyle}
        secondLabel={copy.lines}
        addLabel={copy.add}
        deleteLabel={copy.delete}
        onChange={(rows) => onSetProperty('nestedLineStyles', rows.map((row) => ({ id: row.id, characterStyleId: row.first, lines: Math.max(1, Number(row.second) || 1) })))}
      />
    </div>
  );
}

function GrepPane({ copy, resolved, onSetProperty }: PaneProps) {
  return (
    <RepeatableRules
      title={copy.grepStyles}
      rows={resolved.grepStyles.map((rule) => ({ id: rule.id, first: rule.characterStyleId, second: rule.expression }))}
      firstLabel={copy.characterStyle}
      secondLabel={copy.expression}
      addLabel={copy.add}
      deleteLabel={copy.delete}
      onChange={(rows) => onSetProperty('grepStyles', rows.map((row) => ({ id: row.id, characterStyleId: row.first, expression: row.second })))}
    />
  );
}

function BulletsPane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.bulletsAndNumbering;
  const set = (patch: Partial<typeof value>) => onSetProperty('bulletsAndNumbering', { ...value, ...patch });
  return (
    <Grid>
      <SelectField label={copy.listType} value={value.type ?? 'none'} options={[
        ['none', copy.none], ['bullets', copy.bullets], ['numbers', copy.numbers],
      ]} onChange={(next) => set({ type: next as 'none' | 'bullets' | 'numbers' })} />
      <TextField label={copy.listName} value={value.listName ?? ''} onChange={(next) => set({ listName: next })} />
      <NumberField label={copy.level} value={value.level ?? 1} min={1} step={1} onChange={(next) => set({ level: Math.trunc(next) })} />
      <TextField label={copy.bulletCharacter} value={value.bulletCharacter ?? '•'} onChange={(next) => set({ bulletCharacter: next })} />
      <TextField label={copy.numberExpression} value={value.numberExpression ?? ''} onChange={(next) => set({ numberExpression: next })} />
      <TextField label={copy.characterStyle} value={value.characterStyleId ?? ''} onChange={(next) => set({ characterStyleId: next })} />
      <SelectField label={copy.alignment} value={value.alignment ?? 'left'} options={[
        ['left', copy.left], ['center', copy.center], ['right', copy.right], ['justify', copy.justify],
      ]} onChange={(next) => set({ alignment: next as NonNullable<typeof value.alignment> })} />
      <NumberField label={copy.startAt} value={value.startAt ?? 1} min={0} step={1} onChange={(next) => set({ startAt: Math.trunc(next) })} />
      <NumberField label={copy.restartAfterLevel} value={value.restartAfterLevel ?? 0} min={0} step={1} onChange={(next) => set({ restartAfterLevel: Math.trunc(next) })} />
      <NumberField label={copy.leftIndent} value={value.leftIndentMm ?? 0} suffix="mm" onChange={(next) => set({ leftIndentMm: next })} />
      <NumberField label={copy.firstLineIndent} value={value.firstLineIndentMm ?? 0} suffix="mm" onChange={(next) => set({ firstLineIndentMm: next })} />
      <NumberField label={copy.tabPosition} value={value.tabPositionMm ?? 0} suffix="mm" onChange={(next) => set({ tabPositionMm: next })} />
    </Grid>
  );
}

function ColorPane({ copy, resolved, onSetProperty }: PaneProps) {
  const stroke = resolved.characterStroke;
  return (
    <>
      <Grid>
        <TextField label={copy.fillColor} value={resolved.fillColor} onChange={(next) => onSetProperty('fillColor', next)} />
        <NumberField label={copy.tint} value={resolved.fillTint} min={0} max={100} suffix="%" onChange={(next) => onSetProperty('fillTint', next)} />
        <NumberField label={copy.strokeWeight} value={stroke.widthPt ?? 0} min={0} suffix="pt" onChange={(next) => onSetProperty('characterStroke', { ...stroke, widthPt: next })} />
        <TextField label={copy.strokeColor} value={stroke.color ?? 'currentColor'} onChange={(next) => onSetProperty('characterStroke', { ...stroke, color: next })} />
        <NumberField label={copy.strokeTint} value={stroke.tint ?? 100} min={0} max={100} suffix="%" onChange={(next) => onSetProperty('characterStroke', { ...stroke, tint: next })} />
        <NumberField label={copy.miterLimit} value={stroke.miterLimit ?? 4} min={0} step={0.1} onChange={(next) => onSetProperty('characterStroke', { ...stroke, miterLimit: next })} />
        <SelectField label={copy.strokeAlignment} value={stroke.alignment ?? 'center'} options={[
          ['center', copy.strokeCenter], ['inside', copy.strokeInside], ['outside', copy.strokeOutside],
        ]} onChange={(next) => onSetProperty('characterStroke', { ...stroke, alignment: next as NonNullable<typeof stroke.alignment> })} />
      </Grid>
      <ToggleGrid>
        <Toggle label={copy.overprintFill} checked={resolved.fillOverprint} onChange={(checked) => onSetProperty('fillOverprint', checked)} />
        <Toggle label={copy.overprintStroke} checked={stroke.overprint === true} onChange={(checked) => onSetProperty('characterStroke', { ...stroke, overprint: checked })} />
      </ToggleGrid>
    </>
  );
}

function OpenTypePane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.openType;
  const set = (patch: Partial<typeof value>) => onSetProperty('openType', { ...value, ...patch });
  return (
    <>
      <ToggleGrid>
        <Toggle label={copy.titling} checked={value.titlingAlternates === true} onChange={(checked) => set({ titlingAlternates: checked })} />
        <Toggle label={copy.swash} checked={value.swash === true} onChange={(checked) => set({ swash: checked })} />
        <Toggle label={copy.contextual} checked={value.contextualAlternates === true} onChange={(checked) => set({ contextualAlternates: checked })} />
        <Toggle label={copy.ordinals} checked={value.ordinals === true} onChange={(checked) => set({ ordinals: checked })} />
        <Toggle label={copy.discretionaryLigatures} checked={value.discretionaryLigatures === true} onChange={(checked) => set({ discretionaryLigatures: checked })} />
        <Toggle label={copy.fractions} checked={value.fractions === true} onChange={(checked) => set({ fractions: checked })} />
        <Toggle label={copy.slashedZero} checked={value.slashedZero === true} onChange={(checked) => set({ slashedZero: checked })} />
      </ToggleGrid>
      <Grid>
        <SelectField label={copy.figureStyle} value={value.figureStyle ?? 'default'} options={[
          ['default', copy.defaultValue],
          ['lining-proportional', copy.liningProportional],
          ['lining-tabular', copy.liningTabular],
          ['oldstyle-proportional', copy.oldstyleProportional],
          ['oldstyle-tabular', copy.oldstyleTabular],
        ]} onChange={(next) => set({ figureStyle: next as NonNullable<typeof value.figureStyle> })} />
        <SelectField label={copy.positionalForm} value={value.positionalForm ?? 'general'} options={[
          ['general', copy.generalForm],
          ['initial', copy.initialForm],
          ['medial', copy.medialForm],
          ['final', copy.finalForm],
          ['isolated', copy.isolatedForm],
        ]} onChange={(next) => set({ positionalForm: next as NonNullable<typeof value.positionalForm> })} />
        <TextField label={copy.stylisticSets} value={(value.stylisticSets ?? []).join(', ')} onChange={(next) => set({ stylisticSets: parseSets(next) })} />
      </Grid>
    </>
  );
}

function DecorationPane({
  kind,
  copy,
  resolved,
  onSetProperty,
}: PaneProps & { kind: 'underline' | 'strikethrough' }) {
  const value = resolved[kind];
  const set = (patch: Partial<typeof value>) => onSetProperty(kind, { ...value, ...patch });
  return (
    <>
      <Toggle label={copy.enabled} checked={value.enabled === true} onChange={(checked) => set({ enabled: checked })} />
      <Grid>
        <NumberField label={copy.weight} value={value.weightPt ?? 0.5} min={0} suffix="pt" onChange={(next) => set({ weightPt: next })} />
        <NumberField label={copy.offset} value={value.offsetPt ?? 0} suffix="pt" onChange={(next) => set({ offsetPt: next })} />
        <SelectField label={copy.type} value={value.style ?? 'solid'} options={strokeOptions(copy)} onChange={(next) => set({ style: next as typeof value.style })} />
        <TextField label={copy.color} value={value.color ?? 'currentColor'} onChange={(next) => set({ color: next })} />
        <NumberField label={copy.tint} value={value.tint ?? 100} min={0} max={100} suffix="%" onChange={(next) => set({ tint: next })} />
        <TextField label={copy.gapColor} value={value.gapColor ?? 'transparent'} onChange={(next) => set({ gapColor: next })} />
        <NumberField label={copy.gapTint} value={value.gapTint ?? 100} min={0} max={100} suffix="%" onChange={(next) => set({ gapTint: next })} />
      </Grid>
      <ToggleGrid>
        <Toggle label={copy.overprint} checked={value.overprint === true} onChange={(checked) => set({ overprint: checked })} />
        <Toggle label={copy.gapOverprint} checked={value.gapOverprint === true} onChange={(checked) => set({ gapOverprint: checked })} />
      </ToggleGrid>
    </>
  );
}

function ExportPane({ copy, resolved, onSetProperty }: PaneProps) {
  const value = resolved.exportTagging;
  const set = (patch: Partial<typeof value>) => onSetProperty('exportTagging', { ...value, ...patch });
  return (
    <>
      <Grid>
        <TextField label={copy.htmlTag} value={value.htmlTag ?? 'p'} onChange={(next) => set({ htmlTag: next })} />
        <TextField label={copy.epubTag} value={value.epubTag ?? 'p'} onChange={(next) => set({ epubTag: next })} />
        <TextField label={copy.ariaRole} value={value.ariaRole ?? ''} onChange={(next) => set({ ariaRole: next })} />
        <TextField label={copy.cssClass} value={value.cssClass ?? ''} onChange={(next) => set({ cssClass: next })} />
        <TextField label={copy.pdfTag} value={value.pdfTag ?? 'P'} onChange={(next) => set({ pdfTag: next })} />
      </Grid>
      <ToggleGrid>
        <Toggle label={copy.applyHtmlClass} checked={value.applyHtmlClass === true} onChange={(checked) => set({ applyHtmlClass: checked })} />
        <Toggle label={copy.emitCss} checked={value.emitCss === true} onChange={(checked) => set({ emitCss: checked })} />
        <Toggle label={copy.splitDocument} checked={value.splitDocument === true} onChange={(checked) => set({ splitDocument: checked })} />
        <Toggle label={copy.emitTag} checked={value.emitTag !== false} onChange={(checked) => set({ emitTag: checked })} />
      </ToggleGrid>
    </>
  );
}

interface PaneProps {
  copy: Copy;
  resolved: ResolvedPublicationParagraphStyle;
  onSetProperty: SetProperty;
}

function RepeatableRules({
  title,
  rows,
  firstLabel,
  secondLabel,
  addLabel,
  deleteLabel,
  onChange,
}: {
  title: string;
  rows: Array<{ id: string; first: string; second: string }>;
  firstLabel: string;
  secondLabel: string;
  addLabel: string;
  deleteLabel: string;
  onChange: (rows: Array<{ id: string; first: string; second: string }>) => void;
}) {
  return (
    <fieldset className="indesign-subpanel">
      <legend>{title}</legend>
      {rows.map((row, index) => (
        <div className="indesign-repeatable-row" key={row.id}>
          <TextField label={firstLabel} value={row.first} onChange={(first) => onChange(rows.map((item, i) => i === index ? { ...item, first } : item))} />
          <TextField label={secondLabel} value={row.second} onChange={(second) => onChange(rows.map((item, i) => i === index ? { ...item, second } : item))} />
          <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))}>{deleteLabel}</button>
        </div>
      ))}
      <button type="button" className="studio-menu-secondary-action" onClick={() => onChange([...rows, { id: crypto.randomUUID(), first: '', second: '' }])}>{addLabel}</button>
    </fieldset>
  );
}

function CornerFields({
  copy,
  value,
  onChange,
}: {
  copy: Copy;
  value: PublicationCorners;
  onChange: (value: PublicationCorners) => void;
}) {
  return (
    <fieldset className="indesign-subpanel">
      <legend>{copy.corners}</legend>
      <Grid>
        {([
          ['topLeft', copy.topLeft],
          ['topRight', copy.topRight],
          ['bottomRight', copy.bottomRight],
          ['bottomLeft', copy.bottomLeft],
        ] as const).flatMap(([key, label]) => {
          const corner = value[key] ?? {};
          return [
            <NumberField
              key={key + '-radius'}
              label={label + ' — ' + copy.radius}
              value={corner.radiusMm ?? 0}
              min={0}
              step={0.5}
              suffix="mm"
              onChange={(radiusMm) => onChange({
                ...value,
                [key]: { ...corner, radiusMm },
              })}
            />,
            <SelectField
              key={key + '-shape'}
              label={label + ' — ' + copy.cornerShape}
              value={corner.shape ?? 'square'}
              options={[
                ['square', copy.cornerSquare],
                ['rounded', copy.cornerRounded],
                ['bevel', copy.cornerBevel],
                ['inset', copy.cornerInset],
                ['inverse-rounded', copy.cornerInverseRounded],
              ]}
              onChange={(shape) => onChange({
                ...value,
                [key]: {
                  ...corner,
                  shape: shape as NonNullable<typeof corner.shape>,
                },
              })}
            />,
          ];
        })}
      </Grid>
    </fieldset>
  );
}

function OffsetFields({
  copy,
  value,
  onChange,
}: {
  copy: Copy;
  value: PublicationOffsets;
  onChange: (value: PublicationOffsets) => void;
}) {
  return (
    <fieldset className="indesign-subpanel">
      <legend>{copy.offsets}</legend>
      <Grid>
        <NumberField label={copy.top} value={value.topMm ?? 0} step={0.5} suffix="mm" onChange={(topMm) => onChange({ ...value, topMm })} />
        <NumberField label={copy.right} value={value.rightMm ?? 0} step={0.5} suffix="mm" onChange={(rightMm) => onChange({ ...value, rightMm })} />
        <NumberField label={copy.bottom} value={value.bottomMm ?? 0} step={0.5} suffix="mm" onChange={(bottomMm) => onChange({ ...value, bottomMm })} />
        <NumberField label={copy.left} value={value.leftMm ?? 0} step={0.5} suffix="mm" onChange={(leftMm) => onChange({ ...value, leftMm })} />
      </Grid>
    </fieldset>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="publication-style-grid indesign-field-grid">{children}</div>;
}

function ToggleGrid({ children }: { children: ReactNode }) {
  return <div className="publication-style-toggle-grid">{children}</div>;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="publication-style-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <span className="indesign-number-field">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
        />
        {suffix ? <small>{suffix}</small> : null}
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function strokeOptions(copy: Copy): Array<[string, string]> {
  return [
    ['solid', copy.solid],
    ['dashed', copy.dashed],
    ['dotted', copy.dotted],
    ['double', copy.double],
  ];
}

function parseSets(value: string): number[] {
  return [...new Set(
    value
      .split(/[\s,;]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= 20),
  )].sort((a, b) => a - b);
}

function categoryItems(copy: Copy): Array<{ id: Category; label: string }> {
  return [
    { id: 'general', label: copy.general },
    { id: 'basic', label: copy.basic },
    { id: 'advanced', label: copy.advanced },
    { id: 'indents', label: copy.indents },
    { id: 'tabs', label: copy.tabs },
    { id: 'rules', label: copy.rules },
    { id: 'border', label: copy.border },
    { id: 'shading', label: copy.shading },
    { id: 'keep', label: copy.keep },
    { id: 'hyphenation', label: copy.hyphenation },
    { id: 'justification', label: copy.justification },
    { id: 'columns', label: copy.columns },
    { id: 'nested', label: copy.nested },
    { id: 'grep', label: copy.grepStyles },
    { id: 'bullets', label: copy.bulletsNumbering },
    { id: 'color', label: copy.characterColor },
    { id: 'opentype', label: copy.openType },
    { id: 'underline', label: copy.underlineOptions },
    { id: 'strikethrough', label: copy.strikeOptions },
    { id: 'export', label: copy.exportTagging },
  ];
}

type Copy = ReturnType<typeof copyFor>;

function copyFor(locale: string) {
  const lang = locale.toLowerCase().split(/[-_]/)[0];
  const hu = lang === 'hu';
  const de = lang === 'de';
  const t = (a: string, b: string, c: string) => hu ? a : de ? b : c;
  return {
    settings: t('Bekezdésstílus beállításai', 'Absatzformat-Einstellungen', 'Paragraph style settings'),
    general: t('Általános', 'Allgemein', 'General'),
    basic: t('Alapvető karakterformázás', 'Grundlegende Zeichenformate', 'Basic character formats'),
    advanced: t('Speciális karakterformázás', 'Erweiterte Zeichenformate', 'Advanced character formats'),
    indents: t('Behúzás és térköz', 'Einzüge und Abstände', 'Indents and spacing'),
    tabs: t('Tabulátorok', 'Tabulatoren', 'Tabs'),
    rules: t('Bekezdés léniák', 'Absatzlinien', 'Paragraph rules'),
    border: t('Bekezdésszegély', 'Absatzrahmen', 'Paragraph border'),
    shading: t('Bekezdésárnyékolás', 'Absatzschattierung', 'Paragraph shading'),
    keep: t('Sorok együtt tartása', 'Umbruchoptionen', 'Keep options'),
    hyphenation: t('Elválasztás', 'Silbentrennung', 'Hyphenation'),
    justification: t('Sorkizárás', 'Abstände', 'Justification'),
    columns: t('Szakasz hasábjai', 'Spalten überspannen', 'Span columns'),
    nested: t('Iniciálék és egymásba ágyazott stílusok', 'Initialen und verschachtelte Formate', 'Drop caps and nested styles'),
    grepStyles: t('GREP stílus', 'GREP-Stil', 'GREP style'),
    bulletsNumbering: t('Felsorolás és számozás', 'Aufzählungszeichen und Nummerierung', 'Bullets and numbering'),
    characterColor: t('Karakterszín', 'Zeichenfarbe', 'Character color'),
    openType: t('OpenType jellemzők', 'OpenType-Funktionen', 'OpenType features'),
    underlineOptions: t('Aláhúzási beállítások', 'Unterstreichungsoptionen', 'Underline options'),
    strikeOptions: t('Áthúzási beállítások', 'Durchstreichungsoptionen', 'Strikethrough options'),
    exportTagging: t('Címke exportálása', 'Export-Tagging', 'Export tagging'),
    styleName: t('Stílus neve', 'Formatname', 'Style name'),
    basedOn: t('Ez alapján', 'Basiert auf', 'Based on'),
    nextStyle: t('Következő stílus', 'Nächstes Format', 'Next style'),
    shortcut: t('Gyorsbillentyű', 'Tastaturbefehl', 'Shortcut'),
    noStyle: t('[Nincs bekezdésstílus]', '[Kein Absatzformat]', '[No paragraph style]'),
    styleSummary: t('Stílusbeállítások', 'Formateinstellungen', 'Style settings'),
    size: t('Méret', 'Schriftgrad', 'Size'),
    leading: t('Sortávolság', 'Zeilenabstand', 'Leading'),
    kerning: t('Alávágás', 'Kerning', 'Kerning'),
    metrics: t('Metrikus', 'Metrisch', 'Metrics'),
    optical: t('Optikai', 'Optisch', 'Optical'),
    manual: t('Kézi', 'Manuell', 'Manual'),
    tracking: t('Betűköz', 'Laufweite', 'Tracking'),
    capitalization: t('Kis- és nagybetűk', 'Groß-/Kleinschreibung', 'Capitalization'),
    normal: t('Normál', 'Normal', 'Normal'),
    smallCaps: t('Kiskapitális', 'Kapitälchen', 'Small caps'),
    allCaps: t('Nagybetűs', 'Versalien', 'All caps'),
    position: t('Helyzet', 'Position', 'Position'),
    superscript: t('Felső index', 'Hochgestellt', 'Superscript'),
    subscript: t('Alsó index', 'Tiefgestellt', 'Subscript'),
    superior: t('Felső', 'Superior', 'Superior'),
    inferior: t('Alsó', 'Inferior', 'Inferior'),
    underline: t('Aláhúzott', 'Unterstrichen', 'Underline'),
    ligatures: t('Ligatúrák', 'Ligaturen', 'Ligatures'),
    noBreak: t('Nincs törés', 'Kein Umbruch', 'No break'),
    strikethrough: t('Áthúzás', 'Durchgestrichen', 'Strikethrough'),
    horizontalScale: t('Vízszintes méretezés', 'Horizontale Skalierung', 'Horizontal scale'),
    verticalScale: t('Függőleges méretezés', 'Vertikale Skalierung', 'Vertical scale'),
    baselineShift: t('Alapvonal-eltolás', 'Grundlinienversatz', 'Baseline shift'),
    skew: t('Döntés', 'Neigung', 'Skew'),
    language: t('Nyelv', 'Sprache', 'Language'),
    alignment: t('Igazítás', 'Ausrichtung', 'Alignment'),
    left: t('Bal', 'Links', 'Left'),
    right: t('Jobb', 'Rechts', 'Right'),
    center: t('Közép', 'Zentriert', 'Center'),
    justify: t('Sorkizárt', 'Blocksatz', 'Justified'),
    leftIndent: t('Bal oldali behúzás', 'Linker Einzug', 'Left indent'),
    rightIndent: t('Jobb oldali behúzás', 'Rechter Einzug', 'Right indent'),
    firstLineIndent: t('Első sor behúzása', 'Einzug erste Zeile', 'First-line indent'),
    lastLineIndent: t('Utolsó sor behúzása', 'Einzug letzte Zeile', 'Last-line indent'),
    spaceBefore: t('Térköz előtte', 'Abstand davor', 'Space before'),
    spaceAfter: t('Térköz utána', 'Abstand danach', 'Space after'),
    sameStyleSpacing: t('Azonos stílusú bekezdések közötti térköz', 'Abstand zwischen gleichem Format', 'Same-style spacing'),
    balanceRagged: t('Szabad sorvégek kiegyenlítése', 'Unausgeglichene Zeilen ausgleichen', 'Balance ragged lines'),
    ignoreOpticalMargin: t('Optikai margó kihagyása', 'Optischen Randausgleich ignorieren', 'Ignore optical margin'),
    baselineGrid: t('Rácshoz igazítás', 'Am Grundlinienraster ausrichten', 'Align to baseline grid'),
    gridAllLines: t('Minden sor', 'Alle Zeilen', 'All lines'),
    gridFirstLine: t('Első sor', 'Erste Zeile', 'First line'),
    gridLastLine: t('Utolsó sor', 'Letzte Zeile', 'Last line'),
    decimal: t('Igazítás karakterhez', 'Am Zeichen ausrichten', 'Align on character'),
    leader: t('Sorkitöltés', 'Füllzeichen', 'Leader'),
    alignOn: t('Igazítás be', 'Ausrichten an', 'Align on'),
    delete: t('Törlés', 'Löschen', 'Delete'),
    add: t('Hozzáadás', 'Hinzufügen', 'Add'),
    ruleAbove: t('Felső lénia', 'Linie darüber', 'Rule above'),
    ruleBelow: t('Alsó lénia', 'Linie darunter', 'Rule below'),
    enabled: t('Bekapcsolva', 'Aktiviert', 'Enabled'),
    weight: t('Vastagság', 'Stärke', 'Weight'),
    type: t('Típus', 'Typ', 'Type'),
    color: t('Szín', 'Farbe', 'Color'),
    tint: t('Színárnyalat', 'Farbton', 'Tint'),
    offset: t('Eltolás', 'Versatz', 'Offset'),
    overprint: t('Felülnyomás', 'Überdrucken', 'Overprint'),
    gapColor: t('Köz színe', 'Lückenfarbe', 'Gap color'),
    gapTint: t('Köz színárnyalata', 'Lückenfarbton', 'Gap tint'),
    gapOverprint: t('Térköz felülnyomása', 'Lücke überdrucken', 'Overprint gap'),
    strokeName: t('Vonalstílus', 'Konturstil', 'Stroke style'),
    widthMode: t('Szélesség', 'Breite', 'Width'),
    column: t('Oszlop', 'Spalte', 'Column'),
    text: t('Szöveg', 'Text', 'Text'),
    keepInFrame: t('Kereten belül marad', 'Im Rahmen halten', 'Keep in frame'),
    cap: t('Vonalvég', 'Linienende', 'Cap'),
    capButt: t('Tompa', 'Abgeschnitten', 'Butt'),
    capRound: t('Kerek', 'Rund', 'Round'),
    capProjecting: t('Kinyúló', 'Projizierend', 'Projecting'),
    join: t('Egyesítés', 'Eckenverbindung', 'Join'),
    joinMiter: t('Gér', 'Gehrung', 'Miter'),
    joinRound: t('Kerek', 'Rund', 'Round'),
    joinBevel: t('Levágott', 'Abgeschrägt', 'Bevel'),
    corners: t('Sarok mérete és alakja', 'Eckgröße und -form', 'Corner size and shape'),
    radius: t('Méret', 'Größe', 'Radius'),
    cornerShape: t('Alak', 'Form', 'Shape'),
    cornerSquare: t('Négyzetes', 'Eckig', 'Square'),
    cornerRounded: t('Lekerekített', 'Abgerundet', 'Rounded'),
    cornerBevel: t('Levágott', 'Abgeschrägt', 'Bevel'),
    cornerInset: t('Belső', 'Eingezogen', 'Inset'),
    cornerInverseRounded: t('Fordított kerek', 'Umgekehrt rund', 'Inverse rounded'),
    topLeft: t('Bal felső', 'Oben links', 'Top left'),
    topRight: t('Jobb felső', 'Oben rechts', 'Top right'),
    bottomRight: t('Jobb alsó', 'Unten rechts', 'Bottom right'),
    bottomLeft: t('Bal alsó', 'Unten links', 'Bottom left'),
    offsets: t('Eltolások', 'Versätze', 'Offsets'),
    displayAcrossFrames: t('Szegély megjelenítése kereteken/oszlopokon át', 'Rahmen über Textrahmen/Spalten hinweg anzeigen', 'Display border across frames/columns'),
    solid: t('Folytonos', 'Durchgezogen', 'Solid'),
    dashed: t('Szaggatott', 'Gestrichelt', 'Dashed'),
    dotted: t('Pontozott', 'Gepunktet', 'Dotted'),
    double: t('Dupla', 'Doppelt', 'Double'),
    top: t('Felső', 'Oben', 'Top'),
    bottom: t('Alsó', 'Unten', 'Bottom'),
    mergeConsecutive: t('Egymást követő szegélyek egyesítése', 'Aufeinanderfolgende Rahmen zusammenführen', 'Merge consecutive borders'),
    clipToFrame: t('Vágás a kerethez', 'Am Rahmen beschneiden', 'Clip to frame'),
    suppressExport: t('Ne nyomtassa vagy exportálja', 'Nicht drucken oder exportieren', 'Suppress in export'),
    keepWithPrevious: t('Együtt az előzővel', 'Mit vorherigem zusammenhalten', 'Keep with previous'),
    keepTogether: t('Sorok együtt tartása', 'Zeilen zusammenhalten', 'Keep lines together'),
    keepWithNext: t('Együtt a következővel', 'Mit nächsten Zeilen zusammenhalten', 'Keep with next'),
    keepFirst: t('Bekezdés elején', 'Am Absatzanfang', 'At paragraph start'),
    keepLast: t('Bekezdés végén', 'Am Absatzende', 'At paragraph end'),
    startParagraph: t('Bekezdés kezdete', 'Absatzbeginn', 'Start paragraph'),
    anywhere: t('Bárhol', 'Beliebig', 'Anywhere'),
    nextColumn: t('Következő hasáb', 'Nächste Spalte', 'Next column'),
    nextFrame: t('Következő keret', 'Nächster Rahmen', 'Next frame'),
    nextPage: t('Következő oldal', 'Nächste Seite', 'Next page'),
    nextOddPage: t('Következő páratlan oldal', 'Nächste ungerade Seite', 'Next odd page'),
    nextEvenPage: t('Következő páros oldal', 'Nächste gerade Seite', 'Next even page'),
    wordLength: t('Ha van benne legalább', 'Mindestens Wortlänge', 'Minimum word length'),
    prefix: t('Ha van előtte legalább', 'Mindestens davor', 'Minimum prefix'),
    suffix: t('Ha van utána legalább', 'Mindestens danach', 'Minimum suffix'),
    maxHyphens: t('Legfeljebb', 'Maximale Trennungen', 'Maximum hyphens'),
    hyphenZone: t('Elválasztási zóna', 'Silbentrennzone', 'Hyphenation zone'),
    hyphenPreference: t('Jobb helykihasználás / kevesebb elválasztás', 'Besserer Abstand / weniger Trennungen', 'Spacing / fewer hyphens'),
    hyphenCaps: t('Nagybetűs szavak elválasztása', 'Wörter in Versalien trennen', 'Hyphenate capitalized words'),
    hyphenLast: t('Utolsó szó elválasztása', 'Letztes Wort trennen', 'Hyphenate last word'),
    hyphenColumns: t('Elválasztás oszlopon keresztül', 'Über Spalten trennen', 'Hyphenate across columns'),
    wordMin: t('Szavak térköze – minimális', 'Wortabstand – Minimum', 'Word spacing – minimum'),
    wordDesired: t('Szavak térköze – kívánt', 'Wortabstand – Gewünscht', 'Word spacing – desired'),
    wordMax: t('Szavak térköze – maximális', 'Wortabstand – Maximum', 'Word spacing – maximum'),
    letterMin: t('Betűtávolság – minimális', 'Zeichenabstand – Minimum', 'Letter spacing – minimum'),
    letterDesired: t('Betűtávolság – kívánt', 'Zeichenabstand – Gewünscht', 'Letter spacing – desired'),
    letterMax: t('Betűtávolság – maximális', 'Zeichenabstand – Maximum', 'Letter spacing – maximum'),
    glyphMin: t('Karakterméretezés – minimális', 'Glyphenskalierung – Minimum', 'Glyph scaling – minimum'),
    glyphDesired: t('Karakterméretezés – kívánt', 'Glyphenskalierung – Gewünscht', 'Glyph scaling – desired'),
    glyphMax: t('Karakterméretezés – maximális', 'Glyphenskalierung – Maximum', 'Glyph scaling – maximum'),
    autoLeading: t('Automatikus sortávolság', 'Automatischer Zeilenabstand', 'Auto leading'),
    composer: t('Szerkesztő', 'Setzer', 'Composer'),
    paragraphFormat: t('Bekezdésformátum', 'Absatzformat', 'Paragraph format'),
    singleColumn: t('Egy oszlopban', 'Einzelne Spalte', 'Single column'),
    span: t('Hasábok átfogása', 'Spalten überspannen', 'Span columns'),
    split: t('Hasábok felosztása', 'Spalten teilen', 'Split columns'),
    columnCount: t('Hasábok száma', 'Spaltenanzahl', 'Column count'),
    insideGutter: t('Belső hasábköz', 'Innerer Spaltenabstand', 'Inside gutter'),
    outsideGutter: t('Külső hasábköz', 'Äußerer Spaltenabstand', 'Outside gutter'),
    dropCaps: t('Iniciálék', 'Initialen', 'Drop caps'),
    lines: t('Sor', 'Zeilen', 'Lines'),
    characters: t('Karakterek', 'Zeichen', 'Characters'),
    characterStyle: t('Karakterstílus', 'Zeichenformat', 'Character style'),
    alignLeftEdge: t('Bal oldali szegély igazítása', 'Linke Kante ausrichten', 'Align left edge'),
    scaleDescenders: t('Igazítás az alsó nyúlványokhoz', 'An Unterlängen ausrichten', 'Scale for descenders'),
    nestedStyles: t('Egymásba ágyazott stílusok', 'Verschachtelte Formate', 'Nested styles'),
    nestedLineStyles: t('Egymásba ágyazott vonalstílusok', 'Verschachtelte Zeilenformate', 'Nested line styles'),
    delimiter: t('Határoló', 'Trennzeichen', 'Delimiter'),
    expression: t('GREP kifejezés', 'GREP-Ausdruck', 'GREP expression'),
    listType: t('Lista típusa', 'Listentyp', 'List type'),
    none: t('Nincs', 'Keine', 'None'),
    bullets: t('Felsorolás', 'Aufzählung', 'Bullets'),
    numbers: t('Számozás', 'Nummerierung', 'Numbers'),
    listName: t('Lista', 'Liste', 'List'),
    level: t('Szint', 'Ebene', 'Level'),
    bulletCharacter: t('Felsorolásjel', 'Aufzählungszeichen', 'Bullet character'),
    numberExpression: t('Számozási minta', 'Nummerierungsmuster', 'Number expression'),
    tabPosition: t('Tabulátor helye', 'Tabulatorposition', 'Tab position'),
    startAt: t('Kezdőérték', 'Beginnen bei', 'Start at'),
    restartAfterLevel: t('Újraindítás szint után', 'Nach Ebene neu starten', 'Restart after level'),
    fillColor: t('Kitöltés színe', 'Flächenfarbe', 'Fill color'),
    strokeWeight: t('Körvonal vastagsága', 'Konturstärke', 'Stroke weight'),
    strokeColor: t('Körvonal színe', 'Konturfarbe', 'Stroke color'),
    strokeTint: t('Körvonal színárnyalata', 'Konturfarbton', 'Stroke tint'),
    miterLimit: t('Ferde vágás határa', 'Gehrungsgrenze', 'Miter limit'),
    strokeAlignment: t('Körvonal igazítása', 'Konturausrichtung', 'Stroke alignment'),
    strokeCenter: t('Középre', 'Zentriert', 'Center'),
    strokeInside: t('Belülre', 'Innen', 'Inside'),
    strokeOutside: t('Kívülre', 'Außen', 'Outside'),
    overprintFill: t('Felülnyomott kitöltés', 'Fläche überdrucken', 'Overprint fill'),
    overprintStroke: t('Felülnyomott körvonal', 'Kontur überdrucken', 'Overprint stroke'),
    titling: t('Címváltozatok', 'Titelformen', 'Titling alternates'),
    swash: t('Hajlításváltozatok', 'Schwungformen', 'Swash'),
    contextual: t('Környezetfüggő változatok', 'Kontextvarianten', 'Contextual alternates'),
    ordinals: t('Sorszámok', 'Ordinalzahlen', 'Ordinals'),
    discretionaryLigatures: t('Tetszés szerinti ligatúrák', 'Optionale Ligaturen', 'Discretionary ligatures'),
    fractions: t('Törtek', 'Brüche', 'Fractions'),
    slashedZero: t('Perjeles nulla', 'Durchgestrichene Null', 'Slashed zero'),
    stylisticSets: t('Stíluskészletek', 'Stilsets', 'Stylistic sets'),
    figureStyle: t('Számstílus', 'Ziffernstil', 'Figure style'),
    positionalForm: t('Helyfüggő alak', 'Positionsform', 'Positional form'),
    defaultValue: t('Alapértelmezett', 'Standard', 'Default'),
    liningProportional: t('Álló, arányos', 'Versalziffern proportional', 'Lining proportional'),
    liningTabular: t('Álló, táblázatos', 'Versalziffern tabellarisch', 'Lining tabular'),
    oldstyleProportional: t('Ugráló, arányos', 'Mediäval proportional', 'Oldstyle proportional'),
    oldstyleTabular: t('Ugráló, táblázatos', 'Mediäval tabellarisch', 'Oldstyle tabular'),
    generalForm: t('Általános alak', 'Allgemeine Form', 'General form'),
    initialForm: t('Kezdő alak', 'Anfangsform', 'Initial form'),
    medialForm: t('Középső alak', 'Mittelform', 'Medial form'),
    finalForm: t('Záró alak', 'Endform', 'Final form'),
    isolatedForm: t('Önálló alak', 'Isolierte Form', 'Isolated form'),
    htmlTag: t('HTML címke', 'HTML-Tag', 'HTML tag'),
    epubTag: t('EPUB címke', 'EPUB-Tag', 'EPUB tag'),
    ariaRole: t('ARIA szerep', 'ARIA-Rolle', 'ARIA role'),
    cssClass: t('Osztály', 'Klasse', 'Class'),
    pdfTag: t('PDF címke', 'PDF-Tag', 'PDF tag'),
    applyHtmlClass: t('HTML-osztályok alkalmazása', 'HTML-Klassen anwenden', 'Apply HTML classes'),
    emitCss: t('CSS készítése', 'CSS ausgeben', 'Emit CSS'),
    splitDocument: t('Dokumentum darabolása', 'Dokument aufteilen', 'Split document'),
    emitTag: t('Címke exportálása', 'Tag exportieren', 'Emit tag'),
  };
}
