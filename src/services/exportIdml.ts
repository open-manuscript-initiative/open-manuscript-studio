import {
  extractOmiInlineRuns,
  omiCharacterStyleName,
  OMI_CHARACTER_STYLE_NAMES,
  type OmiInlineRun,
} from '../model/inlineSemantics';
import { contributorNameParts } from '../model/contributorName';
import { buildPublicationRenderingContext, type OmiRenderedContributor } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type {
  PublicationParagraphStyleDefinition,
  PublicationParagraphStyleProperties,
} from '../model/publicationParagraphStyles';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import {
  loadPublicationStyle,
  type PublicationStyle,
} from './publicationStyleExport';
import { createStoreZip, textZipEntry } from './simpleZip';

export const IDML_MEDIA_TYPE = 'application/vnd.adobe.indesign-idml-package' as const;
export const IDML_DOM_VERSION = '8.0' as const;

export interface IdmlExportResult {
  blob: Blob;
  bytes: Uint8Array;
  fileName: string;
  warnings: string[];
}

/**
 * Generates an editable IDML package for Adobe InDesign.
 * Paragraph semantics become named InDesign Paragraph Styles and inline OMI
 * semantics become named Character Styles. This keeps author intent separate
 * from a publisher's final typography and makes template remapping practical.
 */
export function buildIdmlExport(
  manuscript: OmiManuscript,
  publicationStyle: PublicationStyle = loadPublicationStyle(),
): IdmlExportResult {
  const profile = resolvePublicationProfile(manuscript);
  const context = buildPublicationRenderingContext(manuscript, profile);
  const warnings: string[] = [];
  const storyParts: string[] = [];

  storyParts.push(styledParagraph(context.title, 'OMI Title'));
  if (context.subtitle) storyParts.push(styledParagraph(context.subtitle, 'OMI Subtitle'));
  if (context.contributors.length) {
    storyParts.push(styledContributorNamesParagraph(context.contributors));
  }
  if (context.abstract) {
    storyParts.push(styledParagraph(localizedLabel(context.locale, 'abstract'), 'OMI Heading 1'));
    storyParts.push(styledParagraph(context.abstract, 'OMI Body'));
  }
  if (context.keywords.length) {
    storyParts.push(styledParagraph(`${localizedLabel(context.locale, 'keywords')}: ${context.keywords.join('; ')}`, 'OMI Metadata'));
  }

  const renderSections = (sections: typeof context.sections): void => {
    for (const section of sections) {
      const level = Math.min(6, section.depth + 1);
      const heading = section.number ? `${section.number} ${section.title}` : section.title;
      storyParts.push(styledParagraph(heading, `OMI Heading ${level}`));
      for (const block of section.blocks) {
        if (block.visual) {
          const text = blockPlainText(block);
          if (text) storyParts.push(styledParagraph(text, 'OMI Figure Caption'));
          warnings.push(`Structured ${block.visual.kind} object ${block.id} is represented as descriptive text in the current IDML alpha export.`);
          continue;
        }

        const paragraphStyleId = resolveIdmlParagraphStyleId(
          block,
          publicationStyle,
        );
        const runs = extractOmiInlineRuns(block.content);
        if (runs.length) {
          storyParts.push(styledRunsParagraph(runs, paragraphStyleId));
        } else {
          const text = blockPlainText(block);
          if (text) storyParts.push(styledParagraph(text, paragraphStyleId));
        }
      }
      renderSections(section.children);
    }
  };
  renderSections(context.sections);

  if (manuscript.annotations.length) {
    storyParts.push(styledParagraph(localizedLabel(context.locale, 'notes'), 'OMI Heading 1'));
    manuscript.annotations.forEach((note, index) => {
      storyParts.push(styledParagraph(`${index + 1}. ${note.body}`, 'OMI Note'));
    });
  }

  const storyId = 'u3';
  const spreadId = 'u2';
  const pageId = 'u4';
  const frameId = 'u5';
  const layerId = 'u1';

  const designMap = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:DesignMap xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}" Self="d">
  <idPkg:Properties src="Resources/Preferences.xml"/>
  <idPkg:Fonts src="Resources/Fonts.xml"/>
  <idPkg:Styles src="Resources/Styles.xml"/>
  <idPkg:Graphic src="Resources/Graphic.xml"/>
  <Layer Self="${layerId}" Name="OMI Content" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"/>
  <idPkg:Spread src="Spreads/Spread_${spreadId}.xml"/>
  <idPkg:Story src="Stories/Story_${storyId}.xml"/>
