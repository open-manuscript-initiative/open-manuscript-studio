import publisherJson from '../document/publicationStyles/egyhaztorteneti-szemle.publisher.json';
import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { assetPath } from '../model/assets';
import {
  applyPublicationCorrectionsToStoredContent,
  applyTextPublicationCorrections,
} from '../model/proofing';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import type {
  OmiBlock,
  OmiManuscript,
  OmiPublicationCorrection,
} from '../types/omi';
import { getAssetPayload } from './assetRepository';
import { cssStringLiteral } from './embeddedCss';
import { renderPublisherHtmlArticle } from './exportPublisherHtmlPackage';
import { hyphenatePrintHtml } from './printHyphenation';
import {
  normalizePublicationParagraphStyleCollection,
  resolvePublicationParagraphStyle as resolveParagraphStyle,
  type PublicationParagraphStyleCollection,
  type ResolvedPublicationParagraphStyle,
} from '../model/publicationParagraphStyles';

type PublicationStyleTemplate = typeof templateJson;
export type PublicationStyle = Omit<PublicationStyleTemplate, 'paragraphStyles'> & {
  paragraphStyles: PublicationParagraphStyleCollection;
};
export type PublicationPublisherIdentity = typeof publisherJson;
export type PublicationStyleTarget = 'html' | 'print';

export const PUBLICATION_STYLE_STORAGE_KEY = 'omi:publication-style:egyhaztorteneti-szemle';
export const PUBLICATION_PUBLISHER_STORAGE_KEY = 'omi:publication-publisher:egyhaztorteneti-szemle';

export function clonePublicationStyleTemplate(): PublicationStyle {
  return JSON.parse(JSON.stringify(templateJson)) as PublicationStyle;
}

export function clonePublicationPublisherTemplate(): PublicationPublisherIdentity {
  return JSON.parse(JSON.stringify(publisherJson)) as PublicationPublisherIdentity;
}

export function loadPublicationStyle(): PublicationStyle {
  try {
    const saved = window.localStorage.getItem(PUBLICATION_STYLE_STORAGE_KEY);
    return saved
      ? normalizePublicationStyle(JSON.parse(saved) as PublicationStyle)
      : clonePublicationStyleTemplate();
  } catch {
    return clonePublicationStyleTemplate();
  }
}

/** Adds newly introduced print-page and typography fields to saved styles. */
export function normalizePublicationStyle(style: PublicationStyle): PublicationStyle {
  const fallback = clonePublicationStyleTemplate();
  return {
    ...fallback,
    ...style,
    page: {
      ...fallback.page,
      ...style.page,
      margins: {
        ...fallback.page.margins,
        ...style.page?.margins,
      },
    },
    styles: {
      ...fallback.styles,
      ...style.styles,
      body: {
        ...fallback.styles.body,
        ...style.styles?.body,
      },
    },
    paragraphStyles: normalizePublicationParagraphStyleCollection(
      style.paragraphStyles,
      fallback.paragraphStyles,
    ),
  };
}

export function publicationParagraphStyleDefaults(
  style: PublicationStyle,
): ResolvedPublicationParagraphStyle {
  const body = style.styles.body;
  return {
    fontFamily: style.fonts.body.family,
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    fontWeight: 400,
    fontStyle: 'normal',
    alignment: body.alignment as ResolvedPublicationParagraphStyle['alignment'],
    firstLineIndent: body.firstLineIndent,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: body.spaceBefore,
    spaceAfter: body.spaceAfter,
    hyphenation: body.hyphenation,
    keepTogether: false,
    keepWithNext: false,
    widows: 2,
    orphans: 2,
  };
}

export function resolvePublicationParagraphStyle(
  style: PublicationStyle,
  styleId?: string | null,
): ResolvedPublicationParagraphStyle {
  return resolveParagraphStyle(
    style.paragraphStyles,
    styleId,
    publicationParagraphStyleDefaults(style),
  );
}

