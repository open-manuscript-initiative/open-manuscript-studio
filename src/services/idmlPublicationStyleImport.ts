import {
  mergePublicationParagraphStyleProperties,
  type PublicationBulletsAndNumbering,
  type PublicationCharacterStroke,
  type PublicationGrepStyleRule,
  type PublicationNestedLineStyleRule,
  type PublicationNestedStyleRule,
  type PublicationOpenTypeSettings,
  type PublicationParagraphAlignment,
  type PublicationParagraphBorder,
  type PublicationParagraphRule,
  type PublicationParagraphShading,
  type PublicationParagraphStyleDefinition,
  type PublicationParagraphStyleProperties,
  type PublicationParagraphTabStop,
  type PublicationTextDecoration,
} from '../model/publicationParagraphStyles';

const PT_TO_MM = 25.4 / 72;

export type IdmlPublicationStyleKey =
  | 'body'
  | 'articleTitlePrimary'
  | 'articleSubtitlePrimary'
  | 'heading1'
  | 'heading2'
  | 'footnote'
  | 'figureCaption'
  | 'tableCaption'
  | 'bibliography';

export type IdmlStylePatch = PublicationParagraphStyleProperties;

export interface IdmlPublicationStyleImportResult {
  sourceName: string;
  page?: {
    width?: number;
    height?: number;
    margins?: {
      top?: number;
      bottom?: number;
      inner?: number;
      outer?: number;
    };
  };
  /** Complete, local (non-flattened) InDesign paragraph-style graph. */
  paragraphStyles: PublicationParagraphStyleDefinition[];
  /** Convenience semantic mapping used by the legacy publication-style roles. */
  styles: Partial<Record<IdmlPublicationStyleKey, IdmlStylePatch>>;
  mappedStyles: Array<{
    source: string;
    sourceId: string;
    target: IdmlPublicationStyleKey;
  }>;
  unmappedStyles: string[];
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

interface RawParagraphStyle {
  id: string;
  name: string;
  basedOn?: string;
  nextStyle?: string;
  shortcut?: string;
  patch: IdmlStylePatch;
  preservedIdml?: Record<string, string | number | boolean>;
}

export async function importPublicationStyleFromIdml(
  file: File,
): Promise<IdmlPublicationStyleImportResult> {
  if (!file.name.toLowerCase().endsWith('.idml')) {
    throw new Error('The selected file is not an IDML package.');
  }
  const buffer = await file.arrayBuffer();
  const entries = readZipDirectory(buffer);
  const xmlEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.xml'));
  if (!xmlEntries.length) {
    throw new Error('The IDML package does not contain XML resources.');
  }

  const xmlByName = new Map<string, string>();
  for (const entry of xmlEntries) {
    if (!shouldReadEntry(entry.name)) continue;
    const bytes = await readZipEntry(buffer, entry);
    const xml = new TextDecoder().decode(bytes);
    assertSafeIdmlXml(xml);
    xmlByName.set(entry.name, xml);
  }

  const stylesXml = findXml(xmlByName, /(^|\/)Resources\/Styles\.xml$/i)
    ?? [...xmlByName.values()].find((xml) => xml.includes('<ParagraphStyle'));
  if (!stylesXml) {
    throw new Error('No InDesign paragraph styles were found in this IDML package.');
  }

  const rawStyles = parseParagraphStyles(stylesXml);
  const paragraphStyles = rawStyles
    .filter((style) => !isSystemStyle(style.name))
    .map((style) => ({
      id: style.id,
      name: style.name,
      basedOnId: style.basedOn ?? null,
      nextStyleId: style.nextStyle ?? null,
      shortcut: style.shortcut ?? null,
      properties: style.patch,
      preservedIdml: style.preservedIdml,
    }));

  const resolvedStyles = resolveBasedOnStyles(rawStyles);
  const mappedStyles: IdmlPublicationStyleImportResult['mappedStyles'] = [];
  const unmappedStyles: string[] = [];
  const styles: Partial<Record<IdmlPublicationStyleKey, IdmlStylePatch>> = {};

  for (const sourceStyle of resolvedStyles) {
    if (isSystemStyle(sourceStyle.name)) continue;
    const target = mapParagraphStyleName(sourceStyle.name);
    if (!target) {
      unmappedStyles.push(sourceStyle.name);
      continue;
    }
    if (!styles[target]) {
      styles[target] = sourceStyle.patch;
      mappedStyles.push({
        source: sourceStyle.name,
        sourceId: sourceStyle.id,
        target,
      });
    }
  }

  return {
    sourceName: file.name.replace(/\.idml$/i, ''),
    page: parsePageGeometry([...xmlByName.values()]),
    paragraphStyles,
    styles,
    mappedStyles,
    unmappedStyles: [...new Set(unmappedStyles)].sort((a, b) => a.localeCompare(b)),
  };
}

function shouldReadEntry(name: string): boolean {
  return /(^|\/)(Resources\/Styles\.xml|Resources\/Preferences\.xml|MasterSpreads\/.*\.xml|Spreads\/.*\.xml|designmap\.xml)$/i.test(name);
}

function findXml(
  xmlByName: Map<string, string>,
  pattern: RegExp,
): string | undefined {
  for (const [name, xml] of xmlByName) {
    if (pattern.test(name)) return xml;
  }
  return undefined;
}

function parseParagraphStyles(xml: string): RawParagraphStyle[] {
  const styles: RawParagraphStyle[] = [];
  const pattern = /<ParagraphStyle\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ParagraphStyle>)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const attributes = parseAttributes(match[1] ?? '');
    const body = match[2] ?? '';
    const rawSelf = attributes.Self ?? attributes.Name ?? 'Unnamed style';
    const id = normalizeReference(rawSelf) ?? rawSelf;
    const name = attributes.Name ?? id;
    const basedOn = normalizeReference(
      attributes.BasedOn
      ?? propertyText(body, 'BasedOn')
      ?? null,
    );
    const nextStyle = normalizeReference(
      attributes.NextStyle
      ?? propertyText(body, 'NextStyle')
      ?? null,
    );
    const shortcut = cleanScalar(attributes.Shortcut ?? propertyText(body, 'Shortcut'));
    const patch = parseParagraphStylePatch(attributes, body);

