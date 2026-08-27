import publisherJson from '../document/publicationStyles/egyhaztorteneti-szemle.publisher.json';
import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { assetPath } from '../model/assets';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { getAssetPayload } from './assetRepository';
import { renderPublisherHtmlArticle } from './exportPublisherHtmlPackage';

export type PublicationStyle = typeof templateJson;
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
    return saved ? (JSON.parse(saved) as PublicationStyle) : clonePublicationStyleTemplate();
  } catch {
    return clonePublicationStyleTemplate();
  }
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
.article-body p { font-size: ${body.fontSize}pt; line-height: ${body.lineHeight}pt; text-align: ${body.alignment}; text-indent: ${body.firstLineIndent}mm; margin: ${body.spaceBefore}pt 0 ${body.spaceAfter}pt; hyphens: ${body.hyphenation ? 'auto' : 'none'}; }
.article-body h2 { font-size: ${heading1.fontSize}pt; line-height: ${heading1.lineHeight}pt; font-weight: ${heading1.fontWeight}; text-align: ${heading1.alignment}; margin: ${heading1.spaceBefore}pt 0 ${heading1.spaceAfter}pt; }
.article-body h3 { font-size: ${heading2.fontSize}pt; line-height: ${heading2.lineHeight}pt; font-weight: ${heading2.fontWeight}; text-align: ${heading2.alignment}; margin: ${heading2.spaceBefore}pt 0 ${heading2.spaceAfter}pt; }
figure { margin-left: 0; margin-right: 0; }
figcaption { font-size: ${figureCaption.fontSize}pt; line-height: ${figureCaption.lineHeight}pt; text-align: ${figureCaption.alignment}; margin: ${figureCaption.spaceBefore}pt 0 ${figureCaption.spaceAfter}pt; }
table caption { font-size: ${tableCaption.fontSize}pt; line-height: ${tableCaption.lineHeight}pt; text-align: ${tableCaption.alignment}; margin: ${tableCaption.spaceBefore}pt 0 ${tableCaption.spaceAfter}pt; }
.article-notes, .footnotes, [role="doc-endnotes"] { font-family: ${noteFamily}; font-size: ${footnote.fontSize}pt; line-height: ${footnote.lineHeight}pt; }
.bibliography p, .references li { font-size: ${bibliography.fontSize}pt; line-height: ${bibliography.lineHeight}pt; text-align: ${bibliography.alignment}; padding-left: ${bibliography.hangingIndent}mm; text-indent: -${bibliography.hangingIndent}mm; }
img, svg, table { max-width: 100%; }
`;

  if (target === 'html') {
    return `${shared}
body { padding: 2rem max(1rem, calc((100vw - 56rem) / 2)); }
.omi-print-running-header, .omi-print-page-number { display: none !important; }
*, *::before, *::after { break-before: auto !important; break-after: auto !important; page-break-before: auto !important; page-break-after: auto !important; }
.omi-scholarly-article, section, figure, table, .article-notes { break-inside: auto; page-break-inside: auto; }
`;
  }

  const margins = style.page.margins;
  const separator = style.footnotes.separator;
  return `${shared}
@page {
  size: ${style.page.width}mm ${style.page.height}mm;
  margin: ${margins.top}mm ${margins.outer}mm ${margins.bottom}mm ${margins.inner}mm;
}
@page:left { margin-left: ${margins.outer}mm; margin-right: ${margins.inner}mm; }
@page:right { margin-left: ${margins.inner}mm; margin-right: ${margins.outer}mm; }
html, body { width: auto; min-height: 0; }
body { padding: 0; }
.omi-scholarly-article { width: auto; }
.article-body h2, .article-body h3 { break-after: avoid-page; page-break-after: avoid; }
figure, table { break-inside: avoid-page; page-break-inside: avoid; }
.article-notes, .footnotes { border-top: ${separator.enabled ? `${separator.width}pt solid currentColor` : '0'}; padding-top: 2mm; }
.omi-print-running-header { display: flex; position: fixed; top: -11mm; left: 0; right: 0; align-items: center; justify-content: space-between; gap: 8mm; font-family: ${family}; font-size: ${style.runningHeaders.fontSize}pt; border-bottom: ${style.runningHeaders.rule.enabled ? `${style.runningHeaders.rule.width}pt solid currentColor` : '0'}; padding-bottom: 1.5mm; }
.omi-print-page-number::after { content: counter(page); }
@media screen { body { background: #e9e9e9; } .omi-scholarly-article { box-sizing: border-box; width: ${style.page.width}mm; min-height: ${style.page.height}mm; margin: 12mm auto; padding: ${margins.top}mm ${margins.outer}mm ${margins.bottom}mm ${margins.inner}mm; background: white; box-shadow: 0 2mm 7mm rgba(0,0,0,.18); } .omi-print-running-header { display: none; } }
@media print { .omi-print-running-header { display: flex; } }
`;
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
  _manuscript: Pick<OmiManuscript, 'title'>,
  style: PublicationStyle,
): string {
  if (!style.runningHeaders.enabled) return html;
  return html.replace(
    '<body>',
    '<body>\n  <div class="omi-print-running-header" aria-hidden="true"><span data-omi-running-header-left></span><span><span data-omi-running-header-right></span> · <span class="omi-print-page-number"></span></span></div>',
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
  const rendered = renderPublisherHtmlArticle(manuscript, profile);
  let html = withPublicationStyleCss(rendered.html, style, target);
  html = withPublisherIdentity(html, manuscript, target, identity);
  if (target === 'print') html = withPrintRunningHeader(html, manuscript, style);
  return target === 'print' ? inlineManuscriptAssets(html, manuscript) : html;
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
  const escapedFamily = family.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedFallback = fallback.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escapedFamily}", "${escapedFallback}"`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
