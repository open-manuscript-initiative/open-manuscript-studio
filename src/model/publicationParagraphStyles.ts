export type PublicationParagraphAlignment = 'left' | 'center' | 'right' | 'justify';
export type PublicationParagraphFontStyle = 'normal' | 'italic';
export type PublicationParagraphCapitalization =
  | 'normal'
  | 'small-caps'
  | 'all-caps';
export type PublicationTabAlignment = 'left' | 'center' | 'right' | 'decimal';
export type PublicationRuleStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type PublicationParagraphStart =
  | 'anywhere'
  | 'next-column'
  | 'next-frame'
  | 'next-page'
  | 'next-odd-page'
  | 'next-even-page';
export type PublicationSpanColumnMode = 'single' | 'span' | 'split';
export type PublicationListType = 'none' | 'bullets' | 'numbers';
export type PublicationKerningMode = 'metrics' | 'optical' | 'manual';
export type PublicationCharacterPosition =
  | 'normal'
  | 'superscript'
  | 'subscript'
  | 'superior'
  | 'inferior';
export type PublicationWidthMode = 'column' | 'text';
export type PublicationStrokeCap = 'butt' | 'round' | 'projecting';
export type PublicationStrokeJoin = 'miter' | 'round' | 'bevel';
export type PublicationBaselineGridAlignment =
  | 'none'
  | 'all-lines'
  | 'first-line'
  | 'last-line';
export type PublicationComposer =
  | 'adobe-paragraph'
  | 'adobe-single-line'
  | 'world-ready-paragraph'
  | 'world-ready-single-line';
export type PublicationFigureStyle =
  | 'default'
  | 'lining-proportional'
  | 'lining-tabular'
  | 'oldstyle-proportional'
  | 'oldstyle-tabular';
export type PublicationPositionalForm =
  | 'general'
  | 'initial'
  | 'medial'
  | 'final'
  | 'isolated';
export type PublicationEdgeReference =
  | 'paragraph'
  | 'text'
  | 'cap-height'
  | 'x-height'
  | 'baseline'
  | 'leading'
  | 'ascent'
  | 'descent';
export type PublicationCornerShape =
  | 'square'
  | 'rounded'
  | 'bevel'
  | 'inset'
  | 'inverse-rounded';
export type PublicationIdmlPrimitive = string | number | boolean;

export interface PublicationParagraphTabStop {
  positionMm: number;
  alignment?: PublicationTabAlignment;
  leader?: string;
  decimalCharacter?: string;
}

export interface PublicationParagraphRule {
  enabled?: boolean;
  widthPt?: number;
  style?: PublicationRuleStyle;
  strokeName?: string;
  color?: string;
  tint?: number;
  overprint?: boolean;
  gapColor?: string;
  gapTint?: number;
  gapOverprint?: boolean;
  widthMode?: PublicationWidthMode;
  offsetPt?: number;
  leftIndentMm?: number;
  rightIndentMm?: number;
  keepInFrame?: boolean;
}

export interface PublicationEdgeWidths {
  topPt?: number;
  rightPt?: number;
  bottomPt?: number;
  leftPt?: number;
}

export interface PublicationCorner {
  radiusMm?: number;
  shape?: PublicationCornerShape;
}

export interface PublicationCorners {
  topLeft?: PublicationCorner;
  topRight?: PublicationCorner;
  bottomRight?: PublicationCorner;
  bottomLeft?: PublicationCorner;
}

export interface PublicationOffsets {
  topMm?: number;
  rightMm?: number;
  bottomMm?: number;
  leftMm?: number;
}

export interface PublicationParagraphBorder {
  enabled?: boolean;
  widthPt?: number;
  widths?: PublicationEdgeWidths;
  style?: PublicationRuleStyle;
  strokeName?: string;
  color?: string;
  tint?: number;
  overprint?: boolean;
  gapColor?: string;
  gapTint?: number;
  gapOverprint?: boolean;
  cap?: PublicationStrokeCap;
  join?: PublicationStrokeJoin;
  corners?: PublicationCorners;
  offsets?: PublicationOffsets;
  topEdgeReference?: PublicationEdgeReference;
  bottomEdgeReference?: PublicationEdgeReference;
  widthMode?: PublicationWidthMode;
  displayAcrossFrames?: boolean;
  mergeConsecutive?: boolean;
}