</idPkg:DesignMap>`;

  const storyXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}">
  <Story Self="${storyId}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="OMI Manuscript" AppliedNamedGrid="n">
    <StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>
    <InCopyExportOption IncludeGraphicProxies="true" IncludeAllResources="false"/>
    ${storyParts.join('\n    ')}
  </Story>
</idPkg:Story>`;

  const spreadXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}">
  <Spread Self="${spreadId}" FlattenerOverride="Default" ShowMasterItems="true" PageTransitionType="None" PageTransitionDirection="NotApplicable" PageTransitionDuration="Medium" BindingLocation="0 0" AllowPageShuffle="true" ItemTransform="1 0 0 1 0 0">
    <Page Self="${pageId}" GeometricBounds="0 0 841.8898 595.2756" ItemTransform="1 0 0 1 0 0" Name="1" AppliedMaster="n" MasterPageTransform="1 0 0 1 0 0" GridStartingPoint="TopOutside" UseMasterGrid="true"/>
    <TextFrame Self="${frameId}" ParentStory="${storyId}" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" ParentPage="${pageId}" ItemLayer="${layerId}" Locked="false" LocalDisplaySetting="Default" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="1 0 0 1 0 0">
      <Properties>
        <PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>
          <PathPointType Anchor="36 36" LeftDirection="36 36" RightDirection="36 36"/>
          <PathPointType Anchor="559.2756 36" LeftDirection="559.2756 36" RightDirection="559.2756 36"/>
          <PathPointType Anchor="559.2756 805.8898" LeftDirection="559.2756 805.8898" RightDirection="559.2756 805.8898"/>
          <PathPointType Anchor="36 805.8898" LeftDirection="36 805.8898" RightDirection="36 805.8898"/>
        </PathPointArray></GeometryPathType></PathGeometry>
      </Properties>
      <TextFramePreference TextColumnCount="1" TextColumnGutter="12" TextColumnFixedWidth="0" UseFixedColumnWidth="false" FirstBaselineOffset="AscentOffset" MinimumFirstBaselineOffset="0" VerticalJustification="TopAlign" VerticalThreshold="0" IgnoreWrap="false"/>
    </TextFrame>
  </Spread>
</idPkg:Spread>`;

  const stylesXml = buildStylesXml(publicationStyle);
  const preferencesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Preferences xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}">
  <DocumentPreference PageHeight="841.8898" PageWidth="595.2756" PagesPerDocument="1" FacingPages="false" PageOrientation="Portrait" PageBinding="LeftToRight"/>
</idPkg:Preferences>`;
  const fontsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Fonts xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}"><FontFamily Self="FontFamily/Times New Roman" Name="Times New Roman"/></idPkg:Fonts>`;
  const graphicXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Graphic xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}"><Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" Name="Black"/></idPkg:Graphic>`;
  const containerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>`;

  const entries = [
    textZipEntry('mimetype', IDML_MEDIA_TYPE),
    textZipEntry('META-INF/container.xml', containerXml),
    textZipEntry('designmap.xml', designMap),
    textZipEntry('Resources/Preferences.xml', preferencesXml),
    textZipEntry('Resources/Fonts.xml', fontsXml),
    textZipEntry('Resources/Styles.xml', stylesXml),
    textZipEntry('Resources/Graphic.xml', graphicXml),
    textZipEntry(`Spreads/Spread_${spreadId}.xml`, spreadXml),
    textZipEntry(`Stories/Story_${storyId}.xml`, storyXml),
  ];
  const bytes = createStoreZip(entries);
  const copy = bytes.slice();
  return {
    bytes,
    blob: new Blob([copy.buffer], { type: IDML_MEDIA_TYPE }),
    fileName: `${fileStem(manuscript)}.idml`,
    warnings,
  };
}

