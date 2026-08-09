import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { blockPlainText, exportFileStem, localizedPublicationLabel } from './exportTextUtils';

export interface XtgExportResult {
  text: string;
  blob: Blob;
  fileName: string;
}

/** UTF-8 QuarkXPress XPress Tags text export. */
export function buildXtgExport(manuscript: OmiManuscript): XtgExportResult {
  const context = buildPublicationRenderingContext(manuscript, resolvePublicationProfile(manuscript));
  const lines: string[] = ['<v21.00><e9>'];

  // Named paragraph style sheets. The following tags are intentionally modest
  // so journals can remap OMI styles to their own QuarkXPress templates.
  lines.push('@OMI Body=<*p(0,0,0,0,0,0,g,"Standard",0,0)>');
  lines.push('@OMI Title=<*p(0,0,0,0,0,0,g,"Standard",0,0)><B><z24>');
  lines.push('@OMI Subtitle=<*p(0,0,0,0,0,0,g,"Standard",0,0)><z16>');
  lines.push('@OMI Authors=<*p(0,0,0,0,0,0,g,"Standard",0,0)><z11>');
  lines.push('@OMI Metadata=<*p(0,0,0,0,0,0,g,"Standard",0,0)><z10>');
  lines.push('@OMI Note=<*p(0,0,0,0,0,0,g,"Standard",0,0)><z9>');
  for (let level = 1; level <= 6; level += 1) {
    lines.push(`@OMI Heading ${level}=<*p(0,0,0,0,0,0,g,"Standard",0,0)><B><z${Math.max(11, 18 - level)}>`);
  }

  lines.push(paragraph(context.title, 'OMI Title'));
  if (context.subtitle) lines.push(paragraph(context.subtitle, 'OMI Subtitle'));
  if (context.contributors.length) {
    lines.push(paragraph(context.contributors.map((item) => item.displayName).join(', '), 'OMI Authors'));
  }
  if (context.abstract) {
    lines.push(paragraph(localizedPublicationLabel(context.locale, 'abstract'), 'OMI Heading 1'));
    lines.push(paragraph(context.abstract, 'OMI Body'));
  }
  if (context.keywords.length) {
    lines.push(paragraph(`${localizedPublicationLabel(context.locale, 'keywords')}: ${context.keywords.join('; ')}`, 'OMI Metadata'));
  }

  const renderSections = (sections: typeof context.sections) => {
    for (const section of sections) {
      const level = Math.min(6, section.depth + 1);
      lines.push(paragraph(section.number ? `${section.number} ${section.title}` : section.title, `OMI Heading ${level}`));
      for (const block of section.blocks) {
        const text = blockPlainText(block);
        if (text) lines.push(paragraph(text, 'OMI Body'));
      }
      renderSections(section.children);
    }
  };
  renderSections(context.sections);

  if (manuscript.annotations.length) {
    lines.push(paragraph(localizedPublicationLabel(context.locale, 'notes'), 'OMI Heading 1'));
    manuscript.annotations.forEach((note, index) => lines.push(paragraph(`${index + 1}. ${note.body}`, 'OMI Note')));
  }

  const text = `${lines.join('\r')}\r`;
  return {
    text,
    blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
    fileName: `${exportFileStem(manuscript)}.xtg`,
  };
}

function paragraph(value: string, style: string): string {
  return `<@${escapeTagName(style)}>${escapeXtg(value)}<P>`;
}

function escapeTagName(value: string): string {
  return value.replace(/[<>]/g, '');
}

function escapeXtg(value: string): string {
  return value
    .replace(/\\/g, '<\\\\>')
    .replace(/</g, '<\\<>')
    .replace(/@/g, '<\\@>')
    .replace(/\r?\n/g, '<\\n>');
}
