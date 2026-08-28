import { renderBibliography } from '../model/cslRendering';
import {
  defaultCustomCitationStyle,
  resolveLocalizedAbstract,
  resolveLocalizedKeywords,
  type CustomExportBlock,
  type CustomExportCitationOccurrenceRule,
  type CustomExportTemplate,
  type CustomExportTypography,
} from '../model/customExport';
import { extractOmiInlineRuns } from '../model/inlineSemantics';
import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type {
  OmiBibliographicRecord,
  OmiBlock,
  OmiCitation,
  OmiManuscript,
} from '../types/omi';
import { createStoreZip, textZipEntry } from './simpleZip';

export interface CustomExportResult {
  blob: Blob;
  fileName: string;
}

interface CitationRenderState {
  seenTargets: Set<string>;
}

interface InlineExportSegment {
  text: string;
  typography?: CustomExportTypography;
  citation?: boolean;
}

interface StoredInlineNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: StoredInlineNode[];
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
  const citationState: CitationRenderState = { seenTargets: new Set() };
  const body = enabledBlocks(template).flatMap((block) =>
    renderWordBlock(manuscript, context, template, block, citationState),
  );
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
  const citationState: CitationRenderState = { seenTargets: new Set() };
  const body = enabledBlocks(template)
    .map((block) => renderHtmlBlock(manuscript, context, template, block, citationState))
    .join('\n');
  return `<!doctype html><html lang="${escapeAttribute(manuscript.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manuscript.title)}</title><style>html{background:#fff;color:#111}body{max-width:760px;margin:40px auto;padding:0 28px}.omi-custom-block{box-sizing:border-box}.omi-custom-body h1,.omi-custom-body h2,.omi-custom-body h3,.omi-custom-body h4,.omi-custom-body h5,.omi-custom-body h6{font-family:inherit}.omi-custom-body p{margin-top:0}.omi-custom-citation{white-space:pre-wrap}.omi-custom-bibliography p,.omi-custom-notes p{padding-left:1.5em;text-indent:-1.5em}@media print{body{max-width:none;margin:0;padding:0}${print ? '' : ''}}</style></head><body>${body}</body></html>`;
}

function renderHtmlBlock(
  manuscript: OmiManuscript,
  context: ReturnType<typeof buildPublicationRenderingContext>,
  template: CustomExportTemplate,
  block: CustomExportBlock,
  citationState: CitationRenderState,
): string {
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
    case 'body': return wrap(renderHtmlSections(context.sections, manuscript, template, block.typography, citationState), 'omi-custom-body');
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

function renderHtmlSections(
  sections: ReturnType<typeof buildPublicationRenderingContext>['sections'],
  manuscript: OmiManuscript,
  template: CustomExportTemplate,
  typography: CustomExportTypography,
  citationState: CitationRenderState,
): string {
  return sections.map((section) => {
    const level = Math.min(6, section.depth + 1);
    const title = section.number ? `${section.number} ${section.title}` : section.title;
    const blocks = section.blocks.map((block) =>
      renderHtmlBodyBlock(block, manuscript, template, typography, citationState),
    ).join('');
    return `<h${level}>${escapeHtml(title)}</h${level}>${blocks}${renderHtmlSections(section.children, manuscript, template, typography, citationState)}`;
  }).join('');
}

function renderHtmlBodyBlock(
  block: OmiBlock,
  manuscript: OmiManuscript,
  template: CustomExportTemplate,
  bodyTypography: CustomExportTypography,
  citationState: CitationRenderState,
): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    return `<p>[${escapeHtml(block.visual.kind)}${caption ? `: ${escapeHtml(caption)}` : ''}]</p>`;
  }
  const segments = customCitationSegments(block.content, manuscript, template, citationState);
  if (!segments.length) return '';
  const inner = segments.map((segment) => {
    const text = escapeHtml(segment.text).replace(/\n/g, '<br>');
    if (!segment.citation || !segment.typography) return text;
    return `<span class="omi-custom-citation" style="${htmlInlineTypography(segment.typography, bodyTypography)}">${text}</span>`;
  }).join('');
  return block.type === 'quote' ? `<blockquote>${inner}</blockquote>` : `<p>${inner}</p>`;
}

