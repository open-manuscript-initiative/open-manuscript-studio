import {
  defaultCustomPageLayout,
  type CustomExportPageNumbering,
  type CustomExportRunningContent,
  type CustomExportTemplate,
  type CustomExportTypography,
} from '../model/customExport';
import { textZipEntry, type StoreZipEntry } from './simpleZip';

export interface RunningTokenContext {
  title: string;
  subtitle?: string;
  authors: string;
}

export interface DocxPageLayoutParts {
  sectionProperties: string;
  relationships: string;
  contentTypeOverrides: string;
  entries: StoreZipEntry[];
}

export function buildDocxPageLayoutParts(
  template: CustomExportTemplate,
  context: RunningTokenContext,
): DocxPageLayoutParts {
  const layout = template.pageLayout ?? defaultCustomPageLayout();
  const headerNeeded = layout.header.enabled || (layout.pageNumbering.enabled && layout.pageNumbering.area === 'header');
  const footerNeeded = layout.footer.enabled || (layout.pageNumbering.enabled && layout.pageNumbering.area === 'footer');
  const entries: StoreZipEntry[] = [];
  const relationships: string[] = [];
  const refs: string[] = [];
  const overrides: string[] = [];

  if (headerNeeded) {
    entries.push(textZipEntry('word/header1.xml', runningPartXml('hdr', layout.header, layout.pageNumbering, 'header', context)));
    relationships.push('<Relationship Id="rIdCustomHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>');
    refs.push('<w:headerReference w:type="default" r:id="rIdCustomHeader"/>');
    overrides.push('<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>');
  }
  if (footerNeeded) {
    entries.push(textZipEntry('word/footer1.xml', runningPartXml('ftr', layout.footer, layout.pageNumbering, 'footer', context)));
    relationships.push('<Relationship Id="rIdCustomFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>');
    refs.push('<w:footerReference w:type="default" r:id="rIdCustomFooter"/>');
    overrides.push('<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
  }

  return {
    sectionProperties: `${refs.join('')}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>`,
    relationships: relationships.join(''),
    contentTypeOverrides: overrides.join(''),
    entries,
  };
}

export function buildPdfPagedMediaCss(
  template: CustomExportTemplate,
  context: RunningTokenContext,
): string {
  const layout = template.pageLayout ?? defaultCustomPageLayout();
  const headerLeft = layout.header.enabled ? renderRunningText(layout.header.left, context) : '';
  const headerRight = layout.header.enabled ? renderRunningText(layout.header.right, context) : '';
  const footerLeft = layout.footer.enabled ? renderRunningText(layout.footer.left, context) : '';
  const footerRight = layout.footer.enabled ? renderRunningText(layout.footer.right, context) : '';
  const number = layout.pageNumbering;

  const slots: Record<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right', { content: string; typography: CustomExportTypography }> = {
    'top-left': { content: headerLeft, typography: layout.header.typography },
    'top-center': { content: '', typography: number.typography },
    'top-right': { content: headerRight, typography: layout.header.typography },
    'bottom-left': { content: footerLeft, typography: layout.footer.typography },
    'bottom-center': { content: '', typography: number.typography },
    'bottom-right': { content: footerRight, typography: layout.footer.typography },
  };

  if (number.enabled) {
    const key = `${number.area === 'header' ? 'top' : 'bottom'}-${number.alignment}` as keyof typeof slots;
    const pageExpression = number.startOnPage <= 1
      ? `counter(page, decimal)`
      : `counter(page, decimal)`;
    slots[key] = {
      ...slots[key],
      content: slots[key].content ? `${slots[key].content} · __OMI_PAGE__` : '__OMI_PAGE__',
      typography: number.typography,
    };
    const offset = number.startAt - number.startOnPage;
    return `@page{size:A4;margin:20mm 18mm 22mm;counter-increment:page;${Object.entries(slots).map(([slot, value]) => `@${slot}{content:${cssContent(value.content).replace('"__OMI_PAGE__"', pageExpression)};${marginTypography(value.typography)}}`).join('')}}html{counter-reset:page ${offset};}`;
  }

  return `@page{size:A4;margin:20mm 18mm 22mm;${Object.entries(slots).map(([slot, value]) => `@${slot}{content:${cssContent(value.content)};${marginTypography(value.typography)}}`).join('')}}`;
}