    const preservedIdml = Object.fromEntries(
      Object.entries(attributes)
        .filter(([key]) => !['Self', 'Name', 'BasedOn', 'NextStyle', 'Shortcut'].includes(key))
        .slice(0, 256),
    );

    styles.push({
      id,
      name,
      basedOn,
      nextStyle,
      shortcut: shortcut || undefined,
      patch,
      preservedIdml: Object.keys(preservedIdml).length ? preservedIdml : undefined,
    });
  }
  return styles;
}

function parseParagraphStylePatch(
  attributes: Record<string, string>,
  body: string,
): IdmlStylePatch {
  const patch: IdmlStylePatch = {};

  const fontFamily = propertyText(body, 'AppliedFont') || attributes.AppliedFont;
  if (fontFamily && !fontFamily.startsWith('$ID/')) patch.fontFamily = fontFamily;
  assignNumber(patch, 'fontSize', scalarNumber(attributes, body, 'PointSize'));
  const leading = scalarNumber(attributes, body, 'Leading');
  if (leading !== undefined && leading > 0) patch.lineHeight = round(leading);

  const fontStyle = cleanScalar(attributes.FontStyle || propertyText(body, 'FontStyle')).toLowerCase();
  if (fontStyle) {
    patch.fontStyle = /italic|oblique/.test(fontStyle) ? 'italic' : 'normal';
    if (/bold|black|heavy/.test(fontStyle)) patch.fontWeight = 700;
    else if (/semibold|demibold/.test(fontStyle)) patch.fontWeight = 600;
    else if (/medium/.test(fontStyle)) patch.fontWeight = 500;
    else if (/light/.test(fontStyle)) patch.fontWeight = 300;
  }

  assignNumber(patch, 'tracking', scalarNumber(attributes, body, 'Tracking'));
  assignNumber(patch, 'kerning', scalarNumber(attributes, body, 'KerningValue'));
  patch.kerningMode = mapKerningMode(
    scalarText(attributes, body, 'KerningMethod'),
  );
  patch.capitalization = mapCapitalization(
    scalarText(attributes, body, 'Capitalization'),
  );
  patch.position = mapCharacterPosition(
    scalarText(attributes, body, 'Position'),
  );
  assignBoolean(patch, 'noBreak', scalarBoolean(attributes, body, 'NoBreak'));
  assignNumber(patch, 'horizontalScale', scalarNumber(attributes, body, 'HorizontalScale'));
  assignNumber(patch, 'verticalScale', scalarNumber(attributes, body, 'VerticalScale'));
  assignNumber(patch, 'baselineShift', scalarNumber(attributes, body, 'BaselineShift'));
  assignNumber(patch, 'skew', scalarNumber(attributes, body, 'Skew'));

  const language = scalarText(attributes, body, 'AppliedLanguage');
  if (language && !language.startsWith('$ID/')) patch.language = language;
  const fillColor = scalarText(attributes, body, 'FillColor');
  if (fillColor) patch.fillColor = normalizeSwatchReference(fillColor);
  assignNumber(patch, 'fillTint', scalarNumber(attributes, body, 'FillTint'));
  assignBoolean(patch, 'fillOverprint', scalarBoolean(attributes, body, 'OverprintFill'));
  patch.characterStroke = parseCharacterStroke(attributes, body);

  const alignment = mapJustification(scalarText(attributes, body, 'Justification'));
  if (alignment) patch.alignment = alignment;
  assignPointAsMm(patch, 'firstLineIndent', scalarNumber(attributes, body, 'FirstLineIndent'));
  assignPointAsMm(patch, 'leftIndent', scalarNumber(attributes, body, 'LeftIndent'));
  assignPointAsMm(patch, 'rightIndent', scalarNumber(attributes, body, 'RightIndent'));
  assignPointAsMm(patch, 'lastLineIndent', scalarNumber(attributes, body, 'LastLineIndent'));
  assignNumber(patch, 'spaceBefore', scalarNumber(attributes, body, 'SpaceBefore'));
  assignNumber(patch, 'spaceAfter', scalarNumber(attributes, body, 'SpaceAfter'));
  assignPointAsMm(patch, 'spaceBetweenSameStyle', scalarNumber(attributes, body, 'SameParaStyleSpacing'));

  const balanced = scalarText(attributes, body, 'BalanceRaggedLines');
  if (balanced) patch.balanceRaggedLines = !/false|NoBalancing/i.test(balanced);
  const ignoreEdge = scalarBoolean(attributes, body, 'IgnoreEdgeAlignment');
  if (ignoreEdge !== undefined) patch.ignoreOpticalMargin = ignoreEdge;
  patch.baselineGridAlignment = mapGridAlignment(
    scalarText(attributes, body, 'GridAlignment'),
    scalarBoolean(attributes, body, 'GridAlignFirstLineOnly'),
  );
  const tabStops = parseTabStops(body);
  if (tabStops.length) patch.tabStops = tabStops;

  patch.ruleAbove = parseParagraphRule(attributes, body, 'Above');
  patch.ruleBelow = parseParagraphRule(attributes, body, 'Below');
  patch.border = parseParagraphBorder(attributes, body);
  patch.shading = parseParagraphShading(attributes, body);

  assignBoolean(patch, 'hyphenation', scalarBoolean(attributes, body, 'Hyphenation'));
  patch.hyphenationSettings = removeEmpty({
    minimumWordLength: scalarNumber(attributes, body, 'HyphenateWordsLongerThan'),
    minimumPrefix: scalarNumber(attributes, body, 'HyphenateAfterFirst'),
    minimumSuffix: scalarNumber(attributes, body, 'HyphenateBeforeLast'),
    maximumHyphens: scalarNumber(attributes, body, 'HyphenateLadderLimit'),
    hyphenationZoneMm: pointsToMm(scalarNumber(attributes, body, 'HyphenationZone')),
    hyphenateCapitalizedWords: scalarBoolean(attributes, body, 'HyphenateCapitalizedWords'),
    hyphenateLastWord: scalarBoolean(attributes, body, 'HyphenateLastWord'),
    hyphenateAcrossColumns: scalarBoolean(attributes, body, 'HyphenateAcrossColumns'),
    preference: scalarNumber(attributes, body, 'HyphenWeight'),
  });

  assignBoolean(patch, 'keepWithPrevious', scalarBoolean(attributes, body, 'KeepWithPrevious'));
  const keepWithNextLines = scalarNumber(attributes, body, 'KeepWithNext');
  if (keepWithNextLines !== undefined) {
    patch.keepWithNextLines = Math.max(0, Math.trunc(keepWithNextLines));
    patch.keepWithNext = keepWithNextLines > 0;
  }
  const keepAll = scalarBoolean(attributes, body, 'KeepAllLinesTogether');
  if (keepAll !== undefined) patch.keepTogether = keepAll;
  assignInteger(patch, 'keepFirstLines', scalarNumber(attributes, body, 'KeepFirstLines'));
  assignInteger(patch, 'keepLastLines', scalarNumber(attributes, body, 'KeepLastLines'));
  patch.startParagraph = mapParagraphStart(scalarText(attributes, body, 'StartParagraph'));

  patch.justification = removeEmpty({
    wordSpacingMinimum: scalarNumber(attributes, body, 'MinimumWordSpacing'),
    wordSpacingDesired: scalarNumber(attributes, body, 'DesiredWordSpacing'),
    wordSpacingMaximum: scalarNumber(attributes, body, 'MaximumWordSpacing'),
    letterSpacingMinimum: scalarNumber(attributes, body, 'MinimumLetterSpacing'),
    letterSpacingDesired: scalarNumber(attributes, body, 'DesiredLetterSpacing'),
    letterSpacingMaximum: scalarNumber(attributes, body, 'MaximumLetterSpacing'),
    glyphScalingMinimum: scalarNumber(attributes, body, 'MinimumGlyphScaling'),
    glyphScalingDesired: scalarNumber(attributes, body, 'DesiredGlyphScaling'),
    glyphScalingMaximum: scalarNumber(attributes, body, 'MaximumGlyphScaling'),
    singleWordAlignment: mapJustification(
      scalarText(attributes, body, 'SingleWordJustification'),
    ),
    autoLeadingPercent: scalarNumber(attributes, body, 'AutoLeading'),
    composer: mapComposer(scalarText(attributes, body, 'Composer')),
  });

  patch.spanColumns = removeEmpty({
    mode: mapSpanColumnMode(scalarText(attributes, body, 'SpanColumnType')),
    count: scalarCount(attributes, body, 'SpanSplitColumnCount'),
    insideGutterMm: pointsToMm(
      scalarNumber(attributes, body, 'SplitColumnsInsideGutter')
      ?? scalarNumber(attributes, body, 'SplitColumnInsideGutter'),
    ),
    outsideGutterMm: pointsToMm(
      scalarNumber(attributes, body, 'SplitColumnsOutsideGutter')
      ?? scalarNumber(attributes, body, 'SplitColumnOutsideGutter'),
    ),
  });

  patch.dropCaps = removeEmpty({
    lines: scalarNumber(attributes, body, 'DropCapLines'),
    characters: scalarNumber(attributes, body, 'DropCapCharacters'),
    characterStyleId: normalizeCharacterStyleReference(
      scalarText(attributes, body, 'DropCapStyle'),
    ),
    alignLeftEdge: scalarBoolean(attributes, body, 'DropcapDetail') === true
      ? true
      : undefined,
  });

  const nestedStyles = parseNestedStyles(body);
  if (nestedStyles.length) patch.nestedStyles = nestedStyles;
  const nestedLineStyles = parseNestedLineStyles(body);
  if (nestedLineStyles.length) patch.nestedLineStyles = nestedLineStyles;
  const grepStyles = parseGrepStyles(body);
  if (grepStyles.length) patch.grepStyles = grepStyles;

  patch.bulletsAndNumbering = parseBulletsAndNumbering(attributes, body);
  patch.openType = parseOpenType(attributes, body);
  patch.underline = parseDecoration(attributes, body, 'Underline');
  patch.strikethrough = parseDecoration(attributes, body, 'StrikeThrough');

  patch.exportTagging = removeEmpty({
    applyHtmlClass: scalarBoolean(attributes, body, 'IncludeClass'),
    emitCss: scalarBoolean(attributes, body, 'EmitCss'),
    splitDocument: scalarBoolean(attributes, body, 'SplitDocument'),
  });

  return removeEmpty(patch) ?? {};
}

