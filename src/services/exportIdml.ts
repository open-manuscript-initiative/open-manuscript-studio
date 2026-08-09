import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript } from '../types/omi';
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
 * The alpha renderer deliberately uses a simple one-page, one-story layout:
 * semantic structure is represented with named paragraph styles so publishers
 * can remap those styles in an InDesign template without losing hierarchy.
 */
export function buildIdmlExport(manuscript: OmiManuscript): IdmlExportResult {
  const profile = resolvePublicationProfile(manuscript);
  const context = buildPublicationRenderingContext(manuscript, profile);
  const warnings: string[] = [];
  const storyParts: string[] = [];

  storyParts.push(styledParagraph(context.title, 'OMI Title'));
  if (context.subtitle) storyParts.push(styledParagraph(context.subtitle, 'OMI Subtitle'));
  if (context.contributors.length) {
    storyParts.push(styledParagraph(context.contributors.map((item) => item.displayName).join(', '), 'OMI Authors'));
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
        const text = blockPlainText(block);
        if (text) storyParts.push(styledParagraph(text, block.visual ? 'OMI Figure Caption' : 'OMI Body'));
        if (block.visual) {
          warnings.push(`Structured ${block.visual.kind} object ${block.id} is represented as descriptive text in the current IDML alpha export.`);
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

  // A4 page in PostScript points with a text frame inside 36 pt margins.
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

  const stylesXml = buildStylesXml();
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

  // IDML is a UCF/ZIP package. Keep the mimetype entry first and uncompressed.
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

function buildStylesXml(): string {
  const paragraphStyles = [
    style('OMI Title', 24, true, 'CenterAlign', 12, 8),
    style('OMI Subtitle', 16, false, 'CenterAlign', 4, 10),
    style('OMI Authors', 11, false, 'CenterAlign', 0, 12),
    style('OMI Body', 11, false, 'LeftAlign', 0, 6),
    style('OMI Metadata', 10, false, 'LeftAlign', 0, 8),
    style('OMI Note', 9, false, 'LeftAlign', 0, 4),
    style('OMI Figure Caption', 9, false, 'CenterAlign', 4, 8),
    ...[1, 2, 3, 4, 5, 6].map((level) => style(`OMI Heading ${level}`, Math.max(11, 17 - level), true, 'LeftAlign', level === 1 ? 12 : 8, 4)),
  ].join('\n    ');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="${IDML_DOM_VERSION}">
  <RootCharacterStyleGroup Self="uCharRoot"><CharacterStyle Self="CharacterStyle/$ID/[None]" Name="$ID/[None]"/></RootCharacterStyleGroup>
  <RootParagraphStyleGroup Self="uParaRoot">
    <ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false" NextStyle="ParagraphStyle/$ID/[No paragraph style]"/>
    ${paragraphStyles}
  </RootParagraphStyleGroup>
  <RootObjectStyleGroup Self="uObjRoot"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/></RootObjectStyleGroup>
</idPkg:Styles>`;
}

function style(name: string, size: number, bold: boolean, justification: string, spaceBefore: number, spaceAfter: number): string {
  return `<ParagraphStyle Self="ParagraphStyle/${xml(name)}" Name="${xml(name)}" BasedOn="ParagraphStyle/$ID/[No paragraph style]" NextStyle="ParagraphStyle/OMI Body" PointSize="${size}" Leading="Auto" Justification="${justification}" SpaceBefore="${spaceBefore}" SpaceAfter="${spaceAfter}"><Properties><AppliedFont type="string">Times New Roman</AppliedFont></Properties>${bold ? '<Properties><FontStyle type="string">Bold</FontStyle></Properties>' : ''}</ParagraphStyle>`;
}

function styledParagraph(value: string, styleName: string): string {
  return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${xml(styleName)}"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[None]"><Content>${xml(value)}</Content><Br/></CharacterStyleRange></ParagraphStyleRange>`;
}

function blockPlainText(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    const label = block.visual.kind.charAt(0).toUpperCase() + block.visual.kind.slice(1);
    return caption?.trim() ? `[${label}: ${caption.trim()}]` : `[${label}]`;
  }
  const value = block.content.trim();
  if (!value) return '';
  try {
    return textFromJson(JSON.parse(value) as unknown).replace(/\s+/g, ' ').trim();
  } catch {
    return value;
  }
}

function textFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[]; type?: unknown };
  if (typeof node.text === 'string') return node.text;
  const separator = node.type === 'paragraph' || node.type === 'heading' ? '\n' : '';
  return (node.content ?? []).map(textFromJson).join(separator);
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