export interface PublicationParagraphShading {
  enabled?: boolean;
  color?: string;
  tint?: number;
  overprint?: boolean;
  corners?: PublicationCorners;
  offsets?: PublicationOffsets;
  topEdgeReference?: PublicationEdgeReference;
  bottomEdgeReference?: PublicationEdgeReference;
  widthMode?: PublicationWidthMode;
  clipToFrame?: boolean;
  suppressInExport?: boolean;
}

export interface PublicationHyphenationSettings {
  minimumWordLength?: number;
  minimumPrefix?: number;
  minimumSuffix?: number;
  maximumHyphens?: number;
  hyphenationZoneMm?: number;
  hyphenateCapitalizedWords?: boolean;
  hyphenateLastWord?: boolean;
  hyphenateAcrossColumns?: boolean;
  preference?: number;
}

export interface PublicationParagraphJustification {
  wordSpacingMinimum?: number;
  wordSpacingDesired?: number;
  wordSpacingMaximum?: number;
  letterSpacingMinimum?: number;
  letterSpacingDesired?: number;
  letterSpacingMaximum?: number;
  glyphScalingMinimum?: number;
  glyphScalingDesired?: number;
  glyphScalingMaximum?: number;
  singleWordAlignment?: PublicationParagraphAlignment;
  autoLeadingPercent?: number;
  composer?: PublicationComposer;
}

export interface PublicationSpanColumns {
  mode?: PublicationSpanColumnMode;
  count?: number;
  insideGutterMm?: number;
  outsideGutterMm?: number;
}

export interface PublicationDropCaps {
  lines?: number;
  characters?: number;
  characterStyleId?: string;
  alignLeftEdge?: boolean;
  scaleForDescenders?: boolean;
}

export interface PublicationNestedStyleRule {
  id: string;
  characterStyleId: string;
  repeat?: number;
  through?: boolean;
  delimiter?: string;
}

export interface PublicationNestedLineStyleRule {
  id: string;
  characterStyleId: string;
  lines: number;
}

export interface PublicationGrepStyleRule {
  id: string;
  characterStyleId: string;
  expression: string;
}

export interface PublicationBulletsAndNumbering {
  type?: PublicationListType;
  listName?: string;
  level?: number;
  format?: string;
  bulletCharacter?: string;
  numberExpression?: string;
  startAt?: number;
  restartAfterLevel?: number;
  leftIndentMm?: number;
  firstLineIndentMm?: number;
  tabPositionMm?: number;
  characterStyleId?: string;
  alignment?: PublicationParagraphAlignment;
}

export interface PublicationOpenTypeSettings {
  ligatures?: boolean;
  titlingAlternates?: boolean;
  swash?: boolean;
  discretionaryLigatures?: boolean;
  contextualAlternates?: boolean;
  fractions?: boolean;
  ordinals?: boolean;
  slashedZero?: boolean;
  figureStyle?: PublicationFigureStyle;
  positionalForm?: PublicationPositionalForm;
  stylisticSet?: number;
  stylisticSets?: number[];
}

export interface PublicationTextDecoration {
  enabled?: boolean;
  weightPt?: number;
  offsetPt?: number;
  style?: PublicationRuleStyle;
  strokeName?: string;
  color?: string;
  tint?: number;
  overprint?: boolean;
  gapColor?: string;
  gapTint?: number;
  gapOverprint?: boolean;
}

export interface PublicationCharacterStroke {
  widthPt?: number;
  color?: string;
  tint?: number;
  overprint?: boolean;
  miterLimit?: number;
  alignment?: 'center' | 'inside' | 'outside';
}

export interface PublicationExportTagging {
  htmlTag?: string;
  epubTag?: string;
  ariaRole?: string;
  applyHtmlClass?: boolean;
  cssClass?: string;
  emitCss?: boolean;
  splitDocument?: boolean;
  emitTag?: boolean;
  pdfTag?: string;
}

export interface PublicationParagraphStyleProperties {
  // Basic / advanced character formatting.
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: number;
  fontStyle?: PublicationParagraphFontStyle;
  capitalization?: PublicationParagraphCapitalization;
  tracking?: number;
  kerning?: number;
  kerningMode?: PublicationKerningMode;
  position?: PublicationCharacterPosition;
  noBreak?: boolean;
  horizontalScale?: number;
  verticalScale?: number;
  baselineShift?: number;
  skew?: number;
  language?: string;
  fillColor?: string;
  fillTint?: number;
  fillOverprint?: boolean;
  characterStroke?: PublicationCharacterStroke;