function parseCharacterStroke(
  attributes: Record<string, string>,
  body: string,
): PublicationCharacterStroke | undefined {
  return removeEmpty({
    widthPt: scalarNumber(attributes, body, 'StrokeWeight'),
    color: normalizeSwatchReference(scalarText(attributes, body, 'StrokeColor')),
    tint: scalarNumber(attributes, body, 'StrokeTint'),
    overprint: scalarBoolean(attributes, body, 'OverprintStroke'),
    miterLimit: scalarNumber(attributes, body, 'MiterLimit'),
    alignment: mapStrokeAlignment(scalarText(attributes, body, 'StrokeAlignment')),
  });
}

function parseParagraphRule(
  attributes: Record<string, string>,
  body: string,
  side: 'Above' | 'Below',
): PublicationParagraphRule | undefined {
  const prefix = `Rule${side}`;
  return removeEmpty({
    enabled: scalarBoolean(attributes, body, prefix),
    widthPt: scalarNumber(attributes, body, `${prefix}LineWeight`),
    style: mapStrokeStyle(scalarText(attributes, body, `${prefix}Type`)),
    strokeName: cleanStrokeName(scalarText(attributes, body, `${prefix}Type`)),
    color: normalizeSwatchReference(scalarText(attributes, body, `${prefix}Color`)),
    tint: scalarNumber(attributes, body, `${prefix}Tint`),
    overprint: scalarBoolean(attributes, body, `${prefix}Overprint`),
    gapColor: normalizeSwatchReference(scalarText(attributes, body, `${prefix}GapColor`)),
    gapTint: scalarNumber(attributes, body, `${prefix}GapTint`),
    gapOverprint: scalarBoolean(attributes, body, `${prefix}GapOverprint`),
    widthMode: mapWidthMode(scalarText(attributes, body, `${prefix}Width`)),
    offsetPt: scalarNumber(attributes, body, `${prefix}Offset`),
    leftIndentMm: pointsToMm(scalarNumber(attributes, body, `${prefix}LeftIndent`)),
    rightIndentMm: pointsToMm(scalarNumber(attributes, body, `${prefix}RightIndent`)),
    keepInFrame: side === 'Above'
      ? scalarBoolean(attributes, body, 'KeepRuleAboveInFrame')
      : undefined,
  });
}