export function loadPublicationPublisherIdentity(): PublicationPublisherIdentity {
  try {
    const saved = window.localStorage.getItem(PUBLICATION_PUBLISHER_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as PublicationPublisherIdentity) : clonePublicationPublisherTemplate();
  } catch {
    return clonePublicationPublisherTemplate();
  }
}

export function savePublicationStyle(style: PublicationStyle): void {
  window.localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
}

export function savePublicationPublisherIdentity(identity: PublicationPublisherIdentity): void {
  window.localStorage.setItem(PUBLICATION_PUBLISHER_STORAGE_KEY, JSON.stringify(identity));
}

export function resetPublicationStyle(): PublicationStyle {
  window.localStorage.removeItem(PUBLICATION_STYLE_STORAGE_KEY);
  return clonePublicationStyleTemplate();
}

export function resetPublicationPublisherIdentity(): PublicationPublisherIdentity {
  window.localStorage.removeItem(PUBLICATION_PUBLISHER_STORAGE_KEY);
  return clonePublicationPublisherTemplate();
}

export function buildPublicationStyleCss(
  style: PublicationStyle,
  target: PublicationStyleTarget,
): string {
  const body = style.styles.body;
  const title = style.styles.articleTitlePrimary;
  const subtitle = style.styles.articleSubtitlePrimary;
  const author = style.styles.author;
  const affiliation = style.styles.affiliation;
  const abstractHeading = style.styles.abstractHeading;
  const abstractBody = style.styles.abstractBody;
  const heading1 = style.styles.heading1;
  const heading2 = style.styles.heading2;
  const footnote = style.styles.footnote;
  const figureCaption = style.styles.figureCaption;
  const tableCaption = style.styles.tableCaption;
  const bibliography = style.styles.bibliography;
  const family = cssFontFamily(style.fonts.body.family, style.fonts.body.fallback);
  const noteFamily = cssFontFamily(style.fonts.note.family, style.fonts.note.fallback);
  const hyphenationEnabled = publicationHyphenationEnabled(style);
  const paragraphStyleRules = buildPublicationParagraphStyleRules(style, target);

  const shared = `
:root { --omi-publication-font: ${family}; }
html, body { margin: 0; padding: 0; }
body { font-family: var(--omi-publication-font); font-size: ${body.fontSize}pt; line-height: ${body.lineHeight}pt; }
.omi-scholarly-article { max-width: none; margin: 0 auto; }
.omi-publisher-branding { display: flex; justify-content: center; align-items: center; margin: 0 0 6mm; }
.omi-publisher-logo { display: block; height: auto; max-width: 100%; }
.omi-publisher-legal { margin-top: 8mm; padding-top: 2.5mm; border-top: .3pt solid currentColor; font-size: 8.5pt; line-height: 1.25; }
.omi-publisher-legal p { margin: 0 0 1mm; text-indent: 0; }
.omi-publisher-legal a { color: inherit; text-decoration: none; }
.article-front h1 { font-size: ${title.fontSize}pt; line-height: ${title.lineHeight}pt; font-weight: ${title.fontWeight}; text-align: ${title.alignment}; margin: 0 0 ${title.spaceAfter}pt; }
.article-front .article-subtitle, .article-front .subtitle { font-size: ${subtitle.fontSize}pt; line-height: ${subtitle.lineHeight}pt; text-align: ${subtitle.alignment}; margin: 0 0 ${subtitle.spaceAfter}pt; }
.article-front .contributor-name, .article-front .author { font-size: ${author.fontSize}pt; line-height: ${author.lineHeight}pt; font-weight: ${author.fontWeight}; text-align: ${author.alignment}; }
.article-front .affiliation { font-size: ${affiliation.fontSize}pt; line-height: ${affiliation.lineHeight}pt; text-align: ${affiliation.alignment}; margin-bottom: ${affiliation.spaceAfter}pt; }
.abstract h2, .abstract-title { font-size: ${abstractHeading.fontSize}pt; line-height: ${abstractHeading.lineHeight}pt; text-align: ${abstractHeading.alignment}; margin: ${abstractHeading.spaceBefore}pt 0 ${abstractHeading.spaceAfter}pt; }
.abstract p, .article-abstract p { font-size: ${abstractBody.fontSize}pt; line-height: ${abstractBody.lineHeight}pt; text-align: ${abstractBody.alignment}; text-indent: ${abstractBody.firstLineIndent}mm; }
.article-body p { font-size: ${body.fontSize}pt; line-height: ${body.lineHeight}pt; text-align: ${body.alignment}; text-indent: ${body.firstLineIndent}mm; margin: ${body.spaceBefore}pt 0 ${body.spaceAfter}pt; }
.article-body h2 { font-size: ${heading1.fontSize}pt; line-height: ${heading1.lineHeight}pt; font-weight: ${heading1.fontWeight}; text-align: ${heading1.alignment}; margin: ${heading1.spaceBefore}pt 0 ${heading1.spaceAfter}pt; }
.article-body h3 { font-size: ${heading2.fontSize}pt; line-height: ${heading2.lineHeight}pt; font-weight: ${heading2.fontWeight}; text-align: ${heading2.alignment}; margin: ${heading2.spaceBefore}pt 0 ${heading2.spaceAfter}pt; }
figure { margin-left: 0; margin-right: 0; }
figcaption { font-size: ${figureCaption.fontSize}pt; line-height: ${figureCaption.lineHeight}pt; text-align: ${figureCaption.alignment}; margin: ${figureCaption.spaceBefore}pt 0 ${figureCaption.spaceAfter}pt; }
table caption { font-size: ${tableCaption.fontSize}pt; line-height: ${tableCaption.lineHeight}pt; text-align: ${tableCaption.alignment}; margin: ${tableCaption.spaceBefore}pt 0 ${tableCaption.spaceAfter}pt; }
.article-notes, .footnotes, [role="doc-endnotes"] { font-family: ${noteFamily}; font-size: ${footnote.fontSize}pt; line-height: ${footnote.lineHeight}pt; }
.bibliography p, .references li { font-size: ${bibliography.fontSize}pt; line-height: ${bibliography.lineHeight}pt; text-align: ${bibliography.alignment}; padding-left: ${bibliography.hangingIndent}mm; text-indent: -${bibliography.hangingIndent}mm; }
img, svg, table { max-width: 100%; }
${paragraphStyleRules}
`;

  if (target === 'html') {
    return `${shared}
${publicationHyphenationCss(false)}
body { padding: 2rem max(1rem, calc((100vw - 56rem) / 2)); }
.omi-print-running-header, .omi-print-page-number { display: none !important; }
*, *::before, *::after { break-before: auto !important; break-after: auto !important; page-break-before: auto !important; page-break-after: auto !important; }
.omi-scholarly-article, section, figure, table, .article-notes { break-inside: auto; page-break-inside: auto; }
@media print { ${publicationHyphenationCss(hyphenationEnabled)} }
`;
  }

  const margins = style.page.margins;
  const pageWidth = positive(style.page.width, 150);
  const pageHeight = positive(style.page.height, 240);
  const topMargin = nonNegative(margins.top, 18);
  const bottomMargin = nonNegative(margins.bottom, 18);
  const gutter = nonNegative(style.page.gutter, 0);
  const bleed = nonNegative(style.page.bleed, 0);
  const innerMargin = nonNegative(margins.inner, 0) + gutter;
  const outerMargin = nonNegative(margins.outer, 0);
  const pageNumberStart = Math.max(0, Math.trunc(style.page.pageNumberStart ?? 1));
  const cropMarks = style.page.cropMarks ?? false;
  const mirroredPageRules = style.page.mirroredMargins
    ? `
@page:left { margin-left: ${outerMargin}mm; margin-right: ${innerMargin}mm; }
@page:right { margin-left: ${innerMargin}mm; margin-right: ${outerMargin}mm; }`
    : '';
  const printMarks = [
    bleed > 0 ? `bleed: ${bleed}mm;` : '',
    cropMarks ? 'marks: crop;' : '',
  ].filter(Boolean).join(' ');
  const separator = style.footnotes.separator;
  return `${shared}
${publicationHyphenationCss(hyphenationEnabled)}
@page {
  size: ${pageWidth}mm ${pageHeight}mm;
  margin: ${topMargin}mm ${outerMargin}mm ${bottomMargin}mm ${innerMargin}mm;
  ${printMarks}
}
${mirroredPageRules}
html, body { width: auto; min-height: 0; }
body { padding: 0; counter-reset: page ${Math.max(0, pageNumberStart - 1)}; }
.omi-scholarly-article { width: auto; }
.article-body h2, .article-body h3 { break-after: avoid-page; page-break-after: avoid; }
figure, table { break-inside: avoid-page; page-break-inside: avoid; }
.article-notes, .footnotes { border-top: ${separator.enabled ? `${separator.width}pt solid currentColor` : '0'}; padding-top: 2mm; }
.omi-print-running-header { display: flex; position: fixed; top: -${Math.max(4, topMargin - 5)}mm; left: 0; right: 0; align-items: center; justify-content: space-between; gap: 8mm; font-family: ${family}; font-size: ${style.runningHeaders.fontSize}pt; border-bottom: ${style.runningHeaders.rule.enabled ? `${style.runningHeaders.rule.width}pt solid currentColor` : '0'}; padding-bottom: 1.5mm; }
.omi-print-page-number::after { content: counter(page); }
@media screen { body { background: #e9e9e9; } .omi-scholarly-article { box-sizing: border-box; width: ${pageWidth}mm; min-height: ${pageHeight}mm; margin: 12mm auto; padding: ${topMargin}mm ${outerMargin}mm ${bottomMargin}mm ${innerMargin}mm; background: white; box-shadow: 0 2mm 7mm rgba(0,0,0,.18); } .omi-print-running-header { display: none; } }
@media print { .omi-print-running-header { display: flex; } }
`;
}