  // Paragraph geometry.
  alignment?: PublicationParagraphAlignment;
  firstLineIndent?: number;
  leftIndent?: number;
  rightIndent?: number;
  lastLineIndent?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  spaceBetweenSameStyle?: number;
  balanceRaggedLines?: boolean;
  ignoreOpticalMargin?: boolean;
  baselineGridAlignment?: PublicationBaselineGridAlignment;
  tabStops?: PublicationParagraphTabStop[];

  // Paragraph rules, border and shading.
  ruleAbove?: PublicationParagraphRule;
  ruleBelow?: PublicationParagraphRule;
  border?: PublicationParagraphBorder;
  shading?: PublicationParagraphShading;

  // Composition / keep / hyphenation.
  hyphenation?: boolean;
  hyphenationSettings?: PublicationHyphenationSettings;
  keepTogether?: boolean;
  keepWithPrevious?: boolean;
  keepWithNext?: boolean;
  keepWithNextLines?: number;
  keepFirstLines?: number;
  keepLastLines?: number;
  startParagraph?: PublicationParagraphStart;
  widows?: number;
  orphans?: number;
  justification?: PublicationParagraphJustification;

  // InDesign paragraph features.
  spanColumns?: PublicationSpanColumns;
  dropCaps?: PublicationDropCaps;
  nestedStyles?: PublicationNestedStyleRule[];
  nestedLineStyles?: PublicationNestedLineStyleRule[];
  grepStyles?: PublicationGrepStyleRule[];
  bulletsAndNumbering?: PublicationBulletsAndNumbering;

  // OpenType and decoration.
  openType?: PublicationOpenTypeSettings;
  underline?: PublicationTextDecoration;
  strikethrough?: PublicationTextDecoration;

  // EPUB/HTML export tagging.
  exportTagging?: PublicationExportTagging;
}

export interface PublicationParagraphStyleDefinition {
  id: string;
  name: string;
  basedOnId: string | null;
  nextStyleId: string | null;
  shortcut?: string | null;
  properties: PublicationParagraphStyleProperties;
  preservedIdml?: Record<string, PublicationIdmlPrimitive>;
}

export interface PublicationParagraphStyleCollection {
  defaultStyleId: string;
  items: PublicationParagraphStyleDefinition[];
}

export type ResolvedPublicationParagraphStyle =
  Required<PublicationParagraphStyleProperties>;

export function normalizePublicationParagraphStyleCollection(
  value: PublicationParagraphStyleCollection | undefined,
  fallback: PublicationParagraphStyleCollection,
): PublicationParagraphStyleCollection {
  const sourceItems = Array.isArray(value?.items) ? value.items : [];
  const fallbackItems = fallback.items.map(normalizeDefinition).filter(isDefinition);
  const items = sourceItems.map(normalizeDefinition).filter(isDefinition);
  const normalizedItems = items.length ? items : fallbackItems;
  const availableIds = new Set(normalizedItems.map((item) => item.id));
  const requestedDefault = cleanText(value?.defaultStyleId);
  const fallbackDefault = cleanText(fallback.defaultStyleId);
  const defaultStyleId = availableIds.has(requestedDefault)
    ? requestedDefault
    : availableIds.has(fallbackDefault)
      ? fallbackDefault
      : normalizedItems[0]?.id ?? 'body';

  return {
    defaultStyleId,
    items: normalizedItems.map((item) => ({
      ...item,
      basedOnId: item.basedOnId && availableIds.has(item.basedOnId)
        ? item.basedOnId
        : null,
      nextStyleId: item.nextStyleId && availableIds.has(item.nextStyleId)
        ? item.nextStyleId
        : defaultStyleId,
    })),
  };
}

export function resolvePublicationParagraphStyle(
  collection: PublicationParagraphStyleCollection,
  styleId: string | null | undefined,
  defaults: ResolvedPublicationParagraphStyle,
): ResolvedPublicationParagraphStyle {
  const byId = new Map(collection.items.map((item) => [item.id, item]));
  const requested = cleanText(styleId);
  const start = byId.get(requested) ?? byId.get(collection.defaultStyleId);
  if (!start) return cloneProperties(defaults) as ResolvedPublicationParagraphStyle;

  const chain: PublicationParagraphStyleDefinition[] = [];
  const visited = new Set<string>();
  let current: PublicationParagraphStyleDefinition | undefined = start;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.basedOnId ? byId.get(current.basedOnId) : undefined;
  }

  return chain.reduce(
    (resolved, definition) => mergePublicationParagraphStyleProperties(
      resolved,
      definition.properties,
    ) as ResolvedPublicationParagraphStyle,
    cloneProperties(defaults) as ResolvedPublicationParagraphStyle,
  );
}