function parseParagraphBorder(
  attributes: Record<string, string>,
  body: string,
): PublicationParagraphBorder | undefined {
  return removeEmpty({
    enabled: scalarBoolean(attributes, body, 'ParagraphBorderOn'),
    widths: removeEmpty({
      topPt: scalarNumber(attributes, body, 'ParagraphBorderTopLineWeight'),
      rightPt: scalarNumber(attributes, body, 'ParagraphBorderRightLineWeight'),
      bottomPt: scalarNumber(attributes, body, 'ParagraphBorderBottomLineWeight'),
      leftPt: scalarNumber(attributes, body, 'ParagraphBorderLeftLineWeight'),
    }),
    style: mapStrokeStyle(scalarText(attributes, body, 'ParagraphBorderType')),
    strokeName: cleanStrokeName(scalarText(attributes, body, 'ParagraphBorderType')),
    color: normalizeSwatchReference(scalarText(attributes, body, 'ParagraphBorderColor')),
    tint: scalarNumber(attributes, body, 'ParagraphBorderTint'),
    overprint: scalarBoolean(attributes, body, 'ParagraphBorderOverprint'),
    gapColor: normalizeSwatchReference(scalarText(attributes, body, 'ParagraphBorderGapColor')),
    gapTint: scalarNumber(attributes, body, 'ParagraphBorderGapTint'),
    gapOverprint: scalarBoolean(attributes, body, 'ParagraphBorderGapOverprint'),
    cap: mapStrokeCap(scalarText(attributes, body, 'ParagraphBorderStrokeEndCap')),
    join: mapStrokeJoin(scalarText(attributes, body, 'ParagraphBorderStrokeEndJoin')),
    corners: parseCorners(attributes, body, 'ParagraphBorder'),
    offsets: removeEmpty({
      topMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphBorderTopOffset')),
      rightMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphBorderRightOffset')),
      bottomMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphBorderBottomOffset')),
      leftMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphBorderLeftOffset')),
    }),
    topEdgeReference: mapEdgeReference(scalarText(attributes, body, 'ParagraphBorderTopOrigin')),
    bottomEdgeReference: mapEdgeReference(scalarText(attributes, body, 'ParagraphBorderBottomOrigin')),
    widthMode: mapWidthMode(scalarText(attributes, body, 'ParagraphBorderWidth')),
    displayAcrossFrames: scalarBoolean(attributes, body, 'ParagraphBorderDisplayIfSplits'),
    mergeConsecutive: scalarBoolean(attributes, body, 'MergeConsecutiveParaBorders'),
  });
}

function parseParagraphShading(
  attributes: Record<string, string>,
  body: string,
): PublicationParagraphShading | undefined {
  return removeEmpty({
    enabled: scalarBoolean(attributes, body, 'ParagraphShadingOn'),
    color: normalizeSwatchReference(scalarText(attributes, body, 'ParagraphShadingColor')),
    tint: scalarNumber(attributes, body, 'ParagraphShadingTint'),
    overprint: scalarBoolean(attributes, body, 'ParagraphShadingOverprint'),
    corners: parseCorners(attributes, body, 'ParagraphShading'),
    offsets: removeEmpty({
      topMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphShadingTopOffset')),
      rightMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphShadingRightOffset')),
      bottomMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphShadingBottomOffset')),
      leftMm: pointsToMm(scalarNumber(attributes, body, 'ParagraphShadingLeftOffset')),
    }),
    topEdgeReference: mapEdgeReference(scalarText(attributes, body, 'ParagraphShadingTopOrigin')),
    bottomEdgeReference: mapEdgeReference(scalarText(attributes, body, 'ParagraphShadingBottomOrigin')),
    widthMode: mapWidthMode(scalarText(attributes, body, 'ParagraphShadingWidth')),
    clipToFrame: scalarBoolean(attributes, body, 'ParagraphShadingClipToFrame'),
    suppressInExport: scalarBoolean(attributes, body, 'ParagraphShadingSuppressPrinting'),
  });
}

function parseCorners(
  attributes: Record<string, string>,
  body: string,
  prefix: 'ParagraphBorder' | 'ParagraphShading',
) {
  const corners = {
    topLeft: parseCorner(attributes, body, `${prefix}TopLeft`),
    topRight: parseCorner(attributes, body, `${prefix}TopRight`),
    bottomRight: parseCorner(attributes, body, `${prefix}BottomRight`),
    bottomLeft: parseCorner(attributes, body, `${prefix}BottomLeft`),
  };
  return removeEmpty(corners);
}

function parseCorner(
  attributes: Record<string, string>,
  body: string,
  prefix: string,
) {
  return removeEmpty({
    radiusMm: pointsToMm(scalarNumber(attributes, body, `${prefix}CornerRadius`)),
    shape: mapCornerShape(scalarText(attributes, body, `${prefix}CornerOption`)),
  });
}