export function buildPublicationParagraphStyleRules(
  style: PublicationStyle,
  target: PublicationStyleTarget,
): string {
  return style.paragraphStyles.items.map((definition) => {
    const resolved = resolvePublicationParagraphStyle(style, definition.id);
    const selectorValue = cssStringLiteral(definition.id);
    const containerSelector = `.article-body [data-omi-paragraph-style-id=${selectorValue}]`;
    const assignedParagraphSelector = `${containerSelector} > :is(p, blockquote, ul, ol, pre), .article-body :is(p, blockquote, ul, ol, pre)[data-omi-paragraph-style-id=${selectorValue}]`;
    const paragraphSelector = definition.id === style.paragraphStyles.defaultStyleId
      ? `${assignedParagraphSelector}, .article-body .text-block:not([data-omi-paragraph-style-id]) > :is(p, blockquote, ul, ol, pre), .article-body :is(p, blockquote, ul, ol, pre)[data-omi-block-id]:not([data-omi-paragraph-style-id])`
      : assignedParagraphSelector;
    const keepRules = target === 'print'
      ? [
          resolved.keepTogether
            ? 'break-inside: avoid-page; page-break-inside: avoid;'
            : '',
          resolved.keepWithNext
            ? 'break-after: avoid-page; page-break-after: avoid;'
            : '',
        ].filter(Boolean).join(' ')
      : '';
    return `${paragraphSelector} { font-family: ${cssFontFamily(resolved.fontFamily, style.fonts.body.fallback)}; font-size: ${finite(resolved.fontSize, 10.5)}pt; line-height: ${finite(resolved.lineHeight, 12.5)}pt; font-weight: ${finite(resolved.fontWeight, 400)}; font-style: ${fontStyle(resolved.fontStyle)}; text-align: ${alignment(resolved.alignment)}; text-indent: ${finite(resolved.firstLineIndent, 0)}mm; margin-top: ${finite(resolved.spaceBefore, 0)}pt; margin-bottom: ${finite(resolved.spaceAfter, 0)}pt; margin-left: ${finite(resolved.leftIndent, 0)}mm; margin-right: ${finite(resolved.rightIndent, 0)}mm; -webkit-hyphens: ${resolved.hyphenation ? 'auto' : 'none'}; hyphens: ${resolved.hyphenation ? 'auto' : 'none'}; widows: ${integer(resolved.widows, 2)}; orphans: ${integer(resolved.orphans, 2)}; ${keepRules} }\n${containerSelector} { ${keepRules} }`;
  }).join('\n');
}