export function mergePublicationParagraphStyleProperties(
  base: PublicationParagraphStyleProperties,
  patch: PublicationParagraphStyleProperties,
): PublicationParagraphStyleProperties {
  const merged: PublicationParagraphStyleProperties = {
    ...base,
    ...patch,
  };

  for (const key of [
    'ruleAbove',
    'ruleBelow',
    'border',
    'shading',
    'hyphenationSettings',
    'justification',
    'spanColumns',
    'dropCaps',
    'bulletsAndNumbering',
    'openType',
    'underline',
    'strikethrough',
    'characterStroke',
    'exportTagging',
  ] as const) {
    const next = patch[key];
    const previous = base[key];
    if (next !== undefined) {
      (merged as Record<string, unknown>)[key] = {
        ...(previous ?? {}),
        ...next,
      };
    }
  }

  if (patch.tabStops !== undefined) {
    merged.tabStops = patch.tabStops.map((stop) => ({ ...stop }));
  }
  if (patch.nestedStyles !== undefined) {
    merged.nestedStyles = patch.nestedStyles.map((rule) => ({ ...rule }));
  }
  if (patch.nestedLineStyles !== undefined) {
    merged.nestedLineStyles = patch.nestedLineStyles.map((rule) => ({ ...rule }));
  }
  if (patch.grepStyles !== undefined) {
    merged.grepStyles = patch.grepStyles.map((rule) => ({ ...rule }));
  }

  return merged;
}

export function paragraphStyleWouldCreateCycle(
  collection: PublicationParagraphStyleCollection,
  styleId: string,
  candidateBaseId: string | null,
): boolean {
  if (!candidateBaseId) return false;
  if (candidateBaseId === styleId) return true;
  const byId = new Map(collection.items.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let currentId: string | null = candidateBaseId;
  while (currentId && !visited.has(currentId)) {
    if (currentId === styleId) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)?.basedOnId ?? null;
  }
  return false;
}

function normalizeDefinition(
  value: PublicationParagraphStyleDefinition | undefined,
): PublicationParagraphStyleDefinition | null {
  const id = cleanText(value?.id);
  if (!id) return null;
  return {
    id,
    name: cleanText(value?.name) || id,
    basedOnId: cleanText(value?.basedOnId) || null,
    nextStyleId: cleanText(value?.nextStyleId) || null,
    shortcut: cleanText(value?.shortcut) || null,
    properties: normalizeProperties(value?.properties),
    preservedIdml: normalizePreservedIdml(value?.preservedIdml),
  };
}