function buildStylesXml(publicationStyle: PublicationStyle): string {
  const fallbackParagraphStyles = [
    style('OMI Title', 24, true, 'CenterAlign', 12, 8),
    style('OMI Subtitle', 16, false, 'CenterAlign', 4, 10),
    style('OMI Authors', 11, false, 'CenterAlign', 0, 12),
    style('OMI Body', 11, false, 'LeftAlign', 0, 6),
    style('OMI Metadata', 10, false, 'LeftAlign', 0, 8),
    style('OMI Note', 9, false, 'LeftAlign', 0, 4),
    style('OMI Figure Caption', 9, false, 'CenterAlign', 4, 8),
    ...[1, 2, 3, 4, 5, 6].map((level) => style(`OMI Heading ${level}`, Math.max(11, 17 - level), true, 'LeftAlign', level === 1 ? 12 : 8, 4)),
  ];
  const studioParagraphStyles = publicationStyle.paragraphStyles.items.map(
    (definition) => paragraphStyle(definition, publicationStyle),
  );
  const paragraphStyles = [
    ...fallbackParagraphStyles,
    ...studioParagraphStyles,
  ].join('\n    ');
  const characterStyles = [
    characterStyle(OMI_CHARACTER_STYLE_NAMES.strong, 'Bold'),
    characterStyle(OMI_CHARACTER_STYLE_NAMES.emphasis, 'Italic'),
    characterStyle('OMI Strong Emphasis', 'Bold Italic'),
    characterStyle(OMI_CHARACTER_STYLE_NAMES.strike, undefined, 'StrikeThru="true"'),
    characterStyle(OMI_CHARACTER_STYLE_NAMES.underline, undefined, 'Underline="true"'),
    characterStyle(OMI_CHARACTER_STYLE_NAMES['small-caps'], undefined, 'Capitalization="SmallCaps"'),
    characterStyle(OMI_CHARACTER_STYLE_NAMES.superscript, undefined, 'Position="Superscript"'),
    characterStyle(OMI_CHARACTER_STYLE_NAMES.subscript, undefined, 'Position="Subscript"'),
    characterStyle(OMI_CHARACTER_STYLE_NAMES.code, undefined, undefined, 'Courier New'),
    characterStyle('OMI Author Given Name'),
    characterStyle('OMI Author Family Name'),
  ].join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}">
  <RootCharacterStyleGroup Self="uCharRoot">
    <CharacterStyle Self="CharacterStyle/$ID/[None]" Name="$ID/[None]"/>
    ${characterStyles}
  </RootCharacterStyleGroup>
  <RootParagraphStyleGroup Self="uParaRoot">
    <ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false" NextStyle="ParagraphStyle/$ID/[No paragraph style]"/>
    ${paragraphStyles}
  </RootParagraphStyleGroup>
  <RootObjectStyleGroup Self="uObjRoot"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/></RootObjectStyleGroup>
