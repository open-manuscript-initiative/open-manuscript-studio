import { normalizePublicationTableStyles, type PublicationTableStyles } from '../model/tableAppearancePresets';
import { publicationFirstPageNumber } from '../model/publicationSpreads';
import { inlinePublicationArtifactImages } from './publicationHtmlArtifact';
import { TABLE_LAYOUT_CSS } from './tableLayoutCss';
import { buildPublicationPageStylesCss } from './publicationPageStyleCss';
import publisherJson from '../document/publicationStyles/egyhaztorteneti-szemle.publisher.json' with { type: 'json' };
import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json' with { type: 'json' };
import {
  applyPublicationCorrectionsToStoredContent,
  applyTextPublicationCorrections,
} from '../model/proofing';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import { PUBLICATION_BODY_START, type PublicationPageStyleCollection } from '../model/publicationPageStyles';
import { getAppliedPublicationTemplate } from '../model/publicationTemplates';
import type {
  OmiBlock,
  OmiManuscript,
  OmiPublicationCorrection,
  OmiCitationStyleId,
} from '../types/omi';
import { AUTHOR_FONT_FALLBACKS, cssStringLiteral } from './embeddedCss';
import { renderPublisherHtmlArticle } from './exportPublisherHtmlPackage';
import { hyphenatePrintHtml } from './printHyphenation';
import { CITATION_STYLE_CATALOG } from '../model/cslRendering';
import { EXPORT_TEXT_ROLE_SELECTORS, LIVE_TEXT_ROLE_SELECTORS, withPublicationTextRoles, type PublicationTextRole } from '../model/publicationTextRoles';
import {
  normalizePublicationParagraphStyleCollection,
  mergePublicationParagraphStyleProperties,
  resolvePublicationParagraphStyle as resolveParagraphStyle,
  type PublicationParagraphStyleCollection,
  type ResolvedPublicationParagraphStyle,
} from '../model/publicationParagraphStyles';

type PublicationStyleTemplate = typeof templateJson;
export type PublicationStyle = Omit<PublicationStyleTemplate, 'paragraphStyles' | 'page'> & {
  page: PublicationStyleTemplate['page'] & { facingPages?: boolean };
  paragraphStyles: PublicationParagraphStyleCollection;
  noteCitationStyles?: { first?: OmiCitationStyleId; subsequent?: OmiCitationStyleId };
  pageStyles?: PublicationPageStyleCollection;
  tableStyles?: PublicationTableStyles;
  /** Presentation-only: let named publication styles override saved author fonts. */
  overrideAuthorFonts?: boolean;
};
export type PublicationPublisherIdentity = typeof publisherJson;
export type PublicationStyleTarget = 'html' | 'print';

export const PUBLICATION_STYLE_STORAGE_KEY = 'omi:publication-style:egyhaztorteneti-szemle';
export const PUBLICATION_PUBLISHER_STORAGE_KEY = 'omi:publication-publisher:egyhaztorteneti-szemle';

export function clonePublicationStyleTemplate(): PublicationStyle {
  const style = JSON.parse(JSON.stringify(templateJson)) as PublicationStyle;
  style.paragraphStyles = withPublicationTextRoles(style.paragraphStyles);
  return style;
}

export function clonePublicationPublisherTemplate(): PublicationPublisherIdentity {
  return JSON.parse(JSON.stringify(publisherJson)) as PublicationPublisherIdentity;
}