function normalizeProperties(
  value: PublicationParagraphStyleProperties | undefined,
): PublicationParagraphStyleProperties {
  if (!value || typeof value !== 'object') return {};
  const result: PublicationParagraphStyleProperties = {};
  const fontFamily = cleanText(value.fontFamily);
  if (fontFamily) result.fontFamily = fontFamily;
  if (finite(value.fontSize) && Number(value.fontSize) > 0) result.fontSize = Number(value.fontSize);
  if (finite(value.lineHeight) && Number(value.lineHeight) > 0) result.lineHeight = Number(value.lineHeight);
  if (finite(value.fontWeight)) result.fontWeight = Math.max(100, Math.min(900, Number(value.fontWeight)));
  if (value.fontStyle === 'normal' || value.fontStyle === 'italic') result.fontStyle = value.fontStyle;
  if (
    value.kerningMode === 'metrics'
    || value.kerningMode === 'optical'
    || value.kerningMode === 'manual'
  ) result.kerningMode = value.kerningMode;
  if (
    value.position === 'normal'
    || value.position === 'superscript'
    || value.position === 'subscript'
    || value.position === 'superior'
    || value.position === 'inferior'
  ) result.position = value.position;
  if (typeof value.noBreak === 'boolean') result.noBreak = value.noBreak;
  if (
    value.capitalization === 'normal'
    || value.capitalization === 'small-caps'
    || value.capitalization === 'all-caps'
  ) result.capitalization = value.capitalization;
  for (const property of [
    'tracking',
    'kerning',
    'horizontalScale',
    'verticalScale',
    'baselineShift',
    'skew',
    'fillTint',
    'firstLineIndent',
    'leftIndent',
    'rightIndent',
    'lastLineIndent',
    'spaceBefore',
    'spaceAfter',
    'spaceBetweenSameStyle',
  ] as const) {
    if (finite(value[property])) result[property] = Number(value[property]);
  }
  for (const property of ['language', 'fillColor'] as const) {
    const normalized = cleanText(value[property]);
    if (normalized) result[property] = normalized;
  }
  if (typeof value.fillOverprint === 'boolean') result.fillOverprint = value.fillOverprint;
  result.characterStroke = normalizeCharacterStroke(value.characterStroke);
  if (typeof value.balanceRaggedLines === 'boolean') result.balanceRaggedLines = value.balanceRaggedLines;
  if (typeof value.ignoreOpticalMargin === 'boolean') result.ignoreOpticalMargin = value.ignoreOpticalMargin;
  if (
    value.baselineGridAlignment === 'none'
    || value.baselineGridAlignment === 'all-lines'
    || value.baselineGridAlignment === 'first-line'
    || value.baselineGridAlignment === 'last-line'
  ) result.baselineGridAlignment = value.baselineGridAlignment;
  if (
    value.alignment === 'left'
    || value.alignment === 'center'
    || value.alignment === 'right'
    || value.alignment === 'justify'
  ) result.alignment = value.alignment;
  if (Array.isArray(value.tabStops)) {
    result.tabStops = normalizeTabStops(value.tabStops);
  }
  result.ruleAbove = normalizeRule(value.ruleAbove);
  result.ruleBelow = normalizeRule(value.ruleBelow);
  result.border = normalizeBorder(value.border);
  result.shading = normalizeShading(value.shading);

  if (typeof value.hyphenation === 'boolean') result.hyphenation = value.hyphenation;
  result.hyphenationSettings = normalizeHyphenationSettings(value.hyphenationSettings);
  if (typeof value.keepTogether === 'boolean') result.keepTogether = value.keepTogether;
  if (typeof value.keepWithPrevious === 'boolean') result.keepWithPrevious = value.keepWithPrevious;
  if (typeof value.keepWithNext === 'boolean') result.keepWithNext = value.keepWithNext;
  if (finite(value.keepWithNextLines)) result.keepWithNextLines = integerAtLeast(value.keepWithNextLines, 0);
  if (finite(value.keepFirstLines)) result.keepFirstLines = integerAtLeast(value.keepFirstLines, 0);
  if (finite(value.keepLastLines)) result.keepLastLines = integerAtLeast(value.keepLastLines, 0);
  if (
    value.startParagraph === 'anywhere'
    || value.startParagraph === 'next-column'
    || value.startParagraph === 'next-frame'
    || value.startParagraph === 'next-page'
    || value.startParagraph === 'next-odd-page'
    || value.startParagraph === 'next-even-page'
  ) result.startParagraph = value.startParagraph;
  if (finite(value.widows)) result.widows = integerAtLeast(value.widows, 1);
  if (finite(value.orphans)) result.orphans = integerAtLeast(value.orphans, 1);
  result.justification = normalizeJustification(value.justification);
  result.spanColumns = normalizeSpanColumns(value.spanColumns);
  result.dropCaps = normalizeDropCaps(value.dropCaps);

  if (Array.isArray(value.nestedStyles)) {
    result.nestedStyles = value.nestedStyles
      .map(normalizeNestedStyle)
      .filter((item): item is PublicationNestedStyleRule => item !== null);
  }
  if (Array.isArray(value.nestedLineStyles)) {
    result.nestedLineStyles = value.nestedLineStyles
      .map(normalizeNestedLineStyle)
      .filter((item): item is PublicationNestedLineStyleRule => item !== null);
  }
  if (Array.isArray(value.grepStyles)) {
    result.grepStyles = value.grepStyles
      .map(normalizeGrepStyle)
      .filter((item): item is PublicationGrepStyleRule => item !== null);
  }

  result.bulletsAndNumbering = normalizeBulletsAndNumbering(value.bulletsAndNumbering);
  result.openType = normalizeOpenType(value.openType);
  result.underline = normalizeDecoration(value.underline);
  result.strikethrough = normalizeDecoration(value.strikethrough);
  result.exportTagging = normalizeExportTagging(value.exportTagging);

  return removeUndefinedObjects(result);
}