function renderWordBlock(
  manuscript: OmiManuscript,
  context: ReturnType<typeof buildPublicationRenderingContext>,
  template: CustomExportTemplate,
  block: CustomExportBlock,
  citationState: CitationRenderState,
): string[] {
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
    case 'body': return renderWordSections(context.sections, manuscript, template, block.typography, citationState);
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

function renderWordSections(
  sections: ReturnType<typeof buildPublicationRenderingContext>['sections'],
  manuscript: OmiManuscript,
  template: CustomExportTemplate,
  typography: CustomExportTypography,
  citationState: CitationRenderState,
): string[] {
  const result: string[] = [];
  for (const section of sections) {
    const title = section.number ? `${section.number} ${section.title}` : section.title;
    result.push(wordParagraph(title, { ...typography, bold: true, fontSizePt: Math.max(typography.fontSizePt, 12 + Math.max(0, 3 - section.depth)) }));
    for (const block of section.blocks) {
      if (block.visual) {
        const value = blockPlainText(block);
        if (value) result.push(wordParagraph(value, typography));
        continue;
      }
      const segments = customCitationSegments(block.content, manuscript, template, citationState);
      if (segments.length) result.push(wordRichParagraph(segments, typography));
    }
    result.push(...renderWordSections(section.children, manuscript, template, typography, citationState));
  }
  return result;
}

function customCitationSegments(
  content: string,
  manuscript: OmiManuscript,
  template: CustomExportTemplate,
  citationState: CitationRenderState,
): InlineExportSegment[] {
  const style = template.citationStyle ?? defaultCustomCitationStyle();
  if (!style.enabled) {
    const text = plainStoredContent(content);
    return text ? [{ text }] : [];
  }

  let root: StoredInlineNode;
  try {
    root = JSON.parse(content) as StoredInlineNode;
  } catch {
    return content.trim() ? [{ text: content }] : [];
  }

  const result: InlineExportSegment[] = [];
  walkInline(root, result, manuscript, style, citationState);
  return coalesceExportSegments(result);
}

function walkInline(
  node: StoredInlineNode,
  result: InlineExportSegment[],
  manuscript: OmiManuscript,
  style: NonNullable<CustomExportTemplate['citationStyle']>,
  citationState: CitationRenderState,
): void {
  if (typeof node.text === 'string') {
    result.push({ text: node.text });
    return;
  }
  if (node.type === 'hardBreak') {
    result.push({ text: '\n' });
    return;
  }
  if (node.type === 'omiCitation') {
    const fallback = typeof node.attrs?.label === 'string' ? node.attrs.label : '[citation]';
    const ids = citationIdsFromNode(node);
    if (!ids.length) {
      result.push({ text: fallback });
      return;
    }
    ids.forEach((id, index) => {
      const citation = manuscript.citations.find((item) => item.id === id);
      const record = citation
        ? (manuscript.bibliographicRecords ?? []).find((item) => item.id === citation.target)
        : undefined;
      if (!citation || !record) {
        result.push({ text: fallback });
        return;
      }
      const first = !citationState.seenTargets.has(citation.target);
      citationState.seenTargets.add(citation.target);
      const rule = first ? style.first : style.subsequent;
      result.push({
        text: formatCitationOccurrence(rule, citation, record, fallback),
        typography: rule.typography,
        citation: true,
      });
      if (index < ids.length - 1) result.push({ text: '; ' });
    });
    return;
  }
  if (node.type === 'omiCrossReference' || node.type === 'omiNote') {
    const label = node.attrs?.label;
    if (typeof label === 'string' && label) result.push({ text: label });
    return;
  }
  for (const child of node.content ?? []) {
    walkInline(child, result, manuscript, style, citationState);
  }
  if (
    (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'codeBlock') &&
    result.length > 0 && result.at(-1)?.text !== '\n'
  ) {
    result.push({ text: '\n' });
  }
}

function citationIdsFromNode(node: StoredInlineNode): string[] {
  const values = node.attrs?.citationIds;
  if (Array.isArray(values)) {
    return values.filter((value): value is string => typeof value === 'string' && Boolean(value));
  }
  const id = node.attrs?.citationId;
  return typeof id === 'string' && id ? [id] : [];
}

export function formatCitationOccurrence(
  rule: Pick<CustomExportCitationOccurrenceRule, 'content'>,
  citation: OmiCitation,
  record: OmiBibliographicRecord,
  fallbackCitation: string,
): string {
  const values: Record<string, string> = {
    citation: fallbackCitation,
    author: bibliographicAuthors(record),
    title: record.title.trim(),
    shortTitle: shortTitle(record.title),
    year: publicationYear(record.issued),
    container: record.containerTitle?.trim() ?? '',
    place: record.place?.trim() ?? '',
    publisher: record.publisher?.trim() ?? '',
    volume: record.volume?.trim() ?? '',
    issue: record.issue?.trim() ?? '',
    pages: record.pages?.trim() ?? '',
    locator: citation.locator?.value?.trim() ?? '',
    doi: identifier(record, 'doi'),
    url: record.url?.trim() ?? '',
  };
  return rule.content.replace(/\{(citation|author|title|shortTitle|year|container|place|publisher|volume|issue|pages|locator|doi|url)\}/g, (_match, key: string) => values[key] ?? '').replace(/[ \t]+/g, ' ').trim();
}

function bibliographicAuthors(record: OmiBibliographicRecord): string {
  return record.contributors
    .filter((item) => item.role === 'author')
    .map((item) => item.literalName?.trim() || [item.givenName, item.familyName].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(', ');
}

function publicationYear(value: string | undefined): string {
  return value?.match(/\b\d{4}\b/)?.[0] ?? value?.trim() ?? '';
}

function identifier(record: OmiBibliographicRecord, scheme: string): string {
  return record.identifiers.find((item) => item.scheme.toLowerCase() === scheme)?.value?.trim() ?? '';
}

function shortTitle(value: string): string {
  const title = value.trim();
  if (title.length <= 60) return title;
  const prefix = title.slice(0, 57).replace(/\s+\S*$/, '').trim();
  return `${prefix || title.slice(0, 57)}…`;
}

function coalesceExportSegments(segments: readonly InlineExportSegment[]): InlineExportSegment[] {
  const result: InlineExportSegment[] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const previous = result.at(-1);
    if (
      previous &&
      !previous.citation &&
      !segment.citation &&
      previous.typography === undefined &&
      segment.typography === undefined
    ) {
      previous.text += segment.text;
    } else {
      result.push({ ...segment });
    }
  }
  while (result.at(-1)?.text === '\n') result.pop();
  return result;
}

function plainStoredContent(content: string): string {
  const runs = extractOmiInlineRuns(content);
  return runs.length
    ? runs.map((run) => run.text).join('').replace(/\s+/g, ' ').trim()
    : content.trim();
}

function wordParagraph(value: string, typography: CustomExportTypography): string {
  return wordRichParagraph([{ text: value }], typography);
}

function wordRichParagraph(segments: readonly InlineExportSegment[], paragraphTypography: CustomExportTypography): string {
  const before = Math.max(0, Math.round((paragraphTypography.spaceBeforePt ?? 0) * 20));
  const after = Math.max(0, Math.round((paragraphTypography.spaceAfterPt ?? 0) * 20));
  const line = Math.max(120, Math.round((paragraphTypography.lineHeight ?? 1.15) * 240));
  const align = paragraphTypography.alignment === 'justify' ? 'both' : paragraphTypography.alignment ?? 'left';
  const runs = segments.map((segment) => wordRun(segment.text, segment.typography ?? paragraphTypography)).join('');
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/></w:pPr>${runs}</w:p>`;
}

function wordRun(value: string, typography: CustomExportTypography): string {
  const halfPoints = Math.max(2, Math.round(typography.fontSizePt * 2));
  const rPr = `<w:rPr><w:rFonts w:ascii="${xml(typography.fontFamily)}" w:hAnsi="${xml(typography.fontFamily)}"/>${typography.bold ? '<w:b/>' : ''}${typography.italic ? '<w:i/>' : ''}<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/></w:rPr>`;
  const parts = value.split('\n');
  return parts.map((part, index) => `${index > 0 ? `<w:r>${rPr}<w:br/></w:r>` : ''}<w:r>${rPr}<w:t xml:space="preserve">${xml(part)}</w:t></w:r>`).join('');
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

function htmlInlineTypography(value: CustomExportTypography, fallback: CustomExportTypography): string {
  return [
    `font-family:${cssString(value.fontFamily || fallback.fontFamily)}`,
    `font-size:${value.fontSizePt || fallback.fontSizePt}pt`,
    `font-weight:${value.bold ? '700' : '400'}`,
    `font-style:${value.italic ? 'italic' : 'normal'}`,
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
  return plainStoredContent(block.content);
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
function cssString(value: string): string { return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`; }