function publicationHyphenationCss(enabled: boolean): string {
  const value = enabled ? 'auto' : 'none';
  const moduleOverride = enabled
    ? '\n[data-omi-hyphenation-module] { -webkit-hyphens: manual; hyphens: manual; }'
    : '';
  return `.article-body p, .article-body li, .article-body blockquote, .abstract p, .article-abstract p, .abstract-body, figcaption, table caption, td, th, .article-notes li, .footnotes li, [role="doc-endnotes"] li, .bibliography p, .bibliography li, .references li { -webkit-hyphens: ${value}; hyphens: ${value}; }${moduleOverride}`;
}

function publicationHyphenationEnabled(style: PublicationStyle): boolean {
  return Boolean(style.styles.body.hyphenation) || style.paragraphStyles.items.some(
    (definition) => resolvePublicationParagraphStyle(style, definition.id).hyphenation,
  );
}

function nonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function integer(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.trunc(finite(value, fallback)));
}

function alignment(value: string): 'left' | 'center' | 'right' | 'justify' {
  return value === 'center' || value === 'right' || value === 'justify'
    ? value
    : 'left';
}

function fontStyle(value: string): 'normal' | 'italic' {
  return value === 'italic' ? 'italic' : 'normal';
}

export function withPublicationStyleCss(
  html: string,
  style: PublicationStyle,
  target: PublicationStyleTarget,
): string {
  const css = buildPublicationStyleCss(style, target);
  return html.replace('</head>', `  <style data-omi-publication-style="${target}">\n${css}\n  </style>\n</head>`);
}