function normalizeTabStops(value: readonly PublicationParagraphTabStop[]): PublicationParagraphTabStop[] {
  return value
    .filter((stop) => finite(stop.positionMm) && Number(stop.positionMm) >= 0)
    .map((stop) => ({
      positionMm: Number(stop.positionMm),
      ...(stop.alignment === 'center' || stop.alignment === 'right' || stop.alignment === 'decimal'
        ? { alignment: stop.alignment }
        : { alignment: 'left' as const }),
      ...(cleanText(stop.leader) ? { leader: cleanText(stop.leader) } : {}),
      ...(cleanText(stop.decimalCharacter) ? { decimalCharacter: cleanText(stop.decimalCharacter) } : {}),
    }))
    .sort((left, right) => left.positionMm - right.positionMm);
}

function normalizeRule(value: PublicationParagraphRule | undefined): PublicationParagraphRule | undefined {
  if (!value) return undefined;
  const result: PublicationParagraphRule = {};
  if (typeof value.enabled === 'boolean') result.enabled = value.enabled;
  copyNumber(result, value, 'widthPt', 0);
  copyStrokeStyle(result, value);
  copyText(result, value, 'strokeName');
  copyText(result, value, 'color');
  copyNumber(result, value, 'tint', 0, 100);
  if (typeof value.overprint === 'boolean') result.overprint = value.overprint;
  copyText(result, value, 'gapColor');
  copyNumber(result, value, 'gapTint', 0, 100);
  if (typeof value.gapOverprint === 'boolean') result.gapOverprint = value.gapOverprint;
  if (value.widthMode === 'column' || value.widthMode === 'text') result.widthMode = value.widthMode;
  copyNumber(result, value, 'offsetPt');
  copyNumber(result, value, 'leftIndentMm');
  copyNumber(result, value, 'rightIndentMm');
  if (typeof value.keepInFrame === 'boolean') result.keepInFrame = value.keepInFrame;
  return Object.keys(result).length ? result : undefined;
}

function normalizeBorder(value: PublicationParagraphBorder | undefined): PublicationParagraphBorder | undefined {
  if (!value) return undefined;
  const result: PublicationParagraphBorder = {};
  if (typeof value.enabled === 'boolean') result.enabled = value.enabled;
  copyNumber(result, value, 'widthPt', 0);
  result.widths = normalizeEdgeWidths(value.widths);
  copyStrokeStyle(result, value);
  copyText(result, value, 'strokeName');
  copyText(result, value, 'color');
  copyNumber(result, value, 'tint', 0, 100);
  if (typeof value.overprint === 'boolean') result.overprint = value.overprint;
  copyText(result, value, 'gapColor');
  copyNumber(result, value, 'gapTint', 0, 100);
  if (typeof value.gapOverprint === 'boolean') result.gapOverprint = value.gapOverprint;
  if (value.cap === 'butt' || value.cap === 'round' || value.cap === 'projecting') result.cap = value.cap;
  if (value.join === 'miter' || value.join === 'round' || value.join === 'bevel') result.join = value.join;
  result.corners = normalizeCorners(value.corners);
  result.offsets = normalizeOffsets(value.offsets);
  if (isEdgeReference(value.topEdgeReference)) result.topEdgeReference = value.topEdgeReference;
  if (isEdgeReference(value.bottomEdgeReference)) result.bottomEdgeReference = value.bottomEdgeReference;
  if (value.widthMode === 'column' || value.widthMode === 'text') result.widthMode = value.widthMode;
  if (typeof value.displayAcrossFrames === 'boolean') result.displayAcrossFrames = value.displayAcrossFrames;
  if (typeof value.mergeConsecutive === 'boolean') result.mergeConsecutive = value.mergeConsecutive;
  return removeUndefinedRecord(result);
}

function normalizeShading(value: PublicationParagraphShading | undefined): PublicationParagraphShading | undefined {
  if (!value) return undefined;
  const result: PublicationParagraphShading = {};
  if (typeof value.enabled === 'boolean') result.enabled = value.enabled;
  copyText(result, value, 'color');
  copyNumber(result, value, 'tint', 0, 100);
  if (typeof value.overprint === 'boolean') result.overprint = value.overprint;
  result.corners = normalizeCorners(value.corners);
  result.offsets = normalizeOffsets(value.offsets);
  if (isEdgeReference(value.topEdgeReference)) result.topEdgeReference = value.topEdgeReference;
  if (isEdgeReference(value.bottomEdgeReference)) result.bottomEdgeReference = value.bottomEdgeReference;
  if (value.widthMode === 'column' || value.widthMode === 'text') result.widthMode = value.widthMode;
  if (typeof value.clipToFrame === 'boolean') result.clipToFrame = value.clipToFrame;
  if (typeof value.suppressInExport === 'boolean') result.suppressInExport = value.suppressInExport;
  return removeUndefinedRecord(result);
}