</idPkg:Styles>`;
}

function resolveIdmlParagraphStyleId(
  block: OmiBlock,
  publicationStyle: PublicationStyle,
): string {
  const requested = block.paragraphStyleId?.trim();
  if (
    requested
    && publicationStyle.paragraphStyles.items.some((style) => style.id === requested)
  ) {
    return requested;
  }
  const fallback = publicationStyle.paragraphStyles.defaultStyleId;
  return publicationStyle.paragraphStyles.items.some((style) => style.id === fallback)
    ? fallback
    : 'OMI Body';
}

function paragraphStyle(
  definition: PublicationParagraphStyleDefinition,
  publicationStyle: PublicationStyle,
): string {
  const properties = definition.properties;
  const attributes = paragraphStyleAttributes(properties);
  const preserved = preservedIdmlAttributes(
    definition.preservedIdml,
    new Set(Object.keys(attributes)),
  );
  const basedOn = definition.basedOnId
    ? `ParagraphStyle/${xml(definition.basedOnId)}`
    : '$ID/[No paragraph style]';
  const nextStyle = definition.nextStyleId
    ? `ParagraphStyle/${xml(definition.nextStyleId)}`
    : `ParagraphStyle/${xml(publicationStyle.paragraphStyles.defaultStyleId)}`;
  const attributeText = Object.entries({ ...preserved, ...attributes })
    .map(([name, value]) => `${name}="${xml(String(value))}"`)
    .join(' ');
  const propertiesXml = paragraphStylePropertiesXml(properties, basedOn);
  return `<ParagraphStyle Self="ParagraphStyle/${xml(definition.id)}" Name="${xml(definition.name)}" Imported="false" NextStyle="${nextStyle}"${attributeText ? ` ${attributeText}` : ''}>${propertiesXml}</ParagraphStyle>`;
}

function paragraphStyleAttributes(
  properties: PublicationParagraphStyleProperties,
): Record<string, string | number | boolean> {
  const attrs: Record<string, string | number | boolean> = {};
  setAttr(attrs, 'PointSize', properties.fontSize);
  setAttr(attrs, 'Leading', properties.lineHeight);
  setAttr(attrs, 'Tracking', properties.tracking);
  setAttr(attrs, 'HorizontalScale', properties.horizontalScale);
  setAttr(attrs, 'VerticalScale', properties.verticalScale);
  setAttr(attrs, 'BaselineShift', properties.baselineShift);
  setAttr(attrs, 'Skew', properties.skew);
  setAttr(attrs, 'FirstLineIndent', mmToPt(properties.firstLineIndent));
  setAttr(attrs, 'LeftIndent', mmToPt(properties.leftIndent));
  setAttr(attrs, 'RightIndent', mmToPt(properties.rightIndent));
  setAttr(attrs, 'LastLineIndent', mmToPt(properties.lastLineIndent));
  setAttr(attrs, 'SpaceBefore', properties.spaceBefore);
  setAttr(attrs, 'SpaceAfter', properties.spaceAfter);
  setAttr(attrs, 'Justification', idmlJustification(properties.alignment));
  setAttr(attrs, 'Hyphenation', properties.hyphenation);
  setAttr(attrs, 'KeepAllLinesTogether', properties.keepTogether);
  setAttr(attrs, 'KeepWithPrevious', properties.keepWithPrevious);
  setAttr(attrs, 'KeepWithNext', properties.keepWithNextLines);
  setAttr(attrs, 'KeepFirstLines', properties.keepFirstLines);
  setAttr(attrs, 'KeepLastLines', properties.keepLastLines);
  setAttr(attrs, 'StartParagraph', idmlParagraphStart(properties.startParagraph));
  setAttr(attrs, 'Capitalization', idmlCapitalization(properties.capitalization));
  setAttr(attrs, 'Position', idmlCharacterPosition(properties.position));
  setAttr(attrs, 'NoBreak', properties.noBreak);
  setAttr(attrs, 'FillTint', properties.fillTint);
  setAttr(attrs, 'OverprintFill', properties.fillOverprint);

  const hyphen = properties.hyphenationSettings;
  setAttr(attrs, 'HyphenateWordsLongerThan', hyphen?.minimumWordLength);
  setAttr(attrs, 'HyphenateAfterFirst', hyphen?.minimumPrefix);
  setAttr(attrs, 'HyphenateBeforeLast', hyphen?.minimumSuffix);
  setAttr(attrs, 'HyphenateLadderLimit', hyphen?.maximumHyphens);
  setAttr(attrs, 'HyphenationZone', mmToPt(hyphen?.hyphenationZoneMm));
  setAttr(attrs, 'HyphenateCapitalizedWords', hyphen?.hyphenateCapitalizedWords);
  setAttr(attrs, 'HyphenateLastWord', hyphen?.hyphenateLastWord);
  setAttr(attrs, 'HyphenateAcrossColumns', hyphen?.hyphenateAcrossColumns);
  setAttr(attrs, 'HyphenWeight', hyphen?.preference);

  const justification = properties.justification;
  setAttr(attrs, 'MinimumWordSpacing', justification?.wordSpacingMinimum);
  setAttr(attrs, 'DesiredWordSpacing', justification?.wordSpacingDesired);
  setAttr(attrs, 'MaximumWordSpacing', justification?.wordSpacingMaximum);
  setAttr(attrs, 'MinimumLetterSpacing', justification?.letterSpacingMinimum);
  setAttr(attrs, 'DesiredLetterSpacing', justification?.letterSpacingDesired);
  setAttr(attrs, 'MaximumLetterSpacing', justification?.letterSpacingMaximum);
  setAttr(attrs, 'MinimumGlyphScaling', justification?.glyphScalingMinimum);
  setAttr(attrs, 'DesiredGlyphScaling', justification?.glyphScalingDesired);
  setAttr(attrs, 'MaximumGlyphScaling', justification?.glyphScalingMaximum);
  setAttr(attrs, 'SingleWordJustification', idmlJustification(justification?.singleWordAlignment));
  setAttr(attrs, 'AutoLeading', justification?.autoLeadingPercent);
  setAttr(attrs, 'Composer', idmlComposer(justification?.composer));

  const openType = properties.openType;
  setAttr(attrs, 'Ligatures', openType?.ligatures);
  setAttr(attrs, 'OtfDiscretionaryLigature', openType?.discretionaryLigatures);
  setAttr(attrs, 'OtfContextualAlternate', openType?.contextualAlternates);
  setAttr(attrs, 'OtfFraction', openType?.fractions);
  setAttr(attrs, 'OtfOrdinal', openType?.ordinals);
  setAttr(attrs, 'OtfSlashedZero', openType?.slashedZero);
  setAttr(attrs, 'OtfTitling', openType?.titlingAlternates);
  setAttr(attrs, 'OtfSwash', openType?.swash);
  setAttr(attrs, 'OtfStylisticSets', stylisticSetsToBitmask(openType?.stylisticSets));

  return attrs;
}

function paragraphStylePropertiesXml(
  properties: PublicationParagraphStyleProperties,
  basedOn: string,
): string {
  const children = [
    `<BasedOn type="object">${xml(basedOn)}</BasedOn>`,
    properties.fontFamily
      ? `<AppliedFont type="string">${xml(properties.fontFamily)}</AppliedFont>`
      : '',
    properties.fontStyle
      ? `<FontStyle type="string">${xml(properties.fontStyle === 'italic' ? 'Italic' : 'Regular')}</FontStyle>`
      : '',
    properties.language
      ? `<AppliedLanguage type="string">${xml(properties.language)}</AppliedLanguage>`
      : '',
    properties.fillColor
      ? `<FillColor type="string">${xml(properties.fillColor)}</FillColor>`
      : '',
    tabListXml(properties.tabStops),
    nestedStylesXml(properties),
  ].filter(Boolean).join('');
  return `<Properties>${children}</Properties>`;
}

function tabListXml(
  stops: PublicationParagraphStyleProperties['tabStops'],
): string {
  if (!stops?.length) return '';
  const items = stops.map((stop, index) => (
    `<ListItem type="record"><TabStop Self="omi-tab-${index + 1}" Position="${mmToPt(stop.positionMm) ?? 0}" Alignment="${idmlTabAlignment(stop.alignment)}" AlignmentCharacter="${xml(stop.decimalCharacter ?? '.')}" Leader="${xml(stop.leader ?? '')}"/></ListItem>`
  )).join('');
  return `<TabList type="list">${items}</TabList>`;
}

function nestedStylesXml(
  properties: PublicationParagraphStyleProperties,
): string {
  const chunks: string[] = [];
  if (properties.nestedStyles?.length) {
    const items = properties.nestedStyles.map((rule) => (
      `<ListItem type="record"><AppliedCharacterStyle type="object">CharacterStyle/${xml(rule.characterStyleId)}</AppliedCharacterStyle><Delimiter type="string">${xml(rule.delimiter ?? '')}</Delimiter><Repetition type="long">${Math.max(1, rule.repeat ?? 1)}</Repetition><Inclusive type="bool">${rule.through === true}</Inclusive></ListItem>`
    )).join('');
    chunks.push(`<AllNestedStyles type="list">${items}</AllNestedStyles>`);
  }
  if (properties.nestedLineStyles?.length) {
    const items = properties.nestedLineStyles.map((rule) => (
      `<ListItem type="record"><AppliedCharacterStyle type="object">CharacterStyle/${xml(rule.characterStyleId)}</AppliedCharacterStyle><LineCount type="long">${Math.max(1, rule.lines)}</LineCount><RepeatLast type="long">0</RepeatLast></ListItem>`
    )).join('');
    chunks.push(`<AllLineStyles type="list">${items}</AllLineStyles>`);
  }
  if (properties.grepStyles?.length) {
    const items = properties.grepStyles.map((rule) => (
      `<ListItem type="record"><AppliedCharacterStyle type="object">CharacterStyle/${xml(rule.characterStyleId)}</AppliedCharacterStyle><GrepExpression type="string">${xml(rule.expression)}</GrepExpression></ListItem>`
    )).join('');
    chunks.push(`<AllGREPStyles type="list">${items}</AllGREPStyles>`);
  }
  return chunks.join('');
}

function preservedIdmlAttributes(
  values: PublicationParagraphStyleDefinition['preservedIdml'],
  generated: Set<string>,
): Record<string, string | number | boolean> {
  if (!values) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      generated.has(key)
      || ['Self', 'Name', 'BasedOn', 'NextStyle', 'Shortcut'].includes(key)
      || !/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(key)
    ) continue;
    result[key] = value;
  }
  return result;
}

function setAttr(
  target: Record<string, string | number | boolean>,
  name: string,
  value: string | number | boolean | undefined,
): void {
  if (value === undefined || value === '') return;
  target[name] = value;
}

function mmToPt(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round((value * 72 / 25.4) * 1000) / 1000;
}

function idmlJustification(value: string | undefined): string | undefined {
  if (value === 'center') return 'CenterAlign';
  if (value === 'right') return 'RightAlign';
  if (value === 'justify') return 'LeftJustified';
  if (value === 'left') return 'LeftAlign';
  return undefined;
}

function idmlParagraphStart(value: string | undefined): string | undefined {
  if (value === 'next-column') return 'NextColumn';
  if (value === 'next-frame') return 'NextFrame';
  if (value === 'next-page') return 'NextPage';
  if (value === 'next-odd-page') return 'NextOddPage';
  if (value === 'next-even-page') return 'NextEvenPage';
  if (value === 'anywhere') return 'Anywhere';
  return undefined;
}

function idmlCapitalization(value: string | undefined): string | undefined {
  if (value === 'small-caps') return 'SmallCaps';
  if (value === 'all-caps') return 'AllCaps';
  if (value === 'normal') return 'Normal';
  return undefined;
}

function idmlCharacterPosition(value: string | undefined): string | undefined {
  if (value === 'superscript') return 'Superscript';
  if (value === 'subscript') return 'Subscript';
  if (value === 'superior') return 'OTSuperscript';
  if (value === 'inferior') return 'OTSubscript';
  if (value === 'normal') return 'Normal';
  return undefined;
}

function idmlComposer(value: string | undefined): string | undefined {
  if (value === 'adobe-single-line') return 'Adobe Single-line Composer';
  if (value === 'world-ready-paragraph') return 'Adobe World-Ready Paragraph Composer';
  if (value === 'world-ready-single-line') return 'Adobe World-Ready Single-line Composer';
  if (value === 'adobe-paragraph') return 'Adobe Paragraph Composer';
  return undefined;
}

function idmlTabAlignment(
  value: string | undefined,
): string {
  if (value === 'right') return 'RightAlign';
  if (value === 'center') return 'CenterAlign';
  if (value === 'decimal') return 'CharacterAlign';
  return 'LeftAlign';
}

function stylisticSetsToBitmask(
  sets: readonly number[] | undefined,
): number | undefined {
  if (!sets?.length) return undefined;
  return sets.reduce((mask, item) => {
    const normalized = Math.trunc(item);
    return normalized >= 1 && normalized <= 20
      ? mask | (1 << (normalized - 1))
      : mask;
  }, 0);
}

function characterStyle(name: string, fontStyle?: string, attributes?: string, font = 'Times New Roman'): string {
  return `<CharacterStyle Self="CharacterStyle/${xml(name)}" Name="${xml(name)}" BasedOn="CharacterStyle/$ID/[None]"${attributes ? ` ${attributes}` : ''}><Properties><AppliedFont type="string">${xml(font)}</AppliedFont>${fontStyle ? `<FontStyle type="string">${xml(fontStyle)}</FontStyle>` : ''}</Properties></CharacterStyle>`;
}

function style(name: string, size: number, bold: boolean, justification: string, spaceBefore: number, spaceAfter: number): string {
  return `<ParagraphStyle Self="ParagraphStyle/${xml(name)}" Name="${xml(name)}" BasedOn="ParagraphStyle/$ID/[No paragraph style]" NextStyle="ParagraphStyle/OMI Body" PointSize="${size}" Leading="Auto" Justification="${justification}" SpaceBefore="${spaceBefore}" SpaceAfter="${spaceAfter}"><Properties><AppliedFont type="string">Times New Roman</AppliedFont></Properties>${bold ? '<Properties><FontStyle type="string">Bold</FontStyle></Properties>' : ''}</ParagraphStyle>`;
}

function styledParagraph(value: string, styleName: string): string {
  return styledRunsParagraph([{ text: value, semantics: [] }], styleName);
}

function styledContributorNamesParagraph(
  contributors: readonly OmiRenderedContributor[],
): string {
  const ranges: string[] = [];
  contributors.forEach((contributor, contributorIndex) => {
    contributorNameParts(contributor).forEach((part, partIndex) => {
      if (partIndex > 0) {
        ranges.push('<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[None]"><Content> </Content></CharacterStyleRange>');
      }
      const styleName =
        part.kind === 'given'
          ? 'OMI Author Given Name'
          : part.kind === 'family'
            ? 'OMI Author Family Name'
            : '$ID/[None]';
      ranges.push(`<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/${xml(styleName)}"><Content>${xml(part.text)}</Content></CharacterStyleRange>`);
    });
    if (contributorIndex < contributors.length - 1) {
      ranges.push('<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[None]"><Content>, </Content></CharacterStyleRange>');
    }
  });
  return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/OMI Authors">${ranges.join('')}<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[None]"><Br/></CharacterStyleRange></ParagraphStyleRange>`;
}

function styledRunsParagraph(runs: readonly OmiInlineRun[], styleName: string): string {
  const content = runs
    .map((run) => {
      const charStyle = omiCharacterStyleName(run.semantics) ?? '$ID/[None]';
      const language = run.language ? ` AppliedLanguage="${xml(run.language)}"` : '';
      return `<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/${xml(charStyle)}"${language}><Content>${xml(run.text)}</Content></CharacterStyleRange>`;
    })
    .join('');
  return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${xml(styleName)}">${content}<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[None]"><Br/></CharacterStyleRange></ParagraphStyleRange>`;
}

function blockPlainText(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    const label = block.visual.kind.charAt(0).toUpperCase() + block.visual.kind.slice(1);
    return caption?.trim() ? `[${label}: ${caption.trim()}]` : `[${label}]`;
  }
  const runs = extractOmiInlineRuns(block.content);
  if (runs.length) return runs.map((run) => run.text).join('').replace(/\s+/g, ' ').trim();
  return block.content.trim();
}

function localizedLabel(locale: string, key: 'abstract' | 'keywords' | 'notes'): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const labels = language === 'hu'
    ? { abstract: 'Absztrakt', keywords: 'Kulcsszavak', notes: 'Jegyzetek' }
    : language === 'de'
      ? { abstract: 'Zusammenfassung', keywords: 'Schlüsselwörter', notes: 'Anmerkungen' }
      : { abstract: 'Abstract', keywords: 'Keywords', notes: 'Notes' };
  return labels[key];
}

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  return manuscript.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || manuscript.id || 'manuscript';
}