function parseBulletsAndNumbering(
  attributes: Record<string, string>,
  body: string,
): PublicationBulletsAndNumbering | undefined {
  const rawType = scalarText(attributes, body, 'BulletsAndNumberingListType');
  const type = /bullet/i.test(rawType)
    ? 'bullets'
    : /number/i.test(rawType)
      ? 'numbers'
      : rawType
        ? 'none'
        : undefined;
  const isNumbered = type === 'numbers';
  const characterStyle = normalizeCharacterStyleReference(
    scalarText(
      attributes,
      body,
      isNumbered ? 'NumberingCharacterStyle' : 'BulletsCharacterStyle',
    ),
  );
  return removeEmpty({
    type,
    listName: normalizeObjectReference(scalarText(attributes, body, 'AppliedNumberingList')),
    level: scalarNumber(attributes, body, 'NumberingLevel'),
    format: scalarText(attributes, body, 'NumberingFormat'),
    bulletCharacter: scalarText(attributes, body, 'BulletChar'),
    numberExpression: isNumbered
      ? scalarText(attributes, body, 'NumberingExpression')
      : scalarText(attributes, body, 'BulletsTextAfter'),
    startAt: scalarNumber(attributes, body, 'NumberingStartAt'),
    leftIndentMm: pointsToMm(scalarNumber(attributes, body, 'LeftIndent')),
    firstLineIndentMm: pointsToMm(scalarNumber(attributes, body, 'FirstLineIndent')),
    tabPositionMm: parseTabStops(body)[0]?.positionMm,
    characterStyleId: characterStyle,
    alignment: mapJustification(
      scalarText(attributes, body, isNumbered ? 'NumberingAlignment' : 'BulletsAlignment'),
    ),
  });
}

function parseOpenType(
  attributes: Record<string, string>,
  body: string,
): PublicationOpenTypeSettings | undefined {
  const stylisticMask = scalarNumber(attributes, body, 'OtfStylisticSets');
  return removeEmpty({
    ligatures: scalarBoolean(attributes, body, 'Ligatures'),
    titlingAlternates: scalarBoolean(attributes, body, 'OtfTitling'),
    swash: scalarBoolean(attributes, body, 'OtfSwash'),
    discretionaryLigatures: scalarBoolean(attributes, body, 'OtfDiscretionaryLigature'),
    contextualAlternates: scalarBoolean(attributes, body, 'OtfContextualAlternate'),
    fractions: scalarBoolean(attributes, body, 'OtfFraction'),
    ordinals: scalarBoolean(attributes, body, 'OtfOrdinal'),
    slashedZero: scalarBoolean(attributes, body, 'OtfSlashedZero'),
    figureStyle: mapFigureStyle(scalarText(attributes, body, 'OtfFigureStyle')),
    positionalForm: mapPositionalForm(scalarText(attributes, body, 'PositionalForm')),
    stylisticSets: stylisticMask !== undefined
      ? stylisticSetsFromBitmask(Math.trunc(stylisticMask))
      : undefined,
  });
}

function parseDecoration(
  attributes: Record<string, string>,
  body: string,
  prefix: 'Underline' | 'StrikeThrough',
): PublicationTextDecoration | undefined {
  const enabledName = prefix === 'Underline' ? 'Underline' : 'StrikeThru';
  return removeEmpty({
    enabled: scalarBoolean(attributes, body, enabledName),
    weightPt: scalarNumber(attributes, body, `${prefix}Weight`),
    offsetPt: scalarNumber(attributes, body, `${prefix}Offset`),
    style: mapStrokeStyle(scalarText(attributes, body, `${prefix}Type`)),
    strokeName: cleanStrokeName(scalarText(attributes, body, `${prefix}Type`)),
    color: normalizeSwatchReference(scalarText(attributes, body, `${prefix}Color`)),
    tint: scalarNumber(attributes, body, `${prefix}Tint`),
    overprint: scalarBoolean(attributes, body, `${prefix}Overprint`),
    gapColor: normalizeSwatchReference(scalarText(attributes, body, `${prefix}GapColor`)),
    gapTint: scalarNumber(attributes, body, `${prefix}GapTint`),
    gapOverprint: scalarBoolean(attributes, body, `${prefix}GapOverprint`),
  });
}

function parseTabStops(body: string): PublicationParagraphTabStop[] {
  const list = elementBody(body, 'TabList');
  if (!list) return [];
  const stops: PublicationParagraphTabStop[] = [];
  for (const item of listItems(list)) {
    const tabStopTag = item.match(/<TabStop\b([^>]*?)(?:\/>|>[\s\S]*?<\/TabStop>)/i);
    const attrs = tabStopTag ? parseAttributes(tabStopTag[1] ?? '') : {};
    const position = attributeNumber(attrs.Position) ?? elementNumber(item, 'Position');
    if (position === undefined) continue;
    const alignmentValue = attrs.Alignment ?? propertyText(item, 'Alignment');
    const alignment = mapTabAlignment(alignmentValue);
    const leader = attrs.Leader ?? propertyText(item, 'Leader');
    const decimalCharacter = attrs.AlignmentCharacter ?? propertyText(item, 'AlignmentCharacter');
    stops.push({
      positionMm: round(position * PT_TO_MM),
      ...(alignment ? { alignment } : {}),
      ...(leader ? { leader } : {}),
      ...(decimalCharacter ? { decimalCharacter } : {}),
    });
  }
  return stops.sort((a, b) => a.positionMm - b.positionMm);
}

function parseNestedStyles(body: string): PublicationNestedStyleRule[] {
  const list = elementBody(body, 'AllNestedStyles');
  if (!list) return [];
  return listItems(list).flatMap((item, index) => {
    const characterStyleId = normalizeCharacterStyleReference(
      propertyText(item, 'AppliedCharacterStyle'),
    );
    const delimiter = propertyText(item, 'Delimiter');
    const repetition = elementNumber(item, 'Repetition');
    if (!characterStyleId || !delimiter) return [];
    return [{
      id: `nested-${index + 1}`,
      characterStyleId,
      delimiter,
      repeat: repetition === undefined ? 1 : Math.max(1, Math.trunc(repetition)),
      through: elementBoolean(item, 'Inclusive') ?? false,
    }];
  });
}