export function withPrintRunningHeader(
  html: string,
  manuscript: Pick<OmiManuscript, 'title' | 'updatedAt'>,
  style: PublicationStyle,
  identity: PublicationPublisherIdentity = loadPublicationPublisherIdentity(),
): string {
  if (!style.runningHeaders.enabled) return html;
  const values = {
    articleTitle: manuscript.title,
    shortArticleTitle: shortenText(manuscript.title, 72),
    journalTitle: identity.journalTitle || style.name,
    volume: identity.issue.volume,
    issue: identity.issue.number,
    year: identity.issue.year || manuscript.updatedAt.slice(0, 4),
  };
  const family = cssFontFamily(style.fonts.body.family, style.fonts.body.fallback);
  const rule = style.runningHeaders.rule.enabled
    ? `border-bottom: ${style.runningHeaders.rule.width}pt solid currentColor;`
    : '';
  const declarations = `font-family: ${family}; font-size: ${style.runningHeaders.fontSize}pt; vertical-align: bottom; padding-bottom: 1.5mm; ${rule}`;
  const firstPageRule = style.firstPage.showRunningHeader
    ? ''
    : `
@page:first {
  @top-left { content: none; }
  @top-right { content: none; }
}`;
  const headerCss = `
@page:left {
  @top-left { content: ${runningHeaderCssContent(style.runningHeaders.even.left, values)}; ${declarations} }
  @top-right { content: ${runningHeaderCssContent(style.runningHeaders.even.right, values)}; text-align: right; ${declarations} }
}
@page:right {
  @top-left { content: ${runningHeaderCssContent(style.runningHeaders.odd.left, values)}; ${declarations} }
  @top-right { content: ${runningHeaderCssContent(style.runningHeaders.odd.right, values)}; text-align: right; ${declarations} }
}${firstPageRule}
`;
  return html.replace(
    '</head>',
    `  <style data-omi-print-running-headers>${headerCss}</style>\n</head>`,
  );
}

