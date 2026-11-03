import { framePageStyle, framePageStyles, frameGraphicContentStyle, frameGraphicInnerStyle, frameRunningHeader } from '../model/publicationFramePages';
import { TABLE_LAYOUT_CSS } from './tableLayoutCss';
import {
  flowFrameStories, frameDisplayText, frameStyle, validateFrameLayout, MM_PER_POINT,
  type FrameTextMeasure, type FrameTextStyle, type PublicationFrame, type PublicationFrameFlow, type PublicationFrameLayout,
} from '../model/publicationFrames';
import { cssStringLiteral } from './embeddedCss';
import { buildPdfArtifactDocument } from './exportPdf';
import type { OmiManuscript } from '../types/omi';

export function createFrameTextMeasure(): FrameTextMeasure {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Text measurement is unavailable.');
  return (text, style) => {
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSizePt * 96 / 72}px ${cssStringLiteral(style.fontFamily)}, serif`;
    return context.measureText(text).width * 25.4 / 96;
  };
}
export function frameClipPath(frame: PublicationFrame): string {
  return frame.shape === 'ellipse' ? 'ellipse(50% 50% at 50% 50%)' : frame.shape === 'polygon'
    ? `polygon(evenodd, ${frame.points.map((point) => `${point.x}% ${point.y}%`).join(', ')})` : 'none';
}
export function frameTypography(style: FrameTextStyle) {
  return { fontFamily: `${cssStringLiteral(style.fontFamily)}, serif`, fontSize: `${style.fontSizePt}pt`,
    lineHeight: `${style.lineHeightPt}pt`, fontWeight: style.fontWeight, fontStyle: style.fontStyle, color: style.color };
}
export function frameShapeSvg(frame: PublicationFrame, style: FrameTextStyle): string {
  const attrs = `fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidthMm}"`;
  const shape = frame.shape === 'ellipse' ? `<ellipse cx="${frame.widthMm / 2}" cy="${frame.heightMm / 2}" rx="${frame.widthMm / 2}" ry="${frame.heightMm / 2}" ${attrs}/>`
    : `<polygon points="${(frame.shape === 'rectangle' ? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] : frame.points).map((p) => `${p.x * frame.widthMm / 100},${p.y * frame.heightMm / 100}`).join(' ')}" fill-rule="evenodd" ${attrs}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="omi-frame-outline" viewBox="0 0 ${frame.widthMm} ${frame.heightMm}" preserveAspectRatio="none" aria-hidden="true">${shape}</svg>`;
}
export function renderFrameDocument(layout: PublicationFrameLayout, flow: PublicationFrameFlow, graphics: ReadonlyMap<string, string>, title: string, language = 'en'): string {
  validateFrameLayout(layout);
  const current = flow.frames;
  if (flow.overflow.length || layout.frames.some((frame) => frame.kind === 'graphic' && !graphics.has(frame.sourceBlockId!))) {
    throw new Error('Resolve text overflow and missing graphic sources before exporting.');
  }
  const pageStyles = framePageStyles(layout);
  const pageRules = pageStyles.map((style, index) => `@page omi_frame_style_${index}{size:${style.widthMm}mm ${style.heightMm}mm;margin:0}`).join('\n');
  const pages = Array.from({ length: layout.page.count }, (_, page) => {
    const pageStyle = framePageStyle(layout, page), styleIndex = pageStyles.findIndex((style) => style.id === pageStyle.id);
    const header = frameRunningHeader(layout, page, title), headerStyle = pageStyle.runningHeader;
    const runningHeader = header ? `<header class="omi-frame-running-header" style="top:${headerStyle.topMm}mm;height:${headerStyle.heightMm}mm;left:${pageStyle.margins.left}mm;right:${pageStyle.margins.right}mm;font-size:${headerStyle.fontSizePt}pt;font-family:${escape(cssStringLiteral(headerStyle.fontFamily))};color:${headerStyle.color}"><span>${escape(header.left)}</span><span>${escape(header.center)}</span><span>${escape(header.right)}</span></header>` : '';
    return `<section class="omi-frame-page" aria-label="${page + 1}" data-page-style="${escape(pageStyle.id)}" style="page:omi_frame_style_${styleIndex};width:${pageStyle.widthMm}mm;height:${pageStyle.heightMm}mm;background:${pageStyle.background}">${runningHeader}${layout.frames.filter((frame) => frame.page === page).map((frame) => {
    const style = frameStyle(layout, frame);
    const typography = Object.entries(frameTypography(style)).map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`).join(';');
    const content = frame.kind === 'text' ? (current.find((item) => item.frameId === frame.id)?.lines ?? []).map((line) =>
      `<div class="omi-frame-line" style="left:${line.x}mm;top:${line.y}mm;width:${line.width}mm;height:${style.lineHeightPt * MM_PER_POINT}mm">${escape(frameDisplayText(line.text)).replace(/\r\n?|\n/g, '&#10;')}</div>`,
    ).join('') : `<div class="omi-frame-graphic" style="clip-path:${frameClipPath(frame)}"><div class="omi-frame-graphic-position" style="${escape(inlineStyle(frameGraphicContentStyle(frame)))}"><div class="omi-frame-graphic-inner" style="${escape(inlineStyle(frameGraphicInnerStyle(frame)))}">${graphics.get(frame.sourceBlockId!)}</div></div></div>`;
    return `<div class="omi-publication-frame" data-frame-id="${escape(frame.id)}" style="left:${frame.xMm}mm;top:${frame.yMm}mm;width:${frame.widthMm}mm;height:${frame.heightMm}mm;transform:rotate(${frame.rotation}deg);${escape(typography)}">${frameShapeSvg(frame, style)}${content}</div>`;
  }).join('')}</section>`;
  }).join('');
  return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>
@page{size:${layout.page.widthMm}mm ${layout.page.heightMm}mm;margin:0}${pageRules}html,body{margin:0;padding:0;background:#eee}
.omi-frame-page{box-sizing:border-box;position:relative;width:${layout.page.widthMm}mm;height:${layout.page.heightMm}mm;background:white;margin:8mm auto;overflow:hidden;break-after:page;page-break-after:always}
.omi-frame-running-header{position:absolute;z-index:10;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm;line-height:1.15;overflow:hidden;white-space:pre-wrap}.omi-frame-running-header span:nth-child(2){text-align:center}.omi-frame-running-header span:last-child{text-align:right}
.omi-frame-page{print-color-adjust:exact;-webkit-print-color-adjust:exact}
.omi-frame-page:last-child{break-after:auto;page-break-after:auto}.omi-publication-frame{position:absolute;transform-origin:center;overflow:visible}
.omi-frame-outline{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.omi-frame-line{position:absolute;white-space:pre;overflow:visible;text-indent:0;letter-spacing:normal;hyphens:none;margin:0;padding:0}
.omi-frame-graphic{position:absolute;inset:0;overflow:hidden}.omi-frame-graphic figure{margin:0;width:100%;height:100%}.omi-frame-graphic img,.omi-frame-graphic svg{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain}
.omi-frame-graphic figcaption{font-size:9pt}.omi-frame-graphic table{width:100%;table-layout:fixed;border-collapse:collapse}.omi-frame-graphic td,.omi-frame-graphic th{border:1px solid #999;overflow-wrap:anywhere;white-space:pre-wrap}
${TABLE_LAYOUT_CSS}
.omi-frame-graphic td,.omi-frame-graphic th{padding:.48rem .55rem}
@media print{html,body{background:white}.omi-frame-page{margin:0}}
</style></head><body>${pages}</body></html>`;
}