function parseNestedLineStyles(body: string): PublicationNestedLineStyleRule[] {
  const list = elementBody(body, 'AllLineStyles');
  if (!list) return [];
  return listItems(list).flatMap((item, index) => {
    const characterStyleId = normalizeCharacterStyleReference(
      propertyText(item, 'AppliedCharacterStyle'),
    );
    const lineCount = elementNumber(item, 'LineCount');
    if (!characterStyleId || lineCount === undefined) return [];
    return [{
      id: `line-${index + 1}`,
      characterStyleId,
      lines: Math.max(1, Math.trunc(lineCount)),
    }];
  });
}

function parseGrepStyles(body: string): PublicationGrepStyleRule[] {
  const list = elementBody(body, 'AllGREPStyles');
  if (!list) return [];
  return listItems(list).flatMap((item, index) => {
    const characterStyleId = normalizeCharacterStyleReference(
      propertyText(item, 'AppliedCharacterStyle'),
    );
    const expression = propertyText(item, 'GrepExpression');
    if (!characterStyleId || !expression) return [];
    return [{
      id: `grep-${index + 1}`,
      characterStyleId,
      expression,
    }];
  });
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    attributes[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '');
  }
  return attributes;
}

function scalarText(
  attributes: Record<string, string>,
  body: string,
  name: string,
): string {
  return cleanScalar(attributes[name] ?? propertyText(body, name));
}

function scalarNumber(
  attributes: Record<string, string>,
  body: string,
  name: string,
): number | undefined {
  return attributeNumber(attributes[name]) ?? elementNumber(body, name);
}

function scalarCount(
  attributes: Record<string, string>,
  body: string,
  name: string,
): number | undefined {
  const value = scalarText(attributes, body, name);
  if (!value || /all/i.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.trunc(number)) : undefined;
}

function scalarBoolean(
  attributes: Record<string, string>,
  body: string,
  name: string,
): boolean | undefined {
  return booleanValue(attributes[name]) ?? elementBoolean(body, name);
}

function elementBody(source: string, name: string): string {
  const escaped = escapeRegExp(name);
  const match = source.match(
    new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'),
  );
  return match?.[1] ?? '';
}

function listItems(source: string): string[] {
  return [...source.matchAll(/<ListItem\b[^>]*>([\s\S]*?)<\/ListItem>/gi)]
    .map((match) => match[1] ?? '');
}

function propertyText(body: string, propertyName: string): string {
  const escaped = escapeRegExp(propertyName);
  const match = body.match(
    new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'),
  );
  if (!match) return '';
  const value = match[1] ?? '';
  if (value.includes('<') || value.includes('>')) return '';
  return decodeXmlEntities(value).trim();
}

function elementNumber(source: string, name: string): number | undefined {
  return attributeNumber(propertyText(source, name));
}

function elementBoolean(source: string, name: string): boolean | undefined {
  return booleanValue(propertyText(source, name));
}

function booleanValue(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (/^(true|1)$/i.test(value)) return true;
  if (/^(false|0)$/i.test(value)) return false;
  return undefined;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveBasedOnStyles(styles: RawParagraphStyle[]): RawParagraphStyle[] {
  const byId = new Map(styles.map((style) => [style.id, style]));
  const memo = new Map<string, IdmlStylePatch>();

  function resolve(
    style: RawParagraphStyle,
    stack = new Set<string>(),
  ): IdmlStylePatch {
    if (memo.has(style.id)) return memo.get(style.id)!;
    if (stack.has(style.id)) return style.patch;

    const nextStack = new Set(stack);
    nextStack.add(style.id);
    const parent = style.basedOn ? byId.get(style.basedOn) : undefined;
    const patch = parent
      ? mergePublicationParagraphStyleProperties(
          resolve(parent, nextStack),
          style.patch,
        )
      : style.patch;
    memo.set(style.id, patch);
    return patch;
  }

  return styles.map((style) => ({ ...style, patch: resolve(style) }));
}

function parsePageGeometry(
  xmlDocuments: string[],
): IdmlPublicationStyleImportResult['page'] | undefined {
  let width: number | undefined;
  let height: number | undefined;
  const margins: NonNullable<
    NonNullable<IdmlPublicationStyleImportResult['page']>['margins']
  > = {};

  for (const xml of xmlDocuments) {
    if (width === undefined) width = firstAttributeNumber(xml, 'PageWidth');
    if (height === undefined) height = firstAttributeNumber(xml, 'PageHeight');
    if (margins.top === undefined) margins.top = pointsToMm(firstAttributeNumber(xml, 'Top'));
    if (margins.bottom === undefined) margins.bottom = pointsToMm(firstAttributeNumber(xml, 'Bottom'));
    if (margins.inner === undefined) margins.inner = pointsToMm(firstAttributeNumber(xml, 'Left'));
    if (margins.outer === undefined) margins.outer = pointsToMm(firstAttributeNumber(xml, 'Right'));
  }

  const pageWidth = pointsToMm(width);
  const pageHeight = pointsToMm(height);
  if (
    pageWidth === undefined
    && pageHeight === undefined
    && !Object.keys(margins).length
  ) return undefined;
  return { width: pageWidth, height: pageHeight, margins };
}

function mapParagraphStyleName(name: string): IdmlPublicationStyleKey | undefined {
  const normalized = normalizeStyleName(name);
  const rules: Array<[RegExp, IdmlPublicationStyleKey]> = [
    [/^(body|body text|text|normal|törzsszöveg|grundtext|fließtext)$/, 'body'],
    [/(article|manuscript|paper)? ?(title|cím|titel)( 1| primary| main)?$/, 'articleTitlePrimary'],
    [/(subtitle|alcím|untertitel)/, 'articleSubtitlePrimary'],
    [/(heading|headline|címsor|überschrift|fejezet|chapter).*\b1\b|^(h1|heading 1|címsor 1|überschrift 1)$/, 'heading1'],
    [/(heading|headline|címsor|überschrift|fejezet|chapter).*\b2\b|^(h2|heading 2|címsor 2|überschrift 2)$/, 'heading2'],
    [/(footnote|lábjegyzet|fußnote)/, 'footnote'],
    [/(figure|image|ábra|kép|abbildung).*(caption|felirat|legende)|^(caption figure|figure caption)$/, 'figureCaption'],
    [/(table|táblázat|tabelle).*(caption|felirat|legende)|^(caption table|table caption)$/, 'tableCaption'],
    [/(bibliograph|reference|irodalom|hivatkoz|literatur)/, 'bibliography'],
  ];
  return rules.find(([pattern]) => pattern.test(normalized))?.[1];
}

function normalizeStyleName(name: string): string {
  return name
    .replace(/^\$ID\//, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_/.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isSystemStyle(name: string): boolean {
  return /^\[.*\]$/.test(name)
    || name.startsWith('$ID/')
    || /\[No paragraph style\]/i.test(name);
}

function mapJustification(value: string | null | undefined): PublicationParagraphAlignment | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes('center')) return 'center';
  if (normalized.includes('right')) return 'right';
  if (normalized.includes('justify')) return 'justify';
  if (normalized.includes('left')) return 'left';
  return undefined;
}