export function withPublisherIdentity(
  html: string,
  manuscript: OmiManuscript,
  target: PublicationStyleTarget,
  identity: PublicationPublisherIdentity = loadPublicationPublisherIdentity(),
): string {
  const showBranding = target === 'print'
    ? identity.display.firstPageBranding && identity.branding.logo.showInPdf
    : identity.display.htmlArticleBranding && identity.branding.logo.showInHtml;
  const showLegal = target === 'print'
    ? identity.display.firstPageLegalBlock
    : identity.display.htmlLegalFooter;

  let result = html;
  if (showBranding && identity.branding.logo.enabled && identity.branding.logo.src.trim()) {
    const maxWidth = Math.max(1, identity.branding.logo.maxWidthMm);
    const logo = `<div class="omi-publisher-branding" data-omi-publisher-branding><img class="omi-publisher-logo" src="${escapeHtml(identity.branding.logo.src.trim())}" alt="${escapeHtml(identity.branding.logo.alt)}" style="max-width:${maxWidth}mm"></div>`;
    result = result.replace('<body>', `<body>\n  ${logo}`);
  }

  if (showLegal) {
    const legal = renderPublisherLegalBlock(manuscript, identity);
    if (legal) result = result.replace('</body>', `  ${legal}\n</body>`);
  }
  return result;
}

function renderPublisherLegalBlock(
  manuscript: OmiManuscript,
  identity: PublicationPublisherIdentity,
): string {
  const year = identity.issue.year.trim() || manuscript.updatedAt.slice(0, 4);
  const lines: string[] = [];

  if (identity.legal.copyright.enabled) {
    const copyright = fillPublisherTemplate(identity.legal.copyright.template, {
      year,
      journalTitle: identity.journalTitle,
      copyrightHolder: identity.legal.copyright.copyrightHolder || identity.publisherName || identity.journalTitle,
    });
    if (copyright.trim()) lines.push(`<p class="omi-publisher-copyright">${escapeHtml(copyright)}</p>`);
  }

  if (identity.legal.license.enabled && identity.legal.license.label.trim()) {
    const label = escapeHtml(identity.legal.license.label.trim());
    const url = identity.legal.license.url.trim();
    lines.push(`<p class="omi-publisher-license">${url ? `<a href="${escapeHtml(url)}">${label}</a>` : label}</p>`);
  }

  const identifiers = [
    identity.identifiers.issn.trim() ? `ISSN ${identity.identifiers.issn.trim()}` : '',
    identity.identifiers.eissn.trim() ? `eISSN ${identity.identifiers.eissn.trim()}` : '',
  ].filter(Boolean);
  if (identity.display.showIssn && identifiers.length) {
    lines.push(`<p class="omi-publisher-identifiers">${escapeHtml(identifiers.join(' · '))}</p>`);
  }

  if (identity.display.showWebsite && identity.website.trim()) {
    const website = identity.website.trim();
    lines.push(`<p class="omi-publisher-website"><a href="${escapeHtml(website)}">${escapeHtml(website)}</a></p>`);
  }

  if (!lines.length) return '';
  return `<footer class="omi-publisher-legal" data-omi-publisher-legal>${lines.join('')}</footer>`;
}

function fillPublisherTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_match, key: string) => values[key] ?? '');
}

export async function renderStyleBasedHtml(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile,
  target: PublicationStyleTarget,
): Promise<string> {
  const style = loadPublicationStyle();
  const identity = loadPublicationPublisherIdentity();
  const renderingManuscript = target === 'print'
    ? applyPublicationCorrectionsForRendering(manuscript)
    : manuscript;
  const rendered = renderPublisherHtmlArticle(renderingManuscript, profile);
  // Keep DOM parsing confined to the semantic article produced by our HTML
  // renderer. Publication-style and publisher values can originate in local
  // storage or an imported IDML package, so add them only after hyphenation.
  let html = rendered.html;
  if (target === 'print' && publicationHyphenationEnabled(style)) {
    html = await hyphenatePrintHtml(html, manuscript.locale);
  }
  html = withPublicationStyleCss(html, style, target);
  if (target === 'print') {
    html = withPublicationCorrectionCss(
      html,
      manuscript.publicationCorrections ?? [],
    );
  }
  html = withPublisherIdentity(html, manuscript, target, identity);
  if (target === 'print') html = withPrintRunningHeader(html, manuscript, style, identity);
  return target === 'print' ? inlineManuscriptAssets(html, manuscript) : html;
}