export function loadPublicationStyle(manuscript?: Pick<OmiManuscript, 'extensions'>): PublicationStyle {
  try {
    const applied = manuscript && getAppliedPublicationTemplate(manuscript);
    if (applied?.style) return normalizePublicationStyle(structuredClone(applied.style));
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
    ...(style.overrideAuthorFonts === true ? { overrideAuthorFonts: true } : {}),
    page: {
      ...fallback.page,
      ...style.page,
      facingPages: style.page?.facingPages === true,
      pageNumberStart: publicationFirstPageNumber(style.page ?? fallback.page),
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
    paragraphStyles: withPublicationTextRoles(normalizePublicationParagraphStyleCollection(
      style.paragraphStyles,
      fallback.paragraphStyles,
    )),
    ...(style.tableStyles===undefined?{}:{tableStyles:normalizePublicationTableStyles(style.tableStyles)}),
    noteCitationStyles: {
      first: CITATION_STYLE_CATALOG.some((item) => item.id === style.noteCitationStyles?.first) ? style.noteCitationStyles?.first : undefined,
      subsequent: CITATION_STYLE_CATALOG.some((item) => item.id === style.noteCitationStyles?.subsequent) ? style.noteCitationStyles?.subsequent : undefined,
    },
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
    fontWeight: body.fontWeight,
    fontStyle: fontStyle(body.fontStyle),
    capitalization: 'normal',
    tracking: 0,
    kerning: 0,
    kerningMode: 'metrics',
    position: 'normal',
    noBreak: false,
    horizontalScale: 100,
    verticalScale: 100,
    baselineShift: 0,
    skew: 0,
    language: '',
    fillColor: 'currentColor',
    fillTint: 100,
    fillOverprint: false,
    characterStroke: {
      widthPt: 0,
      color: 'currentColor',
      tint: 100,
      overprint: false,
      miterLimit: 4,
      alignment: 'center',
    },
    alignment: body.alignment as ResolvedPublicationParagraphStyle['alignment'],
    firstLineIndent: body.firstLineIndent,
    leftIndent: 0,
    rightIndent: 0,
    lastLineIndent: 0,
    spaceBefore: body.spaceBefore,
    spaceAfter: body.spaceAfter,
    spaceBetweenSameStyle: 0,
    balanceRaggedLines: false,
    ignoreOpticalMargin: false,
    baselineGridAlignment: 'none',
    tabStops: [],
    ruleAbove: {
      enabled: false,
      widthPt: 0.5,
      style: 'solid',
      strokeName: '',
      color: 'currentColor',
      tint: 100,
      overprint: false,
      gapColor: 'transparent',
      gapTint: 100,
      gapOverprint: false,
      widthMode: 'column',
      offsetPt: 0,
      leftIndentMm: 0,
      rightIndentMm: 0,
      keepInFrame: false,
    },
    ruleBelow: {
      enabled: false,
      widthPt: 0.5,
      style: 'solid',
      strokeName: '',
      color: 'currentColor',
      tint: 100,
      overprint: false,
      gapColor: 'transparent',
      gapTint: 100,
      gapOverprint: false,
      widthMode: 'column',
      offsetPt: 0,
      leftIndentMm: 0,
      rightIndentMm: 0,
      keepInFrame: false,
    },
    border: {
      enabled: false,
      widthPt: 0.5,
      widths: { topPt: 0.5, rightPt: 0.5, bottomPt: 0.5, leftPt: 0.5 },
      style: 'solid',
      strokeName: '',
      color: 'currentColor',
      tint: 100,
      overprint: false,
      gapColor: 'transparent',
      gapTint: 100,
      gapOverprint: false,
      cap: 'butt',
      join: 'miter',
      corners: {
        topLeft: { radiusMm: 0, shape: 'square' },
        topRight: { radiusMm: 0, shape: 'square' },
        bottomRight: { radiusMm: 0, shape: 'square' },
        bottomLeft: { radiusMm: 0, shape: 'square' },
      },
      offsets: { topMm: 0, rightMm: 0, bottomMm: 0, leftMm: 0 },
      topEdgeReference: 'paragraph',
      bottomEdgeReference: 'paragraph',
      widthMode: 'column',
      displayAcrossFrames: false,
      mergeConsecutive: true,
    },
    shading: {
      enabled: false,
      color: 'transparent',
      tint: 100,
      overprint: false,
      corners: {
        topLeft: { radiusMm: 0, shape: 'square' },
        topRight: { radiusMm: 0, shape: 'square' },
        bottomRight: { radiusMm: 0, shape: 'square' },
        bottomLeft: { radiusMm: 0, shape: 'square' },
      },
      offsets: { topMm: 0, rightMm: 0, bottomMm: 0, leftMm: 0 },
      topEdgeReference: 'paragraph',
      bottomEdgeReference: 'paragraph',
      widthMode: 'column',
      clipToFrame: false,
      suppressInExport: false,
    },
    hyphenation: body.hyphenation,
    hyphenationSettings: {
      minimumWordLength: 5,
      minimumPrefix: 2,
      minimumSuffix: 2,
      maximumHyphens: 3,
      hyphenationZoneMm: 0,
      hyphenateCapitalizedWords: true,
      hyphenateLastWord: true,
      hyphenateAcrossColumns: true,
      preference: 50,
    },
    keepTogether: false,
    footnoteContinueOnNextPage: true,
    keepWithPrevious: false,
    keepWithNext: false,
    keepWithNextLines: 0,
    keepFirstLines: 0,
    keepLastLines: 0,
    startParagraph: 'anywhere',
    widows: 2,
    orphans: 2,
    justification: {
      wordSpacingMinimum: 80,
      wordSpacingDesired: 100,
      wordSpacingMaximum: 133,
      letterSpacingMinimum: 0,
      letterSpacingDesired: 0,
      letterSpacingMaximum: 0,
      glyphScalingMinimum: 100,
      glyphScalingDesired: 100,
      glyphScalingMaximum: 100,
      singleWordAlignment: 'justify',
      autoLeadingPercent: 120,
      composer: 'adobe-paragraph',
    },
    spanColumns: {
      mode: 'single',
      count: 1,
      insideGutterMm: 0,
      outsideGutterMm: 0,
    },
    dropCaps: {
      lines: 0,
      characters: 0,
      characterStyleId: '',
      alignLeftEdge: true,
      scaleForDescenders: false,
    },
    nestedStyles: [],
    nestedLineStyles: [],
    grepStyles: [],
    bulletsAndNumbering: {
      type: 'none',
      listName: '',
      level: 1,
      format: '',
      bulletCharacter: '•',
      numberExpression: '^#.^t',
      startAt: 1,
      restartAfterLevel: 0,
      leftIndentMm: 0,
      firstLineIndentMm: 0,
      tabPositionMm: 12.7,
      characterStyleId: '',
      alignment: 'left',
    },
    openType: {
      ligatures: true,
      titlingAlternates: false,
      swash: false,
      discretionaryLigatures: false,
      contextualAlternates: true,
      fractions: false,
      ordinals: false,
      slashedZero: false,
      figureStyle: 'default',
      positionalForm: 'general',
      stylisticSet: 0,
      stylisticSets: [],
    },
    underline: {
      enabled: false,
      weightPt: 0.5,
      offsetPt: 0,
      style: 'solid',
      strokeName: '',
      color: 'currentColor',
      tint: 100,
      overprint: false,
      gapColor: 'transparent',
      gapTint: 100,
      gapOverprint: false,
    },
    strikethrough: {
      enabled: false,
      weightPt: 0.5,
      offsetPt: 0,
      style: 'solid',
      strokeName: '',
      color: 'currentColor',
      tint: 100,
      overprint: false,
      gapColor: 'transparent',
      gapTint: 100,
      gapOverprint: false,
    },
    exportTagging: {
      htmlTag: 'p',
      epubTag: 'p',
      ariaRole: '',
      applyHtmlClass: true,
      cssClass: '',
      emitCss: true,
      splitDocument: false,
      emitTag: true,
      pdfTag: 'P',
    },
  };
}

export function resolvePublicationParagraphStyle(
  style: PublicationStyle,
  styleId?: string | null,
  documentLanguage = '',
): ResolvedPublicationParagraphStyle {
  const collection = { ...style.paragraphStyles, items: style.paragraphStyles.items.map((item) => ({ ...item, properties: { ...publicationRoleDefaults(style, item.role), ...item.properties } })) };
  let defaults = publicationParagraphStyleDefaults(style);
  const visited = new Set<string>();
  let inherited = collection.items.find((item) => item.id === styleId);
  while (inherited && !visited.has(inherited.id)) {
    visited.add(inherited.id);
    if (inherited.role === 'note-citation') {
      defaults = resolveParagraphStyle(collection, collection.items.find((item) => item.role === 'note')?.id, defaults);
      break;
    }
    inherited = collection.items.find((item) => item.id === inherited?.basedOnId);
  }
  const resolved = resolveParagraphStyle(
    collection,
    styleId,
    defaults,
  );
  return { ...resolved, language: resolved.language || documentLanguage };
}

function publicationRoleDefaults(style: PublicationStyle, role?: PublicationTextRole): import('../model/publicationParagraphStyles').PublicationParagraphStyleProperties {
  if (!role || role === 'body' || role === 'citation' || role === 'note-citation') return {};
  if (role === 'quote') return { fontStyle: 'italic', firstLineIndent: 0, leftIndent: 5, rightIndent: 5, spaceBefore: 4, spaceAfter: 4 };
  const keys = { title: 'articleTitlePrimary', subtitle: 'articleSubtitlePrimary', author: 'author', motto: 'epigraph', abstract: 'abstractBody', keywords: 'keywords', heading1: 'heading1', heading2: 'heading2', note: 'footnote', bibliography: 'bibliography', 'figure-caption': 'figureCaption', 'table-caption': 'tableCaption' } as const;
  const value = style.styles[keys[role]] as Record<string, unknown>;
  const properties: import('../model/publicationParagraphStyles').PublicationParagraphStyleProperties = { firstLineIndent: 0, leftIndent: 0, rightIndent: 0 };
  for (const key of ['fontSize', 'lineHeight', 'fontWeight', 'spaceBefore', 'spaceAfter', 'firstLineIndent'] as const) {
    if (typeof value?.[key] === 'number') properties[key] = value[key];
  }
  if (typeof value?.alignment === 'string') properties.alignment = alignment(value.alignment);
  if (typeof value?.fontStyle === 'string') properties.fontStyle = fontStyle(value.fontStyle);
  if (role === 'note') { properties.fontFamily = style.fonts.note.family; properties.alignment = 'left'; }
  if (role === 'bibliography' && typeof value?.hangingIndent === 'number') { properties.leftIndent = value.hangingIndent; properties.firstLineIndent = -value.hangingIndent; }
  if (role === 'motto') properties.fontStyle = 'italic';
  if (role === 'title' || role.startsWith('heading')) { properties.keepWithNext = true; properties.hyphenation = false; }
  return properties;
}

/** Citation typography is sparse: unset values inherit the surrounding note text. */
export function publicationInlineStyleProperties(style: PublicationStyle, id: string): import('../model/publicationParagraphStyles').PublicationParagraphStyleProperties {
  const visited = new Set<string>();
  function collect(styleId: string | null): import('../model/publicationParagraphStyles').PublicationParagraphStyleProperties {
    if (!styleId || visited.has(styleId)) return {};
    visited.add(styleId);
    const item = style.paragraphStyles.items.find((definition) => definition.id === styleId);
    return item ? mergePublicationParagraphStyleProperties(collect(item.basedOnId), item.properties) : {};
  }
  return collect(id);
}

export function publicationNoteCitationRules(style: PublicationStyle, rules: OmiPublicationProfile['rules']['citations']): OmiPublicationProfile['rules']['citations'] {
  return { ...rules, noteFirstStyle: style.noteCitationStyles?.first ?? rules.noteFirstStyle ?? rules.style,
    noteSubsequentStyle: style.noteCitationStyles?.subsequent ?? rules.noteSubsequentStyle ?? style.noteCitationStyles?.first ?? rules.noteFirstStyle ?? rules.style };
}

/** The same role-to-style mapping drives live pages and both export targets. */
export function buildPublicationTextRoleCss(style: PublicationStyle, target: PublicationStyleTarget, documentLanguage = '', liveScope?: string, scale = 1): string {
  const selectors = liveScope ? LIVE_TEXT_ROLE_SELECTORS : EXPORT_TEXT_ROLE_SELECTORS;
  const point = (value: number) => liveScope ? `${finite(value, 10) * 96 / 72 * scale}px` : `${finite(value, 10)}pt`;
  return style.paragraphStyles.items.filter((item) => item.role && item.role !== 'body').map((item) => {
    const inline = item.role === 'citation' || item.role === 'note-citation';
    const resolved = resolvePublicationParagraphStyle(style, item.id, documentLanguage);
    const sparse = inline ? publicationInlineStyleProperties(style, item.id) : resolved;
    const advanced = inline
      ? mergePublicationParagraphStyleProperties(publicationParagraphStyleDefaults(style), sparse) as ResolvedPublicationParagraphStyle : resolved;
    if (inline && !sparse.openType) advanced.openType = {};
    const rules = [
      sparse.fontFamily !== undefined ? `font-family:${cssFontFamily(sparse.fontFamily, style.fonts.body.fallback)};--omi-publication-primary-font:${cssStringLiteral(sparse.fontFamily)}` : '',
      sparse.fontSize !== undefined ? `font-size:${point(sparse.fontSize)}` : '',
      sparse.lineHeight !== undefined ? `line-height:${point(sparse.lineHeight)}` : '',
      sparse.fontWeight !== undefined ? `font-weight:${finite(sparse.fontWeight, 400)}` : '',
      sparse.fontStyle !== undefined ? `font-style:${fontStyle(sparse.fontStyle)}` : '',
      sparse.fillColor !== undefined ? `color:${cssColorValue(sparse.fillColor, 'currentColor')}` : '',
      sparse.language ? `-webkit-locale:${cssStringLiteral(sparse.language)}` : '',
      sparse.capitalization ? `font-variant-caps:${sparse.capitalization === 'small-caps' ? 'small-caps' : 'normal'};text-transform:${sparse.capitalization === 'all-caps' ? 'uppercase' : 'none'}` : '',
      !inline ? `text-align:${alignment(resolved.alignment, target)};text-indent:${point(resolved.firstLineIndent * 72 / 25.4)};margin-left:${point(resolved.leftIndent * 72 / 25.4)};margin-right:${point(resolved.rightIndent * 72 / 25.4)};margin-top:${point(resolved.spaceBefore)};margin-bottom:${point(resolved.spaceAfter)};hyphens:${target === 'print' && resolved.hyphenation ? 'auto' : 'none'}` : '',
      !inline && target === 'print' && resolved.keepWithNext ? 'break-after:avoid' : '',
      extendedParagraphStyleCss(advanced, target),
    ].filter(Boolean).join(';');
    const selector = selectors[item.role!].map((selector) => `${liveScope ?? '.omi-scholarly-article'} ${selector}`).join(', ');
    return selector && rules ? `${selector} { ${rules}; }` : '';
  }).join('\n');
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

export function publicationAuthorFontOverrideCss(style: PublicationStyle, scope = ''): string {
  if (style.overrideAuthorFonts !== true) return '';
  const root = scope || ':root';
  const marked = scope ? scope + ' [data-omi-source-font]' : '[data-omi-source-font]';
  return [
    `${root} { --omi-publication-primary-font: ${cssStringLiteral(style.fonts.body.family)}; }`,
    `${marked} { font-family: var(--omi-publication-primary-font), var(--omi-author-font-family, ${cssStringLiteral(style.fonts.body.fallback)}), ${cssStringLiteral(style.fonts.body.fallback)}, ${AUTHOR_FONT_FALLBACKS} !important; }`,
  ].join('\n');
}

export function buildPublicationStyleCss(
  style: PublicationStyle,
  target: PublicationStyleTarget,
): string {
  const body = style.styles.body;
  const title = style.styles.articleTitlePrimary;
  const subtitle = style.styles.articleSubtitlePrimary;
  const author = style.styles.author;
  const authorGivenName = style.styles.authorGivenName;
  const authorFamilyName = style.styles.authorFamilyName;
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
body { font-family: var(--omi-publication-font); font-size: ${body.fontSize}pt; line-height: ${body.lineHeight}pt; font-weight: ${body.fontWeight}; font-style: ${fontStyle(body.fontStyle)}; }
.omi-scholarly-article { max-width: none; margin: 0 auto; }
.omi-publisher-branding { display: flex; justify-content: center; align-items: center; margin: 0 0 6mm; }
.omi-publisher-logo { display: block; height: auto; max-width: 100%; }
.omi-publisher-legal { margin-top: 8mm; padding-top: 2.5mm; border-top: .3pt solid currentColor; font-size: 8.5pt; line-height: 1.25; }
.omi-publisher-legal p { margin: 0 0 1mm; text-indent: 0; }
.omi-publisher-legal a { color: inherit; text-decoration: none; }
.article-front h1 { font-size: ${title.fontSize}pt; line-height: ${title.lineHeight}pt; font-weight: ${title.fontWeight}; text-align: ${alignment(title.alignment, target)}; margin: 0 0 ${title.spaceAfter}pt; }
.article-front .article-subtitle, .article-front .subtitle { font-size: ${subtitle.fontSize}pt; line-height: ${subtitle.lineHeight}pt; text-align: ${alignment(subtitle.alignment, target)}; margin: 0 0 ${subtitle.spaceAfter}pt; }
.article-front .contributor-name, .article-front .author, .article-front .author-name { font-size: ${author.fontSize}pt; line-height: ${author.lineHeight}pt; font-weight: ${author.fontWeight}; text-align: ${alignment(author.alignment, target)}; }
.article-front .author-given-name { font-weight: ${authorGivenName.fontWeight}; font-style: ${fontStyle(authorGivenName.fontStyle)}; font-variant-caps: ${fontVariantCaps(authorGivenName.fontVariantCaps)}; text-transform: ${textTransform(authorGivenName.textTransform)}; }
.article-front .author-family-name { font-weight: ${authorFamilyName.fontWeight}; font-style: ${fontStyle(authorFamilyName.fontStyle)}; font-variant-caps: ${fontVariantCaps(authorFamilyName.fontVariantCaps)}; text-transform: ${textTransform(authorFamilyName.textTransform)}; }
.article-front .affiliation { font-size: ${affiliation.fontSize}pt; line-height: ${affiliation.lineHeight}pt; text-align: ${alignment(affiliation.alignment, target)}; margin-bottom: ${affiliation.spaceAfter}pt; }
.abstract h2, .abstract-title { font-size: ${abstractHeading.fontSize}pt; line-height: ${abstractHeading.lineHeight}pt; text-align: ${alignment(abstractHeading.alignment, target)}; margin: ${abstractHeading.spaceBefore}pt 0 ${abstractHeading.spaceAfter}pt; }
.abstract p, .article-abstract p { font-size: ${abstractBody.fontSize}pt; line-height: ${abstractBody.lineHeight}pt; text-align: ${alignment(abstractBody.alignment, target)}; text-indent: ${abstractBody.firstLineIndent}mm; }
.article-body p { font-size: ${body.fontSize}pt; line-height: ${body.lineHeight}pt; text-align: ${alignment(body.alignment, target)}; text-indent: ${body.firstLineIndent}mm; margin: ${body.spaceBefore}pt 0 ${body.spaceAfter}pt; }
.article-body h2 { font-size: ${heading1.fontSize}pt; line-height: ${heading1.lineHeight}pt; font-weight: ${heading1.fontWeight}; text-align: ${alignment(heading1.alignment, target)}; margin: ${heading1.spaceBefore}pt 0 ${heading1.spaceAfter}pt; }
.article-body h3 { font-size: ${heading2.fontSize}pt; line-height: ${heading2.lineHeight}pt; font-weight: ${heading2.fontWeight}; text-align: ${alignment(heading2.alignment, target)}; margin: ${heading2.spaceBefore}pt 0 ${heading2.spaceAfter}pt; }
figure { margin-left: 0; margin-right: 0; }
figcaption { font-size: ${figureCaption.fontSize}pt; line-height: ${figureCaption.lineHeight}pt; text-align: ${alignment(figureCaption.alignment, target)}; margin: ${figureCaption.spaceBefore}pt 0 ${figureCaption.spaceAfter}pt; }
table caption { font-size: ${tableCaption.fontSize}pt; line-height: ${tableCaption.lineHeight}pt; text-align: ${alignment(tableCaption.alignment, target)}; margin: ${tableCaption.spaceBefore}pt 0 ${tableCaption.spaceAfter}pt; }
.article-notes, .footnotes, [role="doc-endnotes"], .omi-page-footnote { font-family: ${noteFamily}; --omi-publication-primary-font: ${cssStringLiteral(style.fonts.note.family)}; font-size: ${footnote.fontSize}pt; line-height: ${footnote.lineHeight}pt; }
.bibliography p, .references li { font-size: ${bibliography.fontSize}pt; line-height: ${bibliography.lineHeight}pt; text-align: ${alignment(bibliography.alignment, target)}; padding-left: ${bibliography.hangingIndent}mm; text-indent: -${bibliography.hangingIndent}mm; }
img, svg, table { max-width: 100%; }
${paragraphStyleRules}
${TABLE_LAYOUT_CSS}
${buildPublicationTextRoleCss(style, target)}
${publicationAuthorFontOverrideCss(style)}
`;

  if (target === 'html') {
    return `${shared}
${publicationHyphenationCss(false)}
body { padding: 2rem max(1rem, calc((100vw - 56rem) / 2)); }
.article-body, .manuscript-section-body { text-align: ${alignment(body.alignment, target)}; }
.omi-publication-matter-page[style*="text-align:justify"], .omi-matter-frame-content[style*="text-align:justify"] { text-align:left !important; }
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
  const pageNumberStart = publicationFirstPageNumber(style.page);
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
${resolvePublicationParagraphStyle(style, style.paragraphStyles.items.find((item) => item.role === 'note')?.id).footnoteContinueOnNextPage === false ? '.omi-page-footnote { break-inside: avoid-page; page-break-inside: avoid; }' : ''}
.article-notes, .footnotes { border-top: ${separator.enabled ? `${separator.width}pt solid currentColor` : '0'}; padding-top: 2mm; }
@page { @footnote { border-top: ${separator.enabled ? `${separator.width}pt solid currentColor` : '0'}; padding-top: 2mm; } }
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
  return style.paragraphStyles.items.filter((item) => item.role !== 'citation' && item.role !== 'note-citation').map((definition) => {
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
          resolved.keepWithPrevious
            ? 'break-before: avoid-page; page-break-before: avoid;'
            : '',
        ].filter(Boolean).join(' ')
      : '';
    const extraRules: string[] = [];
    const firstLetterSelectors = paragraphSelector
      .split(',')
      .map((selector) => `${selector.trim()}::first-letter`)
      .join(', ');
    if ((resolved.dropCaps.lines ?? 0) > 1 && (resolved.dropCaps.characters ?? 0) > 0) {
      extraRules.push(
        `${firstLetterSelectors} { float: left; font-size: ${Math.max(1, finite(resolved.dropCaps.lines, 1))}em; line-height: .82; margin-right: .12em; }`,
      );
    }
    if (finite(resolved.spaceBetweenSameStyle, 0) !== 0) {
      extraRules.push(
        `${containerSelector} + ${containerSelector} > :is(p, blockquote, ul, ol, pre) { margin-top: ${finite(resolved.spaceBetweenSameStyle, 0)}pt; }`,
      );
    }
    return [
      `${paragraphSelector} { font-family: ${cssFontFamily(resolved.fontFamily, style.fonts.body.fallback)}; --omi-publication-primary-font: ${cssStringLiteral(resolved.fontFamily)}; font-size: ${finite(resolved.fontSize, 10.5)}pt; line-height: ${finite(resolved.lineHeight, 12.5)}pt; font-weight: ${finite(resolved.fontWeight, 400)}; font-style: ${fontStyle(resolved.fontStyle)}; text-align: ${alignment(resolved.alignment, target)}; text-indent: ${finite(resolved.firstLineIndent, 0)}mm; margin-top: ${finite(resolved.spaceBefore, 0)}pt; margin-bottom: ${finite(resolved.spaceAfter, 0)}pt; margin-left: ${finite(resolved.leftIndent, 0)}mm; margin-right: ${finite(resolved.rightIndent, 0)}mm; color: ${cssColorValue(resolved.fillColor, 'currentColor')}; -webkit-hyphens: ${target === 'print' && resolved.hyphenation ? 'auto' : 'none'}; hyphens: ${target === 'print' && resolved.hyphenation ? 'auto' : 'none'}; widows: ${integer(resolved.widows, 2)}; orphans: ${integer(resolved.orphans, 2)}; ${keepRules} ${extendedParagraphStyleCss(resolved, target)} }`,
      `${containerSelector} { ${keepRules} }`,
      ...extraRules,
    ].join('\n');
  }).join('\n');
}


function extendedParagraphStyleCss(
  resolved: ResolvedPublicationParagraphStyle,
  target: PublicationStyleTarget,
): string {
  const declarations: string[] = [];
  const tracking = finite(resolved.tracking, 0);
  if (tracking !== 0) {
    declarations.push('letter-spacing: ' + (tracking / 1000) + 'em;');
  }

  if (resolved.capitalization === 'small-caps') {
    declarations.push('font-variant-caps: small-caps;');
  } else if (resolved.capitalization === 'all-caps') {
    declarations.push('text-transform: uppercase;');
  }

  if (resolved.noBreak) declarations.push('white-space: nowrap;');
  if (resolved.language) declarations.push(`-webkit-locale:${cssStringLiteral(resolved.language)};`);
  if (resolved.balanceRaggedLines) declarations.push('text-wrap: balance;');

  if (resolved.position === 'superscript' || resolved.position === 'superior') {
    declarations.push('font-variant-position: super;');
  } else if (resolved.position === 'subscript' || resolved.position === 'inferior') {
    declarations.push('font-variant-position: sub;');
  }
  if (finite(resolved.baselineShift, 0) !== 0) {
    declarations.push('position: relative;');
    declarations.push('top: ' + (-finite(resolved.baselineShift, 0)) + 'pt;');
  }

  const strokeWidth = Math.max(0, finite(resolved.characterStroke.widthPt, 0));
  if (strokeWidth > 0) {
    declarations.push('-webkit-text-stroke-width: ' + strokeWidth + 'pt;');
    declarations.push(
      '-webkit-text-stroke-color: '
      + cssColorValue(resolved.characterStroke.color, 'currentColor')
      + ';',
    );
  }

  const decorations: string[] = [];
  if (resolved.underline.enabled) decorations.push('underline');
  if (resolved.strikethrough.enabled) decorations.push('line-through');
  if (decorations.length) {
    declarations.push('text-decoration-line: ' + decorations.join(' ') + ';');
    const decoration = resolved.underline.enabled
      ? resolved.underline
      : resolved.strikethrough;
    declarations.push(
      'text-decoration-color: '
      + cssColorValue(decoration.color, 'currentColor')
      + ';',
    );
    declarations.push(
      'text-decoration-thickness: '
      + Math.max(0, finite(decoration.weightPt, 0.5))
      + 'pt;',
    );
    declarations.push(
      'text-decoration-style: '
      + cssBorderStyle(decoration.style)
      + ';',
    );
    if (resolved.underline.enabled) {
      declarations.push(
        'text-underline-offset: '
        + finite(resolved.underline.offsetPt, 0)
        + 'pt;',
      );
    }
  }

  const border = resolved.border;
  if (border.enabled) {
    const widths = border.widths;
    declarations.push(
      'border-style: '
      + cssBorderStyle(border.style)
      + ';',
    );
    declarations.push(
      'border-color: '
      + cssColorValue(border.color, 'currentColor')
      + ';',
    );
    declarations.push(
      'border-width: '
      + Math.max(0, finite(widths?.topPt, border.widthPt ?? 0.5))
      + 'pt '
      + Math.max(0, finite(widths?.rightPt, border.widthPt ?? 0.5))
      + 'pt '
      + Math.max(0, finite(widths?.bottomPt, border.widthPt ?? 0.5))
      + 'pt '
      + Math.max(0, finite(widths?.leftPt, border.widthPt ?? 0.5))
      + 'pt;',
    );
    const corners = border.corners;
    declarations.push(
      'border-radius: '
      + Math.max(0, finite(corners?.topLeft?.radiusMm, 0))
      + 'mm '
      + Math.max(0, finite(corners?.topRight?.radiusMm, 0))
      + 'mm '
      + Math.max(0, finite(corners?.bottomRight?.radiusMm, 0))
      + 'mm '
      + Math.max(0, finite(corners?.bottomLeft?.radiusMm, 0))
      + 'mm;',
    );
  }

  const shading = resolved.shading;
  if (shading.enabled && !(target === 'print' && shading.suppressInExport)) {
    declarations.push(
      'background-color: '
      + cssColorValue(shading.color, 'transparent')
      + ';',
    );
  }

  if (border.enabled || shading.enabled) {
    const offsets = border.enabled ? border.offsets : shading.offsets;
    declarations.push(
      'padding: '
      + finite(offsets?.topMm, 0) + 'mm '
      + finite(offsets?.rightMm, 0) + 'mm '
      + finite(offsets?.bottomMm, 0) + 'mm '
      + finite(offsets?.leftMm, 0) + 'mm;',
    );
    declarations.push('box-decoration-break: clone; -webkit-box-decoration-break: clone;');
  }

  const openTypeFeatures = [
    ['liga', resolved.openType.ligatures],
    ['dlig', resolved.openType.discretionaryLigatures],
    ['calt', resolved.openType.contextualAlternates],
    ['frac', resolved.openType.fractions],
    ['ordn', resolved.openType.ordinals],
    ['zero', resolved.openType.slashedZero],
    ['titl', resolved.openType.titlingAlternates],
    ['swsh', resolved.openType.swash],
  ]
    .filter((entry) => typeof entry[1] === 'boolean')
    .map((entry) => '"' + entry[0] + '" ' + (entry[1] ? '1' : '0'));

  for (const set of resolved.openType.stylisticSets ?? []) {
    if (Number.isInteger(set) && set >= 1 && set <= 20) {
      openTypeFeatures.push('"ss' + String(set).padStart(2, '0') + '" 1');
    }
  }
  if (openTypeFeatures.length) {
    declarations.push(
      'font-feature-settings: '
      + openTypeFeatures.join(', ')
      + ';',
    );
  }
  const numericVariant = cssFontVariantNumeric(resolved.openType.figureStyle);
  if (numericVariant) declarations.push('font-variant-numeric: ' + numericVariant + ';');

  if (resolved.spanColumns.mode === 'span') {
    declarations.push('column-span: all;');
  }

  if (target === 'print') {
    const breakBefore = cssBreakBefore(resolved.startParagraph);
    if (breakBefore) declarations.push('break-before: ' + breakBefore + ';');
  }

  return declarations.join(' ');
}

function cssColorValue(
  value: string | undefined,
  fallback: 'currentColor' | 'transparent',
): string {
  const normalized = (value ?? '').trim();
  const lower = normalized.toLowerCase();
  if (!normalized) return fallback;
  if (lower === 'currentcolor' || lower === 'text color' || lower === 'black') {
    return lower === 'black' ? '#000' : 'currentColor';
  }
  if (
    lower === 'transparent'
    || lower === 'none'
    || lower === '[none]'
  ) return 'transparent';
  if (lower === 'paper' || lower === '[paper]') return '#fff';
  if (/^#[0-9a-f]{3,8}$/i.test(normalized)) return normalized;
  if (/^[a-z]+$/i.test(normalized)) return normalized;
  if (
    /^(rgb|rgba|hsl|hsla)\([0-9.,%+\-\s]+\)$/i.test(normalized)
  ) return normalized;
  return fallback;
}

function cssFontVariantNumeric(value: string | undefined): string {
  if (value === 'lining-proportional') return 'lining-nums proportional-nums';
  if (value === 'lining-tabular') return 'lining-nums tabular-nums';
  if (value === 'oldstyle-proportional') return 'oldstyle-nums proportional-nums';
  if (value === 'oldstyle-tabular') return 'oldstyle-nums tabular-nums';
  return '';
}

function cssBorderStyle(value: string | undefined): string {
  if (value === 'dashed' || value === 'dotted' || value === 'double') {
    return value;
  }
  return 'solid';
}

function cssBreakBefore(value: string | undefined): string {
  if (value === 'next-column') return 'column';
  if (value === 'next-page') return 'page';
  if (value === 'next-odd-page') return 'right';
  if (value === 'next-even-page') return 'left';
  return '';
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

function alignment(value: string, target: PublicationStyleTarget = 'print'): 'left' | 'center' | 'right' | 'justify' {
  if (target === 'html' && value === 'justify') return 'left';
  return value === 'center' || value === 'right' || value === 'justify'
    ? value
    : 'left';
}

function fontStyle(value: string): 'normal' | 'italic' {
  return value === 'italic' ? 'italic' : 'normal';
}

function fontVariantCaps(value: string): 'normal' | 'small-caps' {
  return value === 'small-caps' ? 'small-caps' : 'normal';
}

function textTransform(value: string): 'none' | 'uppercase' {
  return value === 'uppercase' ? 'uppercase' : 'none';
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
  manuscript: Pick<OmiManuscript, 'title' | 'updatedAt'> & Partial<Pick<OmiManuscript, 'sections'>>,
  style: PublicationStyle,
  identity: PublicationPublisherIdentity = loadPublicationPublisherIdentity(),
): string {
  if (!style.runningHeaders.enabled && !style.pageStyles) return html;
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
  const beforeBody = html.split('<article class="omi-scholarly-article"')[0] ?? '';
  const bodyPageOffset = (beforeBody.match(/<section class="omi-publication-matter-page"/g) ?? []).length;
  const headerCss = `
@page:left {
  @top-left { content: ${style.runningHeaders.enabled ? runningHeaderCssContent(style.runningHeaders.even.left, values) : 'none'}; ${declarations} }
  @top-right { content: ${style.runningHeaders.enabled ? runningHeaderCssContent(style.runningHeaders.even.right, values) : 'none'}; text-align: right; ${declarations} }
}
@page:right {
  @top-left { content: ${style.runningHeaders.enabled ? runningHeaderCssContent(style.runningHeaders.odd.left, values) : 'none'}; ${declarations} }
  @top-right { content: ${style.runningHeaders.enabled ? runningHeaderCssContent(style.runningHeaders.odd.right, values) : 'none'}; text-align: right; ${declarations} }
}${firstPageRule}
`;
  return html.replace(
    '</head>',
    `  <style data-omi-print-running-headers>${headerCss}\n${buildPublicationPageStylesCss(style, manuscript.sections ?? [], manuscript.title, identity, manuscript.updatedAt.slice(0, 4), bodyPageOffset)}</style>\n</head>`,
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
  context?: { style: PublicationStyle; identity: PublicationPublisherIdentity; embedAssets?: boolean },
): Promise<string> {
  const style = normalizePublicationStyle(context?.style ?? loadPublicationStyle(manuscript));
  const appliedTemplate = getAppliedPublicationTemplate(manuscript);
  const identity = context?.identity ?? (appliedTemplate && appliedTemplate.source !== 'document-style'
    ? templatePublisherIdentity(manuscript, profile, appliedTemplate.association ?? '')
    : loadPublicationPublisherIdentity());
  const renderingManuscript = target === 'print'
    ? applyPublicationCorrectionsForRendering(manuscript)
    : manuscript;
  const rendered = renderPublisherHtmlArticle(renderingManuscript, { ...profile, rules: { ...profile.rules, citations: publicationNoteCitationRules(style, profile.rules.citations) }, publicationStyle: style }, {
    noteLayout: target === 'print' ? 'paged' : undefined,
  });
  const fatal = rendered.diagnostics.filter(item => item.severity === 'error' && (target !== 'print' || item.code !== 'profile-does-not-support-html'));
  if (fatal.length) throw new Error(fatal.map(item => item.message).join('\n'));
  // Keep DOM parsing confined to the semantic article produced by our HTML
  // renderer. Publication-style and publisher values can originate in local
  // storage or an imported IDML package, so add them only after hyphenation.
  let html = withPublicationTextRoleLanguages(rendered.html, style, manuscript.locale);
  if (target === 'print' && publicationHyphenationEnabled(style)) {
    html = await hyphenatePrintHtml(html, manuscript.locale, (element) => {
      const id = element.closest('[data-omi-paragraph-style-id]')?.getAttribute('data-omi-paragraph-style-id');
      const role = element.closest('[data-omi-text-role]')?.getAttribute('data-omi-text-role');
      const paragraph = resolvePublicationParagraphStyle(style, id ?? style.paragraphStyles.items.find((item) => item.role === role)?.id, manuscript.locale);
      return { enabled: paragraph.hyphenation && !paragraph.noBreak, language: paragraph.language || manuscript.locale };
    });
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
  if (target === 'print') html = withInsertedPublicationPages(html, style);
  return target === 'print' || context?.embedAssets
    ? inlinePublicationArtifactImages(html, manuscript, target === 'print' ? 48 * 1024 * 1024 : 8 * 1024 * 1024, target === 'print')
    : html;
}

/** Stable block anchors keep deliberate empty pages out of the scholarly text. */
/** Locate complete rendered block elements, including nested tables/SVG. This
 * only places trusted blank-page markup; it does not filter or rewrite HTML. */
export function withInsertedPublicationPages(html: string, style: PublicationStyle): string {
  const insertions = style.pageStyles?.insertions ?? [];
  if (!insertions.length) return html;
  const positions = new Map<string, { before: number; after: number }>();
  const stack: { name: string; id?: string; before: number }[] = [];
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const tokens = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  for (const match of html.matchAll(tokens)) {
    if (!match[1]) continue;
    const tag = match[0], name = match[1].toLowerCase(), before = match.index!;
    if (name === 'article' && !tag.startsWith('</') && /\bclass="[^"]*\bomi-scholarly-article\b[^"]*"/.test(tag)) {
      positions.set(PUBLICATION_BODY_START, { before: before + tag.length, after: before + tag.length });
    }
    if (tag.startsWith('</')) {
      let index = stack.length - 1;
      while (index >= 0 && stack[index]!.name !== name) index -= 1;
      if (index < 0) continue;
      const [item] = stack.splice(index);
      if (item?.id && !positions.has(item.id)) positions.set(item.id, { before: item.before, after: before + tag.length });
    } else {
      const id = tag.match(/\bdata-omi-block-id="([^"]+)"/i)?.[1];
      if (voids.has(name) || /\/\s*>$/.test(tag)) {
        if (id && !positions.has(id)) positions.set(id, { before, after: before + tag.length });
      } else stack.push({ name, id, before });
    }
  }
  const additions = new Map<number, string[]>();
  for (const insertion of insertions) {
    const anchor = insertion.beforeBlockId ?? insertion.afterBlockId;
    const position = anchor ? positions.get(escapeHtml(anchor)) : undefined;
    if (!position) continue;
    const offset = insertion.afterBlockId ? position.after : position.before;
    const nodes = additions.get(offset) ?? [];
    nodes.push(`<div class="omi-inserted-publication-page" data-omi-inserted-page="${escapeHtml(insertion.id)}" aria-hidden="true">&#160;</div>`);
    additions.set(offset, nodes);
  }
  for (const [offset, nodes] of [...additions].sort((a, b) => b[0] - a[0])) html = html.slice(0, offset) + nodes.join('\n') + html.slice(offset);
  return html;
}

function withPublicationTextRoleLanguages(html: string, style: PublicationStyle, language: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const originalLanguageNodes = new Set(doc.querySelectorAll('[lang]'));
  for (const definition of style.paragraphStyles.items) {
    if (!definition.role || definition.role === 'body') continue;
    const selectors = EXPORT_TEXT_ROLE_SELECTORS[definition.role];
    if (!selectors.length) continue;
    const resolved = resolvePublicationParagraphStyle(style, definition.id, language);
    const roleLanguage = definition.role === 'citation' || definition.role === 'note-citation'
      ? publicationInlineStyleProperties(style, definition.id).language : resolved.language;
    for (const element of doc.querySelectorAll(selectors.join(', '))) {
      element.setAttribute('data-omi-text-role', definition.role);
      if (!originalLanguageNodes.has(element) && roleLanguage) element.setAttribute('lang', roleLanguage);
    }
  }
  for (const element of doc.querySelectorAll('[data-omi-paragraph-style-id], .article-body')) {
    const resolved = resolvePublicationParagraphStyle(style, element.getAttribute('data-omi-paragraph-style-id'), language);
    if (!originalLanguageNodes.has(element) && resolved.language) element.setAttribute('lang', resolved.language);
  }
  return `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
}

/** A portable template must not inherit another device's active journal brand. */
export function templatePublisherIdentity(manuscript: OmiManuscript, profile: OmiPublicationProfile, association: string): PublicationPublisherIdentity {
  const identity = clonePublicationPublisherTemplate();
  identity.id = profile.id;
  identity.journalTitle = association;
  identity.journalShortTitle = association;
  identity.publisherName = manuscript.titleMatter?.publisherName ?? profile.publisher ?? '';
  identity.publisherAddress = ''; identity.contactEmail = '';
  identity.website = profile.branding?.website ?? '';
  identity.identifiers.issn = manuscript.titleMatter?.issn ?? '';
  identity.identifiers.eissn = manuscript.titleMatter?.eissn ?? '';
  identity.branding.logo.enabled = Boolean(profile.branding?.logoDataUrl);
  identity.branding.logo.src = profile.branding?.logoDataUrl ?? '';
  identity.branding.logo.alt = profile.branding?.logoAlt ?? association;
  // Legal statements belong to the captured imprint/profile, not the old brand.
  identity.legal.copyright.enabled = false;
  identity.legal.copyright.copyrightHolder = '';
  identity.legal.license.enabled = false;
  return identity;
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