function mapKerningMode(value: string): IdmlStylePatch['kerningMode'] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (/optical|optik/.test(normalized)) return 'optical';
  if (/metric|metrik/.test(normalized)) return 'metrics';
  return 'manual';
}

function mapCapitalization(value: string): IdmlStylePatch['capitalization'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('small')) return 'small-caps';
  if (normalized.includes('all') && normalized.includes('cap')) return 'all-caps';
  if (normalized.includes('normal')) return 'normal';
  return undefined;
}

function mapCharacterPosition(value: string): IdmlStylePatch['position'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('superscript')) return 'superscript';
  if (normalized.includes('subscript')) return 'subscript';
  if (normalized.includes('superior')) return 'superior';
  if (normalized.includes('inferior')) return 'inferior';
  if (normalized.includes('normal')) return 'normal';
  return undefined;
}

function mapGridAlignment(
  value: string,
  firstLineOnly: boolean | undefined,
): IdmlStylePatch['baselineGridAlignment'] | undefined {
  if (!value || /none/i.test(value)) return 'none';
  return firstLineOnly ? 'first-line' : 'all-lines';
}

function mapParagraphStart(value: string): IdmlStylePatch['startParagraph'] | undefined {
  const normalized = value.toLowerCase();
  if (!normalized || normalized.includes('anywhere')) return normalized ? 'anywhere' : undefined;
  if (normalized.includes('odd')) return 'next-odd-page';
  if (normalized.includes('even')) return 'next-even-page';
  if (normalized.includes('page')) return 'next-page';
  if (normalized.includes('frame')) return 'next-frame';
  if (normalized.includes('column')) return 'next-column';
  return undefined;
}

function mapComposer(value: string): NonNullable<IdmlStylePatch['justification']>['composer'] | undefined {
  const normalized = value.toLowerCase();
  if (!normalized) return undefined;
  if (/world.*single|single.*world/.test(normalized)) return 'world-ready-single-line';
  if (/world/.test(normalized)) return 'world-ready-paragraph';
  if (/single/.test(normalized)) return 'adobe-single-line';
  return 'adobe-paragraph';
}

function mapSpanColumnMode(value: string): NonNullable<IdmlStylePatch['spanColumns']>['mode'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('split')) return 'split';
  if (normalized.includes('span')) return 'span';
  if (normalized.includes('single')) return 'single';
  return undefined;
}

function mapTabAlignment(value: string): PublicationParagraphTabStop['alignment'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('right')) return 'right';
  if (normalized.includes('center')) return 'center';
  if (normalized.includes('character') || normalized.includes('decimal')) return 'decimal';
  if (normalized.includes('left')) return 'left';
  return undefined;
}

function mapWidthMode(value: string): PublicationParagraphRule['widthMode'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('text')) return 'text';
  if (normalized.includes('column')) return 'column';
  return undefined;
}

function mapStrokeStyle(value: string): PublicationParagraphRule['style'] | undefined {
  const normalized = value.toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('double')) return 'double';
  if (normalized.includes('dash')) return 'dashed';
  if (normalized.includes('dot')) return 'dotted';
  if (normalized.includes('solid')) return 'solid';
  return undefined;
}

function cleanStrokeName(value: string): string | undefined {
  if (!value) return undefined;
  return normalizeObjectReference(value);
}

function mapStrokeCap(value: string): PublicationParagraphBorder['cap'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('round')) return 'round';
  if (normalized.includes('project')) return 'projecting';
  if (normalized.includes('butt')) return 'butt';
  return undefined;
}

function mapStrokeJoin(value: string): PublicationParagraphBorder['join'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('round')) return 'round';
  if (normalized.includes('bevel')) return 'bevel';
  if (normalized.includes('miter')) return 'miter';
  return undefined;
}

function mapStrokeAlignment(value: string): PublicationCharacterStroke['alignment'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('inside')) return 'inside';
  if (normalized.includes('outside')) return 'outside';
  if (normalized.includes('center')) return 'center';
  return undefined;
}

function mapEdgeReference(value: string): PublicationParagraphBorder['topEdgeReference'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('cap')) return 'cap-height';
  if (normalized.includes('xheight') || normalized.includes('x-height')) return 'x-height';
  if (normalized.includes('baseline')) return 'baseline';
  if (normalized.includes('leading')) return 'leading';
  if (normalized.includes('ascent')) return 'ascent';
  if (normalized.includes('descent')) return 'descent';
  if (normalized.includes('text')) return 'text';
  if (normalized.includes('paragraph')) return 'paragraph';
  return undefined;
}