export function renderRunningText(template: string, context: RunningTokenContext): string {
  return template.replace(/\{(title|subtitle|author)\}/g, (_match, key: string) => {
    if (key === 'title') return context.title;
    if (key === 'subtitle') return context.subtitle ?? '';
    return context.authors;
  }).replace(/[ \t]+/g, ' ').trim();
}

function runningPartXml(
  root: 'hdr' | 'ftr',
  running: CustomExportRunningContent,
  numbering: CustomExportPageNumbering,
  area: 'header' | 'footer',
  context: RunningTokenContext,
): string {
  const cells: Array<{ alignment: 'left' | 'center' | 'right'; text: string; page: boolean }> = [
    { alignment: 'left', text: running.enabled ? renderRunningText(running.left, context) : '', page: numbering.enabled && numbering.area === area && numbering.alignment === 'left' },
    { alignment: 'center', text: '', page: numbering.enabled && numbering.area === area && numbering.alignment === 'center' },
    { alignment: 'right', text: running.enabled ? renderRunningText(running.right, context) : '', page: numbering.enabled && numbering.area === area && numbering.alignment === 'right' },
  ];
  const row = cells.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="33" w:type="pct"/></w:tcPr><w:p><w:pPr><w:jc w:val="${cell.alignment}"/></w:pPr>${cell.text ? wordRun(cell.text, running.typography) : ''}${cell.text && cell.page ? wordRun(' · ', numbering.typography) : ''}${cell.page ? conditionalPageField(numbering) : ''}</w:p></w:tc>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${root} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3120"/><w:gridCol w:w="3120"/><w:gridCol w:w="3120"/></w:tblGrid><w:tr>${row}</w:tr></w:tbl></w:${root}>`;
}

function conditionalPageField(numbering: CustomExportPageNumbering): string {
  const startOn = Math.max(1, Math.trunc(numbering.startOnPage));
  const startAt = Math.max(0, Math.trunc(numbering.startAt));
  const typography = runProperties(numbering.typography);
  if (startOn === 1 && startAt === 1) return `<w:fldSimple w:instr=" PAGE "><w:r>${typography}<w:t>1</w:t></w:r></w:fldSimple>`;
  const formula = startOn === 1 ? `= PAGE + ${startAt - 1}` : `IF PAGE &gt;= ${startOn} "= PAGE - ${startOn} + ${startAt}" ""`;
  return `<w:fldSimple w:instr=" ${formula} "><w:r>${typography}<w:t>${startOn === 1 ? startAt : ''}</w:t></w:r></w:fldSimple>`;
}

function wordRun(value: string, typography: CustomExportTypography): string {
  return `<w:r>${runProperties(typography)}<w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
}

function runProperties(typography: CustomExportTypography): string {
  const halfPoints = Math.max(2, Math.round(typography.fontSizePt * 2));
  return `<w:rPr><w:rFonts w:ascii="${xml(typography.fontFamily)}" w:hAnsi="${xml(typography.fontFamily)}"/>${typography.bold ? '<w:b/>' : ''}${typography.italic ? '<w:i/>' : ''}<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/></w:rPr>`;
}

function marginTypography(value: CustomExportTypography): string {
  return `font-family:${cssString(value.fontFamily)};font-size:${value.fontSizePt}pt;font-weight:${value.bold ? '700' : '400'};font-style:${value.italic ? 'italic' : 'normal'};`;
}

function cssContent(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}
function cssString(value: string): string { return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`; }
function xml(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
