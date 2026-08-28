import { renderBibliography } from '../model/cslRendering';
import {
  resolveLocalizedAbstract,
  resolveLocalizedKeywords,
  type CustomExportBlock,
  type CustomExportTemplate,
  type CustomExportTypography,
} from '../model/customExport';
import { extractOmiInlineRuns } from '../model/inlineSemantics';
import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import { createStoreZip, textZipEntry } from './simpleZip';

export interface CustomExportResult {
  blob: Blob;
  fileName: string;
}

export function buildCustomHtmlExport(manuscript: OmiManuscript, template: CustomExportTemplate): CustomExportResult {
  const html = renderCustomHtmlDocument(manuscript, template);
  return {
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
    fileName: `${fileStem(manuscript)}-custom.html`,
  };
}

export function openCustomPdfPrintView(manuscript: OmiManuscript, template: CustomExportTemplate): void {
  const html = renderCustomHtmlDocument(manuscript, template, true);
  const target = window.open('', '_blank', 'noopener,noreferrer');
  if (!target) throw new Error('The print preview window could not be opened.');
  target.document.open();
  target.document.write(html);
  target.document.close();
  target.addEventListener('load', () => target.print(), { once: true });
}

export function buildCustomDocxExport(manuscript: OmiManuscript, template: CustomExportTemplate): CustomExportResult {
  const context = buildPublicationRenderingContext(manuscript, resolvePublicationProfile(manuscript));
  const body = enabledBlocks(template).flatMap((block) => renderWordBlock(manuscript, context, block));
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const entries = [
    textZipEntry('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`),
    textZipEntry('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    textZipEntry('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`),
    textZipEntry('word/document.xml', documentXml),
  ];
  const bytes = createStoreZip(entries);
  const copy = bytes.slice();
  return {
    blob: new Blob([copy.buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    fileName: `${fileStem(manuscript)}-custom.docx`,
  };
}

export function renderCustomHtmlDocument(manuscript: OmiManuscript, template: CustomExportTemplate, print = false): string {
  const context = buildPublicationRenderingContext(manuscript, resolvePublicationProfile(manuscript));
  const body = enabledBlocks(template).map((block) => renderHtmlBlock(manuscript, context, block)).join('\n');
  return `<!doctype html><html lang="${escapeAttribute(manuscript.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manuscript.title)}</title><style>html{background:#fff;color:#111}body{max-width:760px;margin:40px auto;padding:0 28px}.omi-custom-block{box-sizing:border-box}.omi-custom-body h1,.omi-custom-body h2,.omi-custom-body h3,.omi-custom-body h4,.omi-custom-body h5,.omi-custom-body h6{font-family:inherit}.omi-custom-body p{margin-top:0}.omi-custom-bibliography p,.omi-custom-notes p{padding-left:1.5em;text-indent:-1.5em}@media print{body{max-width:none;margin:0;padding:0}${print ? '' : ''}}</style></head><body>${body}</body></html>`;
}

function renderHtmlBlock(manuscript: OmiManuscript, context: ReturnType<typeof buildPublicationRenderingContext>, block: CustomExportBlock): string {
  const style = htmlTypography(block.typography);
  const wrap = (inner: string, extra = '') => `<section class="omi-custom-block ${extra}" style="${style}">${inner}</section>`;
  switch (block.kind) {
    case 'title': return wrap(`<div>${escapeHtml(context.title)}</div>`);
    case 'subtitle': return context.subtitle ? wrap(`<div>${escapeHtml(context.subtitle)}</div>`) : '';
    case 'motto': return context.motto ? wrap(`<div>${escapeHtml(context.motto)}</div>`) : '';
    case 'author': return context.contributors.length ? wrap(`<div>${escapeHtml(context.contributors.map((item) => item.displayName).join(', '))}</div>`) : '';
    case 'affiliation': {
      const affiliations = [...new Set(context.contributors.flatMap((item) => item.affiliations.map((affiliation) => [affiliation.department, affiliation.organizationName].filter(Boolean).join(', '))))];
      return affiliations.length ? wrap(`<div>${affiliations.map(escapeHtml).join('<br>')}</div>`) : '';
    }
    case 'abstract': {
      const value = resolveLocalizedAbstract(manuscript, block.language);
      return value ? wrap(`<div><strong>${escapeHtml(localizedLabel(block.language || manuscript.locale, 'abstract'))}</strong></div><div>${escapeHtml(value)}</div>`) : '';
    }
    case 'keywords': {
      const values = resolveLocalizedKeywords(manuscript, block.language);
      return values.length ? wrap(`<div><strong>${escapeHtml(localizedLabel(block.language || manuscript.locale, 'keywords'))}:</strong> ${escapeHtml(values.join('; '))}</div>`) : '';
    }
    case 'body': return wrap(renderHtmlSections(context.sections), 'omi-custom-body');
    case 'notes': {
      const notes = manuscript.annotations.filter((item) => item.type === 'note' && (block.noteMode === 'all' || !block.noteMode || item.noteKind === block.noteMode));
      return notes.length ? wrap(`<div><strong>${escapeHtml(localizedLabel(manuscript.locale, 'notes'))}</strong></div>${notes.map((item, index) => `<p>${index + 1}. ${escapeHtml(item.body)}</p>`).join('')}`, 'omi-custom-notes') : '';
    }
    case 'bibliography': {
      const records = manuscript.bibliographicRecords ?? [];
      const styleId = block.bibliographyStyle ?? manuscript.citationStyle ?? 'apa-7';
      const entries = renderBibliography(records, styleId, manuscript.locale);
      return entries.length ? wrap(`<div><strong>${escapeHtml(localizedLabel(manuscript.locale, 'bibliography'))}</strong></div>${entries.map((entry) => `<p>${escapeHtml(entry.text)}</p>`).join('')}`, 'omi-custom-bibliography') : '';
    }
  }
}

function renderHtmlSections(sections: ReturnType<typeof buildPublicationRenderingContext>['sections']): string {
  return sections.map((section) => {
    const level = Math.min(6, section.depth + 1);
    const title = section.number ? `${section.number} ${section.title}` : section.title;
    const blocks = section.blocks.map(renderHtmlBodyBlock).join('');
    return `<h${level}>${escapeHtml(title)}</h${level}>${blocks}${renderHtmlSections(section.children)}`;
  }).join('');
}

function renderHtmlBodyBlock(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    return `<p>[${escapeHtml(block.visual.kind)}${caption ? `: ${escapeHtml(caption)}` : ''}]</p>`;
  }
  const text = blockPlainText(block);
  if (!text) return '';
  return block.type === 'quote' ? `<blockquote>${escapeHtml(text)}</blockquote>` : `<p>${escapeHtml(text)}</p>`;
}

function renderWordBlock(manuscript: OmiManuscript, context: ReturnType<typeof buildPublicationRenderingContext>, block: CustomExportBlock): string[] {
  const p = (value: string, typography = block.typography) => value.trim() ? [wordParagraph(value, typography)] : [];
  switch (block.kind) {
    case 'title': return p(context.title);
    case 'subtitle': return context.subtitle ? p(context.subtitle) : [];
    case 'motto': return context.motto ? p(context.motto) : [];
    case 'author': return p(context.contributors.map((item) => item.displayName).join(', '));
    case 'affiliation': return p([...new Set(context.contributors.flatMap((item) => item.affiliations.map((affiliation) => [affiliation.department, affiliation.organizationName].filter(Boolean).join(', '))))].join('; '));
    case 'abstract': {
      const value = resolveLocalizedAbstract(manuscript, block.language);
      return value ? p(`${localizedLabel(block.language || manuscript.locale, 'abstract')}: ${value}`) : [];
    }
    case 'keywords': {
      const values = resolveLocalizedKeywords(manuscript, block.language);
      return values.length ? p(`${localizedLabel(block.language || manuscript.locale, 'keywords')}: ${values.join('; ')}`) : [];
    }
    case 'body': return renderWordSections(context.sections, block.typography);
    case 'notes': {
      const notes = manuscript.annotations.filter((item) => item.type === 'note' && (block.noteMode === 'all' || !block.noteMode || item.noteKind === block.noteMode));
      return notes.length ? [wordParagraph(localizedLabel(manuscript.locale, 'notes'), { ...block.typography, bold: true }), ...notes.map((item, index) => wordParagraph(`${index + 1}. ${item.body}`, block.typography))] : [];
    }
    case 'bibliography': {
      const styleId = block.bibliographyStyle ?? manuscript.citationStyle ?? 'apa-7';
      const entries = renderBibliography(manuscript.bibliographicRecords ?? [], styleId, manuscript.locale);
      return entries.length ? [wordParagraph(localizedLabel(manuscript.locale, 'bibliography'), { ...block.typography, bold: true }), ...entries.map((entry) => wordParagraph(entry.text, block.typography))] : [];
    }
  }
}

function renderWordSections(sections: ReturnType<typeof buildPublicationRenderingContext>['sections'], typography: CustomExportTypography): string[] {
  const result: string[] = [];
  for (const section of sections) {
    const title = section.number ? `${section.number} ${section.title}` : section.title;
    result.push(wordParagraph(title, { ...typography, bold: true, fontSizePt: Math.max(typography.fontSizePt, 12 + Math.max(0, 3 - section.depth)) }));
    for (const block of section.blocks) {
      const value = blockPlainText(block);
      if (value) result.push(wordParagraph(value, typography));
    }
    result.push(...renderWordSections(section.children, typography));
  }
  return result;
}

function wordParagraph(value: string, typography: CustomExportTypography): string {
  const halfPoints = Math.max(2, Math.round(typography.fontSizePt * 2));
  const before = Math.max(0, Math.round((typography.spaceBeforePt ?? 0) * 20));
  const after = Math.max(0, Math.round((typography.spaceAfterPt ?? 0) * 20));
  const line = Math.max(120, Math.round((typography.lineHeight ?? 1.15) * 240));
  const align = typography.alignment === 'justify' ? 'both' : typography.alignment ?? 'left';
  const rPr = `<w:rPr><w:rFonts w:ascii="${xml(typography.fontFamily)}" w:hAnsi="${xml(typography.fontFamily)}"/>${typography.bold ? '<w:b/>' : ''}${typography.italic ? '<w:i/>' : ''}<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/></w:rPr>`;
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/></w:pPr><w:r>${rPr}<w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
}

function htmlTypography(value: CustomExportTypography): string {
  return [
    `font-family:${cssString(value.fontFamily)}`,
    `font-size:${value.fontSizePt}pt`,
    `font-weight:${value.bold ? '700' : '400'}`,
    `font-style:${value.italic ? 'italic' : 'normal'}`,
    `text-align:${value.alignment ?? 'left'}`,
    `margin-top:${value.spaceBeforePt ?? 0}pt`,
    `margin-bottom:${value.spaceAfterPt ?? 0}pt`,
    `line-height:${value.lineHeight ?? 1.15}`,
  ].join(';');
}

function enabledBlocks(template: CustomExportTemplate): CustomExportBlock[] {
  return template.blocks.filter((block) => block.enabled);
}

function blockPlainText(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    return `[${block.visual.kind}${caption ? `: ${caption}` : ''}]`;
  }
  const runs = extractOmiInlineRuns(block.content);
  if (runs.length) return runs.map((run) => run.text).join('').replace(/\s+/g, ' ').trim();
  return block.content.trim();
}

function localizedLabel(locale: string, key: 'abstract' | 'keywords' | 'notes' | 'bibliography'): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const values = language === 'hu'
    ? { abstract: 'Absztrakt', keywords: 'Kulcsszavak', notes: 'Jegyzetek', bibliography: 'Bibliográfia' }
    : language === 'de'
      ? { abstract: 'Zusammenfassung', keywords: 'Schlüsselwörter', notes: 'Anmerkungen', bibliography: 'Literaturverzeichnis' }
      : { abstract: 'Abstract', keywords: 'Keywords', notes: 'Notes', bibliography: 'Bibliography' };
  return values[key];
}

function fileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  return manuscript.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || manuscript.id || 'manuscript';
}

function escapeHtml(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escapeAttribute(value: string): string { return escapeHtml(value); }
function xml(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function cssString(value: string): string { return `'${value.replace(/'/g, "\\'")}'`; }