function normalizeHyphenationSettings(
  value: PublicationHyphenationSettings | undefined,
): PublicationHyphenationSettings | undefined {
  if (!value) return undefined;
  const result: PublicationHyphenationSettings = {};
  for (const key of ['minimumWordLength', 'minimumPrefix', 'minimumSuffix', 'maximumHyphens'] as const) {
    if (finite(value[key])) result[key] = integerAtLeast(value[key], 0);
  }
  copyNumber(result, value, 'hyphenationZoneMm', 0);
  for (const key of ['hyphenateCapitalizedWords', 'hyphenateLastWord', 'hyphenateAcrossColumns'] as const) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  copyNumber(result, value, 'preference', 0, 100);
  return Object.keys(result).length ? result : undefined;
}

function normalizeJustification(
  value: PublicationParagraphJustification | undefined,
): PublicationParagraphJustification | undefined {
  if (!value) return undefined;
  const result: PublicationParagraphJustification = {};
  for (const key of [
    'wordSpacingMinimum',
    'wordSpacingDesired',
    'wordSpacingMaximum',
    'letterSpacingMinimum',
    'letterSpacingDesired',
    'letterSpacingMaximum',
    'glyphScalingMinimum',
    'glyphScalingDesired',
    'glyphScalingMaximum',
  ] as const) copyNumber(result, value, key);
  if (
    value.singleWordAlignment === 'left'
    || value.singleWordAlignment === 'center'
    || value.singleWordAlignment === 'right'
    || value.singleWordAlignment === 'justify'
  ) result.singleWordAlignment = value.singleWordAlignment;
  copyNumber(result, value, 'autoLeadingPercent', 0, 1000);
  if (
    value.composer === 'adobe-paragraph'
    || value.composer === 'adobe-single-line'
    || value.composer === 'world-ready-paragraph'
    || value.composer === 'world-ready-single-line'
  ) result.composer = value.composer;
  return Object.keys(result).length ? result : undefined;
}

function normalizeSpanColumns(value: PublicationSpanColumns | undefined): PublicationSpanColumns | undefined {
  if (!value) return undefined;
  const result: PublicationSpanColumns = {};
  if (value.mode === 'span' || value.mode === 'split' || value.mode === 'single') result.mode = value.mode;
  if (finite(value.count)) result.count = Math.max(1, Math.min(16, Math.trunc(Number(value.count))));
  copyNumber(result, value, 'insideGutterMm', 0);
  copyNumber(result, value, 'outsideGutterMm', 0);
  return Object.keys(result).length ? result : undefined;
}

function normalizeDropCaps(value: PublicationDropCaps | undefined): PublicationDropCaps | undefined {
  if (!value) return undefined;
  const result: PublicationDropCaps = {};
  if (finite(value.lines)) result.lines = integerAtLeast(value.lines, 0);
  if (finite(value.characters)) result.characters = integerAtLeast(value.characters, 0);
  copyText(result, value, 'characterStyleId');
  if (typeof value.alignLeftEdge === 'boolean') result.alignLeftEdge = value.alignLeftEdge;
  if (typeof value.scaleForDescenders === 'boolean') result.scaleForDescenders = value.scaleForDescenders;
  return Object.keys(result).length ? result : undefined;
}

function normalizeNestedStyle(value: PublicationNestedStyleRule): PublicationNestedStyleRule | null {
  const id = cleanText(value?.id);
  const characterStyleId = cleanText(value?.characterStyleId);
  if (!id || !characterStyleId) return null;
  return {
    id,
    characterStyleId,
    ...(finite(value.repeat) ? { repeat: integerAtLeast(value.repeat, 1) } : {}),
    ...(typeof value.through === 'boolean' ? { through: value.through } : {}),
    ...(cleanText(value.delimiter) ? { delimiter: cleanText(value.delimiter) } : {}),
  };
}

function normalizeNestedLineStyle(
  value: PublicationNestedLineStyleRule,
): PublicationNestedLineStyleRule | null {
  const id = cleanText(value?.id);
  const characterStyleId = cleanText(value?.characterStyleId);
  if (!id || !characterStyleId || !finite(value?.lines)) return null;
  return {
    id,
    characterStyleId,
    lines: integerAtLeast(value.lines, 1),
  };
}