function mapCornerShape(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('inverse') && normalized.includes('round')) return 'inverse-rounded' as const;
  if (normalized.includes('round')) return 'rounded' as const;
  if (normalized.includes('bevel')) return 'bevel' as const;
  if (normalized.includes('inset')) return 'inset' as const;
  if (normalized.includes('square') || normalized.includes('none')) return 'square' as const;
  return undefined;
}

function mapFigureStyle(value: string): PublicationOpenTypeSettings['figureStyle'] | undefined {
  const normalized = value.toLowerCase();
  if (!normalized || normalized.includes('default')) return normalized ? 'default' : undefined;
  const oldstyle = normalized.includes('old');
  const tabular = normalized.includes('tab');
  if (oldstyle && tabular) return 'oldstyle-tabular';
  if (oldstyle) return 'oldstyle-proportional';
  if (tabular) return 'lining-tabular';
  return 'lining-proportional';
}

function mapPositionalForm(value: string): PublicationOpenTypeSettings['positionalForm'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes('initial')) return 'initial';
  if (normalized.includes('medial')) return 'medial';
  if (normalized.includes('final')) return 'final';
  if (normalized.includes('isolated')) return 'isolated';
  if (normalized.includes('general') || normalized.includes('none')) return 'general';
  return undefined;
}

function stylisticSetsFromBitmask(mask: number): number[] {
  const sets: number[] = [];
  for (let bit = 0; bit < 20; bit += 1) {
    if ((mask & (1 << bit)) !== 0) sets.push(bit + 1);
  }
  return sets;
}

function normalizeSwatchReference(value: string): string | undefined {
  if (!value) return undefined;
  return normalizeObjectReference(value)
    .replace(/^Color\//, '')
    .replace(/^Swatch\//, '');
}

function normalizeObjectReference(value: string): string {
  return value
    .replace(/^ParagraphStyle[\\/]/, '')
    .replace(/^CharacterStyle[\\/]/, '')
    .replace(/^NumberingList[\\/]/, '');
}

function normalizeCharacterStyleReference(value: string): string | undefined {
  const normalized = normalizeObjectReference(value);
  if (!normalized || normalized === 'n' || /\[None\]|\[No character style\]/i.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function assertSafeIdmlXml(xml: string): void {
  const trimmed = xml.trimStart();
  if (!trimmed.startsWith('<')) {
    throw new Error('An IDML XML resource is not valid XML.');
  }
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error('An IDML XML resource contains an unsupported DOCTYPE declaration.');
  }
  if (/<!ENTITY/i.test(xml)) {
    throw new Error('An IDML XML resource contains an unsupported entity declaration.');
  }
  if (/<\?xml-stylesheet/i.test(xml)) {
    throw new Error('An IDML XML resource contains an unsupported processing instruction.');
  }
  if (/<script\b/i.test(xml)) {
    throw new Error('An IDML XML resource contains unsupported executable markup.');
  }
}

function normalizeReference(value: string | null): string | undefined {
  if (!value || value === 'n' || value === 'NothingEnum.NOTHING') return undefined;
  return normalizeObjectReference(value);
}

function attributeNumber(value: string | undefined): number | undefined {
  if (!value || value === 'Auto' || value.startsWith('$ID/')) return undefined;
  const parsed = Number(value.replace(/\s*(pt|px|mm)$/i, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstAttributeNumber(xml: string, name: string): number | undefined {
  const match = xml.match(new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`, 'i'));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function pointsToMm(value: number | undefined): number | undefined {
  return value === undefined ? undefined : round(value * PT_TO_MM);
}

function assignPointAsMm<K extends keyof IdmlStylePatch>(
  target: IdmlStylePatch,
  key: K,
  value: number | undefined,
): void {
  const mm = pointsToMm(value);
  if (mm !== undefined) {
    (target as Record<string, unknown>)[key as string] = mm;
  }
}

function assignNumber<K extends keyof IdmlStylePatch>(
  target: IdmlStylePatch,
  key: K,
  value: number | undefined,
): void {
  if (value !== undefined) {
    (target as Record<string, unknown>)[key as string] = round(value);
  }
}

function assignInteger<K extends keyof IdmlStylePatch>(
  target: IdmlStylePatch,
  key: K,
  value: number | undefined,
): void {
  if (value !== undefined) {
    (target as Record<string, unknown>)[key as string] = Math.max(0, Math.trunc(value));
  }
}

function assignBoolean<K extends keyof IdmlStylePatch>(
  target: IdmlStylePatch,
  key: K,
  value: boolean | undefined,
): void {
  if (value !== undefined) {
    (target as Record<string, unknown>)[key as string] = value;
  }
}

function removeEmpty<T extends object>(value: T): T | undefined {
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === '') {
      delete (value as Record<string, unknown>)[key];
    }
  }
  return Object.keys(value).length ? value : undefined;
}

function cleanScalar(value: string | undefined): string {
  return (value ?? '').trim();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function readZipDirectory(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer); const view = new DataView(buffer); const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error('The selected IDML package is not a valid ZIP archive.');
  const entryCount = view.getUint16(eocdOffset + 10, true); let offset = view.getUint32(eocdOffset + 16, true); const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('The IDML ZIP directory is malformed.');
    const compressionMethod = view.getUint16(offset + 10, true); const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true); const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset }); offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function findEndOfCentralDirectory(bytes: Uint8Array): number { const minimum = Math.max(0, bytes.length - 65_557); for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) return offset; return -1; }
async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer); const bytes = new Uint8Array(buffer); const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('An IDML ZIP entry has an invalid local header.');
  const nameLength = view.getUint16(offset + 26, true); const extraLength = view.getUint16(offset + 28, true); const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize); if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod !== 8) throw new Error(`Unsupported IDML ZIP compression method: ${entry.compressionMethod}`);
  if (typeof DecompressionStream === 'undefined') throw new Error('This platform cannot decompress IDML files.');
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}