import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { blockPlainText, exportFileStem, localizedPublicationLabel } from './exportTextUtils';

export interface SlaExportResult {
  text: string;
  blob: Blob;
  fileName: string;
}

/**
 * Creates an editable Scribus SLA document with one linked text frame story.
 * Paragraph styles preserve the OMI semantic hierarchy for later template mapping.
 */
export function buildSlaExport(manuscript: OmiManuscript): SlaExportResult {
  const context = buildPublicationRenderingContext(manuscript, resolvePublicationProfile(manuscript));
  const story: string[] = [];

  story.push(itext(context.title, 'OMI Title'));
  if (context.subtitle) story.push(itext(context.subtitle, 'OMI Subtitle'));
  if (context.contributors.length) {
    story.push(itext(context.contributors.map((item) => item.displayName).join(', '), 'OMI Authors'));
  }
  if (context.abstract) {
    story.push(itext(localizedPublicationLabel(context.locale, 'abstract'), 'OMI Heading 1'));
    story.push(itext(context.abstract, 'OMI Body'));
  }
  if (context.keywords.length) {
    story.push(itext(`${localizedPublicationLabel(context.locale, 'keywords')}: ${context.keywords.join('; ')}`, 'OMI Metadata'));
  }

  const renderSections = (sections: typeof context.sections) => {
    for (const section of sections) {
      const level = Math.min(6, section.depth + 1);
      story.push(itext(section.number ? `${section.number} ${section.title}` : section.title, `OMI Heading ${level}`));
      for (const block of section.blocks) {
        const text = blockPlainText(block);
        if (text) story.push(itext(text, 'OMI Body'));
      }
      renderSections(section.children);
    }
  };
  renderSections(context.sections);

  if (manuscript.annotations.length) {
    story.push(itext(localizedPublicationLabel(context.locale, 'notes'), 'OMI Heading 1'));
    manuscript.annotations.forEach((note, index) => story.push(itext(`${index + 1}. ${note.body}`, 'OMI Note')));
  }

  const styles = [
    style('OMI Body', 11, false, 0),
    style('OMI Title', 24, true, 1),
    style('OMI Subtitle', 16, false, 1),
    style('OMI Authors', 11, false, 1),
    style('OMI Metadata', 10, false, 0),
    style('OMI Note', 9, false, 0),
    ...[1,2,3,4,5,6].map((level) => style(`OMI Heading ${level}`, Math.max(11, 18 - level), true, 0)),
  ].join('\n    ');

  const text = `<?xml version="1.0" encoding="UTF-8"?>
<SCRIBUSUTF8NEW Version="1.6.0">
 <DOCUMENT ANZPAGES="1" PAGEWIDTH="595.2756" PAGEHEIGHT="841.8898" BORDERLEFT="56.6929" BORDERRIGHT="56.6929" BORDERTOP="56.6929" BORDERBOTTOM="56.6929" ORIENTATION="0" PAGESIZE="A4" LANGUAGE="${xml(context.locale)}">
  <COLOR NAME="Black" SPACE="CMYK" C="0" M="0" Y="0" K="100"/>
  <CHARSTYLE CNAME="OMI Default Character" FONT="Times New Roman Regular" FONTSIZE="11" FCOLOR="Black"/>
  ${styles}
  <PAGE NUM="0" NAM="" MNAM="Normal" LEFT="0" PRESET="0" VerticalGuides="" HorizontalGuides=""/>
  <PAGEOBJECT OwnPage="0" PTYPE="4" XPOS="56.6929" YPOS="56.6929" WIDTH="481.8898" HEIGHT="728.5039" RADRECT="0" FRTYPE="0" CLIPEDIT="0" PWIDTH="0" PCOLOR="None" PCOLOR2="None" PLINEART="1" ANNAME="OMI Manuscript" NEXTITEM="-1" BACKITEM="-1" TEXTFLOWMODE="0" AUTOTEXT="0" COLUMNS="1" COLGAP="0" LINESPMode="0">
   <StoryText>
    ${story.join('\n    ')}
   </StoryText>
  </PAGEOBJECT>
 </DOCUMENT>
</SCRIBUSUTF8NEW>
`;

  return {
    text,
    blob: new Blob([text], { type: 'application/vnd.scribus;charset=utf-8' }),
    fileName: `${exportFileStem(manuscript)}.sla`,
  };
}

function style(name: string, size: number, bold: boolean, alignment: number): string {
  return `<STYLE NAME="${xml(name)}" FONT="Times New Roman ${bold ? 'Bold' : 'Regular'}" FONTSIZE="${size}" FCOLOR="Black" ALIGN="${alignment}" LINESPMode="0" GAPBEFORE="${name.includes('Heading') ? 8 : 0}" GAPAFTER="${name === 'OMI Body' ? 6 : 4}"/>`;
}

function itext(value: string, styleName: string): string {
  return `<ITEXT CH="${xml(value)}" PSTYLE="${xml(styleName)}"/><para PARENT="${xml(styleName)}"/>`;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r?\n/g, '&#10;');
}