/** Preserve the visual editor's vector chart rather than its semantic data-table fallback. */
export function captureFrameGraphicSnapshots(root: HTMLElement, layout: PublicationFrameLayout): Map<string, string> {
  const snapshots = new Map<string, string>();
  for (const node of root.querySelectorAll<HTMLElement>('[data-frame-id]')) {
    const frame = layout.frames.find((item) => item.id === node.dataset.frameId);
    const svg = node.querySelector<SVGSVGElement>('.omi-chart-svg');
    if (!frame?.sourceBlockId || !svg) continue;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const originals = [svg, ...svg.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((original, index) => {
      const style = getComputedStyle(original);
      const copy = copies[index] as SVGElement;
      for (const property of ['fill', 'stroke', 'stroke-width', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor']) copy.style.setProperty(property, style.getPropertyValue(property));
    });
    snapshots.set(frame.sourceBlockId, `<figure>${clone.outerHTML}</figure>`);
  }
  return snapshots;
}

export async function buildFrameExport(manuscript: OmiManuscript, layout: PublicationFrameLayout, snapshots: ReadonlyMap<string, string> = new Map()): Promise<string> {
  await document.fonts.ready;
  const flow = flowFrameStories(layout, createFrameTextMeasure());
  const graphics = new Map<string, string>();
  if (layout.frames.some((frame) => frame.kind === 'graphic')) {
    // Reuse the existing integrity-checked, self-contained asset pipeline.
    const source = new DOMParser().parseFromString(await buildPdfArtifactDocument(manuscript), 'text/html');
    for (const node of source.querySelectorAll<HTMLElement>('figure[data-omi-block-id]')) graphics.set(node.dataset.omiBlockId!, node.outerHTML);
  }
  for (const [id, html] of snapshots) graphics.set(id, html);
  return renderFrameDocument(layout, flow, graphics, manuscript.title, manuscript.locale);
}
function escape(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function inlineStyle(style: object): string { return Object.entries(style).map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`).join(';'); }