function normalizeGrepStyle(value: PublicationGrepStyleRule): PublicationGrepStyleRule | null {
  const id = cleanText(value?.id);
  const characterStyleId = cleanText(value?.characterStyleId);
  const expression = typeof value?.expression === 'string' ? value.expression : '';
  if (!id || !characterStyleId || !expression) return null;
  return { id, characterStyleId, expression };
}

function normalizeBulletsAndNumbering(
  value: PublicationBulletsAndNumbering | undefined,
): PublicationBulletsAndNumbering | undefined {
  if (!value) return undefined;
  const result: PublicationBulletsAndNumbering = {};
  if (value.type === 'bullets' || value.type === 'numbers' || value.type === 'none') result.type = value.type;
  for (const key of ['listName', 'format', 'bulletCharacter', 'numberExpression', 'characterStyleId'] as const) {
    copyText(result, value, key);
  }
  for (const key of ['level', 'startAt', 'restartAfterLevel'] as const) {
    if (finite(value[key])) result[key] = integerAtLeast(value[key], 0);
  }
  for (const key of ['leftIndentMm', 'firstLineIndentMm', 'tabPositionMm'] as const) {
    copyNumber(result, value, key);
  }
  if (
    value.alignment === 'left'
    || value.alignment === 'center'
    || value.alignment === 'right'
    || value.alignment === 'justify'
  ) result.alignment = value.alignment;
  return Object.keys(result).length ? result : undefined;
}

function normalizeOpenType(value: PublicationOpenTypeSettings | undefined): PublicationOpenTypeSettings | undefined {
  if (!value) return undefined;
  const result: PublicationOpenTypeSettings = {};
  for (const key of [
    'ligatures',
    'discretionaryLigatures',
    'contextualAlternates',
    'fractions',
    'ordinals',
    'slashedZero',
  ] as const) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  if (finite(value.stylisticSet)) result.stylisticSet = Math.max(0, Math.min(20, Math.trunc(Number(value.stylisticSet))));
  return Object.keys(result).length ? result : undefined;
}

function normalizeDecoration(value: PublicationTextDecoration | undefined): PublicationTextDecoration | undefined {
  if (!value) return undefined;
  const result: PublicationTextDecoration = {};
  if (typeof value.enabled === 'boolean') result.enabled = value.enabled;
  copyText(result, value, 'color');
  copyNumber(result, value, 'tint', 0, 100);
  copyNumber(result, value, 'weightPt', 0);
  copyNumber(result, value, 'offsetPt');
  return Object.keys(result).length ? result : undefined;
}

function normalizeExportTagging(value: PublicationExportTagging | undefined): PublicationExportTagging | undefined {
  if (!value) return undefined;
  const result: PublicationExportTagging = {};
  for (const key of ['htmlTag', 'epubTag', 'cssClass'] as const) copyText(result, value, key);
  if (typeof value.splitDocument === 'boolean') result.splitDocument = value.splitDocument;
  if (typeof value.emitTag === 'boolean') result.emitTag = value.emitTag;
  return Object.keys(result).length ? result : undefined;
}

function removeUndefinedObjects(
  value: PublicationParagraphStyleProperties,
): PublicationParagraphStyleProperties {
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) delete (value as Record<string, unknown>)[key];
  }
  return value;
}

function cloneProperties(
  value: PublicationParagraphStyleProperties,
): PublicationParagraphStyleProperties {
  return JSON.parse(JSON.stringify(value)) as PublicationParagraphStyleProperties;
}

function copyText<T extends object, K extends keyof T>(
  target: T,
  source: T,
  key: K,
): void {
  const normalized = cleanText(source[key]);
  if (normalized) target[key] = normalized as T[K];
}

function copyNumber<T extends object, K extends keyof T>(
  target: T,
  source: T,
  key: K,
  minimum?: number,
  maximum?: number,
): void {
  const raw = source[key];
  if (!finite(raw)) return;
  let numeric = Number(raw);
  if (minimum !== undefined) numeric = Math.max(minimum, numeric);
  if (maximum !== undefined) numeric = Math.min(maximum, numeric);
  target[key] = numeric as T[K];
}

function isDefinition(
  value: PublicationParagraphStyleDefinition | null,
): value is PublicationParagraphStyleDefinition {
  return value !== null;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finite(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function integerAtLeast(value: unknown, minimum: number): number {
  return Math.max(minimum, Math.trunc(Number(value)));
}