/** Returns a print-only clone containing inline correction characters. */
export function applyPublicationCorrectionsForRendering(
  manuscript: OmiManuscript,
): OmiManuscript {
  const corrections = manuscript.publicationCorrections ?? [];
  if (!corrections.length) return manuscript;
  const byBlock = new Map<string, OmiPublicationCorrection[]>();
  for (const correction of corrections) {
    const group = byBlock.get(correction.targetBlockId) ?? [];
    group.push(correction);
    byBlock.set(correction.targetBlockId, group);
  }

  const mapBlocks = (blocks: readonly OmiBlock[]): OmiBlock[] => blocks.map((block) => {
    const blockCorrections = byBlock.get(block.id) ?? [];
    return {
      ...block,
      content: applyPublicationCorrectionsToStoredContent(
        block.content,
        blockCorrections,
      ),
      ...(block.children ? { children: mapBlocks(block.children) } : {}),
    };
  });

  return {
    ...manuscript,
    sections: manuscript.sections.map((section) => ({
      ...section,
      title: applyTextPublicationCorrections(
        section.title,
        byBlock.get(`${section.id}--heading`) ?? [],
      ),
      blocks: mapBlocks(section.blocks),
    })),
  };
}

export function withPublicationCorrectionCss(
  html: string,
  corrections: readonly OmiPublicationCorrection[],
): string {
  const rules = corrections.flatMap((correction) => {
    const syntheticHeading = correction.targetBlockId.endsWith('--heading');
    const selector = syntheticHeading
      ? `[data-omi-section-id=${cssStringLiteral(correction.targetBlockId.slice(0, -'--heading'.length))}] > :is(h1, h2, h3, h4, h5, h6):first-child`
      : `[data-omi-block-id=${cssStringLiteral(correction.targetBlockId)}]`;
    if (correction.kind === 'page-break-before') {
      return `${selector} { break-before: page; page-break-before: always; }`;
    }
    if (correction.kind === 'keep-together') {
      return `${selector} { break-inside: avoid-page; page-break-inside: avoid; }`;
    }
    if (correction.kind === 'keep-with-next') {
      return `${selector} { break-after: avoid-page; page-break-after: avoid; }`;
    }
    return [];
  });
  if (!rules.length) return html;
  return html.replace(
    '</head>',
    `  <style data-omi-publication-corrections>\n${rules.join('\n')}\n  </style>\n</head>`,
  );
}

async function inlineManuscriptAssets(html: string, manuscript: OmiManuscript): Promise<string> {
  let result = html;
  for (const asset of manuscript.assets ?? []) {
    const bytes = await getAssetPayload(manuscript.id, asset.id);
    if (!bytes) continue;
    const dataUrl = `data:${asset.mediaType};base64,${bytesToBase64(bytes)}`;
    const path = assetPath(asset).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`(["'])${path}\\1`, 'g'), (_match, quote: string) => `${quote}${dataUrl}${quote}`);
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return window.btoa(binary);
}

function cssFontFamily(family: string, fallback: string): string {
  return `${cssStringLiteral(family)}, ${cssStringLiteral(fallback)}`;
}

function runningHeaderCssContent(
  template: string,
  values: Record<string, string>,
): string {
  const pageMarker = '\u0000omi-page-number\u0000';
  const rendered = template
    .replace(
      /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g,
      (_match, key: string) => key === 'pageNumber' ? pageMarker : values[key] ?? '',
    )
    .replace(/\s*\/\s*(?=\()/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!rendered) return 'none';

  const parts = rendered.split(pageMarker);
  const content: string[] = [];
  parts.forEach((part, index) => {
    if (part) content.push(cssContentString(part));
    if (index < parts.length - 1) content.push('counter(page)');
  });
  return content.join(' ') || 'none';
}

function cssContentString(value: string): string {
  return cssStringLiteral(value);
}

function shortenText(value: string, maximumLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maximumLength - 1)).trimEnd()}…`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
